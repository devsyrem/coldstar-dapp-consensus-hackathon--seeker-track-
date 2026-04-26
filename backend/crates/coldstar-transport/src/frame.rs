use sha2::{Digest, Sha256};

use crate::TransportError;

/// Maximum payload size: 64 KiB.
const MAX_PAYLOAD: usize = 65536;

/// Frame header: [length(4 BE) | type(1) | payload(N) | checksum(4 BE)]
/// Total overhead: 9 bytes.
const HEADER_SIZE: usize = 5; // length + type
const CHECKSUM_SIZE: usize = 4;
const MIN_FRAME_SIZE: usize = HEADER_SIZE + CHECKSUM_SIZE;

/// Message types for the USB protocol.
#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(u8)]
pub enum MessageType {
    /// Session initiation (mobile → device)
    InitSession = 0x01,
    /// Session acknowledgment (device → mobile)
    SessionAck = 0x02,
    /// Sign request (mobile → device)
    SignRequest = 0x10,
    /// Sign response (device → mobile)
    SignResponse = 0x11,
    /// Wallet list request (mobile → device)
    ListWallets = 0x20,
    /// Wallet list response (device → mobile)
    WalletList = 0x21,
    /// Flash: write file to USB (mobile → device)
    FlashWriteFile = 0x30,
    /// Flash: write file acknowledgment (device → mobile)
    FlashWriteAck = 0x31,
    /// Flash: format drive request (mobile → device)
    FlashFormat = 0x32,
    /// Flash: format acknowledgment (device → mobile)
    FlashFormatAck = 0x33,
    /// Flash: generate wallet keypair on USB (mobile → device)
    FlashGenKeypair = 0x34,
    /// Flash: generated wallet result (device → mobile)
    FlashKeypairResult = 0x35,
    /// Flash: verify USB wallet integrity (mobile → device)
    FlashVerify = 0x36,
    /// Flash: verification result (device → mobile)
    FlashVerifyResult = 0x37,
    /// Ping (either direction)
    Ping = 0xF0,
    /// Pong (either direction)
    Pong = 0xF1,
    /// Error (either direction)
    Error = 0xFF,
}

impl MessageType {
    pub fn from_byte(b: u8) -> Result<Self, TransportError> {
        match b {
            0x01 => Ok(Self::InitSession),
            0x02 => Ok(Self::SessionAck),
            0x10 => Ok(Self::SignRequest),
            0x11 => Ok(Self::SignResponse),
            0x20 => Ok(Self::ListWallets),
            0x21 => Ok(Self::WalletList),
            0x30 => Ok(Self::FlashWriteFile),
            0x31 => Ok(Self::FlashWriteAck),
            0x32 => Ok(Self::FlashFormat),
            0x33 => Ok(Self::FlashFormatAck),
            0x34 => Ok(Self::FlashGenKeypair),
            0x35 => Ok(Self::FlashKeypairResult),
            0x36 => Ok(Self::FlashVerify),
            0x37 => Ok(Self::FlashVerifyResult),
            0xF0 => Ok(Self::Ping),
            0xF1 => Ok(Self::Pong),
            0xFF => Ok(Self::Error),
            _ => Err(TransportError::UnknownMessageType(b)),
        }
    }
}

/// A parsed frame.
#[derive(Debug, Clone)]
pub struct Frame {
    pub msg_type: MessageType,
    pub payload: Vec<u8>,
}

impl Frame {
    /// Create a new frame.
    pub fn new(msg_type: MessageType, payload: Vec<u8>) -> Result<Self, TransportError> {
        if payload.len() > MAX_PAYLOAD {
            return Err(TransportError::PayloadTooLarge {
                max: MAX_PAYLOAD,
                got: payload.len(),
            });
        }
        Ok(Self { msg_type, payload })
    }

    /// Encode the frame to wire bytes.
    ///
    /// Format: [payload_len(4 BE) | type(1) | payload(N) | sha256_trunc(4 BE)]
    pub fn encode(&self) -> Vec<u8> {
        let payload_len = self.payload.len() as u32;
        let total = HEADER_SIZE + self.payload.len() + CHECKSUM_SIZE;
        let mut buf = Vec::with_capacity(total);

        // Length (4 bytes, big-endian) — length of payload only
        buf.extend_from_slice(&payload_len.to_be_bytes());
        // Message type (1 byte)
        buf.push(self.msg_type as u8);
        // Payload
        buf.extend_from_slice(&self.payload);
        // Checksum: first 4 bytes of SHA-256(type || payload)
        let checksum = compute_checksum(self.msg_type as u8, &self.payload);
        buf.extend_from_slice(&checksum.to_be_bytes());

        buf
    }

    /// Decode a frame from wire bytes.
    pub fn decode(data: &[u8]) -> Result<Self, TransportError> {
        if data.len() < MIN_FRAME_SIZE {
            return Err(TransportError::FrameTooShort {
                min: MIN_FRAME_SIZE,
                got: data.len(),
            });
        }

        // Parse length
        let payload_len =
            u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;

        let expected_total = HEADER_SIZE + payload_len + CHECKSUM_SIZE;
        if data.len() < expected_total {
            return Err(TransportError::FrameTooShort {
                min: expected_total,
                got: data.len(),
            });
        }

        if payload_len > MAX_PAYLOAD {
            return Err(TransportError::PayloadTooLarge {
                max: MAX_PAYLOAD,
                got: payload_len,
            });
        }

        // Parse type
        let msg_type = MessageType::from_byte(data[4])?;

        // Extract payload
        let payload = data[HEADER_SIZE..HEADER_SIZE + payload_len].to_vec();

        // Verify checksum
        let checksum_offset = HEADER_SIZE + payload_len;
        let received_checksum = u32::from_be_bytes([
            data[checksum_offset],
            data[checksum_offset + 1],
            data[checksum_offset + 2],
            data[checksum_offset + 3],
        ]);

        let expected_checksum = compute_checksum(msg_type as u8, &payload);
        if received_checksum != expected_checksum {
            return Err(TransportError::ChecksumMismatch {
                expected: expected_checksum,
                got: received_checksum,
            });
        }

        Ok(Self { msg_type, payload })
    }
}

/// Compute a 4-byte checksum: truncated SHA-256(type || payload).
fn compute_checksum(msg_type: u8, payload: &[u8]) -> u32 {
    let mut hasher = Sha256::new();
    hasher.update([msg_type]);
    hasher.update(payload);
    let hash = hasher.finalize();
    u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_round_trip() {
        let payload = b"hello device".to_vec();
        let frame = Frame::new(MessageType::Ping, payload.clone()).unwrap();
        let encoded = frame.encode();
        let decoded = Frame::decode(&encoded).unwrap();

        assert_eq!(decoded.msg_type, MessageType::Ping);
        assert_eq!(decoded.payload, payload);
    }

    #[test]
    fn checksum_tamper_detected() {
        let frame = Frame::new(MessageType::Ping, b"data".to_vec()).unwrap();
        let mut encoded = frame.encode();
        // Tamper with the last byte (checksum)
        let last = encoded.len() - 1;
        encoded[last] ^= 0xFF;

        let result = Frame::decode(&encoded);
        assert!(matches!(
            result,
            Err(TransportError::ChecksumMismatch { .. })
        ));
    }

    #[test]
    fn empty_payload() {
        let frame = Frame::new(MessageType::Pong, vec![]).unwrap();
        let encoded = frame.encode();
        let decoded = Frame::decode(&encoded).unwrap();
        assert_eq!(decoded.msg_type, MessageType::Pong);
        assert!(decoded.payload.is_empty());
    }
}
