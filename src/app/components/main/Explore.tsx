import { useState, useEffect } from 'react';
import { Search, ExternalLink, Wallet, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { BottomNav } from '../shared/BottomNav';
import { HardwareStatus } from '../shared/HardwareStatus';
import { useWallet } from '../../../contexts/WalletContext';

interface DApp {
  id: string;
  name: string;
  category: string;
  url: string;
  icon: string;
  description: string;
}

const suggestedDApps: DApp[] = [
  {
    id: '1',
    name: 'Jupiter',
    category: 'DEX',
    url: 'https://jup.ag',
    icon: '🪐',
    description: 'Best swap aggregator on Solana',
  },
  {
    id: '2',
    name: 'Raydium',
    category: 'DEX',
    url: 'https://raydium.io',
    icon: '⚡',
    description: 'AMM and liquidity provider',
  },
  {
    id: '3',
    name: 'Orca',
    category: 'DEX',
    url: 'https://orca.so',
    icon: '🐋',
    description: 'User-friendly DEX on Solana',
  },
  {
    id: '4',
    name: 'Magic Eden',
    category: 'NFT',
    url: 'https://magiceden.io',
    icon: '✨',
    description: 'Leading NFT marketplace',
  },
  {
    id: '5',
    name: 'Tensor',
    category: 'NFT',
    url: 'https://tensor.trade',
    icon: '📊',
    description: 'Pro NFT trading platform',
  },
  {
    id: '6',
    name: 'Drift',
    category: 'DeFi',
    url: 'https://drift.trade',
    icon: '🌊',
    description: 'Perpetual futures trading',
  },
  {
    id: '7',
    name: 'Kamino',
    category: 'DeFi',
    url: 'https://kamino.finance',
    icon: '💎',
    description: 'Automated liquidity solutions',
  },
  {
    id: '8',
    name: 'Marinade',
    category: 'DeFi',
    url: 'https://marinade.finance',
    icon: '🥩',
    description: 'Liquid staking on Solana',
  },
];

const RECENT_DAPPS_KEY = 'coldstar_recent_dapps';

function getRecentlyVisited(): DApp[] {
  try {
    const stored = localStorage.getItem(RECENT_DAPPS_KEY);
    if (!stored) return [];
    const ids: string[] = JSON.parse(stored);
    return ids.map(id => suggestedDApps.find(d => d.id === id)).filter(Boolean) as DApp[];
  } catch {
    return [];
  }
}

function addToRecentlyVisited(dapp: DApp) {
  try {
    const stored = localStorage.getItem(RECENT_DAPPS_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    const filtered = ids.filter(id => id !== dapp.id);
    filtered.unshift(dapp.id);
    localStorage.setItem(RECENT_DAPPS_KEY, JSON.stringify(filtered.slice(0, 5)));
  } catch {
    // ignore storage errors
  }
}

export function Explore() {
  const [searchQuery, setSearchQuery] = useState('');
  const { hardwareConnected, connectedDevice, connectedWalletPubkey, publicKey, disconnectHardware } = useWallet();
  const [recentlyVisited, setRecentlyVisited] = useState<DApp[]>([]);

  useEffect(() => {
    setRecentlyVisited(getRecentlyVisited());
  }, []);

  const handleDAppClick = (dapp: DApp) => {
    addToRecentlyVisited(dapp);
    setRecentlyVisited(getRecentlyVisited());
    window.open(dapp.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-black pb-32 pt-12">
      {/* Header */}
      <div className="px-3 sm:px-6 pt-3 sm:pt-6 pb-4">
        <h1 className="text-2xl font-semibold text-white mb-6">Explore</h1>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or enter URL"
            className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/40 outline-none focus:bg-white/10 focus:border-white/20 transition-all"
          />
        </div>

        {/* Wallet Connection Status */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-white/60" />
              <span className="text-sm font-medium text-white">Wallet Connection</span>
            </div>
            <button
              onClick={hardwareConnected ? disconnectHardware : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                hardwareConnected && connectedWalletPubkey === publicKey
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-white/60 border border-white/10'
              }`}
            >
              {hardwareConnected && connectedWalletPubkey === publicKey ? (connectedDevice?.productName || connectedDevice?.deviceName || 'Connected') : 'Disconnected'}
            </button>
          </div>
          <HardwareStatus connected={hardwareConnected && connectedWalletPubkey === publicKey} deviceName={connectedDevice?.productName || connectedDevice?.deviceName} variant="inline" />
        </div>

        {/* Recently Visited */}
        {recentlyVisited.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-white/60" />
              <h2 className="text-sm font-medium text-white/60">Recently Visited</h2>
            </div>
            <div className="space-y-2">
              {recentlyVisited.map((dapp) => (
                <motion.button
                  key={dapp.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDAppClick(dapp)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-2xl">
                    {dapp.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-white mb-1">{dapp.name}</div>
                    <div className="text-sm text-white/60">{dapp.description}</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/40" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Suggested DApps */}
        <div>
          <h2 className="text-sm font-medium text-white/60 mb-3">Suggested DApps</h2>
          <div className="grid grid-cols-2 gap-3">
            {suggestedDApps
              .filter(dapp => 
                !searchQuery || 
                dapp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                dapp.category.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((dapp, index) => (
              <motion.button
                key={dapp.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleDAppClick(dapp)}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-3xl mb-3 mx-auto">
                  {dapp.icon}
                </div>
                <div className="text-center">
                  <div className="font-semibold text-white mb-1">{dapp.name}</div>
                  <div className="text-xs text-white/40 mb-2">{dapp.category}</div>
                  <div className="text-xs text-white/60 line-clamp-2">
                    {dapp.description}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <p className="text-sm text-amber-400 text-center">
            Always verify you're on the correct website before connecting your wallet
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}