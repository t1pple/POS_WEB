'use client';

import { useState, useMemo, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import {
  ArrowLeft, Plus, Trash2, ShoppingCart, AlertTriangle,
  CheckCircle, Package, ShoppingBag, User, FileText, Edit3
} from 'lucide-react';

interface OrderEntry {
  product_id: string;
  quantity: string;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'รอดำเนินการ', color: 'var(--warning)' },
  { value: 'completed', label: 'เสร็จสิ้น', color: 'var(--success)' },
  { value: 'cancelled', label: 'ยกเลิก', color: 'var(--danger)' },
];

export default function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const {
    orders, orderItems, products, recipes, ingredients,
    recipeIngredients, recipeSubRecipes, packaging,
    productRecipes, productPackaging, getProductCost,
    updateOrderFull, addToast
  } = useStore() as any;

  const order = orders.find((o: any) => o.id === id);
  const items = orderItems.filter((oi: any) => oi.order_id === id);

  const [entries, setEntries] = useState<OrderEntry[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pending' | 'completed' | 'cancelled'>('pending');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (order) {
      setCustomerName(order.customer_name || '');
      setCustomerPhone(order.customer_phone || '');
      setOrderDate(order.order_date || new Date().toISOString().split('T')[0]);
      setDeliveryDate(order.delivery_date || '');
      setNotes(order.notes || '');
      setStatus(order.status || 'pending');
    }
    if (items.length > 0) {
      setEntries(items.map((i: any) => ({ product_id: i.product_id, quantity: i.quantity.toString() })));
    }
  }, [order?.id]);

  const addEntry = () => setEntries(prev => [...prev, { product_id: '', quantity: '1' }]);
  const removeEntry = (idx: number) => setEntries(prev => prev.filter((_, i) => i !== idx));
  const updateEntry = (idx: number, field: string, value: string) =>
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));

  const analysis = useMemo(() => {
    const validEntries = entries.filter(e => e.product_id && e.quantity && parseInt(e.quantity) > 0);
    let totalCost = 0, totalRevenue = 0;
    const itemDetails: { name: string; qty: number; cost: number; price: number; subtotalCost: number; subtotalRevenue: number }[] = [];
    const requiredIngredients = new Map<string, { name: string; required: number; available: number; unit: string }>();
    const requiredPackaging = new Map<string, { name: string; required: number; available: number; unit: string }>();

    // Helper: net available = current stock + what was already committed in original order (return on edit)
    const originalIngUsage = new Map<string, number>();
    const originalPkgUsage = new Map<string, number>();
    // We skip complex net-delta calculation and just use current stock (backend handles reconciliation)

    const resolveRecipeIngredients = (recipeId: string, neededYield: number) => {
      const recipe = recipes.find((r: any) => r.id === recipeId);
      if (!recipe) return;
      const multiplier = neededYield / (recipe.yield_quantity || 1);
      for (const ri of recipeIngredients.filter((ri: any) => ri.recipe_id === recipeId)) {
        const ing = ingredients.find((i: any) => i.id === ri.ingredient_id);
        if (!ing) continue;
        const neededPacks = (ri.unit === 'แพ็ค' || ri.unit === 'ถุง')
          ? ri.quantity_used * multiplier
          : (ri.quantity_used * multiplier) / ing.quantity;
        const existing = requiredIngredients.get(ri.ingredient_id);
        if (existing) existing.required += neededPacks;
        else requiredIngredients.set(ri.ingredient_id, { name: ing.name, required: neededPacks, available: ing.stock_quantity, unit: 'แพ็ค' });
      }
      for (const rsr of recipeSubRecipes.filter((rsr: any) => rsr.recipe_id === recipeId)) {
        resolveRecipeIngredients(rsr.sub_recipe_id, rsr.quantity_used * multiplier);
      }
    };

    for (const entry of validEntries) {
      const product = products.find((p: any) => p.id === entry.product_id);
      if (!product) continue;
      const qty = parseInt(entry.quantity);
      const cost = getProductCost(product.id);
      const price = product.selling_price || 0;
      totalCost += cost * qty;
      totalRevenue += price * qty;
      itemDetails.push({ name: product.name, qty, cost, price, subtotalCost: cost * qty, subtotalRevenue: price * qty });
      for (const pr of productRecipes.filter((pr: any) => pr.product_id === product.id)) {
        resolveRecipeIngredients(pr.recipe_id, pr.quantity_used * qty);
      }
      for (const pp of productPackaging.filter((pp: any) => pp.product_id === product.id)) {
        const pkg = packaging.find((p: any) => p.id === pp.packaging_id);
        if (!pkg) continue;
        const needed = pp.quantity_used * qty;
        const existing = requiredPackaging.get(pp.packaging_id);
        if (existing) existing.required += needed;
        else requiredPackaging.set(pp.packaging_id, { name: pkg.name, required: needed, available: pkg.stock_quantity * pkg.quantity, unit: pkg.unit });
      }
    }

    const ingredientCheck = Array.from(requiredIngredients.entries()).map(([id, d]) => ({
      id, ...d, sufficient: true, shortage: 0, // edit mode: bypass strict check, backend reconciles
    }));
    const packagingCheck = Array.from(requiredPackaging.entries()).map(([id, d]) => ({
      id, ...d, sufficient: true, shortage: 0,
    }));

    return {
      itemDetails, ingredientCheck, packagingCheck, totalCost, totalRevenue,
      totalProfit: totalRevenue - totalCost, allSufficient: true,
    };
  }, [entries, products, recipes, ingredients, packaging, recipeIngredients, recipeSubRecipes, productRecipes, productPackaging, getProductCost]);

  if (!order) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Edit3 size={36} /></div>
        <h3>ไม่พบออเดอร์</h3>
        <button className="btn btn-primary" onClick={() => router.push('/orders')}>กลับไปหน้ารายการ</button>
      </div>
    );
  }

  const handleSubmit = async () => {
    const validEntries = entries.filter(e => e.product_id && e.quantity && parseInt(e.quantity) > 0);
    if (validEntries.length === 0) { addToast('error', 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'); return; }
    setSubmitting(true);
    try {
      await updateOrderFull(
        id,
        validEntries.map(e => ({ product_id: e.product_id, quantity: parseInt(e.quantity) })),
        { notes: notes || undefined, customer_name: customerName || undefined, customer_phone: customerPhone || undefined, order_date: orderDate || undefined, delivery_date: deliveryDate || undefined, status }
      );
      addToast('success', 'บันทึกการแก้ไขออเดอร์สำเร็จ!');
      router.push(`/orders/${id}`);
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      setSubmitting(false);
    }
  };

  const currentStatusCfg = STATUS_OPTIONS.find(s => s.value === status)!;

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => router.back()} style={{ marginBottom: 12, padding: '4px 8px' }}>
          <ArrowLeft size={16} /> กลับ
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>แก้ไขออเดอร์ {order.order_number}</h1>
          {/* Status selector inline */}
          <select
            className="form-input form-select"
            value={status}
            onChange={e => setStatus(e.target.value as any)}
            style={{ width: 'auto', padding: '5px 32px 5px 12px', fontWeight: 600, color: currentStatusCfg.color, fontSize: '0.875rem' }}
          >
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <p style={{ margin: '4px 0 0', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
          การแก้ไขจะปรับสต็อกวัตถุดิบอัตโนมัติ (คืนเก่า + ตัดใหม่)
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Customer Info */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} style={{ color: 'var(--primary-400)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>ข้อมูลลูกค้า & การส่ง</span>
            </div>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">ชื่อลูกค้า / ร้านค้า</label>
                <input className="form-input" placeholder="เช่น ร้านขนมคุณยาย" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">เบอร์ติดต่อ</label>
                <input className="form-input" placeholder="08X-XXX-XXXX" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">วันที่สั่งซื้อ</label>
                <input className="form-input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">วันที่ส่งของ</label>
                <input className="form-input" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Product Selection */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingBag size={16} style={{ color: 'var(--primary-400)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>รายการสินค้า</span>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={addEntry}>
                <Plus size={14} /> เพิ่มรายการ
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entries.map((entry, idx) => {
                const product = products.find((p: any) => p.id === entry.product_id);
                const cost = entry.product_id ? getProductCost(entry.product_id) : 0;
                const subtotalRev = product ? (product.selling_price * parseInt(entry.quantity || '1')) : 0;
                return (
                  <div key={idx} style={{
                    display: 'grid', gridTemplateColumns: '1fr 90px auto',
                    gap: 10, alignItems: 'end',
                    padding: '12px 14px',
                    background: 'var(--surface-2)',
                    borderRadius: 10,
                  }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      {idx === 0 && <label className="form-label">สินค้า</label>}
                      <select
                        className="form-input form-select"
                        value={entry.product_id}
                        onChange={e => updateEntry(idx, 'product_id', e.target.value)}
                      >
                        <option value="">-- เลือกสินค้า --</option>
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatCurrency(p.selling_price)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      {idx === 0 && <label className="form-label">จำนวน</label>}
                      <input
                        className="form-input"
                        type="number" min="1"
                        value={entry.quantity}
                        onChange={e => updateEntry(idx, 'quantity', e.target.value)}
                        style={{ textAlign: 'center' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, paddingBottom: 2 }}>
                      {product ? (
                        <div style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                          <div style={{ color: 'var(--text-tertiary)' }}>ต้นทุน <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{formatCurrency(cost * parseInt(entry.quantity || '1'))}</span></div>
                          <div style={{ color: 'var(--text-secondary)', marginTop: 1 }}>ขาย <span style={{ fontWeight: 600 }}>{formatCurrency(subtotalRev)}</span></div>
                        </div>
                      ) : <div style={{ width: 80 }} />}
                      <button
                        className="btn-icon btn-ghost"
                        onClick={() => removeEntry(idx)}
                        style={{ color: 'var(--danger)' }}
                        disabled={entries.length === 1}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--info-bg)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--info)' }}>
                ⓘ การแก้ไขจะคืนสต็อกเก่าและตัดสต็อกใหม่อัตโนมัติ
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>หมายเหตุ</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <textarea
                className="form-input"
                placeholder="หมายเหตุสำหรับออเดอร์นี้ (ไม่จำเป็น)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ minHeight: 72, resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div style={{ position: 'sticky', top: 'calc(var(--topbar-height, 64px) + 20px)' }}>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit3 size={16} style={{ color: 'var(--primary-400)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>สรุปการแก้ไข</span>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* Original vs New comparison */}
              <div style={{
                padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8,
                marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase' }}>ยอดเดิม</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{formatCurrency(order.total_revenue)}</div>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--primary-400)', marginBottom: 4, textTransform: 'uppercase' }}>ยอดใหม่</div>
                  <div style={{ fontWeight: 700 }}>{formatCurrency(analysis.totalRevenue)}</div>
                </div>
              </div>

              {analysis.itemDetails.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem', padding: '8px 0' }}>
                  เลือกสินค้าเพื่อดูสรุป
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {analysis.itemDetails.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'var(--surface-2)', borderRadius: 8,
                        fontSize: '0.8125rem',
                      }}>
                        <span style={{ fontWeight: 500 }}>{item.name} ×{item.qty}</span>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(item.subtotalRevenue)}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'ต้นทุนรวมใหม่', value: formatCurrency(analysis.totalCost), color: 'var(--accent-amber)' },
                      { label: 'รายรับรวมใหม่', value: formatCurrency(analysis.totalRevenue), color: 'var(--text-primary)' },
                    ].map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                        <span style={{ fontWeight: 600, color: r.color }}>{r.value}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                      <span style={{ fontWeight: 600 }}>กำไรใหม่</span>
                      <span style={{ fontWeight: 700, fontSize: '1.125rem', color: analysis.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {formatCurrency(analysis.totalProfit)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 16 }}
                onClick={handleSubmit}
                disabled={analysis.itemDetails.length === 0 || submitting}
              >
                <CheckCircle size={16} />
                {submitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
