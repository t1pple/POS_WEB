'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils/format';
import { CATEGORY_OPTIONS } from '@/lib/types';
import { ArrowLeft, Plus, Trash2, ChefHat, Package, Calculator, GitBranch, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface IngredientEntry {
  id?: string;
  ingredient_id: string;
  quantity_used: string;
  unit: string;
  input_mode: 'per_piece' | 'total_batch';
}

interface SubRecipeEntry {
  id?: string;
  sub_recipe_id: string;
  quantity_used: string;
  unit: string;
}

export default function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { recipes, ingredients, recipeIngredients, recipeSubRecipes, getRecipeCost, fetchAllData, addToast } = useStore() as any;

  const recipe = recipes.find((r: any) => r.id === id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [yieldQuantity, setYieldQuantity] = useState('1');
  const [category, setCategory] = useState('เครื่องดื่ม');
  const [saving, setSaving] = useState(false);

  const [ingredientEntries, setIngredientEntries] = useState<IngredientEntry[]>([]);
  const [subRecipeEntries, setSubRecipeEntries] = useState<SubRecipeEntry[]>([]);

  const supabase = createClient();

  // Populate form when recipe loads
  useEffect(() => {
    if (!recipe) return;
    setName(recipe.name || '');
    setDescription(recipe.description || '');
    setYieldQuantity(String(recipe.yield_quantity || 1));
    setCategory(recipe.category || 'เครื่องดื่ม');

    const rIngs = recipeIngredients.filter((ri: any) => ri.recipe_id === id);
    setIngredientEntries(rIngs.map((ri: any) => ({
      id: ri.id,
      ingredient_id: ri.ingredient_id,
      quantity_used: String(ri.quantity_used),
      unit: ri.unit,
      input_mode: ri.input_mode || 'total_batch',
    })));

    const rSubs = recipeSubRecipes.filter((rsr: any) => rsr.recipe_id === id);
    setSubRecipeEntries(rSubs.map((rsr: any) => ({
      id: rsr.id,
      sub_recipe_id: rsr.sub_recipe_id,
      quantity_used: String(rsr.quantity_used),
      unit: rsr.unit,
    })));
  }, [id, recipe, recipeIngredients, recipeSubRecipes]);

  // Real-time cost preview
  const costBreakdown = useMemo(() => {
    let ingredientCost = 0;
    const ingredientDetails: { name: string; cost: number; qty: string; unit: string }[] = [];
    for (const entry of ingredientEntries) {
      if (!entry.ingredient_id || !entry.quantity_used) continue;
      const ing = ingredients.find((i: any) => i.id === entry.ingredient_id);
      if (!ing) continue;
      const qty = parseFloat(entry.quantity_used);
      const cost = entry.unit === 'แพ็ค' ? qty * ing.price : qty * ing.price_per_unit;
      ingredientCost += cost;
      ingredientDetails.push({ name: ing.name, cost, qty: entry.quantity_used, unit: entry.unit });
    }

    let subCost = 0;
    const subDetails: { name: string; cost: number; qty: string; unit: string; perUnit: number }[] = [];
    for (const entry of subRecipeEntries) {
      if (!entry.sub_recipe_id || !entry.quantity_used) continue;
      const sub = recipes.find((r: any) => r.id === entry.sub_recipe_id);
      if (!sub) continue;
      const totalSubCost = getRecipeCost(sub.id);
      const subYield = sub.yield_quantity || 1;
      const perUnit = totalSubCost / subYield;
      const cost = perUnit * parseFloat(entry.quantity_used);
      subCost += cost;
      subDetails.push({ name: sub.name, cost, qty: entry.quantity_used, unit: entry.unit || 'ชิ้น', perUnit });
    }

    const totalCost = ingredientCost + subCost;
    const yieldQty = parseFloat(yieldQuantity) || 1;
    return { totalCost, costPerPiece: totalCost / yieldQty, ingredientDetails, subDetails };
  }, [ingredientEntries, subRecipeEntries, yieldQuantity, ingredients, recipes, getRecipeCost]);

  const handleSave = async () => {
    if (!name) { addToast('error', 'กรุณาใส่ชื่อสูตร'); return; }
    setSaving(true);
    try {
      // 1. Update recipe row
      await supabase.from('recipes').update({
        name, description,
        yield_quantity: parseFloat(yieldQuantity) || 1,
        category,
      }).eq('id', id);

      // 2. Replace ingredients: delete then insert
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
      const validIngs = ingredientEntries.filter(e => e.ingredient_id && e.quantity_used);
      if (validIngs.length > 0) {
        await supabase.from('recipe_ingredients').insert(validIngs.map(e => ({
          recipe_id: id,
          ingredient_id: e.ingredient_id,
          quantity_used: parseFloat(e.quantity_used),
          unit: e.unit,
          input_mode: e.input_mode,
        })));
      }

      // 3. Replace sub-recipes
      await supabase.from('recipe_sub_recipes').delete().eq('recipe_id', id);
      const validSubs = subRecipeEntries.filter(e => e.sub_recipe_id && e.quantity_used);
      if (validSubs.length > 0) {
        await supabase.from('recipe_sub_recipes').insert(validSubs.map(e => ({
          recipe_id: id,
          sub_recipe_id: e.sub_recipe_id,
          quantity_used: parseFloat(e.quantity_used),
          unit: e.unit,
        })));
      }

      addToast('success', `อัปเดตสูตร "${name}" สำเร็จ!`);
      router.push(`/recipes/${id}`);
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  if (!recipe) return (
    <div className="empty-state">
      <div className="empty-state-icon"><ChefHat size={36} /></div>
      <h3>ไม่พบสูตรอาหาร</h3>
      <Link href="/recipes" className="btn btn-primary">กลับไปหน้าสูตร</Link>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost" onClick={() => router.back()} style={{ marginBottom: 'var(--space-2)' }}>
            <ArrowLeft size={18} /> กลับ
          </button>
          <h1>แก้ไขสูตร: {recipe.name}</h1>
          <p>แก้ไขวัตถุดิบและปริมาณที่ใช้</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-6)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

          {/* Basic Info */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ChefHat size={20} style={{ color: 'var(--primary-400)' }} /> ข้อมูลสูตร
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">ชื่อสูตร <span className="form-required">*</span></label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">จำนวนที่ได้ (ชิ้น/สูตร) <span className="form-required">*</span></label>
                  <input className="form-input" type="number" min="1" value={yieldQuantity} onChange={e => setYieldQuantity(e.target.value)} />
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
                <textarea className="form-input" value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: 80 }} />
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Package size={20} style={{ color: 'var(--accent-emerald)' }} /> วัตถุดิบ
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setIngredientEntries(p => [...p, { ingredient_id: '', quantity_used: '', unit: 'กรัม', input_mode: 'per_piece' }])}>
                <Plus size={16} /> เพิ่มวัตถุดิบ
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {ingredientEntries.map((entry, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px 140px 40px', gap: 'var(--space-3)', alignItems: 'end' }}>
                  <div className="form-group">
                    {idx === 0 && <label className="form-label">เลือกวัตถุดิบ</label>}
                    <select className="form-input form-select" value={entry.ingredient_id}
                      onChange={e => {
                        const ing = ingredients.find((i: any) => i.id === e.target.value);
                        setIngredientEntries(p => p.map((en, i) => i === idx ? { ...en, ingredient_id: e.target.value, unit: ing?.unit || 'กรัม' } : en));
                      }}>
                      <option value="">-- เลือก --</option>
                      {ingredients.map((ing: any) => (
                        <option key={ing.id} value={ing.id}>{ing.name} ({formatCurrency(ing.price_per_unit)}/{ing.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    {idx === 0 && <label className="form-label">ปริมาณใช้</label>}
                    <input className="form-input" type="number" placeholder="0" value={entry.quantity_used}
                      onChange={e => setIngredientEntries(p => p.map((en, i) => i === idx ? { ...en, quantity_used: e.target.value } : en))} />
                  </div>
                  <div className="form-group">
                    {idx === 0 && <label className="form-label">หน่วย</label>}
                    <select className="form-input form-select" value={entry.unit}
                      onChange={e => setIngredientEntries(p => p.map((en, i) => i === idx ? { ...en, unit: e.target.value } : en))}>
                      <option value={ingredients.find((ig: any) => ig.id === entry.ingredient_id)?.unit || 'กรัม'}>
                        {ingredients.find((ig: any) => ig.id === entry.ingredient_id)?.unit || 'กรัม'} (ย่อย)
                      </option>
                      <option value="แพ็ค">แพ็ค/ถุง</option>
                    </select>
                  </div>
                  <div className="form-group">
                    {idx === 0 && <label className="form-label">รูปแบบ</label>}
                    <select className="form-input form-select" value={entry.input_mode}
                      onChange={e => setIngredientEntries(p => p.map((en, i) => i === idx ? { ...en, input_mode: e.target.value as any } : en))}>
                      <option value="per_piece">ต่อ 1 ชิ้น</option>
                      <option value="total_batch">รวมทั้งสูตร</option>
                    </select>
                  </div>
                  <button className="btn-icon btn-ghost" onClick={() => setIngredientEntries(p => p.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', marginBottom: 2 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {ingredientEntries.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-4)', border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  กดปุ่มด้านบนเพื่อเพิ่มวัตถุดิบ
                </div>
              )}
            </div>
          </div>

          {/* Sub-Recipes */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <GitBranch size={20} style={{ color: 'var(--primary-400)' }} /> สูตรย่อย
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setSubRecipeEntries(p => [...p, { sub_recipe_id: '', quantity_used: '1', unit: 'ชิ้น' }])}>
                <Plus size={16} /> เพิ่มสูตรย่อย
              </button>
            </div>
            {subRecipeEntries.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-4)', border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                ไม่ได้ใช้สูตรย่อย
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {subRecipeEntries.map((entry, idx) => {
                  const sub = recipes.find((r: any) => r.id === entry.sub_recipe_id);
                  const subCostTotal = sub ? getRecipeCost(sub.id) : 0;
                  const perUnit = sub ? subCostTotal / (sub.yield_quantity || 1) : 0;
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 40px', gap: 'var(--space-3)', alignItems: 'end' }}>
                      <div className="form-group">
                        {idx === 0 && <label className="form-label">เลือกสูตรย่อย</label>}
                        <select className="form-input form-select" value={entry.sub_recipe_id}
                          onChange={e => setSubRecipeEntries(p => p.map((en, i) => i === idx ? { ...en, sub_recipe_id: e.target.value } : en))}>
                          <option value="">-- เลือกสูตร --</option>
                          {recipes.filter((r: any) => r.id !== id).map((r: any) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.yield_quantity} ชิ้น | {formatCurrency(getRecipeCost(r.id) / (r.yield_quantity || 1))}/ชิ้น)
                            </option>
                          ))}
                        </select>
                        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{formatCurrency(subCostTotal)} / {sub.yield_quantity} ชิ้น = {formatCurrency(perUnit)}/ชิ้น</div>}
                      </div>
                      <div className="form-group">
                        {idx === 0 && <label className="form-label">จำนวน</label>}
                        <input className="form-input" type="number" min="0.1" step="0.1" value={entry.quantity_used}
                          onChange={e => setSubRecipeEntries(p => p.map((en, i) => i === idx ? { ...en, quantity_used: e.target.value } : en))} />
                      </div>
                      <div className="form-group">
                        {idx === 0 && <label className="form-label">หน่วย</label>}
                        <input className="form-input" value={entry.unit}
                          onChange={e => setSubRecipeEntries(p => p.map((en, i) => i === idx ? { ...en, unit: e.target.value } : en))} />
                      </div>
                      <button className="btn-icon btn-ghost" onClick={() => setSubRecipeEntries(p => p.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', marginBottom: 2 }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cost + Save */}
        <div style={{ position: 'sticky', top: 'calc(var(--topbar-height) + var(--space-8))' }}>
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Calculator size={20} style={{ color: 'var(--primary-400)' }} /> สรุปต้นทุน
            </h3>

            {costBreakdown.ingredientDetails.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>วัตถุดิบ</div>
                {costBreakdown.ingredientDetails.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', padding: 'var(--space-1) 0', color: 'var(--text-secondary)' }}>
                    <span>{d.name} ({d.qty} {d.unit})</span>
                    <span>{formatCurrency(d.cost)}</span>
                  </div>
                ))}
              </div>
            )}
            {costBreakdown.subDetails.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>สูตรย่อย</div>
                {costBreakdown.subDetails.map((d, i) => (
                  <div key={i} style={{ marginBottom: 'var(--space-1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      <span>{d.name} ({d.qty} {d.unit})</span>
                      <span>{formatCurrency(d.cost)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>{formatCurrency(d.perUnit)}/ชิ้น</div>
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
                <span style={{ color: 'var(--text-secondary)' }}>จำนวนที่ได้</span>
                <span style={{ fontWeight: 600 }}>{yieldQuantity || 1} ชิ้น</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                <span style={{ fontWeight: 600 }}>ต้นทุน/ชิ้น</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-400)' }}>{formatCurrency(costBreakdown.costPerPiece)}</span>
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
