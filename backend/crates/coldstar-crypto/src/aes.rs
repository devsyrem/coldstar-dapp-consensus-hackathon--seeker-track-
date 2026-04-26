use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, AeadCore, Key, Nonce,
};
use zeroize::Zeroize;

use crate::CryptoError;

/// AES-256-GCM nonce size (96 bits / 12 bytes).
const NONCE_SIZE: usize = 12;

/// Encrypted blob: [12-byte nonce | ciphertext+tag].
#[derive(Debug, Clone)]
pub struct EncryptedBlob {
    pub nonce: [u8; NONCE_SIZE],
    pub ciphertext: Vec<u8>,
}

impl EncryptedBlob {
    /// Serialize to contiguous bytes: nonce || ciphertext.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(NONCE_SIZE + self.ciphertext.len());
        out.extend_from_slice(&self.nonce);
        out.extend_from_slice(&self.ciphertext);
        out
    }

    /// Deserialize from contiguous bytes.
    pub fn from_bytes(data: &[u8]) -> Result<Self, CryptoError> {
        if data.len() < NONCE_SIZE + 16 {
            // Minimum: nonce + 16-byte AES-GCM tag
            return Err(CryptoError::DecryptionFailed);
        }
        let mut nonce = [0u8; NONCE_SIZE];
        nonce.copy_from_slice(&data[..NONCE_SIZE]);
        let ciphertext = data[NONCE_SIZE..].to_vec();
        Ok(Self { nonce, ciphertext })
    }
}

/// Encrypt plaintext with a 32-byte key using AES-256-GCM.
///
/// Returns an `EncryptedBlob` containing a random nonce and ciphertext.
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<EncryptedBlob, CryptoError> {
    let aes_key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(aes_key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    let mut nonce_arr = [0u8; NONCE_SIZE];
    nonce_arr.copy_from_slice(&nonce);

    Ok(EncryptedBlob {
        nonce: nonce_arr,
        ciphertext,
    })
}

/// Decrypt an `EncryptedBlob` with a 32-byte key.
///
/// Returns the plaintext. The caller is responsible for zeroizing
/// the returned bytes after use.
pub fn decrypt(key: &[u8; 32], blob: &EncryptedBlob) -> Result<Vec<u8>, CryptoError> {
    let aes_key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(aes_key);
    let nonce = Nonce::from_slice(&blob.nonce);

    cipher
        .decrypt(nonce, blob.ciphertext.as_ref())
        .map_err(|_| CryptoError::DecryptionFailed)
}

/// Convenience: decrypt from raw bytes (nonce || ciphertext).
pub fn decrypt_bytes(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let blob = EncryptedBlob::from_bytes(data)?;
    decrypt(key, &blob)
}

/// Securely zeroize a mutable byte slice.
pub fn secure_clear(data: &mut [u8]) {
    data.zeroize();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let key = [0x42u8; 32];
        let plaintext = b"solana private key material";

        let blob = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &blob).unwrap();
        assert_eq!(&decrypted, plaintext);
    }

    #[test]
    fn round_trip_via_bytes() {
        let key = [0xABu8; 32];
        let plaintext = b"test data";

        let blob = encrypt(&key, plaintext).unwrap();
        let serialized = blob.to_bytes();
        let decrypted = decrypt_bytes(&key, &serialized).unwrap();
        assert_eq!(&decrypted, plaintext);
    }

    #[test]
    fn wrong_key_fails() {
        let key = [0x42u8; 32];
        let wrong_key = [0x43u8; 32];
        let plaintext = b"secret";

        let blob = encrypt(&key, plaintext).unwrap();
        let result = decrypt(&wrong_key, &blob);
        assert!(result.is_err());
    }
}
