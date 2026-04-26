use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Domain separator prefix for all Coldstar signing operations.
const DOMAIN_PREFIX: &str = "coldstar:v1:sign:";

/// A canonical, domain-separated message that the device signs.
///
/// The device never signs raw transaction bytes. Instead, it signs
/// a canonical representation that binds:
///   - domain (prevents cross-protocol replay)
///   - nonce (prevents same-session replay)
///   - the SHA-256 hash of the serialized transaction message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanonicalMessage {
    /// Domain tag, e.g., "coldstar:v1:sign:solana-mainnet"
    pub domain: String,
    /// Anti-replay nonce (from the session)
    pub nonce: [u8; 32],
    /// SHA-256 of the serialized Solana Message
    pub tx_hash: [u8; 32],
}

impl CanonicalMessage {
    /// Create a new canonical message.
    pub fn new(network: &str, nonce: [u8; 32], serialized_tx_message: &[u8]) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(serialized_tx_message);
        let tx_hash: [u8; 32] = hasher.finalize().into();

        Self {
            domain: format!("{DOMAIN_PREFIX}{network}"),
            nonce,
            tx_hash,
        }
    }

    /// Serialize to deterministic bytes for signing.
    ///
    /// Format: [domain_len(u16) | domain_bytes | nonce(32) | tx_hash(32)]
    pub fn to_signable_bytes(&self) -> Vec<u8> {
        let domain_bytes = self.domain.as_bytes();
        let domain_len = domain_bytes.len() as u16;

        let mut out = Vec::with_capacity(2 + domain_bytes.len() + 32 + 32);
        out.extend_from_slice(&domain_len.to_be_bytes());
        out.extend_from_slice(domain_bytes);
        out.extend_from_slice(&self.nonce);
        out.extend_from_slice(&self.tx_hash);
        out
    }

    /// Verify the domain matches expected network.
    pub fn verify_domain(&self, expected_network: &str) -> bool {
        self.domain == format!("{DOMAIN_PREFIX}{expected_network}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_message_deterministic() {
        let nonce = [0xAA; 32];
        let tx_data = b"fake serialized solana message";

        let msg1 = CanonicalMessage::new("solana-mainnet", nonce, tx_data);
        let msg2 = CanonicalMessage::new("solana-mainnet", nonce, tx_data);

        assert_eq!(msg1.to_signable_bytes(), msg2.to_signable_bytes());
    }

    #[test]
    fn different_network_different_bytes() {
        let nonce = [0xBB; 32];
        let tx_data = b"tx";

        let msg1 = CanonicalMessage::new("solana-mainnet", nonce, tx_data);
        let msg2 = CanonicalMessage::new("solana-devnet", nonce, tx_data);

        assert_ne!(msg1.to_signable_bytes(), msg2.to_signable_bytes());
    }

    #[test]
    fn domain_verification() {
        let msg = CanonicalMessage::new("solana-mainnet", [0; 32], b"tx");
        assert!(msg.verify_domain("solana-mainnet"));
        assert!(!msg.verify_domain("solana-devnet"));
    }
}
