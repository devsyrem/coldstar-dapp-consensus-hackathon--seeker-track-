use serde::{Deserialize, Serialize};

/// A sign request sent from the mobile app to the device.
///
/// Contains the serialized Solana Message, transaction metadata, and
/// session binding (nonce). The device will:
/// 1. Verify the session nonce
/// 2. Build a CanonicalMessage from the data
/// 3. Display TxParams for user verification
/// 4. Decrypt the private key using the PIN
/// 5. Sign the CanonicalMessage
/// 6. Zeroize the key
/// 7. Return a SignResponse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignRequest {
    /// Unique request ID
    pub request_id: String,
    /// Session ID (from SessionAck)
    pub session_id: String,
    /// Anti-replay nonce for this specific request
    pub nonce: [u8; 32],
    /// The signer's public key (base58) — device verifies it owns this key
    pub signer_pubkey: String,
    /// Network identifier: "solana-mainnet", "solana-devnet"
    pub network: String,
    /// Serialized Solana Message bytes (the actual data to be signed)
    pub serialized_message: Vec<u8>,
    /// Human-readable transaction parameters for device display
    pub tx_params: super::tx_params::TxParams,
    /// Transaction metadata
    pub tx_metadata: super::tx_params::TxMetadata,
}
