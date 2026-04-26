use x25519_dalek::{EphemeralSecret, PublicKey, StaticSecret};
use rand::rngs::OsRng;
use zeroize::Zeroize;

use crate::CryptoError;

/// Generate an X25519 ephemeral keypair for session key exchange.
///
/// Returns (secret, public_key_bytes).
pub fn generate_ephemeral_keypair() -> (EphemeralSecret, [u8; 32]) {
    let secret = EphemeralSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    (secret, public.to_bytes())
}

/// Generate a static X25519 keypair (for the device side).
pub fn generate_static_keypair() -> (StaticSecret, [u8; 32]) {
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    (secret, public.to_bytes())
}

/// Perform X25519 Diffie-Hellman with an ephemeral secret and a peer's public key.
///
/// Returns the 32-byte shared secret.
pub fn ephemeral_diffie_hellman(
    secret: EphemeralSecret,
    peer_public: &[u8; 32],
) -> [u8; 32] {
    let peer_key = PublicKey::from(*peer_public);
    let shared = secret.diffie_hellman(&peer_key);
    *shared.as_bytes()
}

/// Perform X25519 Diffie-Hellman with a static secret.
pub fn static_diffie_hellman(
    secret: &StaticSecret,
    peer_public: &[u8; 32],
) -> [u8; 32] {
    let peer_key = PublicKey::from(*peer_public);
    let shared = secret.diffie_hellman(&peer_key);
    *shared.as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_exchange_produces_shared_secret() {
        let (alice_secret, alice_public) = generate_static_keypair();
        let (bob_secret, bob_public) = generate_static_keypair();

        let alice_shared = static_diffie_hellman(&alice_secret, &bob_public);
        let bob_shared = static_diffie_hellman(&bob_secret, &alice_public);

        assert_eq!(alice_shared, bob_shared);
    }
}
