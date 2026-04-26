import { useState, useEffect, useCallback } from 'react';
import { Usb, RefreshCw, HardDrive, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { useStartupPage } from '../../../utils/useStartupPage';
import { detectUSBDevices, requestUSBPermission, checkExistingWallet } from '../../../services/usb-flash';
import type { USBDevice } from '../../../services/usb-flash';

export function USBConnect() {
  const [devices, setDevices] = useState<USBDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<USBDevice | null>(null);
  const [scanning, setScanning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hasExistingWallet, setHasExistingWallet] = useState(false);
  const [existingPubkey, setExistingPubkey] = useState<string | null>(null);
  const navigate = useNavigate();
  useStartupPage();

  const scanForDevices = useCallback(async () => {
    setScanning(true);
    try {
      const found = await detectUSBDevices();
      setDevices(found);
      if (found.length === 1) {
        setSelectedDevice(found[0]);
      }
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    scanForDevices();
    // Poll for device changes every 2 seconds
    const interval = setInterval(scanForDevices, 2000);
    return () => clearInterval(interval);
  }, [scanForDevices]);

  const handleSelectDevice = async (device: USBDevice) => {
    setSelectedDevice(device);
    // Request permission
    const granted = await requestUSBPermission(device);
    if (granted) {
      // Check for existing wallet
      const existing = await checkExistingWallet(device);
      if (existing.hasWallet) {
        setHasExistingWallet(true);
        setExistingPubkey(existing.publicKey || null);
      }
    }
  };

  const handleConnect = async () => {
    if (!selectedDevice) return;
    const granted = await requestUSBPermission(selectedDevice);
    if (granted) {
      setConnected(true);
      // Store selected device in sessionStorage for the flash step
      sessionStorage.setItem('coldstar_usb_device', JSON.stringify(selectedDevice));
      setTimeout(() => {
        navigate('/onboarding/firmware');
      }, 1000);
    }
  };

  const handleUseExisting = () => {
    // Navigate to startup flash — it will detect the existing wallet and
    // show the unlock-PIN flow instead of the create-PIN flow
    if (selectedDevice) {
      sessionStorage.setItem('coldstar_usb_device', JSON.stringify(selectedDevice));
    }
    sessionStorage.setItem('coldstar_creating_new_wallet', 'true');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-between p-6 pb-12 pt-16">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full">
        <motion.div
          animate={connected ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <div className={`w-32 h-32 rounded-3xl flex items-center justify-center transition-all duration-500 ${
            connected 
              ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-2xl shadow-emerald-500/50' 
              : devices.length > 0
              ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500/40'
              : 'bg-white/5 border-2 border-dashed border-white/20'
          }`}>
            <Usb className={`w-16 h-16 transition-colors duration-500 ${
              connected ? 'text-white' : devices.length > 0 ? 'text-blue-400' : 'text-white/40'
            }`} />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-semibold text-white mb-4">
            {connected ? 'USB Drive Connected' : 
             devices.length > 0 ? 'USB Drive Detected' : 'Connect USB Drive'}
          </h1>
          <p className="text-base text-white/60 leading-relaxed max-w-sm">
            {connected 
              ? 'Proceeding to firmware installation...'
              : devices.length > 0
              ? `Found ${devices.length} USB device${devices.length > 1 ? 's' : ''}. Select one to continue.`
              : 'Insert a USB drive via OTG adapter to create your cold wallet'
            }
          </p>
        </motion.div>

        {/* Device list */}
        {!connected && devices.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full space-y-3 mb-6"
          >
            {devices.map((device) => (
              <button
                key={device.deviceId}
                onClick={() => handleSelectDevice(device)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                  selectedDevice?.deviceId === device.deviceId
                    ? 'bg-blue-500/15 border border-blue-500/40'
                    : 'bg-white/5 border border-white/10 active:bg-white/10'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedDevice?.deviceId === device.deviceId
                    ? 'bg-blue-500/20' : 'bg-white/10'
                }`}>
                  <HardDrive className={`w-5 h-5 ${
                    selectedDevice?.deviceId === device.deviceId
                      ? 'text-blue-400' : 'text-white/60'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium text-sm">
                    {device.productName || device.deviceName}
                  </p>
                  <p className="text-white/40 text-xs">
                    {device.formattedSize !== '0 B' ? device.formattedSize : 'USB Storage'}
                    {device.manufacturerName !== 'Unknown' ? ` · ${device.manufacturerName}` : ''}
                  </p>
                </div>
                {selectedDevice?.deviceId === device.deviceId && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </motion.div>
        )}

        {/* Existing wallet warning */}
        {hasExistingWallet && !connected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium text-sm mb-1">
                  Existing wallet found
                </p>
                <p className="text-amber-400/70 text-xs mb-3">
                  {existingPubkey ? `${existingPubkey.slice(0, 8)}...${existingPubkey.slice(-8)}` : 'Unknown wallet'}
                </p>
                <button
                  onClick={handleUseExisting}
                  className="text-xs font-medium text-amber-400 underline"
                >
                  Use existing wallet instead
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Info cards (when no devices found) */}
        {!connected && devices.length === 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="space-y-3 w-full bg-white/5 rounded-2xl p-4 border border-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-white">!</span>
              </div>
              <p className="text-sm text-white/80">
                Use a dedicated USB drive (minimum 256MB)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-white">!</span>
              </div>
              <p className="text-sm text-white/80">
                Connect via USB-C OTG adapter
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-white">!</span>
              </div>
              <p className="text-sm text-white/80">
                All existing data will be erased during flash
              </p>
            </div>
          </motion.div>
        )}

        {connected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 text-emerald-400"
          >
            <motion.div
              className="w-3 h-3 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-sm font-medium">Preparing next step...</span>
          </motion.div>
        )}
      </div>

      <div className="w-full max-w-md space-y-3">
        {!connected && devices.length === 0 && (
          <button
            onClick={scanForDevices}
            disabled={scanning}
            className="w-full h-14 rounded-2xl bg-white/10 text-white font-semibold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <RefreshCw className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan for USB devices'}
          </button>
        )}

        {!connected && selectedDevice && (
          <button
            onClick={handleConnect}
            className="w-full h-14 rounded-2xl bg-white text-black font-semibold text-base shadow-xl active:scale-95 transition-transform"
          >
            {hasExistingWallet ? 'Flash new wallet (erase existing)' : 'Continue with this device'}
          </button>
        )}
      </div>
    </div>
  );
}