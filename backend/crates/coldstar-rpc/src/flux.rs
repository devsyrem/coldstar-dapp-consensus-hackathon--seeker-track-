use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::RpcError;

/// FluxRPC client for Solana JSON-RPC.
///
/// Wraps the FluxRPC endpoint with standard Solana RPC methods.
pub struct FluxRpcClient {
    client: Client,
    endpoint: String,
}

/// Standard Solana JSON-RPC request envelope.
#[derive(Serialize)]
struct RpcRequest {
    jsonrpc: &'static str,
    id: u64,
    method: String,
    params: serde_json::Value,
}

/// Standard Solana JSON-RPC response envelope.
#[derive(Deserialize)]
struct RpcResponse<T> {
    #[allow(dead_code)]
    jsonrpc: String,
    #[allow(dead_code)]
    id: u64,
    result: Option<T>,
    error: Option<RpcErrorResponse>,
}

#[derive(Deserialize)]
struct RpcErrorResponse {
    code: i64,
    message: String,
}

impl FluxRpcClient {
    /// Create a new FluxRPC client.
    ///
    /// `endpoint` should be the full URL including the API key parameter.
    pub fn new(endpoint: &str) -> Self {
        Self {
            client: Client::new(),
            endpoint: endpoint.to_string(),
        }
    }

    /// Make a raw JSON-RPC call.
    async fn call<T: for<'de> Deserialize<'de>>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<T, RpcError> {
        let request = RpcRequest {
            jsonrpc: "2.0",
            id: 1,
            method: method.to_string(),
            params,
        };

        debug!(method = method, "RPC call");

        let response = self
            .client
            .post(&self.endpoint)
            .json(&request)
            .send()
            .await?;

        if response.status() == 429 {
            return Err(RpcError::RateLimited {
                retry_after_ms: 1000,
            });
        }

        let rpc_response: RpcResponse<T> = response
            .json()
            .await
            .map_err(|e| RpcError::DeserializationError(e.to_string()))?;

        if let Some(err) = rpc_response.error {
            return Err(RpcError::ResponseError {
                code: err.code,
                message: err.message,
            });
        }

        rpc_response
            .result
            .ok_or_else(|| RpcError::RequestFailed("No result in response".to_string()))
    }

    /// Get SOL balance for an address (in lamports).
    pub async fn get_balance(&self, pubkey: &str) -> Result<u64, RpcError> {
        #[derive(Deserialize)]
        struct BalanceResult {
            value: u64,
        }

        let result: BalanceResult = self
            .call("getBalance", serde_json::json!([pubkey]))
            .await?;
        Ok(result.value)
    }

    /// Get recent blockhash.
    pub async fn get_latest_blockhash(&self) -> Result<String, RpcError> {
        #[derive(Deserialize)]
        struct BlockhashResult {
            value: BlockhashValue,
        }
        #[derive(Deserialize)]
        struct BlockhashValue {
            blockhash: String,
        }

        let result: BlockhashResult = self
            .call("getLatestBlockhash", serde_json::json!([]))
            .await?;
        Ok(result.value.blockhash)
    }

    /// Send a signed transaction (base58-encoded).
    pub async fn send_transaction(&self, signed_tx_base58: &str) -> Result<String, RpcError> {
        let sig: String = self
            .call(
                "sendTransaction",
                serde_json::json!([signed_tx_base58, {"encoding": "base58"}]),
            )
            .await?;
        Ok(sig)
    }

    /// Send a signed transaction (base64-encoded).
    pub async fn send_transaction_base64(&self, signed_tx_base64: &str) -> Result<String, RpcError> {
        let sig: String = self
            .call(
                "sendTransaction",
                serde_json::json!([signed_tx_base64, {"encoding": "base64"}]),
            )
            .await?;
        Ok(sig)
    }

    /// Get token accounts by owner.
    pub async fn get_token_accounts_by_owner(
        &self,
        owner: &str,
        program_id: &str,
    ) -> Result<Vec<TokenAccountInfo>, RpcError> {
        #[derive(Deserialize)]
        struct TokenAccountsResult {
            value: Vec<TokenAccountEntry>,
        }
        #[derive(Deserialize)]
        struct TokenAccountEntry {
            pubkey: String,
            account: TokenAccountData,
        }
        #[derive(Deserialize)]
        struct TokenAccountData {
            data: TokenParsedData,
        }
        #[derive(Deserialize)]
        struct TokenParsedData {
            parsed: TokenParsedInfo,
        }
        #[derive(Deserialize)]
        struct TokenParsedInfo {
            info: TokenInfo,
        }
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct TokenInfo {
            mint: String,
            token_amount: TokenAmount,
        }
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct TokenAmount {
            amount: String,
            decimals: u8,
            ui_amount: Option<f64>,
        }

        let result: TokenAccountsResult = self
            .call(
                "getTokenAccountsByOwner",
                serde_json::json!([
                    owner,
                    {"programId": program_id},
                    {"encoding": "jsonParsed"}
                ]),
            )
            .await?;

        Ok(result
            .value
            .into_iter()
            .map(|entry| TokenAccountInfo {
                address: entry.pubkey,
                mint: entry.account.data.parsed.info.mint,
                amount: entry.account.data.parsed.info.token_amount.amount,
                decimals: entry.account.data.parsed.info.token_amount.decimals,
                ui_amount: entry.account.data.parsed.info.token_amount.ui_amount,
            })
            .collect())
    }

    /// Get transaction details.
    pub async fn get_transaction(
        &self,
        signature: &str,
    ) -> Result<serde_json::Value, RpcError> {
        let result: serde_json::Value = self
            .call(
                "getTransaction",
                serde_json::json!([signature, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}]),
            )
            .await?;
        Ok(result)
    }

    /// Get account info.
    pub async fn get_account_info(
        &self,
        pubkey: &str,
    ) -> Result<serde_json::Value, RpcError> {
        let result: serde_json::Value = self
            .call(
                "getAccountInfo",
                serde_json::json!([pubkey, {"encoding": "jsonParsed"}]),
            )
            .await?;
        Ok(result)
    }

    /// Get minimum balance for rent exemption.
    pub async fn get_minimum_balance_for_rent_exemption(
        &self,
        data_len: usize,
    ) -> Result<u64, RpcError> {
        let result: u64 = self
            .call(
                "getMinimumBalanceForRentExemption",
                serde_json::json!([data_len]),
            )
            .await?;
        Ok(result)
    }
}

/// Token account summary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenAccountInfo {
    pub address: String,
    pub mint: String,
    pub amount: String,
    pub decimals: u8,
    pub ui_amount: Option<f64>,
}
