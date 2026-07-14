'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import {
  ArrowLeft, Plus, Trash2, ShoppingCart, AlertTriangle,
  CheckCircle, Package, ShoppingBag, User, Calendar, FileText
} from 'lucide-react';

interface OrderEntry {
  product_id: string;
  quantity: string;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const {
    products, recipes, ingredients, recipeIngredients, recipeSubRecipes,
    packaging, productRecipes, productPackaging, getProductCost, createOrder, addToast
  } = useStore() as any;

  const [entries, setEntries] = useState<OrderEntry[]>([{ product_id: '', quantity: '1' }]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addEntry = () => setEntries(prev => [...prev, { product_id: '', quantity: '1' }]);
  const removeEntry = (idx: number) => setEntries(prev => prev.filter((_, i) => i !== idx));
  const updateEntry = (idx: number, field: string, value: string) =>
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));

  const analysis = useMemo(() => {
    const validEntries = entries.filter(e => e.product_id && e.quantity && parseInt(e.quantity) > 0);
    const requiredIngredients = new Map<string, { name: string; required: number; available: number; unit: string; quantityPerPack: number; ingredientUnit: string }>();
    const requiredPackaging = new Map<string, { name: string; required: number; available: number; unit: string; quantityPerPack: number; ingredientUnit: string }>();
    let totalCost = 0, totalRevenue = 0;
    const itemDetails: { name: string; qty: number; cost: number; price: number; subtotalCost: number; subtotalRevenue: number }[] = [];

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
        else requiredIngredients.set(ri.ingredient_id, {
          name: ing.name, required: neededPacks, available: ing.stock_quantity,
          unit: 'แพ็ค', quantityPerPack: ing.quantity, ingredientUnit: ing.unit,
        });
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
        else requiredPackaging.set(pp.packaging_id, {
          name: pkg.name, required: needed, available: pkg.stock_quantity * pkg.quantity,
          unit: pkg.unit, quantityPerPack: pkg.quantity, ingredientUnit: pkg.unit,
        });
      }
    }

    const ingredientCheck = Array.from(requiredIngredients.entries()).map(([id, d]) => ({
      id, ...d,
      sufficient: d.available >= d.required,
      shortage: Math.max(0, d.required - d.available),
      shortagePacksCeil: Math.ceil(Math.max(0, d.required - d.available)),
      shortageAmount: Math.ceil(Math.max(0, d.required - d.available)) * d.quantityPerPack,
    }));
    const packagingCheck = Array.from(requiredPackaging.entries()).map(([id, d]) => ({
      id, ...d,
      sufficient: d.available >= d.required,
      shortage: Math.max(0, d.required - d.available),
      shortagePacksCeil: Math.ceil(Math.max(0, d.required - d.available)),
      shortageAmount: Math.ceil(Math.max(0, d.required - d.available)) * d.quantityPerPack,
    }));

    return {
      itemDetails, ingredientCheck, packagingCheck, totalCost, totalRevenue,
      totalProfit: totalRevenue - totalCost,
      allSufficient: ingredientCheck.every(i => i.sufficient) && packagingCheck.every(p => p.sufficient),
      hasWarning: ingredientCheck.some(i => !i.sufficient) || packagingCheck.some(p => !p.sufficient),
    };
  }, [entries, products, recipes, ingredients, packaging, recipeIngredients, recipeSubRecipes, productRecipes, productPackaging, getProductCost]);

  const handleSubmit = async () => {
    const validEntries = entries.filter(e => e.product_id && e.quantity && parseInt(e.quantity) > 0);
    if (validEntries.length === 0) { addToast('error', 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'); return; }
    if (analysis.hasWarning) { addToast('warning', 'วัตถุดิบบางรายการไม่เพียงพอ แต่ยังสร้างออเดอร์ได้'); }
    setSubmitting(true);
    try {
      await createOrder(
        validEntries.map(e => ({ product_id: e.product_id, quantity: parseInt(e.quantity) })),
        { notes: notes || undefined, customer_name: customerName || undefined, customer_phone: customerPhone || undefined, order_date: orderDate || undefined, delivery_date: deliveryDate || undefined }
      );
      addToast('success', 'สร้างออเดอร์สำเร็จ!');
      router.push('/orders');
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      setSubmitting(false);
    }
  };

  const allStockItems = [...analysis.ingredientCheck, ...analysis.packagingCheck];

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => router.back()} style={{ marginBottom: 12, padding: '4px 8px' }}>
          <ArrowLeft size={16} /> กลับ
        </button>
        <h1 style={{ margin: 0 }}>สร้างออเดอร์ใหม่</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>เลือกสินค้า กำหนดจำนวน และตรวจสอบวัตถุดิบ</p>
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
              {products.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px 0' }}>ยังไม่มีสินค้า กรุณาสร้างสินค้าก่อน</p>
              ) : (
                entries.map((entry, idx) => {
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
                })
              )}
            </div>
          </div>

          {/* Stock Check */}
          {allStockItems.length > 0 && (
            <div style={{ background: 'var(--surface-1)', border: `1px solid ${analysis.allSufficient ? 'var(--border-subtle)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={16} style={{ color: analysis.allSufficient ? 'var(--success)' : 'var(--danger)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>สต็อกวัตถุดิบ & บรรจุภัณฑ์</span>
              </div>

              {analysis.allSufficient ? (
                /* All good — single green row */
                <div style={{
                  padding: '14px 20px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  color: 'var(--success)',
                }}>
                  <CheckCircle size={18} />
                  <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>วัตถุดิบและบรรจุภัณฑ์พอสำหรับออเดอร์นี้</span>
                </div>
              ) : (
                /* Only show the items that are short */
                <div>
                  {allStockItems.filter(item => !item.sufficient).map((item, i, arr) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 20px',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          ต้องซื้อเพิ่ม
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 12px', borderRadius: 99,
                          background: 'var(--danger-bg)', color: 'var(--danger)',
                          fontSize: '0.8125rem', fontWeight: 700,
                        }}>
                          <AlertTriangle size={13} />
                          {item.shortagePacksCeil} แพ็ค
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                          ≈ {item.shortageAmount.toLocaleString()} {item.ingredientUnit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

        {/* Right: Sticky Summary */}
        <div style={{ position: 'sticky', top: 'calc(var(--topbar-height, 64px) + 20px)' }}>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={16} style={{ color: 'var(--primary-400)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>สรุปออเดอร์</span>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {analysis.itemDetails.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem', padding: '16px 0' }}>
                  เลือกสินค้าเพื่อดูสรุป
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {analysis.itemDetails.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'var(--surface-2)', borderRadius: 8,
                      }}>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            ×{item.qty} · ต้นทุน {formatCurrency(item.cost)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{formatCurrency(item.subtotalRevenue)}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: 2 }}>
                            กำไร {formatCurrency(item.subtotalRevenue - item.subtotalCost)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'ต้นทุนรวม', value: formatCurrency(analysis.totalCost), color: 'var(--accent-amber)' },
                      { label: 'รายรับรวม', value: formatCurrency(analysis.totalRevenue), color: 'var(--text-primary)' },
                    ].map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                        <span style={{ fontWeight: 600, color: r.color }}>{r.value}</span>
                      </div>
                    ))}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 4,
                    }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>กำไร</span>
                      <span style={{ fontWeight: 700, fontSize: '1.125rem', color: analysis.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {formatCurrency(analysis.totalProfit)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {analysis.hasWarning && (
                <div style={{
                  marginTop: 14, padding: '10px 12px',
                  background: 'var(--warning-bg)', borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: '0.8125rem', color: 'var(--warning)',
                }}>
                  <AlertTriangle size={15} /> วัตถุดิบบางรายการไม่พอ
                </div>
              )}

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 16 }}
                onClick={handleSubmit}
                disabled={analysis.itemDetails.length === 0 || submitting}
              >
                <ShoppingCart size={16} />
                {submitting ? 'กำลังสร้าง...' : 'ยืนยันออเดอร์'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
