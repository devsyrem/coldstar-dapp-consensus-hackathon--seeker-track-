use serde::{Deserialize, Serialize};

/// Transaction parameters supplied by the mobile app.
///
/// The mobile app builds the Solana Message and sends these params
/// so the device can verify what it's signing before proceeding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxParams {
    /// Human-readable description shown on device
    pub description: String,
    /// Target program ID (base58)
    pub program_id: String,
    /// Destination address (base58), if applicable
    pub destination: Option<String>,
    /// Amount in lamports (for SOL transfers) or token smallest unit
    pub amount: Option<u64>,
    /// Token mint address (base58), for SPL token operations
    pub token_mint: Option<String>,
    /// Token symbol for display
    pub token_symbol: Option<String>,
    /// Token decimals for display formatting
    pub token_decimals: Option<u8>,
    /// Network: "solana-mainnet", "solana-devnet", "solana-testnet"
    pub network: String,
}

/// Metadata about the transaction for audit/display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxMetadata {
    /// Transaction type for categorization
    pub tx_type: TxType,
    /// Estimated compute units
    pub compute_units: Option<u32>,
    /// Priority fee in micro-lamports
    pub priority_fee: Option<u64>,
    /// Recent blockhash (base58)
    pub recent_blockhash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TxType {
    SolTransfer,
    SplTokenTransfer,
    Swap,
    Stake,
    Unstake,
    BulkSend,
    DAppInteraction,
    Unknown,
}
