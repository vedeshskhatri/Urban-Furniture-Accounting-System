import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Copy,
  Check,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  DollarSign,
  FileText,
  HelpCircle,
  ChevronRight,
  PieChart,
  RefreshCw,
  Building2,
  Lock,
} from 'lucide-react';
import api from '../../lib/axios';

interface OverdueInvoiceSummary {
  id: number;
  number: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  total: string;
  amountDue: string;
  paymentStatus: string;
  daysOverdue: number;
}

interface FinancialSnapshot {
  timestamp: string;
  liquidity: {
    cash: string;
    bank: string;
    totalLiquid: string;
    payable: string;
    receivable: string;
    cashToPayableRatio: string;
    netWorkingCapital: string;
  };
  pnl: {
    revenueThisMonth: string;
    expenseThisMonth: string;
    netIncomeThisMonth: string;
  };
  aging: {
    overdueInvoicesCount: number;
    overdueInvoicesTotal: string;
    topOverdueInvoices: OverdueInvoiceSummary[];
  };
  integrity: {
    passed: number;
    failed: number;
    total: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  };
  gst: {
    totalTaxableValue: string;
    totalTaxLiability: string;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'ollama' | 'deterministic';
  modelUsed?: string;
  executionTimeMs?: number;
  timestamp: string;
}

interface CfoCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export const CfoCopilotModal: React.FC<CfoCopilotModalProps> = ({
  isOpen,
  onClose,
  initialPrompt,
}) => {
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch live snapshot on modal open
  const fetchSnapshot = async () => {
    setIsLoadingSnapshot(true);
    try {
      const res = await api.get('/api/cfo-copilot/snapshot');
      if (res.data?.data) {
        setSnapshot(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load live snapshot:', err);
    } finally {
      setIsLoadingSnapshot(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSnapshot();
      if (messages.length === 0) {
        setMessages([
          {
            id: 'welcome-1',
            role: 'assistant',
            content: `### 🏛️ Urban Furniture — CFO Copilot Synchronized\n\nI am your **AI Financial Advisor and Audit Copilot**, operating 100% locally and offline. I have extracted real-time balances directly from our PostgreSQL ledger views (\`v_trial_balance\`, \`v_invoice_status\`, \`v_bill_status\`, and system integrity monitors).\n\nSelect a briefing topic below or ask any executive financial question regarding our liquidity, overdue receivables, or cost control.`,
            source: 'deterministic',
            modelUsed: 'Audited-Ledger-Context',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSend(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isQuerying]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async (textToSend?: string, focusArea?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isQuerying) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsQuerying(true);

    try {
      const history = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.post('/api/cfo-copilot/query', {
        message: query,
        focus: focusArea || 'overview',
        history,
      });

      if (res.data?.data) {
        const d = res.data.data;
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: d.advice,
          source: d.source,
          modelUsed: d.modelUsed,
          executionTimeMs: d.executionTimeMs,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (d.snapshot) {
          setSnapshot(d.snapshot);
        }
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Unable to complete CFO advisory analysis**: ${
          err.response?.data?.error?.message || err.message || 'Service temporarily unavailable'
        }`,
        source: 'deterministic',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    {
      label: 'Cash Runway & Liquidity',
      icon: DollarSign,
      query: 'Give me an executive liquidity and cash runway briefing. How long can our liquid capital cover operating liabilities?',
      focus: 'liquidity',
    },
    {
      label: 'Overdue Receivables',
      icon: AlertTriangle,
      query: 'Identify our top overdue customer debtors, total amount at risk, and actionable collection steps.',
      focus: 'aging',
    },
    {
      label: 'Ledger Anomalies Audit',
      icon: ShieldCheck,
      query: 'Inspect our accounting ledger for anomalies, trial balance discrepancies, unposted drafts, or integrity failures.',
      focus: 'anomalies',
    },
    {
      label: 'GST & Tax Position',
      icon: FileText,
      query: 'Summarize our current GST taxable turnover and tax liabilities for monthly filing.',
      focus: 'gst',
    },
    {
      label: '💡 What is Working Capital?',
      icon: HelpCircle,
      query: 'What is working capital, how is it calculated, and what is Urban Furniture\'s position right now?',
      focus: 'liquidity',
    },
    {
      label: '💡 Cash vs. Profit',
      icon: PieChart,
      query: 'Explain the difference between accounting profit and actual cash flow in our system.',
      focus: 'overview',
    },
    {
      label: '💡 How Double-Entry Works',
      icon: Building2,
      query: 'How does double-entry bookkeeping and debits/credits work in our furniture business?',
      focus: 'overview',
    },
    {
      label: '💡 Can We Spend ₹50,000?',
      icon: DollarSign,
      query: 'Can we afford to spend ₹50,000 on new workshop equipment today without risking supplier payments?',
      focus: 'liquidity',
    },
    {
      label: '📋 What Should I Do Today?',
      icon: TrendingUp,
      query: 'What should be my top financial and operational priorities today based on our ledger data?',
      focus: 'overview',
    },
    {
      label: '💡 Asset vs. Liability',
      icon: HelpCircle,
      query: 'What is the difference between an asset and a liability, and what are our actual balances?',
      focus: 'overview',
    },
    {
      label: '💡 How to Cut Costs',
      icon: AlertTriangle,
      query: 'What cost optimization and expense reduction strategies do you recommend for our business?',
      focus: 'overview',
    },
    {
      label: '🧭 How to Create Invoices',
      icon: FileText,
      query: 'How do I create a customer invoice or vendor bill in this system?',
      focus: 'overview',
    },
  ];

  // Simple, elegant Markdown formatter for CFO answers
  const renderMarkdown = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableHeader: string[] = [];
    let tableRows: string[][] = [];

    const flushTable = (keyIndex: number) => {
      if (tableHeader.length > 0 || tableRows.length > 0) {
        elements.push(
          <div key={`table-${keyIndex}`} style={{ overflowX: 'auto', margin: '12px 0' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12.5px',
                fontFamily: 'var(--font-body)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                borderRadius: 6,
                background: '#FFFFFF',
              }}
            >
              {tableHeader.length > 0 && (
                <thead>
                  <tr style={{ background: 'rgba(235, 215, 190, 0.35)', textAlign: 'left' }}>
                    {tableHeader.map((h, hi) => (
                      <th
                        key={hi}
                        style={{
                          padding: '8px 12px',
                          fontWeight: 700,
                          color: 'var(--brown-900)',
                          borderBottom: '1px solid rgba(208, 174, 146, 0.5)',
                        }}
                      >
                        {formatInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {tableRows.map((r, ri) => (
                  <tr
                    key={ri}
                    style={{
                      borderBottom: '1px solid rgba(208, 174, 146, 0.2)',
                      background: ri % 2 === 1 ? 'rgba(247, 244, 238, 0.5)' : '#FFFFFF',
                    }}
                  >
                    {r.map((cell, ci) => (
                      <td key={ci} style={{ padding: '8px 12px', color: 'var(--brown-800)' }}>
                        {formatInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableHeader = [];
        tableRows = [];
        inTable = false;
      }
    };

    const formatInline = (text: string): React.ReactNode => {
      // Split on bold **bold**
      const parts = text.split(/(\*\*.*?\*\*|\`.*?\`)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} style={{ color: 'var(--brown-900)', fontWeight: 700 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              style={{
                background: 'rgba(74, 58, 52, 0.08)',
                padding: '2px 5px',
                borderRadius: 4,
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Table line
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        const cols = trimmed
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        // Check if separator line (| --- | --- |)
        if (cols.every((c) => /^:?-+:?$/.test(c))) {
          // It's a separator line, skip
          return;
        }
        if (tableHeader.length === 0) {
          tableHeader = cols;
        } else {
          tableRows.push(cols);
        }
        return;
      }

      if (inTable && !trimmed.startsWith('|')) {
        flushTable(idx);
      }

      // Headers
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4
            key={idx}
            style={{
              fontSize: '15px',
              fontWeight: 750,
              color: 'var(--brown-900)',
              margin: '14px 0 6px 0',
              fontFamily: 'var(--font-display)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {formatInline(trimmed.replace('### ', ''))}
          </h4>
        );
        return;
      }

      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3
            key={idx}
            style={{
              fontSize: '16px',
              fontWeight: 800,
              color: 'var(--brown-900)',
              margin: '16px 0 8px 0',
              fontFamily: 'var(--font-display)',
            }}
          >
            {formatInline(trimmed.replace('## ', ''))}
          </h3>
        );
        return;
      }

      // Bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: 8,
              margin: '4px 0',
              fontSize: '13px',
              color: 'var(--brown-800)',
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: 'var(--gold, #B48D57)', fontWeight: 700 }}>•</span>
            <div style={{ flex: 1 }}>{formatInline(trimmed.slice(2))}</div>
          </div>
        );
        return;
      }

      // Numbered items (1. 2. 3.)
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        elements.push(
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: 8,
              margin: '4px 0',
              fontSize: '13px',
              color: 'var(--brown-800)',
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: 'var(--gold, #B48D57)', fontWeight: 700, minWidth: 16 }}>
              {numMatch[1]}.
            </span>
            <div style={{ flex: 1 }}>{formatInline(numMatch[2])}</div>
          </div>
        );
        return;
      }

      // Regular paragraph or empty line
      if (trimmed === '') {
        elements.push(<div key={idx} style={{ height: 6 }} />);
      } else {
        elements.push(
          <p
            key={idx}
            style={{
              fontSize: '13px',
              lineHeight: 1.55,
              color: 'var(--brown-800)',
              margin: '4px 0',
            }}
          >
            {formatInline(trimmed)}
          </p>
        );
      }
    });

    flushTable(lines.length);
    return elements;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(38, 33, 28, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          height: '88vh',
          maxHeight: 820,
          background: 'var(--surface, #FFFFFF)',
          borderRadius: 12,
          border: '1px solid rgba(208, 174, 146, 0.5)',
          boxShadow: '0 20px 50px rgba(74, 58, 52, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(208, 174, 146, 0.4)',
            background: 'linear-gradient(180deg, #FBF8F5 0%, #F5EFE8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #4A3A34 0%, #26211C 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EBD7BE',
                boxShadow: '0 2px 6px rgba(74, 58, 52, 0.2)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 750,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--brown-900)',
                  }}
                >
                  CFO Copilot
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(95, 112, 82, 0.15)',
                    color: '#4B5E3E',
                    border: '1px solid rgba(95, 112, 82, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#5F7052',
                    }}
                  />
                  Offline AI • Local Ollama
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--brown-600)' }}>
                Audited PostgreSQL ledger synthesis with zero cloud telemetry
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={fetchSnapshot}
              disabled={isLoadingSnapshot}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: 'var(--brown-700)',
                background: 'transparent',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                borderRadius: 6,
                padding: '5px 9px',
                cursor: 'pointer',
              }}
              title="Refresh ledger balances"
            >
              <RefreshCw
                size={13}
                style={{
                  animation: isLoadingSnapshot ? 'spin 1s linear infinite' : 'none',
                }}
              />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brown-600)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Live Balance Summary Bar */}
        {snapshot && (
          <div
            style={{
              padding: '8px 20px',
              background: 'rgba(235, 215, 190, 0.25)',
              borderBottom: '1px solid rgba(208, 174, 146, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              overflowX: 'auto',
              fontSize: 11.5,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--brown-600)', fontWeight: 500 }}>Liquid Funds:</span>
              <strong style={{ color: 'var(--brown-900)' }}>₹{snapshot.liquidity.totalLiquid}</strong>
            </div>
            <span style={{ color: 'rgba(208, 174, 146, 0.6)' }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--brown-600)', fontWeight: 500 }}>Overdue AR:</span>
              <strong
                style={{
                  color: snapshot.aging.overdueInvoicesCount > 0 ? '#9E4A38' : 'var(--brown-900)',
                }}
              >
                ₹{snapshot.aging.overdueInvoicesTotal} ({snapshot.aging.overdueInvoicesCount})
              </strong>
            </div>
            <span style={{ color: 'rgba(208, 174, 146, 0.6)' }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--brown-600)', fontWeight: 500 }}>Pending AP:</span>
              <strong style={{ color: 'var(--brown-900)' }}>₹{snapshot.liquidity.payable}</strong>
            </div>
            <span style={{ color: 'rgba(208, 174, 146, 0.6)' }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--brown-600)', fontWeight: 500 }}>Integrity:</span>
              <span
                style={{
                  fontWeight: 700,
                  color: snapshot.integrity.status === 'HEALTHY' ? '#5F7052' : '#9E4A38',
                }}
              >
                {snapshot.integrity.passed}/{snapshot.integrity.total} Checks
              </span>
            </div>
          </div>
        )}

        {/* Chat Feed */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            background: '#FAF8F5',
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '100%',
                }}
              >
                <div
                  style={{
                    maxWidth: isUser ? '82%' : '94%',
                    background: isUser ? 'linear-gradient(135deg, #4A3A34 0%, #342823 100%)' : '#FFFFFF',
                    color: isUser ? '#FAF8F5' : 'var(--brown-900)',
                    padding: isUser ? '10px 14px' : '14px 18px',
                    borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    border: isUser ? 'none' : '1px solid rgba(208, 174, 146, 0.35)',
                    boxShadow: isUser
                      ? '0 2px 8px rgba(74, 58, 52, 0.15)'
                      : '0 2px 8px rgba(74, 58, 52, 0.04)',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}
                >
                  {isUser ? (
                    <div style={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>{msg.content}</div>
                  ) : (
                    <div>{renderMarkdown(msg.content)}</div>
                  )}

                  {!isUser && (
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: '1px solid rgba(208, 174, 146, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '10.5px',
                        color: 'var(--brown-600)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>
                          {msg.modelUsed || 'llama3.2:3b'} •{' '}
                          {msg.executionTimeMs ? `${(msg.executionTimeMs / 1000).toFixed(1)}s` : 'Instant'}
                        </span>
                        {msg.source === 'ollama' && (
                          <span
                            style={{
                              background: 'rgba(95, 112, 82, 0.12)',
                              color: '#5F7052',
                              padding: '1px 5px',
                              borderRadius: 4,
                              fontWeight: 700,
                            }}
                          >
                            LLM SYNTHESIS
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--brown-600)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                        title="Copy memo"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={12} color="#5F7052" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copy Briefing
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--brown-500, #A8836C)',
                    margin: '3px 4px 0 4px',
                  }}
                >
                  {msg.timestamp}
                </span>
              </div>
            );
          })}

          {isQuerying && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'var(--brown-800)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EBD7BE',
                }}
              >
                <Sparkles size={14} />
              </div>
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '10px 14px',
                  borderRadius: '12px 12px 12px 2px',
                  border: '1px solid rgba(208, 174, 146, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '12.5px',
                  color: 'var(--brown-700)',
                }}
              >
                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                <span>CFO evaluating PostgreSQL ledger balances...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Chips */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid rgba(208, 174, 146, 0.3)',
            background: 'var(--surface, #FFFFFF)',
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
          }}
        >
          {quickPrompts.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.label}
                type="button"
                disabled={isQuerying}
                onClick={() => handleSend(p.query, p.focus)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--brown-800)',
                  background: 'rgba(235, 215, 190, 0.28)',
                  border: '1px solid rgba(208, 174, 146, 0.4)',
                  borderRadius: 20,
                  padding: '5px 12px',
                  cursor: isQuerying ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isQuerying) {
                    e.currentTarget.style.background = 'rgba(235, 215, 190, 0.6)';
                    e.currentTarget.style.borderColor = 'var(--brown-600)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isQuerying) {
                    e.currentTarget.style.background = 'rgba(235, 215, 190, 0.28)';
                    e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.4)';
                  }
                }}
              >
                <Icon size={12} color="var(--brown-700)" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: '12px 20px 16px 20px',
            borderTop: '1px solid rgba(208, 174, 146, 0.3)',
            background: '#FFFFFF',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
          >
            <textarea
              ref={inputRef}
              rows={2}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask CFO anything (e.g. 'Can we afford 400k stock purchase next week?')..."
              disabled={isQuerying}
              style={{
                flex: 1,
                resize: 'none',
                padding: '9px 12px',
                fontSize: '13px',
                fontFamily: 'var(--font-body)',
                border: '1px solid rgba(208, 174, 146, 0.5)',
                borderRadius: 8,
                background: '#FAF8F5',
                color: 'var(--brown-900)',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isQuerying || !inputQuery.trim()}
              style={{
                height: 42,
                padding: '0 16px',
                borderRadius: 8,
                background:
                  !inputQuery.trim() || isQuerying
                    ? 'rgba(74, 58, 52, 0.2)'
                    : 'linear-gradient(135deg, #4A3A34 0%, #26211C 100%)',
                color: !inputQuery.trim() || isQuerying ? 'var(--brown-500)' : '#EBD7BE',
                border: 'none',
                fontWeight: 650,
                fontSize: 13,
                cursor: !inputQuery.trim() || isQuerying ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 120ms ease',
              }}
            >
              <span>Advise</span>
              <Send size={13} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
