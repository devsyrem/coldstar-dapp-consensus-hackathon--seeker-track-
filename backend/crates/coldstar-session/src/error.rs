use thiserror::Error;

#[derive(Debug, Error)]
pub enum SessionError {
    #[error("No active session")]
    NoActiveSession,

    #[error("Session expired (lifetime: {lifetime_secs}s)")]
    SessionExpired { lifetime_secs: u64 },

    #[error("Session ID mismatch: expected {expected}, got {got}")]
    SessionIdMismatch { expected: String, got: String },

    #[error("Nonce already used (replay attempt)")]
    NonceReplay,

    #[error("Key exchange failed: {0}")]
    KeyExchangeFailed(String),

    #[error("Maximum sessions exceeded")]
    MaxSessionsExceeded,
}
