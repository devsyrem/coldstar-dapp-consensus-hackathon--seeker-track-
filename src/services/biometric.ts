/**
 * Biometric Authentication Service — Solana Mobile Seeker fingerprint integration
 * Uses Capacitor's native bridge to access Android BiometricPrompt on Seeker devices.
 * Falls back gracefully when running in browser or when biometrics are unavailable.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

interface BiometricAuthPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  authenticate(options: { reason: string; title: string; subtitle: string }): Promise<void>;
}

let biometricPlugin: BiometricAuthPlugin | null = null;

function getBiometricPlugin(): BiometricAuthPlugin | null {
  if (biometricPlugin) return biometricPlugin;
  if (!Capacitor.isNativePlatform()) return null;

  try {
    biometricPlugin = registerPlugin<BiometricAuthPlugin>('BiometricAuth');
    return biometricPlugin;
  } catch {
    return null;
  }
}

/** Check if biometric authentication is available on this device */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const plugin = getBiometricPlugin();
  if (!plugin) return false;

  try {
    const result = await plugin.isAvailable();
    return result.available;
  } catch {
    return false;
  }
}

/** Trigger biometric authentication (fingerprint on Seeker) */
export async function authenticateWithBiometric(): Promise<boolean> {
  const plugin = getBiometricPlugin();
  if (!plugin) return false;

  try {
    await plugin.authenticate({
      reason: 'Unlock Coldstar Wallet',
      title: 'Authenticate',
      subtitle: 'Use your fingerprint to unlock',
    });
    return true;
  } catch {
    return false;
  }
}
