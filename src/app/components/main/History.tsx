import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Filter, CheckCircle2, Clock, XCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';
import { BottomNav } from '../shared/BottomNav';
import { useWallet } from '../../../contexts/WalletContext';
import { type ParsedTransaction } from '../../../services/solscan';
import {
  loadTransactions,
  syncTransactions,
  isOnline,
  isOnWifi,
  onConnectivityChange,
  getLastSyncTime,
} from '../../../services/transaction-cache';

type Transaction = ParsedTransaction;

export function History() {
  const { publicKey } = useWallet();
  const [filter, setFilter] = useState<'all' | 'send' | 'receive' | 'swap'>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [online, setOnline] = useState(isOnline());
  const [wifi, setWifi] = useState(isOnWifi());
  const [lastSync, setLastSync] = useState(0);
  const [error, setError] = useState('');
  const unsubRef = useRef<(() => void) | null>(null);

  // Load cached data immediately, then sync if on WiFi
  const fetchTransactions = useCallback(async (force = false) => {
    if (!publicKey) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await loadTransactions(publicKey, force);
      setTransactions(result.transactions);
      if (result.synced) setLastSync(Date.now());
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Update last sync display
  useEffect(() => {
    if (publicKey) setLastSync(getLastSyncTime(publicKey));
  }, [publicKey]);

  // Listen for online/WiFi changes and auto-sync
  useEffect(() => {
    unsubRef.current = onConnectivityChange(async (nowOnline, nowWifi) => {
      setOnline(nowOnline);
      setWifi(nowWifi);
      if (nowWifi && publicKey) {
        setIsSyncing(true);
        const merged = await syncTransactions(publicKey);
        if (merged) {
          setTransactions(merged);
          setLastSync(Date.now());
        }
        setIsSyncing(false);
      }
    });
    return () => unsubRef.current?.();
  }, [publicKey]);

  const handleManualRefresh = useCallback(() => {
    if (!publicKey) return;
    setIsSyncing(true);
    syncTransactions(publicKey).then(merged => {
      if (merged) {
        setTransactions(merged);
        setLastSync(Date.now());
      }
      setIsSyncing(false);
    });
  }, [publicKey]);

  const formatLastSync = () => {
    if (!lastSync) return 'Never synced';
    const diff = Math.floor((Date.now() - lastSync) / 1000);
    if (diff < 60) return 'Synced just now';
    if (diff < 3600) return `Synced ${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `Synced ${Math.floor(diff / 3600)}h ago`;
    return `Synced ${Math.floor(diff / 86400)}d ago`;
  };

  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(tx => tx.type === filter);

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'send':
        return (
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 text-red-400" />
          </div>
        );
      case 'receive':
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
          </div>
        );
      case 'swap':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-blue-400" />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black pb-32 pt-12">
      {/* Header */}
      <div className="px-3 sm:px-6 pt-3 sm:pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold text-white">History</h1>
          <div className="flex items-center gap-2">
            {online ? (
              <Wifi className={`w-4 h-4 ${wifi ? 'text-emerald-400' : 'text-amber-400'}`} />
            ) : (
              <WifiOff className="w-4 h-4 text-white/30" />
            )}
            <button
              onClick={handleManualRefresh}
              disabled={!online || isSyncing}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30"
            >
              <RefreshCw className={`w-4 h-4 text-white/60 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <p className="text-xs text-white/40 mb-4">
          {isSyncing ? 'Syncing…' : !online ? 'Offline — showing cached history' : formatLastSync()}
        </p>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'send', 'receive', 'swap'].map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType as typeof filter)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all active:scale-95 ${
                filter === filterType
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </button>
          ))}
          <button className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors ml-auto flex-shrink-0 active:scale-95">
            <Filter className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="px-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin mb-4" />
            <p className="text-white/40">Loading transactions...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => fetchTransactions(true)}
              className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
        <div className="space-y-2">
          {filteredTransactions.map((tx, index) => (
            <motion.a
              key={tx.id}
              href={`https://solscan.io/tx/${tx.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="block bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start gap-4">
                {getTypeIcon(tx.type)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white capitalize">
                      {tx.type}
                    </span>
                    {getStatusIcon(tx.status)}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-white/60">{tx.asset}</span>
                    <span className="text-xs text-white/40">•</span>
                    <span className="text-xs text-white/40">{tx.network}</span>
                  </div>

                  {(tx.from || tx.to) && (
                    <div className="text-xs text-white/40 mb-1">
                      {tx.from && `From ${tx.from}`}
                      {tx.to && `To ${tx.to}`}
                    </div>
                  )}

                  <span className="text-xs text-white/40">{tx.timestamp}</span>
                </div>

                <div className="text-right">
                  <div
                    className={`font-semibold mb-1 ${
                      tx.type === 'receive'
                        ? 'text-emerald-400'
                        : tx.type === 'send'
                        ? 'text-red-400'
                        : 'text-white'
                    }`}
                  >
                    {tx.type === 'swap' ? tx.amount : `${tx.amount} ${tx.asset}`}
                  </div>
                  <div className="text-sm text-white/60">{tx.fiatValue}</div>
                </div>
              </div>
            </motion.a>
          ))}
        </div>
        )}

        {!isLoading && !error && filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-white/40" />
            </div>
            <p className="text-white/60">No transactions found</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}