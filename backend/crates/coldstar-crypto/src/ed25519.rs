use ed25519_dalek::{
    Signature, Signer, SigningKey, Verifier, VerifyingKey,
};
use zeroize::Zeroize;

use crate::CryptoError;

/// Sign a message with a 32-byte Ed25519 secret key.
///
/// Returns the 64-byte signature. The secret key is NOT zeroized by this
/// function — the caller must manage the key lifetime.
pub fn sign(secret_key_bytes: &[u8; 32], message: &[u8]) -> Result<[u8; 64], CryptoError> {
    let signing_key = SigningKey::from_bytes(secret_key_bytes);
    let signature = signing_key.sign(message);
    Ok(signature.to_bytes())
}

/// Verify an Ed25519 signature over a message.
pub fn verify(
    public_key_bytes: &[u8; 32],
    message: &[u8],
    signature_bytes: &[u8; 64],
) -> Result<(), CryptoError> {
    let verifying_key =
        VerifyingKey::from_bytes(public_key_bytes).map_err(|_| CryptoError::InvalidPublicKey)?;
    let signature =
        Signature::from_bytes(signature_bytes);
    verifying_key
        .verify(message, &signature)
        .map_err(|_| CryptoError::InvalidSignature)
}

/// Derive the 32-byte public key from a 32-byte secret key.
pub fn public_key_from_secret(secret_key_bytes: &[u8; 32]) -> [u8; 32] {
    let signing_key = SigningKey::from_bytes(secret_key_bytes);
    signing_key.verifying_key().to_bytes()
}

/// Securely zeroize a secret key.
pub fn zeroize_secret_key(key: &mut [u8; 32]) {
    key.zeroize();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_and_verify() {
        // Generate a deterministic test key
        let secret = [0x01u8; 32];
        let pubkey = public_key_from_secret(&secret);
        let message = b"coldstar:sign:test-transaction";

        let sig = sign(&secret, message).unwrap();
        verify(&pubkey, message, &sig).unwrap();
    }

    #[test]
    fn verify_wrong_message_fails() {
        let secret = [0x02u8; 32];
        let pubkey = public_key_from_secret(&secret);

        let sig = sign(&secret, b"original").unwrap();
        let result = verify(&pubkey, b"tampered", &sig);
        assert!(result.is_err());
    }
}
