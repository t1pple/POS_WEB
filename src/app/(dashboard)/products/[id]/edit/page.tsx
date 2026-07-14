'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils/format';
import { CATEGORY_OPTIONS } from '@/lib/types';
import { ArrowLeft, Plus, Trash2, ShoppingBag, ChefHat, Calculator, Tag, Layers, BoxIcon, Save } from 'lucide-react';

interface RecipeEntry { recipe_id: string; quantity_used: string; }
interface PkgEntry { packaging_id: string; quantity_used: string; }

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { products, productRecipes, productPackaging, recipes, packaging, getRecipeCost, updateProductFull, addToast } = useStore() as any;

  const product = products.find((p: any) => p.id === id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [flavor, setFlavor] = useState('');
  const [piecesPerPack, setPiecesPerPack] = useState('1');
  const [sellingPrice, setSellingPrice] = useState('');
  const [category, setCategory] = useState('ขนม');
  const [saving, setSaving] = useState(false);

  const [recipeEntries, setRecipeEntries] = useState<RecipeEntry[]>([]);
  const [packagingEntries, setPkgEntries] = useState<PkgEntry[]>([]);

  // Populate form from existing data
  useEffect(() => {
    if (!product) return;
    setName(product.name || '');
    setDescription(product.description || '');
    setFlavor(product.flavor || '');
    setPiecesPerPack(String(product.pieces_per_pack || 1));
    setSellingPrice(String(product.selling_price || ''));
    setCategory(product.category || 'ขนม');

    const pRecs = productRecipes.filter((pr: any) => pr.product_id === id);
    setRecipeEntries(pRecs.map((pr: any) => ({ recipe_id: pr.recipe_id, quantity_used: String(pr.quantity_used) })));

    const pPkgs = productPackaging.filter((pp: any) => pp.product_id === id);
    setPkgEntries(pPkgs.map((pp: any) => ({ packaging_id: pp.packaging_id, quantity_used: String(pp.quantity_used) })));
  }, [id, product, productRecipes, productPackaging]);

  const costBreakdown = useMemo(() => {
    const recipeDetails: { name: string; cost: number; qty: string; costPerUnit: number }[] = [];
    let recipeCost = 0;
    for (const entry of recipeEntries) {
      if (!entry.recipe_id || !entry.quantity_used) continue;
      const recipe = recipes.find((r: any) => r.id === entry.recipe_id);
      if (!recipe) continue;
      const total = getRecipeCost(recipe.id);
      const yieldQty = recipe.yield_quantity || 1;
      const costPerUnit = total / yieldQty;
      const cost = costPerUnit * parseFloat(entry.quantity_used);
      recipeCost += cost;
      recipeDetails.push({ name: recipe.name, cost, qty: entry.quantity_used, costPerUnit });
    }

    const packagingDetails: { name: string; cost: number; qty: string }[] = [];
    let packagingCost = 0;
    for (const entry of packagingEntries) {
      if (!entry.packaging_id || !entry.quantity_used) continue;
      const pkg = packaging.find((p: any) => p.id === entry.packaging_id);
      if (!pkg) continue;
      const cost = pkg.price_per_unit * parseInt(entry.quantity_used);
      packagingCost += cost;
      packagingDetails.push({ name: pkg.name, cost, qty: entry.quantity_used });
    }

    const totalCost = recipeCost + packagingCost;
    const price = parseFloat(sellingPrice) || 0;
    const profit = price - totalCost;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    return { recipeDetails, packagingDetails, totalCost, profit, margin };
  }, [recipeEntries, packagingEntries, sellingPrice, recipes, packaging, getRecipeCost]);

  const handleSave = async () => {
    if (!name) { addToast('error', 'กรุณาใส่ชื่อสินค้า'); return; }
    if (!sellingPrice || parseFloat(sellingPrice) <= 0) { addToast('error', 'กรุณาใส่ราคาขาย'); return; }
    const validRecipes = recipeEntries.filter(e => e.recipe_id && e.quantity_used);
    if (validRecipes.length === 0) { addToast('error', 'กรุณาเลือกสูตรอาหารอย่างน้อย 1 สูตร'); return; }
    const validPkg = packagingEntries.filter(e => e.packaging_id && e.quantity_used);
    setSaving(true);
    try {
      await updateProductFull(
        id,
        { name, description, flavor, pieces_per_pack: parseInt(piecesPerPack) || 1, selling_price: parseFloat(sellingPrice), category },
        validRecipes.map(e => ({ recipe_id: e.recipe_id, quantity_used: parseFloat(e.quantity_used) })),
        validPkg.map(e => ({ packaging_id: e.packaging_id, quantity_used: parseInt(e.quantity_used) })),
      );
      addToast('success', `อัปเดตสินค้า "${name}" สำเร็จ!`);
      router.push(`/products/${id}`);
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  if (!product) return (
    <div className="empty-state">
      <div className="empty-state-icon"><ShoppingBag size={36} /></div>
      <h3>ไม่พบสินค้า</h3>
      <Link href="/products" className="btn btn-primary">กลับไปหน้าสินค้า</Link>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost" onClick={() => router.back()} style={{ marginBottom: 'var(--space-2)' }}>
            <ArrowLeft size={18} /> กลับ
          </button>
          <h1>แก้ไขสินค้า: {product.name}</h1>
          <p>อัปเดตข้อมูล สูตร และบรรจุภัณฑ์</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 'var(--space-6)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

          {/* Basic Info */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ShoppingBag size={20} style={{ color: 'var(--primary-400)' }} /> ข้อมูลสินค้า
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">ชื่อสินค้า <span className="form-required">*</span></label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label"><Tag size={14} style={{ display: 'inline', marginRight: 4 }} />รสชาติ</label>
                  <input className="form-input" value={flavor} onChange={e => setFlavor(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label"><Layers size={14} style={{ display: 'inline', marginRight: 4 }} />จำนวนชิ้น/แพ็ค</label>
                  <input className="form-input" type="number" min="1" value={piecesPerPack} onChange={e => setPiecesPerPack(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">ราคาขาย <span className="form-required">*</span></label>
                  <input className="form-input" type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">หมวดหมู่</label>
                  <select className="form-input form-select" value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">รายละเอียด</label>
                <textarea className="form-input" value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: 70 }} />
              </div>
            </div>
          </div>

          {/* Recipes */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ChefHat size={20} style={{ color: 'var(--accent-emerald)' }} /> สูตรอาหารที่ใช้ผลิต
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setRecipeEntries(p => [...p, { recipe_id: '', quantity_used: '1' }])}>
                <Plus size={16} /> เพิ่มสูตร
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {recipeEntries.map((entry, idx) => {
                const recipe = recipes.find((r: any) => r.id === entry.recipe_id);
                const recipeCost = recipe ? getRecipeCost(recipe.id) : 0;
                const recipeYield = recipe?.yield_quantity || 1;
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 40px', gap: 'var(--space-3)', alignItems: 'end' }}>
                    <div className="form-group">
                      {idx === 0 && <label className="form-label">เลือกสูตรอาหาร</label>}
                      <select className="form-input form-select" value={entry.recipe_id}
                        onChange={e => setRecipeEntries(p => p.map((en, i) => i === idx ? { ...en, recipe_id: e.target.value } : en))}>
                        <option value="">-- เลือกสูตร --</option>
                        {recipes.map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name} (yield {r.yield_quantity} | {formatCurrency(getRecipeCost(r.id) / (r.yield_quantity || 1))}/ชิ้น)</option>
                        ))}
                      </select>
                      {recipe && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          ต้นทุน {formatCurrency(recipeCost)} / {recipeYield} ชิ้น = {formatCurrency(recipeCost / recipeYield)}/ชิ้น
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      {idx === 0 && <label className="form-label">จำนวนชิ้น</label>}
                      <input className="form-input" type="number" min="0.1" step="0.1" value={entry.quantity_used}
                        onChange={e => setRecipeEntries(p => p.map((en, i) => i === idx ? { ...en, quantity_used: e.target.value } : en))} />
                    </div>
                    <button className="btn-icon btn-ghost" onClick={() => setRecipeEntries(p => p.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', marginBottom: 2 }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              {recipeEntries.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-4)', border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                  กดปุ่มด้านบนเพื่อเพิ่มสูตร
                </div>
              )}
            </div>
          </div>

          {/* Packaging */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <BoxIcon size={20} style={{ color: 'var(--accent-amber)' }} /> บรรจุภัณฑ์
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setPkgEntries(p => [...p, { packaging_id: '', quantity_used: '1' }])}>
                <Plus size={16} /> เพิ่มบรรจุภัณฑ์
              </button>
            </div>
            {packagingEntries.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem', border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                ไม่ได้ใช้บรรจุภัณฑ์ — กดปุ่มด้านบนเพื่อเพิ่ม
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {packagingEntries.map((entry, idx) => {
                  const pkg = packaging.find((p: any) => p.id === entry.packaging_id);
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 60px 40px', gap: 'var(--space-3)', alignItems: 'end' }}>
                      <div className="form-group">
                        {idx === 0 && <label className="form-label">เลือกบรรจุภัณฑ์</label>}
                        <select className="form-input form-select" value={entry.packaging_id}
                          onChange={e => setPkgEntries(p => p.map((en, i) => i === idx ? { ...en, packaging_id: e.target.value } : en))}>
                          <option value="">-- เลือก --</option>
                          {packaging.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price_per_unit)}/{p.unit})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        {idx === 0 && <label className="form-label">จำนวน</label>}
                        <input className="form-input" type="number" min="1" value={entry.quantity_used}
                          onChange={e => setPkgEntries(p => p.map((en, i) => i === idx ? { ...en, quantity_used: e.target.value } : en))} />
                      </div>
                      <div style={{ paddingBottom: 6, fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{pkg?.unit || 'ชิ้น'}</div>
                      <button className="btn-icon btn-ghost" onClick={() => setPkgEntries(p => p.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', marginBottom: 2 }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cost Summary + Save */}
        <div style={{ position: 'sticky', top: 'calc(var(--topbar-height) + var(--space-8))' }}>
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Calculator size={20} style={{ color: 'var(--primary-400)' }} /> สรุปต้นทุน
            </h3>
            {costBreakdown.recipeDetails.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>สูตร</div>
                {costBreakdown.recipeDetails.map((d, i) => (
                  <div key={i} style={{ marginBottom: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(d.cost)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{d.qty} ชิ้น × {formatCurrency(d.costPerUnit)}/ชิ้น</div>
                  </div>
                ))}
              </div>
            )}
            {costBreakdown.packagingDetails.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>บรรจุภัณฑ์</div>
                {costBreakdown.packagingDetails.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', padding: 'var(--space-1) 0', color: 'var(--text-secondary)' }}>
                    <span>{d.name} (x{d.qty})</span>
                    <span>{formatCurrency(d.cost)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ต้นทุนรวม</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{formatCurrency(costBreakdown.totalCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ราคาขาย</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(parseFloat(sellingPrice) || 0)}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                <span style={{ fontWeight: 600 }}>กำไร</span>
                <span style={{ fontWeight: 700, color: costBreakdown.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(costBreakdown.profit)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Margin</span>
                <span className={`badge ${costBreakdown.margin >= 50 ? 'badge-success' : costBreakdown.margin >= 30 ? 'badge-warning' : 'badge-danger'}`}>
                  {costBreakdown.margin.toFixed(1)}%
                </span>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-6)' }} onClick={handleSave} disabled={saving}>
              <Save size={18} /> {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
