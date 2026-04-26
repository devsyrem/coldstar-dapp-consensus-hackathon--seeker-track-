use thiserror::Error;

#[derive(Debug, Error)]
pub enum SignerError {
    #[error("Session error: {0}")]
    SessionError(String),

    #[error("Nonce replay detected")]
    NonceReplay,

    #[error("Domain mismatch: expected {expected}, got {got}")]
    DomainMismatch { expected: String, got: String },

    #[error("Public key mismatch: request key does not match device key")]
    PublicKeyMismatch,

    #[error("Decryption failed — wrong PIN or corrupted key blob")]
    DecryptionFailed,

    #[error("Signing failed: {0}")]
    SigningFailed(String),

    #[error("Crypto error: {0}")]
    Crypto(#[from] coldstar_crypto::CryptoError),

    #[error("Core error: {0}")]
    Core(#[from] coldstar_core::CoreError),
}
