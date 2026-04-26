use argon2::{self, Argon2, Algorithm, Params, Version};
use zeroize::Zeroize;

use crate::CryptoError;

/// Argon2id parameters for PIN → AES-256 key derivation.
/// Tuned for mobile devices: moderate memory, reasonable time.
const ARGON2_M_COST: u32 = 65536; // 64 MiB
const ARGON2_T_COST: u32 = 3; // 3 iterations
const ARGON2_P_COST: u32 = 1; // single-threaded on mobile
const KEY_LEN: usize = 32; // AES-256 key length

/// Derive a 32-byte AES-256 key from a PIN using Argon2id.
///
/// `pin` — the user's PIN (numeric string).
/// `salt` — a unique per-wallet salt (stored alongside the encrypted blob on USB).
///
/// Returns a 32-byte key suitable for AES-256-GCM.
pub fn derive_key_from_pin(pin: &[u8], salt: &[u8]) -> Result<[u8; 32], CryptoError> {
    let params = Params::new(ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST, Some(KEY_LEN))
        .map_err(|e| CryptoError::KdfFailed(e.to_string()))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(pin, salt, &mut key)
        .map_err(|e| CryptoError::KdfFailed(e.to_string()))?;

    Ok(key)
}

/// Securely wipe a derived key from memory.
pub fn zeroize_key(key: &mut [u8; 32]) {
    key.zeroize();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_key_deterministic() {
        let pin = b"123456";
        let salt = b"coldstar-wallet-salt-v1";

        let key1 = derive_key_from_pin(pin, salt).unwrap();
        let key2 = derive_key_from_pin(pin, salt).unwrap();
        assert_eq!(key1, key2);
    }

    #[test]
    fn different_pins_different_keys() {
        let salt = b"same-salt";
        let key1 = derive_key_from_pin(b"111111", salt).unwrap();
        let key2 = derive_key_from_pin(b"222222", salt).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn different_salts_different_keys() {
        let pin = b"123456";
        let key1 = derive_key_from_pin(pin, b"salt-aaaaaaaaaa").unwrap();
        let key2 = derive_key_from_pin(pin, b"salt-bbbbbbbbbb").unwrap();
        assert_ne!(key1, key2);
    }
}
