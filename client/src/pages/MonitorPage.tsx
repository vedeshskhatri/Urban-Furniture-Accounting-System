/**
 * MonitorPage — /monitor
 *
 * Full-screen live ledger integrity board, designed to be read from the back
 * of a presentation room. Connects to Socket.IO and flashes updated figures on
 * each `ledger:changed` event. Fetches /api/verify on mount to prime state.
 *
 * Layout:
 *   - Top-right: status pill + live dot + reconnect indicator
 *   - Centre-top: TOTAL DEBIT · TOTAL CREDIT
 *   - Centre hero: DIFFERENCE (96px mono) + BALANCED / OUT OF BALANCE badge
 *   - Bottom: last-8-entry live feed, newest at top
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Decimal from 'decimal.js';
import { ShieldCheck, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { formatINR } from '../lib/money';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface LedgerPayload {
  totalDebit: string;
  totalCredit: string;
  difference: string;
  entryCount: number;
  lineCount: number;
  lastEntry: {
    number: string;
    date: string;
    time?: string;
    journal: string;
  } | null;
}

interface FeedEntry {
  id: string; // synthetic for React key
  number: string;
  date: string;
  time?: string;
  journal: string;
  arrivedAt: string; // local clock when we got the event
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function now(): string {
  return new Date().toLocaleTimeString('en-IN', { hour12: false });
}

function fmtMoney(val: string): string {
  return formatINR(val || '0');
}

/** Triggers the CSS flash animation by toggling a class on a ref. */
function useFlash(): [React.RefObject<HTMLSpanElement | null>, () => void] {
  const ref = useRef<HTMLSpanElement>(null);
  const trigger = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('animate-figure-flash');
    // Force reflow so removing+re-adding actually fires
    void el.offsetWidth;
    el.classList.add('animate-figure-flash');
  }, []);
  return [ref, trigger];
}

/* ── Money cell — large mono figure with optional flash ─────────────────── */

function MoneyCell({
  label,
  value,
  size = 48,
  color = 'var(--brown-900)',
  flash = false,
}: {
  label: string;
  value: string;
  size?: number;
  color?: string;
  flash?: boolean;
}) {
  const [ref, triggerFlash] = useFlash();

  useEffect(() => {
    if (flash) triggerFlash();
  }, [value, flash, triggerFlash]);

  return (
    <div style={{ textAlign: 'center', minWidth: 0 }}>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <span
        ref={ref}
        style={{
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: size,
          lineHeight: 1.1,
          fontWeight: 500,
          color,
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 6,
        }}
      >
        {fmtMoney(value)}
      </span>
    </div>
  );
}

/* ── Feed row ────────────────────────────────────────────────────────────── */

function FeedRow({ entry, isNew }: { entry: FeedEntry; isNew: boolean }) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isNew && rowRef.current) {
      rowRef.current.classList.remove('animate-figure-flash');
      void rowRef.current.offsetWidth;
      rowRef.current.classList.add('animate-figure-flash');
    }
  }, [isNew]);

  return (
    <div
      ref={rowRef}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 0,
        padding: '10px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 15,
        color: 'rgba(255,255,255,0.82)',
        borderRadius: 6,
      }}
    >
      <span style={{ fontWeight: 500 }}>{entry.number}</span>
      <span style={{ color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{entry.date}</span>
      <span style={{ color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{entry.journal}</span>
      <span style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'right', fontSize: 12 }}>
        {entry.arrivedAt}
      </span>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function MonitorPage() {
  const [ledger, setLedger] = useState<LedgerPayload | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [newestId, setNewestId] = useState<string | null>(null);

  const [debitRef, flashDebit] = useFlash();
  const [creditRef, flashCredit] = useFlash();
  const [diffRef, flashDiff] = useFlash();

  const socketRef = useRef<Socket | null>(null);

  // ── Prime from REST on mount + poll as a safety net ───────────────────
  // The socket is the primary channel, but if a `ledger:changed` event is
  // missed (reconnect gap, dropped frame, StrictMode remount) the figures
  // would silently go stale. A lightweight poll keeps them in sync.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetch('/api/verify', { credentials: 'include' })
        .then((r) => r.json())
        .then((body) => {
          if (!cancelled && body?.data) setLedger(body.data as LedgerPayload);
        })
        .catch(() => {/* ignore — socket or the next poll will recover */});
    };
    refresh();
    const timer = setInterval(refresh, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // ── Socket.IO setup ───────────────────────────────────────────────────
  useEffect(() => {
    const socket = io('/', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      // forceNew avoids sharing a Manager across React StrictMode remounts,
      // which otherwise tears down the live connection on the first cleanup.
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('ledger:changed', (payload: LedgerPayload) => {
      setLedger(payload);

      // Flash the changed figures
      flashDebit();
      flashCredit();
      flashDiff();

      // Append to feed, newest first, cap at 8
      if (payload.lastEntry) {
        const id = `${payload.lastEntry.number}-${Date.now()}`;
        setNewestId(id);
        setFeed((prev) => {
          const entry: FeedEntry = {
            id,
            number: payload.lastEntry!.number,
            date: payload.lastEntry!.date,
            time: payload.lastEntry!.time,
            journal: payload.lastEntry!.journal,
            arrivedAt: now(),
          };
          return [entry, ...prev].slice(0, 8);
        });
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isBalanced = ledger ? new Decimal(ledger.difference).isZero() : true;
  const balanceColor = isBalanced ? '#7BAF6A' : '#D97B6C';
  const balanceBg = isBalanced ? 'rgba(123,175,106,0.12)' : 'rgba(217,123,108,0.12)';
  const balanceBorder = isBalanced ? 'rgba(123,175,106,0.4)' : 'rgba(217,123,108,0.4)';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1A1410',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-body)',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Subtle background texture ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 20% 10%, rgba(95,112,82,0.12) 0%, transparent 50%), ' +
            'radial-gradient(ellipse at 80% 80%, rgba(74,58,52,0.2) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Header bar ── */}
      <header
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldCheck size={20} color="rgba(255,255,255,0.4)" />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            Urban Furniture — Live Ledger Integrity Monitor
          </span>
        </div>

        {/* Connection pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            background: connected ? 'rgba(123,175,106,0.12)' : 'rgba(217,123,108,0.12)',
            border: `1px solid ${connected ? 'rgba(123,175,106,0.35)' : 'rgba(217,123,108,0.35)'}`,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: connected ? '#7BAF6A' : '#D97B6C',
          }}
        >
          {/* Live dot */}
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? '#7BAF6A' : '#D97B6C',
              boxShadow: connected
                ? '0 0 0 3px rgba(123,175,106,0.25)'
                : '0 0 0 3px rgba(217,123,108,0.25)',
              animation: connected ? 'pulse-dot 1.6s infinite' : 'none',
            }}
          />
          {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>{connected ? 'Live' : 'Reconnecting…'}</span>
        </div>
      </header>

      {/* ── Main content ── */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          gap: 48,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* ── Top row: DEBIT / CREDIT ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 64,
            width: '100%',
            maxWidth: 1100,
          }}
        >
          {/* Total Debit */}
          <div
            style={{
              textAlign: 'center',
              padding: '28px 32px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 12,
              }}
            >
              Total Debits
            </div>
            <span
              ref={debitRef}
              style={{
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 48,
                lineHeight: 1.1,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              {fmtMoney(ledger?.totalDebit ?? '0.00')}
            </span>
          </div>

          {/* Total Credit */}
          <div
            style={{
              textAlign: 'center',
              padding: '28px 32px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 12,
              }}
            >
              Total Credits
            </div>
            <span
              ref={creditRef}
              style={{
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 48,
                lineHeight: 1.1,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              {fmtMoney(ledger?.totalCredit ?? '0.00')}
            </span>
          </div>
        </div>

        {/* ── Hero: DIFFERENCE ── */}
        <div
          style={{
            textAlign: 'center',
            padding: '36px 48px',
            background: balanceBg,
            borderRadius: 24,
            border: `2px solid ${balanceBorder}`,
            width: '100%',
            maxWidth: 800,
            boxShadow: isBalanced
              ? '0 0 60px rgba(123,175,106,0.08)'
              : '0 0 60px rgba(217,123,108,0.08)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: isBalanced ? 'rgba(123,175,106,0.65)' : 'rgba(217,123,108,0.65)',
              marginBottom: 16,
            }}
          >
            Net Difference (Debits − Credits)
          </div>

          <span
            ref={diffRef}
            style={{
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 96,
              lineHeight: 1,
              fontWeight: 500,
              color: balanceColor,
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 8,
            }}
          >
            {fmtMoney(ledger?.difference ?? '0.00')}
          </span>

          {/* Status badge */}
          <div style={{ marginTop: 24 }}>
            {isBalanced ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(123,175,106,0.15)',
                  border: '1px solid rgba(123,175,106,0.4)',
                  borderRadius: 999,
                  padding: '10px 28px',
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#7BAF6A',
                }}
              >
                <ShieldCheck size={22} />
                <span>BALANCED</span>
              </div>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(217,123,108,0.15)',
                  border: '1px solid rgba(217,123,108,0.4)',
                  borderRadius: 999,
                  padding: '10px 28px',
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#D97B6C',
                }}
              >
                <AlertTriangle size={22} />
                <span>OUT OF BALANCE</span>
              </div>
            )}
          </div>

          {/* Entry count */}
          {ledger && (
            <div
              style={{
                marginTop: 16,
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              {ledger.entryCount} posted entries · {ledger.lineCount} lines
            </div>
          )}
        </div>

        {/* ── Live feed ── */}
        {feed.length > 0 && (
          <div
            style={{
              width: '100%',
              maxWidth: 900,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {/* Feed header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: 0,
                padding: '10px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'var(--font-body)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.25)',
              }}
            >
              <span>Entry No.</span>
              <span style={{ textAlign: 'center' }}>Date</span>
              <span style={{ textAlign: 'center' }}>Journal</span>
              <span style={{ textAlign: 'right' }}>Received</span>
            </div>

            {feed.map((entry) => (
              <FeedRow
                key={entry.id}
                entry={entry}
                isNew={entry.id === newestId}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {feed.length === 0 && connected && (
          <div
            style={{
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              color: 'rgba(255,255,255,0.2)',
              textAlign: 'center',
              padding: '20px 0',
            }}
          >
            Waiting for live transactions…
          </div>
        )}
      </main>

      {/* ── Pulse keyframe ── */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 3px rgba(123,175,106,0.25); }
          50%       { opacity: 0.6; box-shadow: 0 0 0 6px rgba(123,175,106,0.1); }
        }
        @keyframes slide-in-top {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
