/**
 * Debug Log Service — Hidden in-app logging for diagnosing issues on-device.
 *
 * Captures timestamped log entries in memory so you can view them
 * from a hidden panel (triple-tap the app version or status bar).
 * Logs are never sent anywhere — they stay on the device.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  tag: string;
  message: string;
  data?: string; // JSON-serialized extra data
}

const MAX_ENTRIES = 500;
let entries: LogEntry[] = [];
let nextId = 1;
let listeners: Array<() => void> = [];

function notify() {
  for (const fn of listeners) fn();
}

function safeStringify(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value, (_key, v) => {
      // Redact anything that looks like a private key or PIN
      if (typeof v === 'string' && v.length > 60) return v.slice(0, 20) + '…[redacted]';
      return v;
    }, 2);
  } catch {
    return String(value);
  }
}

function add(level: LogLevel, tag: string, message: string, data?: unknown) {
  const entry: LogEntry = {
    id: nextId++,
    timestamp: Date.now(),
    level,
    tag,
    message,
    data: safeStringify(data),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES);
  }
  notify();
}

// ─── Public API ───

export const dlog = {
  debug: (tag: string, msg: string, data?: unknown) => add('debug', tag, msg, data),
  info:  (tag: string, msg: string, data?: unknown) => add('info',  tag, msg, data),
  warn:  (tag: string, msg: string, data?: unknown) => add('warn',  tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => add('error', tag, msg, data),

  /** Get all entries (newest last). */
  getAll: (): readonly LogEntry[] => entries,

  /** Clear all entries. */
  clear: () => { entries = []; nextId = 1; notify(); },

  /** Subscribe to changes — returns unsubscribe function. */
  subscribe: (fn: () => void): (() => void) => {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  },

  /** Export entries as a copyable text blob. */
  export: (): string => {
    return entries.map(e => {
      const ts = new Date(e.timestamp).toISOString();
      const data = e.data ? `  ${e.data}` : '';
      return `[${ts}] ${e.level.toUpperCase()} [${e.tag}] ${e.message}${data}`;
    }).join('\n');
  },
};
