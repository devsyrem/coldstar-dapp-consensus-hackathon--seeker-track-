use serde::{Deserialize, Serialize};

/// Represents an encrypted wallet stored on the USB device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedWallet {
    /// Wallet version for forward compatibility
    pub version: u8,
    /// Wallet identifier (public, not secret)
    pub wallet_id: String,
    /// The public key (base58) — safe to expose
    pub public_key: String,
    /// KDF salt used for PIN → AES key derivation
    pub kdf_salt: Vec<u8>,
    /// Encrypted private key blob (nonce || ciphertext)
    /// Encrypted with AES-256-GCM using the PIN-derived key
    pub encrypted_secret_key: Vec<u8>,
    /// Creation timestamp (Unix seconds)
    pub created_at: i64,
    /// Optional human-readable label
    pub label: Option<String>,
}

/// Information about a wallet that's safe to share with the mobile app.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInfo {
    pub wallet_id: String,
    pub public_key: String,
    pub label: Option<String>,
    pub created_at: i64,
}

impl From<&EncryptedWallet> for WalletInfo {
    fn from(w: &EncryptedWallet) -> Self {
        Self {
            wallet_id: w.wallet_id.clone(),
            public_key: w.public_key.clone(),
            label: w.label.clone(),
            created_at: w.created_at,
        }
    }
}
