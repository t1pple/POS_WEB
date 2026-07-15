'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils/format';
import { Plus, ClipboardList, Check, XCircle, Clock, AlertCircle, ChevronRight, Search, Calendar, Package } from 'lucide-react';

// --- Computed status helper ---
function getDisplayStatus(order: { status: string; delivery_date?: string | null }) {
  if (
    order.status === 'pending' &&
    order.delivery_date &&
    new Date(order.delivery_date) < new Date(new Date().toDateString())
  ) {
    return 'overdue';
  }
  return order.status;
}

// --- Config per display status ---
const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string; icon: React.ReactNode;
}> = {
  pending:   { label: 'รอดำเนินการ', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.35)',  icon: <Clock size={12} strokeWidth={2.5} /> },
  overdue:   { label: 'เลยกำหนดส่ง', color: '#f97316', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.35)',  icon: <AlertCircle size={12} strokeWidth={2.5} /> },
  completed: { label: 'เสร็จสิ้น',   color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.35)', icon: <Check size={12} strokeWidth={2.5} /> },
  cancelled: { label: 'ยกเลิก',      color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.35)',  icon: <XCircle size={12} strokeWidth={2.5} /> },
};

const STATUS_TABS = [
  { key: 'all',       label: 'ทั้งหมด' },
  { key: 'pending',   label: 'รอดำเนินการ' },
  { key: 'overdue',   label: 'เลยกำหนดส่ง' },
  { key: 'completed', label: 'เสร็จสิ้น' },
  { key: 'cancelled', label: 'ยกเลิก' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'รอดำเนินการ' },
  { value: 'completed', label: 'เสร็จสิ้น' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

export default function OrdersPage() {
  const router = useRouter();
  const { orders, orderItems, products, completeOrder, cancelOrder, updateOrderStatus, addToast } = useStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  // Map of orderId → which action is loading
  const [loadingMap, setLoadingMap] = useState<Record<string, 'complete' | 'cancel' | null>>({});

  const setLoading = (id: string, action: 'complete' | 'cancel' | null) =>
    setLoadingMap(prev => ({ ...prev, [id]: action }));

  // Enrich each order with display status
  const enrichedOrders = useMemo(() =>
    orders.map(o => ({ ...o, displayStatus: getDisplayStatus(o) })),
    [orders]
  );

  const summary = useMemo(() => {
    const completed = enrichedOrders.filter(o => o.status === 'completed');
    const overdue   = enrichedOrders.filter(o => o.displayStatus === 'overdue');
    return {
      total:        enrichedOrders.length,
      pending:      enrichedOrders.filter(o => o.displayStatus === 'pending').length,
      overdue:      overdue.length,
      totalRevenue: completed.reduce((s, o) => s + o.total_revenue, 0),
      totalProfit:  completed.reduce((s, o) => s + o.total_profit, 0),
    };
  }, [enrichedOrders]);

  const filtered = useMemo(() => {
    let list = [...enrichedOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (activeTab !== 'all') list = list.filter(o => o.displayStatus === activeTab);
    if (search) list = list.filter(o =>
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase()))
    );
    return list;
  }, [enrichedOrders, search, activeTab]);

  const tabCount = (key: string) => {
    if (key === 'all') return enrichedOrders.length;
    return enrichedOrders.filter(o => o.displayStatus === key).length;
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (loadingMap[orderId]) return;
    setLoading(orderId, 'complete'); // using 'complete' generically as loading flag
    try {
      await updateOrderStatus(orderId, newStatus);
      addToast('success', 'อัปเดตสถานะออเดอร์แล้ว');
    } catch {
      addToast('error', 'เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    } finally {
      setLoading(orderId, null);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>ออเดอร์</h1>
          <p>จัดการออเดอร์และติดตามการขายทั้งหมด</p>
        </div>
        <div className="page-header-actions">
          <Link href="/production" className="btn btn-secondary">
            <ClipboardList size={16} /> แผนผลิตวันนี้
          </Link>
          <Link href="/orders/create" className="btn btn-primary">
            <Plus size={16} /> สร้างออเดอร์
          </Link>
        </div>
      </div>

      {/* Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'ทั้งหมด',        value: summary.total,                          color: 'var(--text-primary)' },
          { label: 'รอดำเนินการ',     value: summary.pending,                        color: '#f59e0b' },
          { label: 'เลยกำหนดส่ง',    value: summary.overdue,                        color: '#f97316' },
          { label: 'รายได้รวม',       value: formatCurrency(summary.totalRevenue),   color: 'var(--text-primary)' },
          { label: 'กำไรรวม',         value: formatCurrency(summary.totalProfit),    color: 'var(--success)' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {s.label}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', gap: 2,
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: 3,
        }}>
          {STATUS_TABS.map(tab => {
            const count = tabCount(tab.key);
            const isActive = activeTab === tab.key;
            const cfg = STATUS_CONFIG[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '6px 13px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 500,
                  background: isActive
                    ? (cfg ? cfg.color : 'var(--primary-500)')
                    : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {tab.label}
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
                  color: isActive ? '#fff' : 'var(--text-tertiary)',
                  padding: '1px 5px', borderRadius: 99,
                  minWidth: 18, textAlign: 'center',
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="search-input-wrapper" style={{ maxWidth: 260 }}>
          <Search className="search-icon" size={15} />
          <input
            className="search-input"
            placeholder="ค้นหาออเดอร์หรือลูกค้า..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Order List */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardList size={36} /></div>
          <h3>ไม่พบออเดอร์</h3>
          <p>{search || activeTab !== 'all' ? 'ลองเปลี่ยนตัวกรองหรือคำค้นหา' : 'สร้างออเดอร์ใหม่เพื่อเริ่มบันทึกการขาย'}</p>
          {!search && activeTab === 'all' && (
            <Link href="/orders/create" className="btn btn-primary"><Plus size={18} /> สร้างออเดอร์</Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(order => {
            const dStatus = order.displayStatus;
            const cfg = STATUS_CONFIG[dStatus] ?? STATUS_CONFIG.pending;
            const items = orderItems.filter(oi => oi.order_id === order.id);
            const loading = loadingMap[order.id];
            const canAct = dStatus === 'pending' || dStatus === 'overdue';
            const marginPct = order.total_revenue > 0
              ? ((order.total_profit / order.total_revenue) * 100).toFixed(0) : '0';

            return (
              <div
                key={order.id}
                className={`animate-fade-in-up stagger-${Math.min(filtered.indexOf(order) + 1, 8)}`}
                onClick={() => router.push(`/orders/${order.id}`)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '16px 20px',
                  background: 'var(--surface-1)',
                  border: `1px solid ${dStatus === 'overdue' ? 'rgba(249,115,22,0.3)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-lg)',
                  transition: 'border-color 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { if (dStatus !== 'overdue') e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = dStatus === 'overdue' ? 'rgba(249,115,22,0.3)' : 'var(--border-subtle)'; }}
              >
                {/* Main Row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1.2fr 1fr 140px 40px',
                  alignItems: 'center', gap: 16,
                }}>
                  {/* Order info */}
                  <div>
                  <Link
                    href={`/orders/${order.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-400)', textDecoration: 'none', display: 'block' }}
                  >
                    {order.customer_name ? order.customer_name : order.order_number}
                  </Link>
                  {order.customer_name && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{order.order_number}</div>
                  )}
                </div>

                {/* Dates */}
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={13} />
                    สั่ง: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatDate(order.created_at)}</span>
                  </div>
                  {order.delivery_date && (
                    <div style={{ fontSize: '0.8rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, color: dStatus === 'overdue' ? '#f97316' : 'var(--text-secondary)' }}>
                      <Package size={13} />
                      ส่ง: <span style={{ color: dStatus === 'overdue' ? '#f97316' : 'var(--text-primary)', fontWeight: 600 }}>{formatDate(order.delivery_date)}</span>
                    </div>
                  )}
                </div>

                {/* Financials */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{formatCurrency(order.total_revenue)}</div>
                  <div style={{ fontSize: '0.73rem', marginTop: 2 }}>
                    <span style={{ color: order.total_profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {order.total_profit >= 0 ? '+' : ''}{formatCurrency(order.total_profit)}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)', marginLeft: 3 }}>({marginPct}%)</span>
                  </div>
                </div>

                {/* Status Dropdown */}
                <div>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={!!loading}
                      style={{
                        appearance: 'none',
                        background: cfg.bg, color: cfg.color,
                        border: `1px solid ${cfg.border}`,
                        borderRadius: 99, padding: '5px 28px 5px 12px',
                        fontSize: '0.78rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1, transition: 'all 0.15s', outline: 'none'
                      }}
                    >
                      {/* If computed is overdue but actual status is pending, show overdue as an option visually */}
                      {dStatus === 'overdue' && <option value="pending" style={{ color: '#000' }}>เลยกำหนดส่ง</option>}
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value} style={{ color: '#000' }}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                      {loading ? (
                        <span style={{ fontSize: '10px', color: cfg.color }}>...</span>
                      ) : (
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L5 5L9 1" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detail link only */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Link
                    href={`/orders/${order.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      height: 32, width: 32, borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      textDecoration: 'none', transition: 'all 0.15s', flexShrink: 0,
                    }}
                    title="ดูรายละเอียด"
                  >
                    <ChevronRight size={15} />
                  </Link>
                </div>
                </div>

                {/* Sub Row: Items */}
                {items.length > 0 && (
                  <div style={{
                    marginTop: 14, paddingTop: 14,
                    borderTop: '1px dashed var(--border-subtle)',
                    display: 'flex', flexWrap: 'wrap', gap: 8,
                  }}>
                    {items.map(item => {
                      const p = products.find((x: any) => x.id === item.product_id);
                      return (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px', background: 'var(--surface-2)',
                          borderRadius: 6, fontSize: '0.78rem',
                        }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{p?.name ?? '?'}</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>×{item.quantity}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
