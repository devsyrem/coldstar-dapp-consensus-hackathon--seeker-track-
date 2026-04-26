use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("AES encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("AES decryption failed: ciphertext is invalid or PIN is wrong")]
    DecryptionFailed,

    #[error("KDF failed: {0}")]
    KdfFailed(String),

    #[error("Invalid key length: expected {expected}, got {got}")]
    InvalidKeyLength { expected: usize, got: usize },

    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Invalid public key")]
    InvalidPublicKey,

    #[error("Invalid secret key")]
    InvalidSecretKey,

    #[error("Random number generation failed")]
    RngFailed,
}
