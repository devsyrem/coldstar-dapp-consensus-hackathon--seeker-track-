//! FFI bridge for the Coldstar wallet backend.
//!
//! Exposes a JSON-based API that the Capacitor/Android layer calls
//! via JNI or C-ABI. Each function takes a JSON string and returns
//! a JSON string, keeping the FFI boundary simple.

use std::ffi::{CStr, CString};
use std::os::raw::c_char;

use coldstar_core::sign_request::SignRequest;
use coldstar_core::wallet::EncryptedWallet;
use coldstar_session::manager::InitSessionRequest;
use serde::{Deserialize, Serialize};

mod state;

use state::AppState;

// ─── JSON API types ───

#[derive(Serialize)]
struct JsonResult {
    success: bool,
    data: Option<serde_json::Value>,
    error: Option<String>,
}

impl JsonResult {
    fn ok(data: serde_json::Value) -> String {
        serde_json::to_string(&Self {
            success: true,
            data: Some(data),
            error: None,
        })
        .unwrap_or_else(|_| r#"{"success":false,"error":"serialization failed"}"#.to_string())
    }

    fn err(msg: &str) -> String {
        serde_json::to_string(&Self {
            success: false,
            data: None,
            error: Some(msg.to_string()),
        })
        .unwrap_or_else(|_| r#"{"success":false,"error":"serialization failed"}"#.to_string())
    }
}

// ─── C-ABI exports ───

/// Initialize the backend with RPC and API configuration.
///
/// Input JSON: `{"rpc_endpoint": "...", "rugcheck_url": "...", "rugcheck_key": "...", "network": "..."}`
#[unsafe(no_mangle)]
pub extern "C" fn coldstar_init(config_json: *const c_char) -> *mut c_char {
    let result = std::panic::catch_unwind(|| {
        let config_str = unsafe { CStr::from_ptr(config_json) }
            .to_str()
            .unwrap_or("{}");

        #[derive(Deserialize)]
        struct InitConfig {
            rpc_endpoint: String,
            rugcheck_url: String,
            rugcheck_key: String,
            network: Option<String>,
        }

        let config: InitConfig = match serde_json::from_str(config_str) {
            Ok(c) => c,
            Err(e) => return JsonResult::err(&format!("Invalid config: {e}")),
        };

        let network = config.network.unwrap_or_else(|| "solana-mainnet".to_string());

        let state = AppState::new(
            &config.rpc_endpoint,
            &config.rugcheck_url,
            &config.rugcheck_key,
            &network,
        );

        // Store in global state
        let mut global = state::GLOBAL_STATE.lock().unwrap();
        *global = Some(state);

        JsonResult::ok(serde_json::json!({"initialized": true, "network": network}))
    });

    let response = result.unwrap_or_else(|_| JsonResult::err("panic during init"));
    CString::new(response).unwrap().into_raw()
}

/// Initialize a session (X25519 key exchange).
///
/// Input JSON: `{"mobile_pubkey": [u8; 32], "challenge": [u8; 32]}`
#[unsafe(no_mangle)]
pub extern "C" fn coldstar_init_session(request_json: *const c_char) -> *mut c_char {
    let result = std::panic::catch_unwind(|| {
        let request_str = unsafe { CStr::from_ptr(request_json) }
            .to_str()
            .unwrap_or("{}");

        let request: InitSessionRequest = match serde_json::from_str(request_str) {
            Ok(r) => r,
            Err(e) => return JsonResult::err(&format!("Invalid request: {e}")),
        };

        let mut global = state::GLOBAL_STATE.lock().unwrap();
        let state = match global.as_mut() {
            Some(s) => s,
            None => return JsonResult::err("Backend not initialized"),
        };

        match state.session_manager.handle_init(&request) {
            Ok(ack) => JsonResult::ok(serde_json::to_value(&ack).unwrap()),
            Err(e) => JsonResult::err(&e.to_string()),
        }
    });

    let response = result.unwrap_or_else(|_| JsonResult::err("panic during session init"));
    CString::new(response).unwrap().into_raw()
}

/// Sign a transaction.
///
/// Input JSON: SignRequest + `{"pin": "123456", "wallet": EncryptedWallet}`
#[unsafe(no_mangle)]
pub extern "C" fn coldstar_sign(request_json: *const c_char) -> *mut c_char {
    let result = std::panic::catch_unwind(|| {
        let request_str = unsafe { CStr::from_ptr(request_json) }
            .to_str()
            .unwrap_or("{}");

        #[derive(Deserialize)]
        struct SignInput {
            request: SignRequest,
            wallet: EncryptedWallet,
            pin: String,
        }

        let input: SignInput = match serde_json::from_str(request_str) {
            Ok(i) => i,
            Err(e) => return JsonResult::err(&format!("Invalid sign input: {e}")),
        };

        let mut global = state::GLOBAL_STATE.lock().unwrap();
        let state = match global.as_mut() {
            Some(s) => s,
            None => return JsonResult::err("Backend not initialized"),
        };

        let response = state
            .signing_pipeline
            .handle_sign(&input.request, &input.wallet, input.pin.as_bytes());

        JsonResult::ok(serde_json::to_value(&response).unwrap())
    });

    let response = result.unwrap_or_else(|_| JsonResult::err("panic during signing"));
    CString::new(response).unwrap().into_raw()
}

/// Get wallet balance (SOL + tokens). Async, runs on a Tokio runtime.
///
/// Input JSON: `{"pubkey": "base58..."}`
#[unsafe(no_mangle)]
pub extern "C" fn coldstar_get_balance(request_json: *const c_char) -> *mut c_char {
    let result = std::panic::catch_unwind(|| {
        let request_str = unsafe { CStr::from_ptr(request_json) }
            .to_str()
            .unwrap_or("{}");

        #[derive(Deserialize)]
        struct BalanceRequest {
            pubkey: String,
        }

        let req: BalanceRequest = match serde_json::from_str(request_str) {
            Ok(r) => r,
            Err(e) => return JsonResult::err(&format!("Invalid request: {e}")),
        };

        let global = state::GLOBAL_STATE.lock().unwrap();
        let state = match global.as_ref() {
            Some(s) => s,
            None => return JsonResult::err("Backend not initialized"),
        };

        let rt = tokio::runtime::Runtime::new().unwrap();
        match rt.block_on(state.solana_client.get_wallet_balance(&req.pubkey)) {
            Ok(balance) => JsonResult::ok(serde_json::to_value(&balance).unwrap()),
            Err(e) => JsonResult::err(&e.to_string()),
        }
    });

    let response = result.unwrap_or_else(|_| JsonResult::err("panic during balance fetch"));
    CString::new(response).unwrap().into_raw()
}

/// Check token safety via RugCheck.
///
/// Input JSON: `{"mint": "base58..."}`
#[unsafe(no_mangle)]
pub extern "C" fn coldstar_check_token(request_json: *const c_char) -> *mut c_char {
    let result = std::panic::catch_unwind(|| {
        let request_str = unsafe { CStr::from_ptr(request_json) }
            .to_str()
            .unwrap_or("{}");

        #[derive(Deserialize)]
        struct TokenCheckRequest {
            mint: String,
        }

        let req: TokenCheckRequest = match serde_json::from_str(request_str) {
            Ok(r) => r,
            Err(e) => return JsonResult::err(&format!("Invalid request: {e}")),
        };

        let global = state::GLOBAL_STATE.lock().unwrap();
        let state = match global.as_ref() {
            Some(s) => s,
            None => return JsonResult::err("Backend not initialized"),
        };

        let rt = tokio::runtime::Runtime::new().unwrap();
        match rt.block_on(state.rugcheck_client.get_token_report(&req.mint)) {
            Ok(report) => JsonResult::ok(serde_json::to_value(&report).unwrap()),
            Err(e) => JsonResult::err(&e.to_string()),
        }
    });

    let response = result.unwrap_or_else(|_| JsonResult::err("panic during token check"));
    CString::new(response).unwrap().into_raw()
}

/// Generate a new wallet keypair and return it encrypted.
///
/// The private key is generated in Rust secure memory, encrypted with
/// Argon2id + AES-256-GCM, and the plaintext is zeroized before return.
/// The encrypted container is safe to write to USB storage.
///
/// Input JSON: `{"pin": "123456", "label": "My Wallet"}`
/// Output JSON: `{"public_key": "base58...", "wallet": EncryptedWallet}`
#[unsafe(no_mangle)]
pub extern "C" fn coldstar_generate_wallet(request_json: *const c_char) -> *mut c_char {
    let result = std::panic::catch_unwind(|| {
        let request_str = unsafe { CStr::from_ptr(request_json) }
            .to_str()
            .unwrap_or("{}");

        #[derive(Deserialize)]
        struct GenerateRequest {
            pin: String,
            label: Option<String>,
        }

        let req: GenerateRequest = match serde_json::from_str(request_str) {
            Ok(r) => r,
            Err(e) => return JsonResult::err(&format!("Invalid request: {e}")),
        };

        // Generate Ed25519 keypair — private key in secure memory
        use coldstar_crypto::{ed25519, kdf, aes};

        // Generate random 32-byte seed for Ed25519
        let mut secret_key = [0u8; 32];
        use rand::RngCore;
        rand::rngs::OsRng.fill_bytes(&mut secret_key);

        // Derive public key from secret
        let public_key_bytes = ed25519::public_key_from_secret(&secret_key);

        // Encode public key as base58
        let public_key = bs58::encode(&public_key_bytes).into_string();

        // Generate random salt for KDF
        let mut kdf_salt = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut kdf_salt);

        // Derive AES-256 key from PIN using Argon2id
        let mut aes_key = match kdf::derive_key_from_pin(req.pin.as_bytes(), &kdf_salt) {
            Ok(k) => k,
            Err(e) => return JsonResult::err(&format!("KDF failed: {e}")),
        };

        // Encrypt the secret key with AES-256-GCM
        let blob = match aes::encrypt(&aes_key, &secret_key) {
            Ok(b) => b,
            Err(e) => {
                // Zeroize keys before returning on error
                aes::secure_clear(&mut aes_key);
                aes::secure_clear(&mut secret_key);
                return JsonResult::err(&format!("Encryption failed: {e}"));
            }
        };

        // CRITICAL: Zeroize plaintext key and derived key immediately
        aes::secure_clear(&mut aes_key);
        aes::secure_clear(&mut secret_key);

        // Build wallet ID
        let wallet_id = format!("wallet-{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs());

        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        // Build the EncryptedWallet container (matches coldstar USB format)
        let encrypted_wallet = EncryptedWallet {
            version: 1,
            wallet_id: wallet_id.clone(),
            public_key: public_key.clone(),
            kdf_salt: kdf_salt.to_vec(),
            encrypted_secret_key: blob.to_bytes(),
            created_at,
            label: req.label,
        };

        JsonResult::ok(serde_json::json!({
            "public_key": public_key,
            "wallet_id": wallet_id,
            "wallet": serde_json::to_value(&encrypted_wallet).unwrap(),
        }))
    });

    let response = result.unwrap_or_else(|_| JsonResult::err("panic during wallet generation"));
    CString::new(response).unwrap().into_raw()
}

/// Free a string allocated by coldstar_* functions.
#[unsafe(no_mangle)]
pub extern "C" fn coldstar_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}

// ─── JNI bridge for Android ───

/// JNI wrapper for `coldstar_generate_wallet`.
///
/// Called from Java as:
///   `private native String nativeGenerateWallet(String pinJson);`
/// in class `com.coldstar.plugins.ColdstarUSBPlugin`.
#[unsafe(no_mangle)]
pub extern "system" fn Java_com_coldstar_plugins_ColdstarUSBPlugin_nativeGenerateWallet(
    mut env: jni::JNIEnv,
    _obj: jni::objects::JObject,
    pin_json: jni::objects::JString,
) -> jni::sys::jstring {
    let input: String = match env.get_string(&pin_json) {
        Ok(s) => s.into(),
        Err(_) => {
            let err = JsonResult::err("Failed to read JNI string");
            return env.new_string(err).expect("JNI new_string").into_raw();
        }
    };

    let c_input = match CString::new(input) {
        Ok(c) => c,
        Err(_) => {
            let err = JsonResult::err("Input contains null byte");
            return env.new_string(err).expect("JNI new_string").into_raw();
        }
    };

    let result_ptr = coldstar_generate_wallet(c_input.as_ptr());
    let result_str = unsafe { CStr::from_ptr(result_ptr) }
        .to_str()
        .unwrap_or(r#"{"success":false,"error":"UTF-8 error"}"#);
    let jstring = env.new_string(result_str).expect("JNI new_string");

    // Free the C string allocated by coldstar_generate_wallet
    coldstar_free_string(result_ptr);

    jstring.into_raw()
}

