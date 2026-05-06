# Coldstar Wallet

Repository: https://github.com/devsyrem/coldstar

Coldstar is a mobile-first Solana wallet experience designed around one simple idea: everyday usability with an extra layer of physical control through a USB device.

This project is currently a prototype. It is great for testing flows, design, and product direction, but it should not yet be treated as a production-ready custody product.

## Table of Contents

- [What This App Does](#what-this-app-does)
- [Who This Is For](#who-this-is-for)
- [What You Can Do Today](#what-you-can-do-today)
- [What Is Coming Next](#what-is-coming-next)
- [Quick Start](#quick-start)
- [Install and Run](#install-and-run)
- [Using Coldstar on Solana Seeker](#using-coldstar-on-solana-seeker)
- [How to Use the App](#how-to-use-the-app)
- [Safety Notes](#safety-notes)
- [If Something Is Not Working](#if-something-is-not-working)
- [For Developers](#for-developers)
- [Additional Documentation](#additional-documentation)

## What This App Does

Coldstar helps you:

- Create or unlock a wallet using a USB-assisted setup flow.
- View your portfolio and token balances.
- Send and receive Solana assets.
- Swap tokens with in-app quotes.
- Review transaction history.
- Explore selected Solana dapps.
- View supported real-world asset style tokens in a dedicated section.

The overall experience is designed to feel clear, guided, and mobile-native.

## Who This Is For

- People exploring a hardware-assisted mobile wallet concept.
- Product teams validating wallet UX ideas.
- Builders testing Solana wallet flows on iOS/Android.
- Users who want to understand how USB + PIN + biometric flows can work together.

## What You Can Do Today

### Onboarding and Access

- Detect a connected USB device.
- Create a new wallet flow with PIN protection.
- Unlock an existing wallet from USB with PIN.
- Use biometric unlock on supported devices.

### Wallet Actions

- Check portfolio balance and assets.
- Send tokens by address, paste, or QR scan.
- Receive tokens through your address QR.
- Swap assets with route and quote preview.
- View transaction history with filters.

### Discovery and Insights

- Explore curated Solana dapps.
- See token safety context during swap flow.
- View selected RWA-related holdings in one place.

## What Is Coming Next

- Staking experience.
- Bundle and airdrop tooling.
- More advanced production-hardening and deeper platform integrations.

## Quick Start

If you just want to get the app running quickly:

```bash
npm install
npm run dev
```

If you want to run it as a mobile app:

```bash
chmod +x setup-mobile.sh
./setup-mobile.sh
```

## Install and Run

### 1. Install dependencies

```bash
npm install
```

### 2. Start local web preview

```bash
npm run dev
```

### 3. Build a production web bundle

```bash
npm run build
```

### 4. Prepare mobile platforms

Option A: guided setup script.

```bash
chmod +x setup-mobile.sh
./setup-mobile.sh
```

Option B: manual setup.

```bash
npm run build
npx cap add ios
npx cap add android
npm run cap:sync
```

### 5. Open native projects

```bash
npm run cap:ios
npm run cap:android
```

## Using Coldstar on Solana Seeker

Coldstar includes Seeker-oriented UX language and biometric flow support where available.

Recommended setup path:

1. Build and sync the app:

```bash
npm run mobile:build
```

2. Open Android Studio:

```bash
npm run cap:android
```

3. Choose your Seeker device and run the app.
4. Connect a dedicated USB drive using USB-C/OTG.
5. Follow the in-app prompts to either:
   - Unlock an existing wallet on USB, or
   - Create a new wallet and complete setup.

## How to Use the App

### First-Time Setup

1. Launch the app.
2. Let the app detect your USB device.
3. Choose one path:
   - Existing wallet: unlock with your PIN.
   - New wallet: set a PIN and complete the creation flow.
4. Save and store your USB device safely.
5. Enter the main wallet screen.

### Home

The Home screen gives you a fast summary of your holdings, plus quick action buttons for Send, Receive, Swap, and Bundle.

### Send

Use Send when moving tokens to another wallet.

- Pick the token.
- Add destination address by typing, pasting, or scanning QR.
- Enter amount and review details.
- Confirm with PIN and sign.

### Receive

Use Receive when someone is sending funds to you.

- Show your wallet QR code.
- Copy your address.
- Share it with the sender.

### Swap

Swap lets you convert one token into another within the app.

- Choose what to swap from and to.
- Enter amount.
- Review quote, route details, and expected output.
- Confirm with PIN to complete.

### RWA View

The RWA area highlights selected real-world asset style tokens detected in your wallet so they are easier to monitor.

### History

History gives you a timeline of sends, receives, and swaps, including cached visibility when offline.

### Explore

Explore is a curated list of Solana apps and websites you may want to visit.

## Safety Notes

- This is a prototype, not a finished security product.
- Keep your USB device physically secure.
- Never share your PIN.
- Test with small amounts only.
- Do not use this build for serious long-term storage.

## If Something Is Not Working

### USB not detected

- Reconnect the USB and adapter.
- Confirm your cable/adapter supports data transfer.
- Try a different USB drive.
- Approve device permissions when prompted.

### Mobile app looks out of date

Run:

```bash
npm run build
npm run cap:sync
```

Then rebuild/run again in Xcode or Android Studio.

### iOS pod issue

```bash
cd ios/App
pod repo update
pod install --repo-update
```

## For Developers

Useful commands:

```bash
npm run dev
npm run build
npm run preview
npm run cap:sync
npm run cap:ios
npm run cap:android
npm run mobile:build
```

Backend Rust workspace lives in backend/.

```bash
cd backend
cargo check
cargo test
```

## Additional Documentation

- [MOBILE_BUILD_GUIDE.md](MOBILE_BUILD_GUIDE.md) for platform build and deployment details.
- [FEATURES_BACKEND_SPEC.md](FEATURES_BACKEND_SPEC.md) for API and backend feature expectations.
- [CONVERSION_SUMMARY.md](CONVERSION_SUMMARY.md) for web-to-mobile conversion history.

## License

MIT
