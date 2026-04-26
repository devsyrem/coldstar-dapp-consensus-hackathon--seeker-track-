use std::collections::HashSet;

use chrono::{DateTime, Utc};
use uuid::Uuid;
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::SessionError;

/// Maximum session lifetime (5 minutes).
const SESSION_LIFETIME_SECS: i64 = 300;

/// Maximum nonces per session before requiring re-init.
const MAX_NONCES_PER_SESSION: usize = 100;

/// A single authenticated session between mobile and device.
#[derive(Debug)]
pub struct Session {
    /// Unique session identifier
    pub id: String,
    /// Shared secret from X25519 key exchange (for future encrypted transport)
    shared_secret: SharedSecret,
    /// Set of used nonces (anti-replay)
    used_nonces: HashSet<[u8; 32]>,
    /// Session creation time
    created_at: DateTime<Utc>,
    /// Mobile's ephemeral public key
    pub mobile_pubkey: [u8; 32],
    /// Device's ephemeral public key
    pub device_pubkey: [u8; 32],
}

/// Wrapper that auto-zeroizes the shared secret on drop.
#[derive(Debug, ZeroizeOnDrop)]
struct SharedSecret {
    #[zeroize]
    bytes: [u8; 32],
}

impl Session {
    /// Create a new session from a completed key exchange.
    pub fn new(
        shared_secret: [u8; 32],
        mobile_pubkey: [u8; 32],
        device_pubkey: [u8; 32],
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            shared_secret: SharedSecret {
                bytes: shared_secret,
            },
            used_nonces: HashSet::new(),
            created_at: Utc::now(),
            mobile_pubkey,
            device_pubkey,
        }
    }

    /// Check if the session has expired.
    pub fn is_expired(&self) -> bool {
        let elapsed = Utc::now()
            .signed_duration_since(self.created_at)
            .num_seconds();
        elapsed > SESSION_LIFETIME_SECS
    }

    /// Validate and consume a nonce. Returns error if expired or replayed.
    pub fn use_nonce(&mut self, nonce: [u8; 32]) -> Result<(), SessionError> {
        if self.is_expired() {
            return Err(SessionError::SessionExpired {
                lifetime_secs: SESSION_LIFETIME_SECS as u64,
            });
        }

        if self.used_nonces.len() >= MAX_NONCES_PER_SESSION {
            return Err(SessionError::SessionExpired {
                lifetime_secs: SESSION_LIFETIME_SECS as u64,
            });
        }

        if self.used_nonces.contains(&nonce) {
            return Err(SessionError::NonceReplay);
        }

        self.used_nonces.insert(nonce);
        Ok(())
    }

    /// Get the number of nonces used.
    pub fn nonce_count(&self) -> usize {
        self.used_nonces.len()
    }

    /// Get read-only access to the shared secret (for encrypted transport).
    pub fn shared_secret(&self) -> &[u8; 32] {
        &self.shared_secret.bytes
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_nonce_tracking() {
        let mut session = Session::new([0xAA; 32], [0xBB; 32], [0xCC; 32]);

        // First use succeeds
        session.use_nonce([0x01; 32]).unwrap();
        assert_eq!(session.nonce_count(), 1);

        // Replay fails
        let result = session.use_nonce([0x01; 32]);
        assert!(matches!(result, Err(SessionError::NonceReplay)));

        // Different nonce succeeds
        session.use_nonce([0x02; 32]).unwrap();
        assert_eq!(session.nonce_count(), 2);
    }

    #[test]
    fn session_has_unique_id() {
        let s1 = Session::new([0; 32], [0; 32], [0; 32]);
        let s2 = Session::new([0; 32], [0; 32], [0; 32]);
        assert_ne!(s1.id, s2.id);
    }
}
