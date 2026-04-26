# Coldstar Mobile App - Build & Deployment Guide

This guide explains how to build and deploy the Coldstar wallet as a native iOS and Android mobile application using Capacitor.

## 📱 Overview

Coldstar has been converted from a web app to a native mobile app using **Capacitor**, which allows the React codebase to run as a native iOS/Android application with full access to native device features like haptics, status bar control, and splash screens.

## 🔧 Prerequisites

### For iOS Development
- macOS computer
- Xcode 14+ installed from the Mac App Store
- Apple Developer account (for App Store distribution)
- CocoaPods installed: `sudo gem install cocoapods`

### For Android Development
- Android Studio installed
- Java JDK 17+
- Android SDK installed via Android Studio

### General Requirements
- Node.js 18+ and npm/pnpm
- All project dependencies installed

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
# or
pnpm install
```

### 2. Build the Web App
```bash
npm run build
```

### 3. Initialize Capacitor (First Time Only)
```bash
npx cap init
```
When prompted:
- **App name:** Coldstar
- **App ID:** com.coldstar.wallet (or your custom bundle ID)
- **Web asset directory:** dist

### 4. Add Mobile Platforms

#### For iOS:
```bash
npx cap add ios
npm run cap:sync
```

#### For Android:
```bash
npx cap add android
npm run cap:sync
```

## 🛠 Development Workflow

### Testing on Device/Simulator

#### iOS:
```bash
# Build web assets and sync to iOS
npm run mobile:build

# Open in Xcode
npm run cap:ios
```

In Xcode:
1. Select your target device/simulator
2. Click the Play button to build and run
3. For physical devices, ensure you have a valid provisioning profile

#### Android:
```bash
# Build web assets and sync to Android
npm run mobile:build

# Open in Android Studio
npm run cap:android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. Select your target device/emulator
3. Click Run

### Live Reload During Development

For faster development, you can use the Vite dev server:

```bash
# Start dev server
npm run dev
```

Then update `capacitor.config.ts` temporarily:
```typescript
server: {
  url: 'http://YOUR_IP:3000',
  cleartext: true
}
```

Run `npx cap sync` and rebuild in Xcode/Android Studio.

**Important:** Remove the `server.url` config before production builds!

## 📦 Production Build

### iOS App Store Build

1. **Build web assets:**
   ```bash
   npm run build
   npx cap sync ios
   ```

2. **Open Xcode:**
   ```bash
   npm run cap:ios
   ```

3. **Configure signing:**
   - Select your project in Xcode
   - Go to "Signing & Capabilities"
   - Select your Team
   - Ensure provisioning profile is valid

4. **Archive:**
   - Product → Archive
   - Once complete, click "Distribute App"
   - Choose "App Store Connect"
   - Follow the prompts

5. **Submit to App Store Connect:**
   - Upload will complete automatically
   - Go to App Store Connect to configure metadata and submit for review

### Android Play Store Build

1. **Build web assets:**
   ```bash
   npm run build
   npx cap sync android
   ```

2. **Open Android Studio:**
   ```bash
   npm run cap:android
   ```

3. **Generate signed APK/AAB:**
   - Build → Generate Signed Bundle / APK
   - Choose "Android App Bundle" (recommended)
   - Create or select your keystore
   - Select "release" build variant
   - Click Finish

4. **Upload to Play Console:**
   - Go to Google Play Console
   - Create a new release
   - Upload your AAB file
   - Fill in release notes and submit for review

## 🎨 Customization

### App Icons & Splash Screens

#### iOS:
- Add icons to: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Add splash screens to: `ios/App/App/Assets.xcassets/Splash.imageset/`

Required iOS icon sizes: 20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024

#### Android:
- Add icons to: `android/app/src/main/res/mipmap-*/`
- Add splash to: `android/app/src/main/res/drawable*/`

Required Android icon sizes: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi

### App Name & Bundle ID

Edit `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  appId: 'com.yourcompany.coldstar', // Change this
  appName: 'Coldstar', // Change this
  // ... rest of config
};
```

After changing, run:
```bash
npx cap sync
```

### Permissions

#### iOS Permissions
Edit `ios/App/App/Info.plist` to add permission descriptions:
```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to scan QR codes</string>
```

#### Android Permissions
Edit `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

## 🐛 Troubleshooting

### iOS Build Issues

**Pod install fails:**
```bash
cd ios/App
pod repo update
pod install --repo-update
```

**Code signing issues:**
- Ensure you're logged into Xcode with your Apple ID
- Check that your provisioning profile is valid
- Try "Automatically manage signing"

### Android Build Issues

**Gradle sync fails:**
- Update Android Studio to latest version
- Invalidate caches: File → Invalidate Caches / Restart
- Check Java version: `java -version` (should be 17+)

**APK size too large:**
- Enable R8/ProGuard minification in `android/app/build.gradle`
- Use Android App Bundle (.aab) instead of APK

### General Issues

**Changes not reflecting:**
```bash
npm run build
npx cap sync
# Then rebuild in Xcode/Android Studio
```

**Capacitor plugins not working:**
```bash
npx cap sync
npm run cap:sync
```

## 📱 Native Features Implemented

- ✅ **Haptic Feedback** - Tactile feedback on swipe gestures and button presses
- ✅ **Status Bar Control** - Black status bar matching app design
- ✅ **Splash Screen** - Custom loading screen on app launch
- ✅ **Safe Area Handling** - Proper spacing for iOS notch/Dynamic Island
- ✅ **Pull-to-Refresh Disabled** - Prevents accidental browser refresh
- ✅ **Double-Tap Zoom Disabled** - Better touch control

## 🔐 Security Considerations

For a production cryptocurrency wallet:
- Implement biometric authentication (Face ID, Touch ID, Fingerprint)
- Add Keychain/Keystore integration for secure key storage
- Enable SSL pinning
- Implement jailbreak/root detection
- Add code obfuscation
- Enable tamper detection

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Android Material Design](https://material.io/design)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy](https://play.google.com/about/developer-content-policy/)

## 🆘 Support

For Capacitor-specific issues:
- [Capacitor GitHub Issues](https://github.com/ionic-team/capacitor/issues)
- [Capacitor Community](https://ionic.io/community)

---

**Note:** This is a demonstration app. For production cryptocurrency wallet deployment, additional security measures, audits, and compliance with financial regulations are required.
