use serde::{Deserialize, Serialize};

use crate::flux::{FluxRpcClient, TokenAccountInfo};
use crate::RpcError;

/// High-level Solana operations built on top of FluxRPC.
pub struct SolanaClient {
    rpc: FluxRpcClient,
}

/// Balance summary for a wallet.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletBalance {
    /// SOL balance in lamports
    pub sol_lamports: u64,
    /// SOL balance as a float
    pub sol_balance: f64,
    /// SPL token accounts
    pub tokens: Vec<TokenAccountInfo>,
}

impl SolanaClient {
    pub fn new(rpc_endpoint: &str) -> Self {
        Self {
            rpc: FluxRpcClient::new(rpc_endpoint),
        }
    }

    /// Get complete wallet balance (SOL + all SPL tokens).
    pub async fn get_wallet_balance(&self, pubkey: &str) -> Result<WalletBalance, RpcError> {
        let sol_lamports = self.rpc.get_balance(pubkey).await?;
        let sol_balance = sol_lamports as f64 / 1_000_000_000.0;

        // SPL Token Program ID
        let token_program = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        let tokens = self
            .rpc
            .get_token_accounts_by_owner(pubkey, token_program)
            .await
            .unwrap_or_default();

        Ok(WalletBalance {
            sol_lamports,
            sol_balance,
            tokens,
        })
    }

    /// Get latest blockhash for transaction building.
    pub async fn get_blockhash(&self) -> Result<String, RpcError> {
        self.rpc.get_latest_blockhash().await
    }

    /// Submit a signed transaction and return the signature.
    pub async fn submit_transaction(&self, signed_tx_base64: &str) -> Result<String, RpcError> {
        self.rpc.send_transaction_base64(signed_tx_base64).await
    }

    /// Get transaction details by signature.
    pub async fn get_transaction(
        &self,
        signature: &str,
    ) -> Result<serde_json::Value, RpcError> {
        self.rpc.get_transaction(signature).await
    }
}
