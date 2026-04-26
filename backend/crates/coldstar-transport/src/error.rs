use thiserror::Error;

#[derive(Debug, Error)]
pub enum TransportError {
    #[error("Frame too short: minimum {min} bytes, got {got}")]
    FrameTooShort { min: usize, got: usize },

    #[error("Frame checksum mismatch: expected {expected:08x}, got {got:08x}")]
    ChecksumMismatch { expected: u32, got: u32 },

    #[error("Unknown message type: 0x{0:02x}")]
    UnknownMessageType(u8),

    #[error("Payload too large: max {max} bytes, got {got}")]
    PayloadTooLarge { max: usize, got: usize },

    #[error("CBOR encoding error: {0}")]
    CborError(String),

    #[error("USB I/O error: {0}")]
    UsbError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}
