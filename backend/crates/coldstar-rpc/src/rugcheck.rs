use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::RpcError;

/// RugCheck API client for SPL token safety scanning.
pub struct RugCheckClient {
    client: Client,
    base_url: String,
    api_key: String,
}

/// Token safety report from RugCheck.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenReport {
    /// Token mint address
    pub mint: String,
    /// Overall risk score (0 = safe, 100 = extreme risk)
    pub score: Option<f64>,
    /// Risk classification
    pub risks: Vec<RiskItem>,
    /// Token metadata
    pub token_meta: Option<TokenMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskItem {
    pub name: String,
    pub value: String,
    pub description: String,
    pub score: f64,
    pub level: RiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Info,
    Low,
    Medium,
    High,
    Critical,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenMeta {
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub uri: Option<String>,
}

/// Safety classification matching the frontend spec.
#[derive(Debug, Clone, PartialEq)]
pub enum SafetyLevel {
    Safe,
    Caution,
    Ruggable,
    Unknown,
}

impl RugCheckClient {
    /// Create a new RugCheck client.
    ///
    /// `base_url` — premium endpoint URL.
    /// `api_key` — premium API key.
    pub fn new(base_url: &str, api_key: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
        }
    }

    /// Get a full token report for a mint address.
    pub async fn get_token_report(&self, mint: &str) -> Result<TokenReport, RpcError> {
        let url = format!("{}/v1/tokens/{}/report", self.base_url, mint);
        debug!(mint = mint, "Fetching RugCheck report");

        let response = self
            .client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .send()
            .await?;

        if response.status() == 429 {
            return Err(RpcError::RateLimited {
                retry_after_ms: 2000,
            });
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(RpcError::RugCheckError(format!(
                "HTTP {}: {}",
                status, body
            )));
        }

        response
            .json::<TokenReport>()
            .await
            .map_err(|e| RpcError::DeserializationError(e.to_string()))
    }

    /// Get a quick safety classification for a token.
    pub async fn classify_token(&self, mint: &str) -> Result<SafetyLevel, RpcError> {
        let report = self.get_token_report(mint).await?;
        Ok(classify_from_report(&report))
    }

    /// Batch-check multiple tokens.
    pub async fn classify_tokens(
        &self,
        mints: &[&str],
    ) -> Vec<(String, Result<SafetyLevel, RpcError>)> {
        let mut results = Vec::with_capacity(mints.len());
        for mint in mints {
            let result = self.classify_token(mint).await;
            results.push((mint.to_string(), result));
        }
        results
    }
}

/// Derive safety level from a RugCheck report.
fn classify_from_report(report: &TokenReport) -> SafetyLevel {
    // If we have a score, use thresholds
    if let Some(score) = report.score {
        return if score <= 20.0 {
            SafetyLevel::Safe
        } else if score <= 60.0 {
            SafetyLevel::Caution
        } else {
            SafetyLevel::Ruggable
        };
    }

    // Fallback: check risk items
    let has_critical = report
        .risks
        .iter()
        .any(|r| r.level == RiskLevel::Critical);
    let has_high = report.risks.iter().any(|r| r.level == RiskLevel::High);

    if has_critical {
        SafetyLevel::Ruggable
    } else if has_high {
        SafetyLevel::Caution
    } else if report.risks.is_empty() {
        SafetyLevel::Unknown
    } else {
        SafetyLevel::Safe
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_safe_score() {
        let report = TokenReport {
            mint: "test".to_string(),
            score: Some(10.0),
            risks: vec![],
            token_meta: None,
        };
        assert_eq!(classify_from_report(&report), SafetyLevel::Safe);
    }

    #[test]
    fn classify_caution_score() {
        let report = TokenReport {
            mint: "test".to_string(),
            score: Some(45.0),
            risks: vec![],
            token_meta: None,
        };
        assert_eq!(classify_from_report(&report), SafetyLevel::Caution);
    }

    #[test]
    fn classify_ruggable_score() {
        let report = TokenReport {
            mint: "test".to_string(),
            score: Some(85.0),
            risks: vec![],
            token_meta: None,
        };
        assert_eq!(classify_from_report(&report), SafetyLevel::Ruggable);
    }

    #[test]
    fn classify_from_risk_items() {
        let report = TokenReport {
            mint: "test".to_string(),
            score: None,
            risks: vec![RiskItem {
                name: "Mutable metadata".to_string(),
                value: "true".to_string(),
                description: "Token metadata can be changed".to_string(),
                score: 80.0,
                level: RiskLevel::Critical,
            }],
            token_meta: None,
        };
        assert_eq!(classify_from_report(&report), SafetyLevel::Ruggable);
    }
}
