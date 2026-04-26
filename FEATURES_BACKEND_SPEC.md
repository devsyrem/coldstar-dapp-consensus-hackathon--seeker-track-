# Coldstar Wallet - Backend Feature Specification

## Overview
Coldstar is a Solana-specific self-custody wallet with hardware-assisted signing via USB removable drive. This document outlines all frontend features requiring backend support.

---

## 1. User Onboarding & Device Management

### 1.1 USB Hardware Device Initialization
**Features:**
- USB device detection and connection status
- Firmware installation/flashing to USB drive
- Device pairing with wallet
- Hardware connection state management

**Backend Requirements:**
- Store device pairing information (device ID, public key)
- Track firmware version and update status
- Manage device connection sessions
- Device authentication endpoints

**API Endpoints Needed:**
```
POST /api/device/pair - Pair new USB device
GET /api/device/status - Check device connection status
POST /api/device/firmware/update - Trigger firmware update
GET /api/device/firmware/version - Check current firmware version
```

---

## 2. Wallet & Account Management

### 2.1 Wallet Creation/Import
**Features:**
- Generate new Solana wallet
- Import existing wallet via seed phrase
- Wallet address generation
- Multi-account support (future consideration)

**Backend Requirements:**
- Store encrypted wallet metadata (NOT private keys - those stay on device)
- Track wallet addresses and public keys
- User authentication and session management
- Account creation timestamps

**API Endpoints Needed:**
```
POST /api/wallet/create - Create new wallet record
POST /api/wallet/import - Import existing wallet
GET /api/wallet/info - Get wallet metadata
GET /api/wallet/addresses - Get all addresses for wallet
```

### 2.2 Balance & Portfolio Tracking
**Features:**
- Real-time SOL balance
- SPL token balances (USDC, USDT, JUP, JTO, BONK, etc.)
- Fiat value conversion (USD)
- 24h price change tracking
- Portfolio total value
- Historical balance data for charts

**Backend Requirements:**
- Integrate with Solana RPC nodes
- Real-time token price feeds (Jupiter, CoinGecko, or similar)
- Cache balance data for performance
- Track portfolio changes over time
- Support for custom SPL tokens

**API Endpoints Needed:**
```
GET /api/portfolio/balance - Get all token balances
GET /api/portfolio/value - Get total portfolio value in USD
GET /api/portfolio/history?period=24h|7d|30d|1y - Historical portfolio data
GET /api/token/price/:symbol - Get current token price
GET /api/token/chart/:symbol?period=24h - Get price chart data
```

---

## 3. Token Safety Scoring

### 3.1 Token Risk Assessment
**Features:**
- Safety score for each token: "Safe", "Caution", "Ruggable"
- Display in asset dropdown on Home tab and RWA Assets tab
- Real-time risk evaluation

**Backend Requirements:**
- Token verification system
- Check liquidity depth
- Analyze holder distribution
- Verify token mint authority status
- Social signals and community validation
- Rugcheck.xyz or similar integration

**API Endpoints Needed:**
```
GET /api/token/safety/:mintAddress - Get token safety score
GET /api/token/metadata/:mintAddress - Get token metadata and risk factors
POST /api/token/verify - Verify custom token address
```

**Safety Score Criteria:**
- **Safe**: Established tokens (SOL, USDC, USDT), verified mints, high liquidity
- **Caution**: Moderate liquidity, some centralization concerns
- **Ruggable**: Low liquidity, unverified, suspicious holder distribution

---

## 4. Real World Assets (RWA) - Digital Assets Tab

### 4.1 RWA Asset Management
**Features:**
- Dedicated tab for Real World Assets (tokenized traditional financial instruments)
- **Developer-curated whitelist**: Only pre-approved RWA tokens appear in this tab
- Asset categories: Stablecoins, Treasury, Commodities, Tokenized Stocks (Equities), Real Estate, Private Credit, Basket/Index
- **Comprehensive RWA Token Support:**
  
  **Stablecoins (Core RWAs)**
  - USDC - USD Coin (Circle)
  - USDT - Tether USD (Tether)
  
  **Tokenized Treasuries / Yield**
  - USDY - Ondo US Dollar Yield (Ondo Finance)
  - OUSG - Ondo Short-Term US Government Bonds (Ondo Finance)
  
  **Commodities (Gold)**
  - PAXG - Pax Gold (Paxos)
  - XAUT - Tether Gold (Tether)
  
  **Tokenized Stocks (Emerging)**
  - xTSLA - Tokenized Tesla (Backed Finance)
  - xAAPL - Tokenized Apple (Backed Finance)
  - xNVDA - Tokenized NVIDIA (Backed Finance)
  - Additional xStocks via Backed or similar platforms
  
  **Real Estate**
  - HOMEBASE - Residential real estate tokens
  - PARCL - Real estate price indices
  
  **Private Credit / Yield RWAs**
  - MPL - Maple Finance (Institutional credit pools)
  - CREDIX - Credix (Emerging market credit)
  
  **RWA Baskets / Indexes**
  - ISC - Multi-asset RWA basket tokens
  
  **"Hot Wallet Ready" Priority Subset:**
  - USDC, USDT (most liquid)
  - PAXG, XAUT (gold commodities)
  - USDY (if accessible to users)

- Display asset details: issuer, backing mechanism, market cap, price
- Real-time price tracking and 24h change
- Category filtering (All, Stablecoins, Treasury, Commodities, Stocks, Real Estate, Credit, Basket)
- Search functionality across all RWA assets
- Total RWA portfolio value
- Interactive charts for price history
- Send/Swap functionality for each asset
- **No safety warnings**: Assets in this tab are pre-vetted and controlled by developers

**Backend Requirements:**
- Maintain developer-controlled whitelist of approved RWA tokens
- Integrate with RWA-specific price oracles and data providers
- Track issuer information and backing mechanisms for all categories
- Store RWA-specific metadata (backing details, issuer, regulatory info)
- Monitor market cap and trading volume for RWA tokens
- **Category-specific data integrations:**
  - **Stablecoins**: Circle API (USDC), Tether Transparency (USDT)
  - **Treasury**: Ondo Finance API for USDY/OUSG yields and NAV
  - **Commodities**: London Bullion Market for gold (PAXG, XAUT)
  - **Tokenized Stocks**: Backed Finance API, traditional stock market data (NYSE, NASDAQ)
  - **Real Estate**: Homebase property data, Parcl index pricing
  - **Credit**: Maple Finance pool data, Credix portfolio yields
  - **Baskets**: ISC index composition and rebalancing data
- **Admin-only endpoints** to add/remove RWA tokens from whitelist

**API Endpoints Needed:**
```
GET /api/rwa/assets - Get all whitelisted RWA assets with balances
GET /api/rwa/categories - Get RWA categories
GET /api/rwa/asset/:mintAddress - Get detailed RWA asset info
GET /api/rwa/issuer/:issuerName - Get issuer details (Ondo, Circle, Backed, etc.)
GET /api/rwa/backing/:mintAddress - Get backing mechanism and proof
GET /api/rwa/portfolio/value - Get total RWA portfolio value
GET /api/rwa/search?query=tesla - Search whitelisted RWA assets
GET /api/rwa/price/:symbol - Get current RWA token price
GET /api/rwa/chart/:symbol?period=24h|7d|30d - Get RWA price chart
GET /api/rwa/market-cap/:symbol - Get RWA token market cap
GET /api/rwa/yield/:symbol - Get current yield/APY for treasury and credit tokens
GET /api/rwa/nav/:symbol - Get Net Asset Value for treasury tokens (USDY, OUSG)

# Admin-only endpoints (developer access required)
POST /api/admin/rwa/add - Add new RWA token to whitelist
DELETE /api/admin/rwa/:mintAddress - Remove RWA token from whitelist
PUT /api/admin/rwa/:mintAddress - Update RWA token metadata
```

**RWA Data Sources by Category:**

1. **Stablecoins**: 
   - Circle API (USDC reserve transparency)
   - Tether Transparency reports (USDT)

2. **Treasury Tokens**:
   - Ondo Finance API (USDY, OUSG NAV and yield data)
   - US Treasury data for underlying bond prices

3. **Commodities**:
   - London Bullion Market Association (LBMA) for gold spot prices
   - Paxos API (PAXG audits and reserves)
   - Tether Gold API (XAUT reserves)

4. **Tokenized Stocks**:
   - Backed Finance API for tokenized stock pricing
   - Traditional stock market feeds (Yahoo Finance, Alpha Vantage)
   - Real-time NYSE/NASDAQ data

5. **Real Estate**:
   - Homebase property valuations
   - Parcl real estate index methodology
   - Regional housing market data

6. **Private Credit**:
   - Maple Finance protocol data (pool statistics, yields)
   - Credix API (loan performance, emerging market credit)
   - DeFi Llama for TVL and protocol metrics

7. **RWA Baskets**:
   - Index provider APIs (ISC composition)
   - Constituent token prices and weights

**RWA Asset Approval Process:**
- Only developers can add assets to the RWA tab
- Thorough vetting of issuer legitimacy and regulatory compliance
- Verification of backing mechanisms and reserve audits
- Manual approval required before appearing in user-facing app
- No dynamic safety scoring - all assets in this tab are considered vetted
- Priority given to "hot wallet ready" assets with high liquidity

---

## 5. Transaction Management

### 5.1 Send Transactions
**Features:**
- Send SOL or SPL tokens to recipient address
- Amount input with balance validation
- Address validation and ENS/domain support (e.g., .sol domains)
- Transaction fee estimation
- Recent recipient history
- Address book/contacts

**Backend Requirements:**
- Validate Solana addresses
- Resolve .sol domains to addresses
- Calculate network fees
- Store transaction history
- Track pending transactions
- Store contact list

**API Endpoints Needed:**
```
POST /api/transaction/prepare - Prepare transaction (validate, estimate fee)
POST /api/transaction/submit - Submit signed transaction to network
GET /api/transaction/status/:signature - Check transaction status
GET /api/transaction/fee/estimate - Estimate transaction fee
GET /api/address/validate - Validate Solana address
GET /api/address/resolve/:domain - Resolve .sol domain
GET /api/contacts - Get user's contacts
POST /api/contacts - Add new contact
```

### 5.2 Receive Transactions
**Features:**
- Display wallet address as text and QR code
- Copy address to clipboard
- Share functionality
- Show incoming transactions

**Backend Requirements:**
- Generate QR code for address
- Track incoming pending transactions
- Real-time transaction monitoring

**API Endpoints Needed:**
```
GET /api/wallet/receive/address - Get primary receive address
GET /api/wallet/receive/qr - Generate QR code
GET /api/transaction/incoming - Monitor incoming transactions
```

### 5.3 Swap Transactions
**Features:**
- Token-to-token swaps via Jupiter aggregator
- From/To token selection
- Amount input with slippage tolerance
- Best route calculation
- Price impact warning
- Swap preview with exchange rate

**Backend Requirements:**
- Integration with Jupiter Aggregator API
- Get swap routes and quotes
- Calculate price impact
- Submit swap transactions
- Track swap history

**API Endpoints Needed:**
```
GET /api/swap/quote - Get swap quote (amount, from, to tokens)
GET /api/swap/routes - Get all available swap routes
POST /api/swap/execute - Execute swap transaction
GET /api/swap/history - Get user's swap history
```

### 5.4 Bundle Transactions (Bulk Send)
**Features:**
- **Bulk Send Tab**: Equal distribution to multiple addresses
- **Transaction Block Builder**: Complex multi-action bundles
  - Send blocks (transfer to addresses)
  - Swap blocks (token exchanges)
  - Stake blocks (stake to validators/protocols)
  - Unstake blocks (withdraw staked tokens)
- Drag-and-drop reordering
- Atomic execution (all or nothing)
- Fee estimation for entire bundle

**Backend Requirements:**
- Build complex Solana transactions with multiple instructions
- Validate transaction bundle atomicity
- Calculate total fees for bundle
- Execute bundle as single transaction
- Store bundle templates

**API Endpoints Needed:**
```
POST /api/bundle/prepare - Prepare bundle transaction
POST /api/bundle/simulate - Simulate bundle execution
POST /api/bundle/submit - Submit signed bundle
GET /api/bundle/estimate-fee - Estimate total bundle fee
GET /api/bundle/templates - Get saved bundle templates
POST /api/bundle/template - Save bundle template
```

### 5.5 Airdrop Features
**Features:**
- NFT holder distribution
- CSV upload for recipient lists
- Token allocation management

**Backend Requirements:**
- Parse CSV files
- Validate recipient addresses in bulk
- Query NFT holders by collection
- Create airdrop distribution transactions

**API Endpoints Needed:**
```
POST /api/airdrop/validate-csv - Validate uploaded CSV
GET /api/airdrop/nft-holders/:collection - Get NFT holder addresses
POST /api/airdrop/prepare - Prepare airdrop transactions
POST /api/airdrop/execute - Execute airdrop
```

---

## 6. Transaction History

### 6.1 Activity Feed
**Features:**
- Chronological list of all transactions
- Filter by type: All, Sent, Received, Swapped, Staked
- Filter by token
- Transaction details (amount, timestamp, status, signature)
- Clickable transaction signatures linking to Solana Explorer
- Pending/Confirmed/Failed status

**Backend Requirements:**
- Index all wallet transactions from Solana blockchain
- Parse transaction types and metadata
- Store transaction history with full details
- Support pagination
- Real-time transaction monitoring

**API Endpoints Needed:**
```
GET /api/history?type=all|sent|received|swapped|staked&page=1&limit=50 - Get transaction history
GET /api/history/:signature - Get transaction details
GET /api/history/pending - Get pending transactions
POST /api/history/sync - Force sync latest transactions
```

---

## 7. Staking Features

### 7.1 Staking Opportunities
**Features:**
- List of staking protocols: Marinade, Kamino, Drift, Jito, Lido
- APY rates for each protocol
- Total staked amount per protocol
- Available to stake balance
- Staking rewards tracking
- Unstaking periods and cooldowns

**Backend Requirements:**
- Integrate with staking protocol APIs
- Fetch current APY rates
- Track user's staked positions
- Calculate pending rewards
- Manage stake/unstake transactions
- Track validator performance

**API Endpoints Needed:**
```
GET /api/stake/protocols - List all supported staking protocols
GET /api/stake/rates - Get current APY rates
GET /api/stake/positions - Get user's staking positions
GET /api/stake/rewards - Calculate pending rewards
POST /api/stake/execute - Stake tokens
POST /api/stake/unstake - Unstake tokens
GET /api/stake/validators - Get validator list and performance
```

---

## 8. DApp Discovery (Explore Tab)

### 8.1 Featured DApps
**Features:**
- Curated list of Solana DApps
- Categories: DeFi, NFTs, Gaming, Social
- Featured DApps with descriptions
- Direct links to DApps
- Popular DApps ranking

**Backend Requirements:**
- DApp directory database
- Curate and update DApp listings
- Track DApp popularity metrics
- Store DApp metadata (logo, description, URL, category)

**API Endpoints Needed:**
```
GET /api/dapps/featured - Get featured DApps
GET /api/dapps/category/:category - Get DApps by category
GET /api/dapps/popular - Get popular DApps
GET /api/dapps/:id - Get DApp details
```

### 8.2 Market Data
**Features:**
- Top trending tokens
- Biggest gainers/losers
- Market cap rankings
- Trading volume data

**Backend Requirements:**
- Integrate with market data APIs
- Cache market data for performance
- Update trending data periodically

**API Endpoints Needed:**
```
GET /api/market/trending - Get trending tokens
GET /api/market/gainers - Get top gainers
GET /api/market/losers - Get top losers
GET /api/market/volume - Get tokens by volume
```

---

## 9. NFT Management

### 9.1 NFT Portfolio
**Features:**
- Display all NFTs owned by wallet
- NFT metadata (image, name, collection)
- Floor price from marketplaces
- NFT detail view
- Send NFT functionality

**Backend Requirements:**
- Index NFTs from Solana blockchain
- Fetch NFT metadata from Metaplex
- Get floor prices from Magic Eden, Tensor, etc.
- Support NFT transfers

**API Endpoints Needed:**
```
GET /api/nft/portfolio - Get all NFTs owned
GET /api/nft/:mintAddress - Get NFT details
GET /api/nft/collection/:id - Get collection details
POST /api/nft/transfer - Transfer NFT
GET /api/nft/floor-price/:collection - Get collection floor price
```

---

## 10. Hardware Device Integration

### 10.1 Transaction Signing
**Features:**
- Swipe-to-sign gesture interface
- Transaction approval flow
- Hardware device communication
- Sign transaction on USB device
- Transaction rejection handling

**Backend Requirements:**
- Prepare unsigned transactions
- Handle device communication protocol
- Verify signed transactions
- Broadcast signed transactions to Solana network
- Handle signing failures/timeouts

**API Endpoints Needed:**
```
POST /api/transaction/prepare-for-signing - Prepare transaction payload
POST /api/transaction/verify-signature - Verify device signature
POST /api/transaction/broadcast - Broadcast signed transaction
```

### 10.2 Device Status Monitoring
**Features:**
- Real-time hardware connection status
- Visual indicator (connected/disconnected badge)
- Connection loss warnings
- Automatic reconnection

**Backend Requirements:**
- WebUSB API integration (frontend handles this)
- Session management
- Connection state tracking
- Heartbeat/ping mechanism

**API Endpoints Needed:**
```
GET /api/device/heartbeat - Check device connection
POST /api/device/disconnect - Handle device disconnection
POST /api/device/reconnect - Re-establish connection
```

---

## 11. Security Features

### 11.1 Authentication
**Features:**
- Device-based authentication
- Session management
- Biometric support (future)
- PIN/passcode protection (future)

**Backend Requirements:**
- JWT token management
- Session expiration
- Refresh token rotation
- Device fingerprinting

**API Endpoints Needed:**
```
POST /api/auth/login - Authenticate user
POST /api/auth/logout - End session
POST /api/auth/refresh - Refresh access token
GET /api/auth/session - Validate session
```

### 11.2 Security Alerts
**Features:**
- Suspicious transaction warnings
- Large transaction confirmations
- Unknown token warnings
- Scam/phishing detection

**Backend Requirements:**
- Transaction risk analysis
- Token blacklist/whitelist
- Scam address database
- Risk scoring algorithms

**API Endpoints Needed:**
```
POST /api/security/check-transaction - Analyze transaction risk
GET /api/security/token-risk/:mintAddress - Check token risk
GET /api/security/address-risk/:address - Check address risk
```

---

## 12. Notifications & Real-Time Updates

### 12.1 Push Notifications
**Features:**
- Transaction confirmations
- Incoming transfers
- Price alerts
- Staking rewards
- Device connection alerts

**Backend Requirements:**
- Push notification service (FCM, APNs)
- WebSocket connections for real-time updates
- Notification preferences management

**API Endpoints Needed:**
```
POST /api/notifications/register - Register device for push
GET /api/notifications/preferences - Get notification settings
PUT /api/notifications/preferences - Update notification settings
POST /api/notifications/send - Send notification (internal)
```

---

## 13. Asset Management

### 13.1 Token Lists
**Features:**
- Verified SPL token list
- Custom token import
- Token search and filtering
- Hide/show tokens
- Token order customization

**Backend Requirements:**
- Maintain verified token registry
- Validate custom tokens
- Store user token preferences
- Token metadata caching

**API Endpoints Needed:**
```
GET /api/tokens/verified - Get verified token list
GET /api/tokens/search?query=JUP - Search tokens
POST /api/tokens/custom - Add custom token
GET /api/tokens/user-preferences - Get user's token display preferences
PUT /api/tokens/user-preferences - Update token preferences
```

### 13.2 Price Charts
**Features:**
- 24h, 7d, 30d, 1y price charts
- Real-time price updates
- Historical price data
- Interactive chart tooltips

**Backend Requirements:**
- Store historical price data
- Integrate with price oracles (Pyth, Switchboard)
- Cache chart data
- Support multiple timeframes

**API Endpoints Needed:**
```
GET /api/chart/:symbol?period=24h|7d|30d|1y - Get chart data
GET /api/price/realtime/:symbol - Get real-time price updates (WebSocket)
GET /api/price/history/:symbol?from=timestamp&to=timestamp - Historical prices
```

---

## 14. Settings & Preferences

### 14.1 App Settings
**Features:**
- Currency preference (USD, EUR, etc.)
- Language selection
- Network selection (Mainnet/Devnet)
- RPC endpoint configuration
- Privacy settings
- Auto-lock timeout

**Backend Requirements:**
- Store user preferences
- Support multiple currencies
- Custom RPC endpoints

**API Endpoints Needed:**
```
GET /api/settings - Get user settings
PUT /api/settings - Update user settings
GET /api/settings/currencies - Get supported currencies
GET /api/settings/networks - Get supported networks
```

---

## 15. Analytics & Metrics (Internal)

### 15.1 Usage Analytics
**Features:**
- Track user activity (privacy-respecting)
- Popular features
- Transaction volume
- Error monitoring

**Backend Requirements:**
- Analytics data collection
- Privacy-compliant logging
- Performance monitoring
- Error tracking and alerting

**API Endpoints Needed:**
```
POST /api/analytics/event - Log user event
POST /api/analytics/error - Log error
GET /api/analytics/dashboard - Admin analytics (internal)
```

---

## Technical Infrastructure Requirements

### Solana Integration
- **RPC Nodes**: Mainnet and Devnet endpoints (consider using QuickNode, Helius, or Alchemy)
- **Jupiter Aggregator**: For swap functionality
- **Metaplex**: For NFT metadata
- **Pyth/Switchboard**: Price oracles
- **Token List**: Solana Labs token registry

### Database Schema Requirements
- Users/Wallets
- Transactions (indexed by address and signature)
- Device pairings
- Token preferences
- Staking positions
- Contacts/Address book
- DApp directory
- Settings/Preferences
- Notification queue

### Real-Time Requirements
- WebSocket connections for:
  - Live transaction updates
  - Price updates
  - Device status
  - Notification delivery

### Security Requirements
- API rate limiting
- Request authentication (JWT)
- Encrypted sensitive data at rest
- HTTPS only
- Input validation and sanitization
- SQL injection prevention
- CORS configuration
- Audit logging

### Performance Requirements
- Response time < 200ms for most endpoints
- Caching strategy for frequently accessed data
- CDN for static assets
- Database query optimization
- Pagination for large datasets

### Scalability Requirements
- Horizontal scaling capability
- Load balancing
- Database connection pooling
- Queue management for async operations
- Microservices architecture consideration

---

## Mock Data Currently Used (Replace with Real APIs)

### Assets
- SOL, USDC, USDT, JUP, JTO, BONK with hardcoded balances
- Safety scores hardcoded per token
- Price changes calculated from mock data

### Transactions
- Sample transaction history with mock data
- Fake transaction signatures

### Staking
- Mock APY rates for protocols
- Fake staking positions

### NFTs
- Sample NFTs with Unsplash images
- Mock floor prices

### DApps
- Hardcoded DApp list with descriptions

---

## API Response Formats

### Standard Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": "2026-04-02T10:30:00Z"
}
```

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance for transaction",
    "details": { /* additional error info */ }
  },
  "timestamp": "2026-04-02T10:30:00Z"
}
```

---

## Priority Implementation Order

### Phase 1 (MVP)
1. Wallet creation/import
2. Balance fetching (SOL + SPL tokens)
3. Send transactions
4. Receive functionality
5. Transaction history
6. Basic device pairing

### Phase 2 (Core Features)
1. Swap integration (Jupiter)
2. Token safety scoring
3. NFT portfolio
4. Staking protocols
5. DApp directory
6. Price charts

### Phase 3 (Advanced Features)
1. Bundle transactions
2. Airdrop features
3. Advanced security features
4. Push notifications
5. Analytics
6. Custom RPC endpoints

---

## WebUSB Communication Protocol

The frontend handles WebUSB communication directly, but the backend needs to:
1. Generate transaction payloads in the correct format for device signing
2. Verify signatures returned from device
3. Support the device firmware update protocol

**Device Communication Flow:**
```
1. Frontend detects USB device via WebUSB
2. Frontend requests transaction preparation from backend
3. Backend returns unsigned transaction + nonce
4. Frontend sends to device for signing via USB
5. Device returns signature
6. Frontend sends signature to backend for verification
7. Backend broadcasts to Solana network
```

---

## Notes for Developer

- All private keys MUST remain on the USB device - never transmitted or stored on backend
- Use environment variables for all API keys and sensitive config
- Implement comprehensive error handling and logging
- Follow Solana program best practices
- Test thoroughly on Devnet before Mainnet deployment
- Consider rate limits for Solana RPC calls
- Implement proper transaction retry logic
- Use Solana transaction confirmation strategies (recent blockhash, etc.)
- Consider implementing a transaction priority fee estimator
- Monitor Solana network congestion and adjust accordingly

---

## Contact & Questions

For any clarifications or additional feature details, please reach out to the product team.