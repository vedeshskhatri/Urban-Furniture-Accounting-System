import React, { useState, useEffect } from 'react';
import { ContactsApi } from '../../api/contacts.api';
import { Contact } from '@shared/schemas/contact.schema';
import { List, LayoutGrid, User, Search } from 'lucide-react';

interface ContactListPageProps {
  onSelectContact: (id: number) => void;
  onNewContact: () => void;
  onBack?: () => void;
  initialViewMode?: 'list' | 'kanban';
}

export const ContactListPage: React.FC<ContactListPageProps> = ({
  onSelectContact,
  onNewContact,
  onBack,
  initialViewMode = 'list',
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(initialViewMode);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const data = await ContactsApi.getAll(false, 'all');
      setContacts(data);
    } catch (err) {
      console.error('Failed to load contacts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Filter contacts by search term
  const filteredContacts = contacts.filter(c => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.mobile && c.mobile.toLowerCase().includes(term))
    );
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContacts.map(c => c.id!).filter(Boolean));
    }
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isAllSelected =
    filteredContacts.length > 0 && selectedIds.length === filteredContacts.length;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.heading}>
          Contact
        </h1>

        {/* Outer Wireframe Card */}
        <div style={styles.card}>
          {/* Top Action Row: New | Search | Back | View Switcher */}
          <div style={styles.topBar}>
            {/* Left: New Button */}
            <button
              type="button"
              onClick={onNewContact}
              onMouseEnter={() => setHoveredBtn('new')}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                ...styles.wireframeBtn,
                ...(hoveredBtn === 'new' ? styles.wireframeBtnHover : {}),
              }}
            >
              New
            </button>

            {/* Center: Search Input Bar */}
            <div style={styles.searchWrapper}>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search"
                style={styles.searchInput}
              />
            </div>

            {/* Right: Back Button & View Switcher */}
            <div style={styles.rightGroup}>
              <button
                type="button"
                onClick={onBack || (() => window.history.back())}
                onMouseEnter={() => setHoveredBtn('back')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  ...styles.wireframeBtn,
                  ...(hoveredBtn === 'back' ? styles.wireframeBtnHover : {}),
                }}
              >
                Back
              </button>

              {/* View Switcher Icons matching wireframe */}
              <div style={styles.switcherContainer}>
                {/* List View Icon button */}
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="Allow user to shift to List View"
                  style={{
                    ...styles.switchBtn,
                    ...(viewMode === 'list' ? styles.switchBtnActive : {}),
                  }}
                >
                  <List size={18} />
                </button>

                {/* Kanban View Icon button */}
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  title="Allow user to shift to Kanban View"
                  style={{
                    ...styles.switchBtn,
                    ...(viewMode === 'kanban' ? styles.switchBtnActive : {}),
                  }}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Loading Indicator */}
          {loading ? (
            <div style={styles.loadingContainer}>
              <span>Loading contacts...</span>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div style={styles.emptyContainer}>
              <p style={styles.emptyText}>No contacts found.</p>
            </div>
          ) : viewMode === 'list' ? (
            /* ═════════════ LIST VIEW TABLE ═════════════ */
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.headerRow}>
                    <th style={{ ...styles.th, width: 70, textAlign: 'center' }}>
                      <span style={{ display: 'block', marginBottom: 4 }}>Select</span>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        style={styles.checkbox}
                        aria-label="Select all contacts"
                      />
                    </th>
                    <th style={{ ...styles.th, width: 80, textAlign: 'center' }}>Image</th>
                    <th style={{ ...styles.th, textAlign: 'left' }}>Name</th>
                    <th style={{ ...styles.th, textAlign: 'left' }}>Email</th>
                    <th style={{ ...styles.th, textAlign: 'left' }}>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(c => {
                    const isSelected = selectedIds.includes(c.id!);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => c.id && onSelectContact(c.id)}
                        style={styles.bodyRow}
                      >
                        {/* Select Checkbox */}
                        <td
                          style={{ ...styles.td, textAlign: 'center' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => toggleSelect(c.id!, e as any)}
                            style={styles.checkbox}
                          />
                        </td>

                        {/* Image Thumbnail */}
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <div style={styles.avatarThumbnail}>
                            {c.image_path ? (
                              <img
                                src={c.image_path}
                                alt={c.name}
                                style={styles.avatarImg}
                              />
                            ) : (
                              <User size={16} color="var(--brown-600, #8C6A58)" />
                            )}
                          </div>
                        </td>

                        {/* Name */}
                        <td style={{ ...styles.td, fontWeight: 600, color: 'var(--brown-900, #4A3A34)' }}>
                          {c.name}
                        </td>

                        {/* Email */}
                        <td style={{ ...styles.td, color: 'var(--brown-700, #77574A)' }}>
                          {c.email || '—'}
                        </td>

                        {/* Phone */}
                        <td style={{ ...styles.td, color: 'var(--brown-700, #77574A)' }}>
                          {c.mobile || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ═════════════ KANBAN CARDS VIEW ═════════════ */
            <div style={styles.kanbanGrid}>
              {filteredContacts.map(c => (
                <div
                  key={c.id}
                  onClick={() => c.id && onSelectContact(c.id)}
                  style={styles.kanbanCard}
                >
                  {/* Left: Square Image */}
                  <div style={styles.kanbanImgBox}>
                    {c.image_path ? (
                      <img
                        src={c.image_path}
                        alt={c.name}
                        style={styles.kanbanImg}
                      />
                    ) : (
                      <User size={26} color="var(--brown-600, #8C6A58)" />
                    )}
                  </div>

                  {/* Right: Contact Details */}
                  <div style={styles.kanbanDetails}>
                    <div style={styles.kanbanName}>{c.name}</div>
                    <div style={styles.kanbanEmail}>{c.email || '—'}</div>
                    <div style={styles.kanbanPhone}>{c.mobile || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-start',
    background: 'var(--cream, #F9F2E4)',
    padding: '36px 20px 48px 20px',
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
  } as React.CSSProperties,

  container: {
    width: '100%',
    maxWidth: 960,
  } as React.CSSProperties,

  heading: {
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    fontWeight: 700,
    fontSize: 22,
    color: 'var(--brown-900, #4A3A34)',
    textAlign: 'center' as const,
    marginBottom: 18,
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  card: {
    background: 'var(--surface, #FFFFFF)',
    borderRadius: 24,
    border: '1.5px solid var(--brown-400, #B8977E)',
    boxShadow: '0 8px 30px rgba(74, 58, 52, 0.07)',
    padding: '28px 36px 36px 36px',
    width: '100%',
  } as React.CSSProperties,

  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 28,
  } as React.CSSProperties,

  wireframeBtn: {
    padding: '7px 24px',
    border: '1.5px solid var(--brown-900, #4A3A34)',
    borderRadius: 12,
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    fontWeight: 700,
    fontSize: 13,
    color: 'var(--brown-900, #4A3A34)',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    outline: 'none',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  wireframeBtnHover: {
    background: 'var(--brown-900, #4A3A34)',
    color: 'var(--cream, #F9F2E4)',
  } as React.CSSProperties,

  searchWrapper: {
    flex: 1,
    maxWidth: 320,
    margin: '0 12px',
  } as React.CSSProperties,

  searchInput: {
    width: '100%',
    border: '1.5px solid var(--brown-700, #77574A)',
    borderRadius: 12,
    background: 'transparent',
    padding: '6px 16px',
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
    fontSize: 13,
    color: 'var(--brown-900, #4A3A34)',
    outline: 'none',
  } as React.CSSProperties,

  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,

  switcherContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px',
    borderRadius: 10,
    background: 'rgba(235, 215, 190, 0.35)',
    border: '1px solid var(--brown-300, #D2B79F)',
  } as React.CSSProperties,

  switchBtn: {
    padding: '5px 8px',
    borderRadius: 7,
    border: 'none',
    background: 'transparent',
    color: 'var(--brown-700, #77574A)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 120ms ease',
  } as React.CSSProperties,

  switchBtnActive: {
    background: 'var(--brown-900, #4A3A34)',
    color: 'var(--cream, #F9F2E4)',
  } as React.CSSProperties,

  loadingContainer: {
    padding: '48px 0',
    textAlign: 'center' as const,
    color: 'var(--brown-600, #8C6A58)',
    fontSize: 14,
  } as React.CSSProperties,

  emptyContainer: {
    padding: '48px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  emptyText: {
    color: 'var(--brown-500, #A8836C)',
    fontSize: 14,
  } as React.CSSProperties,

  /* Table styling */
  tableWrapper: {
    width: '100%',
    overflowX: 'auto' as const,
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  } as React.CSSProperties,

  headerRow: {
    borderBottom: '1.5px solid var(--brown-700, #77574A)',
  } as React.CSSProperties,

  th: {
    padding: '12px 14px',
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    fontWeight: 700,
    fontSize: 13,
    color: 'var(--brown-900, #4A3A34)',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  bodyRow: {
    borderBottom: '1px solid var(--brown-200, #E4D5C7)',
    cursor: 'pointer',
    transition: 'background 120ms ease',
  } as React.CSSProperties,

  td: {
    padding: '14px',
    fontSize: 13,
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,

  checkbox: {
    accentColor: 'var(--brown-900, #4A3A34)',
    cursor: 'pointer',
    width: 16,
    height: 16,
  } as React.CSSProperties,

  avatarThumbnail: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: '1px solid var(--brown-300, #D2B79F)',
    background: 'rgba(235, 215, 190, 0.4)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as React.CSSProperties,

  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  } as React.CSSProperties,

  /* Kanban grid styling */
  kanbanGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 20,
    padding: '8px 0',
  } as React.CSSProperties,

  kanbanCard: {
    background: 'var(--surface, #FFFFFF)',
    border: '1.5px solid var(--brown-700, #77574A)',
    borderRadius: 18,
    padding: '16px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    cursor: 'pointer',
    transition: 'transform 120ms ease, box-shadow 120ms ease',
  } as React.CSSProperties,

  kanbanImgBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    border: '1px solid var(--brown-300, #D2B79F)',
    background: 'rgba(235, 215, 190, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  } as React.CSSProperties,

  kanbanImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  } as React.CSSProperties,

  kanbanDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    overflow: 'hidden',
  } as React.CSSProperties,

  kanbanName: {
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--brown-900, #4A3A34)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  kanbanEmail: {
    fontSize: 12,
    color: 'var(--brown-700, #77574A)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  kanbanPhone: {
    fontSize: 12,
    color: 'var(--brown-600, #8C6A58)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
};

