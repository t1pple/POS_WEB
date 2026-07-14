'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import {
  ArrowLeft, ShoppingBag, Edit, Trash2, CheckCircle,
  Clock, XCircle, User, Calendar, FileText, TrendingUp, DollarSign, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  pending:   { label: 'รอดำเนินการ', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.3)',  icon: <Clock size={15} /> },
  overdue:   { label: 'เลยกำหนดส่ง',  color: '#f97316', bg: 'rgba(249,115,22,0.08)',   border: 'rgba(249,115,22,0.3)',  icon: <AlertCircle size={15} /> },
  completed: { label: 'เสร็จสิ้น',    color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)', icon: <CheckCircle size={15} /> },
  cancelled: { label: 'ยกเลิก',       color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',  icon: <XCircle size={15} /> },
};

function getDisplayStatus(order: { status: string; delivery_date?: string | null }) {
  if (
    order.status === 'pending' &&
    order.delivery_date &&
    new Date(order.delivery_date) < new Date(new Date().toDateString())
  ) return 'overdue';
  return order.status;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { orders, orderItems, products, deleteOrder, updateOrderStatus, addToast } = useStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const order = orders.find(o => o.id === id);
  const items = orderItems.filter(oi => oi.order_id === id);

  if (!order) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><ShoppingBag size={36} /></div>
        <h3>ไม่พบออเดอร์</h3>
        <p>ออเดอร์นี้อาจถูกลบหรือไม่มีอยู่ในระบบ</p>
        <button className="btn btn-primary" onClick={() => router.push('/orders')}>
          กลับไปหน้ารายการออเดอร์
        </button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[getDisplayStatus(order)] ?? STATUS_CONFIG.pending;
  const marginPct = order.total_revenue > 0
    ? ((order.total_profit / order.total_revenue) * 100).toFixed(1)
    : '0';

  const handleStatusChange = async (newStatus: string) => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await updateOrderStatus(order.id, newStatus);
      addToast('success', 'อัปเดตสถานะออเดอร์แล้ว');
    } catch {
      addToast('error', 'เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    if (!confirm(`ลบออเดอร์ ${order.order_number} ใช่หรือไม่?\n\nสต็อกวัตถุดิบที่ถูกตัดไปจะถูกคืนกลับอัตโนมัติ`)) return;
    setIsDeleting(true);
    try {
      await deleteOrder(id);
      addToast('success', 'ลบออเดอร์เรียบร้อยแล้ว');
      router.push('/orders');
    } catch {
      addToast('error', 'เกิดข้อผิดพลาดในการลบออเดอร์');
      setIsDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Back + Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          className="btn btn-ghost"
          onClick={() => router.back()}
          style={{ marginBottom: 12, padding: '4px 8px' }}
        >
          <ArrowLeft size={16} /> กลับ
        </button>

        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0 }}>ออเดอร์ {order.order_number}</h1>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isUpdatingStatus}
                  style={{
                    appearance: 'none',
                    background: cfg.bg, color: cfg.color,
                    border: `1px solid ${cfg.border}`,
                    borderRadius: 99, padding: '5px 32px 5px 14px',
                    fontSize: '0.8125rem', fontWeight: 600, cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                    opacity: isUpdatingStatus ? 0.6 : 1, transition: 'all 0.15s', outline: 'none'
                  }}
                >
                  {getDisplayStatus(order) === 'overdue' && <option value="pending" style={{ color: '#000' }}>เลยกำหนดส่ง</option>}
                  <option value="pending" style={{ color: '#000' }}>รอดำเนินการ</option>
                  <option value="completed" style={{ color: '#000' }}>เสร็จสิ้น</option>
                  <option value="cancelled" style={{ color: '#000' }}>ยกเลิก</option>
                </select>
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                  {isUpdatingStatus ? (
                    <span style={{ fontSize: '10px', color: cfg.color }}>...</span>
                  ) : (
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
            <p style={{ margin: '6px 0 0', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
              สร้างเมื่อ {formatDateTime(order.created_at)}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link href={`/orders/${id}/edit`} className="btn btn-secondary">
              <Edit size={16} /> แก้ไข
            </Link>
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 size={16} />
              {isDeleting ? 'กำลังลบ...' : 'ลบ'}
            </button>
          </div>
        </div>
      </div>

      {/* Financial Summary Strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24,
      }}>
        {[
          { icon: <TrendingUp size={18} />, label: 'รายรับรวม', value: formatCurrency(order.total_revenue), color: 'var(--text-primary)', iconBg: 'var(--surface-3)' },
          { icon: <DollarSign size={18} />, label: 'ต้นทุนรวม', value: formatCurrency(order.total_cost), color: 'var(--accent-amber)', iconBg: 'rgba(251,191,36,0.1)' },
          { icon: <TrendingUp size={18} />, label: `กำไร (${marginPct}%)`, value: formatCurrency(order.total_profit), color: order.total_profit >= 0 ? 'var(--success)' : 'var(--danger)', iconBg: order.total_profit >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '16px 20px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: s.iconBg, color: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {s.label}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main content: 2 column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Items */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={18} style={{ color: 'var(--primary-400)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>รายการสินค้า</span>
            <span style={{ marginLeft: 4, fontSize: '0.78rem', color: 'var(--text-tertiary)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 99 }}>
              {items.length} รายการ
            </span>
          </div>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>สินค้า</th>
                <th style={{ textAlign: 'right' }}>จำนวน</th>
                <th style={{ textAlign: 'right' }}>ราคา/ชิ้น</th>
                <th style={{ textAlign: 'right' }}>ต้นทุน</th>
                <th style={{ textAlign: 'right' }}>ยอด</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const product = products.find(p => p.id === item.product_id);
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{product?.name ?? 'ไม่ทราบชื่อ'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>×{item.quantity}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(item.unit_price)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-amber)' }}>{formatCurrency(item.unit_cost * item.quantity)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.subtotal_revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} />
                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ต้นทุนรวม</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent-amber)' }}>{formatCurrency(order.total_cost)}</td>
              </tr>
              <tr>
                <td colSpan={3} />
                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>รายรับรวม</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem' }}>{formatCurrency(order.total_revenue)}</td>
              </tr>
              <tr>
                <td colSpan={3} />
                <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>กำไร</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: order.total_profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatCurrency(order.total_profit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Metadata sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Customer */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} style={{ color: 'var(--primary-400)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>ข้อมูลลูกค้า</span>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'ชื่อลูกค้า / ร้านค้า', value: order.customer_name },
                { label: 'เบอร์ติดต่อ', value: order.customer_phone },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: f.value ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {f.value ?? '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} style={{ color: 'var(--accent-emerald)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>ข้อมูลการส่ง</span>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'วันที่สั่งซื้อ', value: order.order_date },
                { label: 'วันที่กำหนดส่ง', value: order.delivery_date },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: f.value ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {f.value ?? '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>หมายเหตุ</span>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {order.notes}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
