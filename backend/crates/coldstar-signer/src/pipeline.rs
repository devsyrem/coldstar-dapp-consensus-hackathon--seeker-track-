use std::collections::HashSet;

use coldstar_core::{
    canonical::CanonicalMessage,
    sign_request::SignRequest,
    sign_response::{SignErrorCode, SignResponse, SignResult},
    wallet::EncryptedWallet,
};
use coldstar_crypto::{aes, ed25519, kdf};
use tracing::{info, warn};
use zeroize::Zeroize;

use crate::SignerError;

/// The device-side signing pipeline.
///
/// Implements the full verify → decrypt → sign → zeroize flow.
/// This struct runs on the USB device (or in the secure enclave emulation).
pub struct SigningPipeline {
    /// Set of already-used nonces to prevent replay.
    used_nonces: HashSet<[u8; 32]>,
    /// Expected network for domain verification.
    network: String,
}

impl SigningPipeline {
    pub fn new(network: &str) -> Self {
        Self {
            used_nonces: HashSet::new(),
            network: network.to_string(),
        }
    }

    /// Execute the full signing pipeline.
    ///
    /// Steps:
    /// 1. Verify nonce hasn't been used (anti-replay)
    /// 2. Build CanonicalMessage and verify domain
    /// 3. Verify the request's public key matches the wallet
    /// 4. Derive AES key from PIN via Argon2id
    /// 5. Decrypt the private key from the encrypted wallet
    /// 6. Sign the canonical message
    /// 7. Zeroize all secrets from memory
    /// 8. Return SignResponse
    pub fn handle_sign(
        &mut self,
        request: &SignRequest,
        wallet: &EncryptedWallet,
        pin: &[u8],
    ) -> SignResponse {
        let request_id = request.request_id.clone();

        match self.do_sign(request, wallet, pin) {
            Ok(signature) => {
                let pubkey_bytes = bs58::decode(&wallet.public_key)
                    .into_vec()
                    .unwrap_or_default();
                let mut signer_pubkey = [0u8; 32];
                if pubkey_bytes.len() == 32 {
                    signer_pubkey.copy_from_slice(&pubkey_bytes);
                }

                info!(request_id = %request_id, "Signing succeeded");
                SignResponse {
                    request_id,
                    result: SignResult::Success {
                        signature: signature.to_vec(),
                        signer_pubkey,
                    },
                }
            }
            Err(e) => {
                warn!(request_id = %request_id, error = %e, "Signing failed");
                let (code, message) = match &e {
                    SignerError::NonceReplay => {
                        (SignErrorCode::NonceReplay, e.to_string())
                    }
                    SignerError::DomainMismatch { .. } => {
                        (SignErrorCode::DomainMismatch, e.to_string())
                    }
                    SignerError::PublicKeyMismatch => {
                        (SignErrorCode::KeyNotFound, e.to_string())
                    }
                    SignerError::DecryptionFailed => {
                        (SignErrorCode::DecryptionFailed, e.to_string())
                    }
                    _ => (SignErrorCode::InternalError, e.to_string()),
                };
                SignResponse {
                    request_id,
                    result: SignResult::Error { code, message },
                }
            }
        }
    }

    fn do_sign(
        &mut self,
        request: &SignRequest,
        wallet: &EncryptedWallet,
        pin: &[u8],
    ) -> Result<[u8; 64], SignerError> {
        // Step 1: Anti-replay check
        if self.used_nonces.contains(&request.nonce) {
            return Err(SignerError::NonceReplay);
        }
        self.used_nonces.insert(request.nonce);

        // Step 2: Build canonical message and verify domain
        let canonical = CanonicalMessage::new(
            &request.network,
            request.nonce,
            &request.serialized_message,
        );

        if !canonical.verify_domain(&self.network) {
            return Err(SignerError::DomainMismatch {
                expected: self.network.clone(),
                got: request.network.clone(),
            });
        }

        // Step 3: Verify public key matches wallet
        if request.signer_pubkey != wallet.public_key {
            return Err(SignerError::PublicKeyMismatch);
        }

        // Step 4: Derive AES key from PIN
        let mut aes_key = kdf::derive_key_from_pin(pin, &wallet.kdf_salt)?;

        // Step 5: Decrypt private key
        let decrypt_result = aes::decrypt_bytes(&aes_key, &wallet.encrypted_secret_key);

        // Zeroize AES key immediately — we no longer need it
        kdf::zeroize_key(&mut aes_key);

        let mut secret_key_bytes = decrypt_result.map_err(|_| SignerError::DecryptionFailed)?;

        if secret_key_bytes.len() != 32 {
            secret_key_bytes.zeroize();
            return Err(SignerError::DecryptionFailed);
        }

        // Step 6: Sign the canonical message
        let signable = canonical.to_signable_bytes();
        let mut sk = [0u8; 32];
        sk.copy_from_slice(&secret_key_bytes);

        // Zeroize the Vec copy
        secret_key_bytes.zeroize();

        let signature = ed25519::sign(&sk, &signable)
            .map_err(|e| SignerError::SigningFailed(e.to_string()));

        // Step 7: Zeroize secret key from memory
        ed25519::zeroize_secret_key(&mut sk);

        signature
    }

    /// Clear the nonce set (call on session reset).
    pub fn reset_nonces(&mut self) {
        self.used_nonces.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use coldstar_core::tx_params::{TxMetadata, TxParams, TxType};
    use coldstar_crypto::{aes, kdf};

    fn create_test_wallet(pin: &[u8]) -> (EncryptedWallet, [u8; 32]) {
        let secret_key = [0x42u8; 32];
        let public_key = ed25519::public_key_from_secret(&secret_key);
        let salt = b"test-salt-16bytes".to_vec();
        let aes_key = kdf::derive_key_from_pin(pin, &salt).unwrap();
        let blob = aes::encrypt(&aes_key, &secret_key).unwrap();

        let wallet = EncryptedWallet {
            version: 1,
            wallet_id: "test-wallet".to_string(),
            public_key: bs58::encode(public_key).into_string(),
            kdf_salt: salt,
            encrypted_secret_key: blob.to_bytes(),
            created_at: 0,
            label: Some("Test Wallet".to_string()),
        };

        (wallet, public_key)
    }

    fn create_test_request(pubkey: &[u8; 32], nonce: [u8; 32]) -> SignRequest {
        SignRequest {
            request_id: "req-001".to_string(),
            session_id: "session-001".to_string(),
            nonce,
            signer_pubkey: bs58::encode(pubkey).into_string(),
            network: "solana-mainnet".to_string(),
            serialized_message: b"fake-solana-message".to_vec(),
            tx_params: TxParams {
                description: "Test transfer".to_string(),
                program_id: "11111111111111111111111111111111".to_string(),
                destination: Some("RecipientPubkey".to_string()),
                amount: Some(1_000_000_000),
                token_mint: None,
                token_symbol: None,
                token_decimals: None,
                network: "solana-mainnet".to_string(),
            },
            tx_metadata: TxMetadata {
                tx_type: TxType::SolTransfer,
                compute_units: Some(200_000),
                priority_fee: Some(5000),
                recent_blockhash: "FakeBlockHash".to_string(),
            },
        }
    }

    #[test]
    fn sign_happy_path() {
        let pin = b"123456";
        let (wallet, pubkey) = create_test_wallet(pin);
        let mut pipeline = SigningPipeline::new("solana-mainnet");

        let nonce = [0xAA; 32];
        let request = create_test_request(&pubkey, nonce);
        let response = pipeline.handle_sign(&request, &wallet, pin);

        match response.result {
            SignResult::Success { signature, signer_pubkey } => {
                assert_eq!(signer_pubkey, pubkey);
                assert_ne!(signature, vec![0u8; 64]);
            }
            other => panic!("Expected Success, got {:?}", other),
        }
    }

    #[test]
    fn nonce_replay_rejected() {
        let pin = b"123456";
        let (wallet, pubkey) = create_test_wallet(pin);
        let mut pipeline = SigningPipeline::new("solana-mainnet");

        let nonce = [0xBB; 32];
        let request = create_test_request(&pubkey, nonce);

        // First sign succeeds
        let r1 = pipeline.handle_sign(&request, &wallet, pin);
        assert!(matches!(r1.result, SignResult::Success { .. }));

        // Second sign with same nonce fails
        let r2 = pipeline.handle_sign(&request, &wallet, pin);
        match r2.result {
            SignResult::Error { code, .. } => assert_eq!(code, SignErrorCode::NonceReplay),
            other => panic!("Expected NonceReplay error, got {:?}", other),
        }
    }

    #[test]
    fn wrong_pin_rejected() {
        let (wallet, pubkey) = create_test_wallet(b"123456");
        let mut pipeline = SigningPipeline::new("solana-mainnet");

        let request = create_test_request(&pubkey, [0xCC; 32]);
        let response = pipeline.handle_sign(&request, &wallet, b"wrong-pin");

        match response.result {
            SignResult::Error { code, .. } => assert_eq!(code, SignErrorCode::DecryptionFailed),
            other => panic!("Expected DecryptionFailed, got {:?}", other),
        }
    }

    #[test]
    fn domain_mismatch_rejected() {
        let pin = b"123456";
        let (wallet, pubkey) = create_test_wallet(pin);
        let mut pipeline = SigningPipeline::new("solana-devnet");

        let request = create_test_request(&pubkey, [0xDD; 32]);
        let response = pipeline.handle_sign(&request, &wallet, pin);

        match response.result {
            SignResult::Error { code, .. } => assert_eq!(code, SignErrorCode::DomainMismatch),
            other => panic!("Expected DomainMismatch, got {:?}", other),
        }
    }
}
