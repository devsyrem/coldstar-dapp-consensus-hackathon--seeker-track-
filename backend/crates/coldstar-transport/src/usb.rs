use crate::frame::{Frame, MessageType};
use crate::TransportError;

/// USB device connection state.
#[derive(Debug, Clone, PartialEq)]
pub enum UsbState {
    Disconnected,
    Detecting,
    Connected { device_path: String },
    Error(String),
}

/// USB transport handler for communicating with the ColdStar device.
///
/// This manages the framed protocol over USB OTG. On Android, the actual
/// I/O is done via the Android USB Host API (through FFI). This struct
/// handles frame encoding/decoding and protocol state.
pub struct UsbTransport {
    state: UsbState,
    /// Buffer for incoming partial frames.
    rx_buffer: Vec<u8>,
}

impl UsbTransport {
    pub fn new() -> Self {
        Self {
            state: UsbState::Disconnected,
            rx_buffer: Vec::new(),
        }
    }

    /// Get current connection state.
    pub fn state(&self) -> &UsbState {
        &self.state
    }

    /// Set connection state (called from FFI when Android detects device).
    pub fn set_connected(&mut self, device_path: String) {
        self.state = UsbState::Connected { device_path };
        self.rx_buffer.clear();
    }

    /// Set disconnected state.
    pub fn set_disconnected(&mut self) {
        self.state = UsbState::Disconnected;
        self.rx_buffer.clear();
    }

    /// Encode a message for sending over USB.
    pub fn encode_message(
        msg_type: MessageType,
        payload: &[u8],
    ) -> Result<Vec<u8>, TransportError> {
        let frame = Frame::new(msg_type, payload.to_vec())?;
        Ok(frame.encode())
    }

    /// Feed received bytes into the buffer and try to extract a complete frame.
    ///
    /// Returns `Some(Frame)` if a complete frame was assembled, `None` if more
    /// data is needed.
    pub fn feed_bytes(&mut self, data: &[u8]) -> Result<Option<Frame>, TransportError> {
        self.rx_buffer.extend_from_slice(data);

        // Need at least 9 bytes for header + checksum
        if self.rx_buffer.len() < 9 {
            return Ok(None);
        }

        // Read payload length
        let payload_len = u32::from_be_bytes([
            self.rx_buffer[0],
            self.rx_buffer[1],
            self.rx_buffer[2],
            self.rx_buffer[3],
        ]) as usize;

        let frame_len = 5 + payload_len + 4;
        if self.rx_buffer.len() < frame_len {
            return Ok(None); // Need more data
        }

        // We have a complete frame
        let frame_bytes: Vec<u8> = self.rx_buffer.drain(..frame_len).collect();
        let frame = Frame::decode(&frame_bytes)?;
        Ok(Some(frame))
    }

    /// Create a ping frame.
    pub fn create_ping() -> Result<Vec<u8>, TransportError> {
        Self::encode_message(MessageType::Ping, &[])
    }

    /// Create an error frame with a message.
    pub fn create_error(error_msg: &str) -> Result<Vec<u8>, TransportError> {
        Self::encode_message(MessageType::Error, error_msg.as_bytes())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn feed_complete_frame() {
        let mut transport = UsbTransport::new();
        transport.set_connected("/dev/usb0".to_string());

        let wire = UsbTransport::encode_message(MessageType::Ping, &[]).unwrap();
        let frame = transport.feed_bytes(&wire).unwrap().unwrap();
        assert_eq!(frame.msg_type, MessageType::Ping);
    }

    #[test]
    fn feed_partial_then_complete() {
        let mut transport = UsbTransport::new();
        transport.set_connected("/dev/usb0".to_string());

        let wire = UsbTransport::encode_message(MessageType::Pong, b"ok").unwrap();

        // Feed first 3 bytes
        assert!(transport.feed_bytes(&wire[..3]).unwrap().is_none());
        // Feed the rest
        let frame = transport.feed_bytes(&wire[3..]).unwrap().unwrap();
        assert_eq!(frame.msg_type, MessageType::Pong);
        assert_eq!(frame.payload, b"ok");
    }

    #[test]
    fn state_transitions() {
        let mut transport = UsbTransport::new();
        assert_eq!(*transport.state(), UsbState::Disconnected);

        transport.set_connected("/dev/usb0".to_string());
        assert!(matches!(transport.state(), UsbState::Connected { .. }));

        transport.set_disconnected();
        assert_eq!(*transport.state(), UsbState::Disconnected);
    }
}
