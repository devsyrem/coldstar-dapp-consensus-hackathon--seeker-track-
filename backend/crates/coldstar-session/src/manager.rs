use coldstar_crypto::x25519;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::session::Session;
use crate::SessionError;

/// Messages for session initialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitSessionRequest {
    /// Mobile's ephemeral X25519 public key
    pub mobile_pubkey: [u8; 32],
    /// Random challenge for freshness
    pub challenge: [u8; 32],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionAck {
    /// Session ID assigned by the device
    pub session_id: String,
    /// Device's ephemeral X25519 public key
    pub device_pubkey: [u8; 32],
    /// Echoed challenge for verification
    pub challenge_echo: [u8; 32],
}

/// Manages session lifecycle on the device side.
pub struct SessionManager {
    /// Currently active session (only one at a time).
    active_session: Option<Session>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            active_session: None,
        }
    }

    /// Handle an InitSession request from the mobile app.
    ///
    /// Performs X25519 key exchange and creates a new session.
    pub fn handle_init(&mut self, request: &InitSessionRequest) -> Result<SessionAck, SessionError> {
        // Generate device ephemeral keypair
        let (device_secret, device_pubkey) = x25519::generate_static_keypair();

        // X25519 Diffie-Hellman
        let shared_secret =
            x25519::static_diffie_hellman(&device_secret, &request.mobile_pubkey);

        // Create session
        let session = Session::new(shared_secret, request.mobile_pubkey, device_pubkey);
        let session_id = session.id.clone();

        info!(session_id = %session_id, "New session created");

        let ack = SessionAck {
            session_id,
            device_pubkey,
            challenge_echo: request.challenge,
        };

        // Replace any existing session
        self.active_session = Some(session);

        Ok(ack)
    }

    /// Validate a session ID and consume a nonce.
    pub fn validate_and_use_nonce(
        &mut self,
        session_id: &str,
        nonce: [u8; 32],
    ) -> Result<(), SessionError> {
        let session = self
            .active_session
            .as_mut()
            .ok_or(SessionError::NoActiveSession)?;

        if session.id != session_id {
            return Err(SessionError::SessionIdMismatch {
                expected: session.id.clone(),
                got: session_id.to_string(),
            });
        }

        session.use_nonce(nonce)
    }

    /// Get the active session ID, if any.
    pub fn active_session_id(&self) -> Option<&str> {
        self.active_session.as_ref().map(|s| s.id.as_str())
    }

    /// Check if there's an active, non-expired session.
    pub fn has_active_session(&self) -> bool {
        self.active_session
            .as_ref()
            .is_some_and(|s| !s.is_expired())
    }

    /// Destroy the active session.
    pub fn destroy_session(&mut self) {
        self.active_session = None;
    }

    /// Generate a random nonce for a sign request.
    pub fn generate_nonce() -> [u8; 32] {
        let mut nonce = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut nonce);
        nonce
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_init_request() -> (InitSessionRequest, x25519_dalek::StaticSecret) {
        let (mobile_secret, mobile_pubkey) = x25519::generate_static_keypair();
        let mut challenge = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut challenge);
        (
            InitSessionRequest {
                mobile_pubkey,
                challenge,
            },
            mobile_secret,
        )
    }

    #[test]
    fn session_init_flow() {
        let mut manager = SessionManager::new();
        let (request, _mobile_secret) = create_init_request();

        let ack = manager.handle_init(&request).unwrap();
        assert_eq!(ack.challenge_echo, request.challenge);
        assert!(manager.has_active_session());
    }

    #[test]
    fn nonce_validation() {
        let mut manager = SessionManager::new();
        let (request, _) = create_init_request();
        let ack = manager.handle_init(&request).unwrap();

        let nonce = SessionManager::generate_nonce();
        manager
            .validate_and_use_nonce(&ack.session_id, nonce)
            .unwrap();

        // Replay should fail
        let result = manager.validate_and_use_nonce(&ack.session_id, nonce);
        assert!(matches!(result, Err(SessionError::NonceReplay)));
    }

    #[test]
    fn wrong_session_id_fails() {
        let mut manager = SessionManager::new();
        let (request, _) = create_init_request();
        manager.handle_init(&request).unwrap();

        let result =
            manager.validate_and_use_nonce("wrong-id", [0; 32]);
        assert!(matches!(
            result,
            Err(SessionError::SessionIdMismatch { .. })
        ));
    }
}
