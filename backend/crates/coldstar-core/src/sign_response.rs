use serde::{Deserialize, Serialize};

/// Response from the device after a signing operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignResponse {
    /// Echoed request ID
    pub request_id: String,
    /// Result of the signing operation
    pub result: SignResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SignResult {
    /// Signing succeeded
    Success {
        /// 64-byte Ed25519 signature (as Vec for serde compatibility)
        signature: Vec<u8>,
        /// The signer's public key (32 bytes)
        signer_pubkey: [u8; 32],
    },
    /// User rejected the transaction on-device
    Rejected {
        reason: String,
    },
    /// Signing failed due to an error
    Error {
        code: SignErrorCode,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SignErrorCode {
    /// Session has expired or is invalid
    SessionInvalid,
    /// Nonce was already used (replay attempt)
    NonceReplay,
    /// Domain mismatch
    DomainMismatch,
    /// Public key not found on device
    KeyNotFound,
    /// PIN/decryption failed
    DecryptionFailed,
    /// Internal device error
    InternalError,
}
