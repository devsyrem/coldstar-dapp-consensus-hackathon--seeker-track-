use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Invalid transaction: {0}")]
    InvalidTransaction(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Nonce already used")]
    NonceReplay,

    #[error("Session expired")]
    SessionExpired,

    #[error("Domain mismatch: expected {expected}, got {got}")]
    DomainMismatch { expected: String, got: String },

    #[error("Public key mismatch")]
    PublicKeyMismatch,

    #[error("Crypto error: {0}")]
    Crypto(#[from] coldstar_crypto::CryptoError),
}
