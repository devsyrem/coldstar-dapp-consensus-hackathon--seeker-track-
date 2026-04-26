use thiserror::Error;

#[derive(Debug, Error)]
pub enum RpcError {
    #[error("RPC request failed: {0}")]
    RequestFailed(String),

    #[error("RPC response error: {code} — {message}")]
    ResponseError { code: i64, message: String },

    #[error("Deserialization error: {0}")]
    DeserializationError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Transaction not found: {0}")]
    TransactionNotFound(String),

    #[error("Invalid address: {0}")]
    InvalidAddress(String),

    #[error("Rate limited — retry after {retry_after_ms}ms")]
    RateLimited { retry_after_ms: u64 },

    #[error("RugCheck API error: {0}")]
    RugCheckError(String),
}

impl From<reqwest::Error> for RpcError {
    fn from(e: reqwest::Error) -> Self {
        RpcError::NetworkError(e.to_string())
    }
}
