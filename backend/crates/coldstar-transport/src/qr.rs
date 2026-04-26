use serde::{de::DeserializeOwned, Serialize};

use crate::TransportError;

/// Maximum QR payload size (CBOR-encoded). Keep under ~2.9 KB for QR code capacity.
const MAX_QR_PAYLOAD: usize = 2953;

/// Encode a serializable value to CBOR bytes for QR transport.
pub fn encode_cbor<T: Serialize>(value: &T) -> Result<Vec<u8>, TransportError> {
    serde_cbor::to_vec(value).map_err(|e| TransportError::CborError(e.to_string()))
}

/// Decode CBOR bytes back to a value.
pub fn decode_cbor<T: DeserializeOwned>(data: &[u8]) -> Result<T, TransportError> {
    serde_cbor::from_slice(data).map_err(|e| TransportError::CborError(e.to_string()))
}

/// Encode a value to CBOR and then to base64 for QR display.
pub fn encode_for_qr<T: Serialize>(value: &T) -> Result<String, TransportError> {
    use base64::Engine;
    let cbor = encode_cbor(value)?;
    if cbor.len() > MAX_QR_PAYLOAD {
        return Err(TransportError::PayloadTooLarge {
            max: MAX_QR_PAYLOAD,
            got: cbor.len(),
        });
    }
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&cbor))
}

/// Decode a base64 QR string back to a value.
pub fn decode_from_qr<T: DeserializeOwned>(qr_data: &str) -> Result<T, TransportError> {
    use base64::Engine;
    let cbor = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(qr_data)
        .map_err(|e| TransportError::CborError(e.to_string()))?;
    decode_cbor(&cbor)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    struct TestPayload {
        msg: String,
        value: u64,
    }

    #[test]
    fn cbor_round_trip() {
        let payload = TestPayload {
            msg: "test".to_string(),
            value: 42,
        };
        let encoded = encode_cbor(&payload).unwrap();
        let decoded: TestPayload = decode_cbor(&encoded).unwrap();
        assert_eq!(decoded, payload);
    }

    #[test]
    fn qr_round_trip() {
        let payload = TestPayload {
            msg: "qr-test".to_string(),
            value: 1000,
        };
        let qr_string = encode_for_qr(&payload).unwrap();
        let decoded: TestPayload = decode_from_qr(&qr_string).unwrap();
        assert_eq!(decoded, payload);
    }
}
