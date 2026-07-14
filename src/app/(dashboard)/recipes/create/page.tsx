'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils/format';
import { CATEGORY_OPTIONS } from '@/lib/types';
import {
  ArrowLeft, Plus, Trash2, ChefHat, Package, Calculator, GitBranch
} from 'lucide-react';

interface IngredientEntry {
  ingredient_id: string;
  quantity_used: string;
  unit: string;
  input_mode: 'per_piece' | 'total_batch';
}

interface SubRecipeEntry {
  sub_recipe_id: string;
  quantity_used: string;
  unit: string;
}

export default function CreateRecipePage() {
  const router = useRouter();
  const { ingredients, recipes, addRecipe, getRecipeCost, addToast } = useStore();

  const [recipeName, setRecipeName] = useState('');
  const [description, setDescription] = useState('');
  const [yieldQuantity, setYieldQuantity] = useState('1');
  const [category, setCategory] = useState('เครื่องดื่ม');

  const [ingredientEntries, setIngredientEntries] = useState<IngredientEntry[]>([
    { ingredient_id: '', quantity_used: '', unit: 'กรัม', input_mode: 'per_piece' },
  ]);
  const [subRecipeEntries, setSubRecipeEntries] = useState<SubRecipeEntry[]>([]);

  // Calculate costs in real-time
  const costBreakdown = useMemo(() => {
    let ingredientCost = 0;
    const ingredientDetails: { name: string; cost: number; qty: string; unit: string }[] = [];

    for (const entry of ingredientEntries) {
      if (!entry.ingredient_id || !entry.quantity_used) continue;
      const ing = ingredients.find(i => i.id === entry.ingredient_id);
      if (!ing) continue;

      const qty = parseFloat(entry.quantity_used);
      const yieldQty = parseFloat(yieldQuantity) || 1;
      const totalQty = entry.input_mode === 'per_piece' ? qty * yieldQty : qty;
      const cost = entry.unit === 'แพ็ค' ? totalQty * ing.price : totalQty * ing.price_per_unit;

      ingredientCost += cost;
      ingredientDetails.push({ name: ing.name, cost, qty: entry.quantity_used, unit: entry.unit });
    }

    // Sub-recipe costs
    let subRecipeCost = 0;
    const subRecipeDetails: { name: string; cost: number; qty: string; unit: string; costPerUnit: number }[] = [];

    for (const entry of subRecipeEntries) {
      if (!entry.sub_recipe_id || !entry.quantity_used) continue;
      const subRecipe = recipes.find(r => r.id === entry.sub_recipe_id);
      if (!subRecipe) continue;
      const subCostTotal = getRecipeCost(entry.sub_recipe_id);
      const subYield = subRecipe.yield_quantity || 1;
      const costPerUnit = subCostTotal / subYield;
      const qty = parseFloat(entry.quantity_used);
      const cost = costPerUnit * qty;
      subRecipeCost += cost;
      subRecipeDetails.push({
        name: subRecipe.name, cost, qty: entry.quantity_used,
        unit: entry.unit || 'ชิ้น', costPerUnit,
      });
    }

    const totalCost = ingredientCost + subRecipeCost;
    const costPerPiece = totalCost / (parseFloat(yieldQuantity) || 1);

    return { ingredientCost, subRecipeCost, totalCost, costPerPiece, ingredientDetails, subRecipeDetails };
  }, [ingredientEntries, subRecipeEntries, ingredients, recipes, getRecipeCost, yieldQuantity]);

  // Ingredient handlers
  const addIngredientRow = () =>
    setIngredientEntries(prev => [...prev, { ingredient_id: '', quantity_used: '', unit: 'กรัม', input_mode: 'per_piece' }]);
  const removeIngredientRow = (idx: number) =>
    setIngredientEntries(prev => prev.filter((_, i) => i !== idx));
  const updateIngredientRow = (idx: number, field: string, value: string) =>
    setIngredientEntries(prev => prev.map((entry, i) => {
      if (i !== idx) return entry;
      const updated = { ...entry, [field]: value };
      if (field === 'ingredient_id') {
        const ing = ingredients.find(ig => ig.id === value);
        if (ing) updated.unit = ing.unit;
      }
      return updated;
    }));

  // Sub-recipe handlers
  const addSubRecipeRow = () =>
    setSubRecipeEntries(prev => [...prev, { sub_recipe_id: '', quantity_used: '1', unit: 'ชิ้น' }]);
  const removeSubRecipeRow = (idx: number) =>
    setSubRecipeEntries(prev => prev.filter((_, i) => i !== idx));
  const updateSubRecipeRow = (idx: number, field: string, value: string) =>
    setSubRecipeEntries(prev => prev.map((entry, i) => i === idx ? { ...entry, [field]: value } : entry));

  const handleSubmit = async () => {
    if (!recipeName) { addToast('error', 'กรุณาใส่ชื่อสูตร'); return; }

    const validIngredients = ingredientEntries.filter(e => e.ingredient_id && e.quantity_used);
    const validSubRecipes = subRecipeEntries.filter(e => e.sub_recipe_id && e.quantity_used);

    if (validIngredients.length === 0 && validSubRecipes.length === 0) {
      addToast('error', 'กรุณาเพิ่มวัตถุดิบหรือสูตรย่อยอย่างน้อย 1 รายการ');
      return;
    }

    await addRecipe(
      {
        name: recipeName,
        description,
        selling_price: 0, // ไม่ใช้ใน recipe แล้ว — ราคาขายอยู่ที่ Product
        yield_quantity: parseFloat(yieldQuantity) || 1,
        category,
      },
      validIngredients.map(e => {
        const qty = parseFloat(e.quantity_used);
        const yieldQty = parseFloat(yieldQuantity) || 1;
        const finalQty = e.input_mode === 'per_piece' ? qty * yieldQty : qty;
        return {
          ingredient_id: e.ingredient_id,
          quantity_used: finalQty,
          unit: e.unit,
          input_mode: e.input_mode,
        };
      }),
      [], // ไม่มี packaging ใน recipe แล้ว
      validSubRecipes.map(e => ({
        sub_recipe_id: e.sub_recipe_id,
        quantity_used: parseFloat(e.quantity_used),
        unit: e.unit,
      })),
    );

    addToast('success', `สร้างสูตร "${recipeName}" สำเร็จ!`);
    router.push('/recipes');
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost" onClick={() => router.back()} style={{ marginBottom: 'var(--space-2)' }}>
            <ArrowLeft size={18} /> กลับ
          </button>
          <h1>สร้างสูตรอาหารใหม่</h1>
          <p>ระบุวัตถุดิบและปริมาณที่ใช้เพื่อคำนวณต้นทุนการผลิต</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Left: Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

          {/* Basic Info */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ChefHat size={20} style={{ color: 'var(--primary-400)' }} /> ข้อมูลสูตร
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">ชื่อสูตร <span className="form-required">*</span></label>
                <input className="form-input" placeholder="เช่น แป้งทองม้วน 1 หม้อ" value={recipeName} onChange={e => setRecipeName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">จำนวนที่ได้ (ชิ้น/สูตร) <span className="form-required">*</span></label>
                  <input className="form-input" type="number" min="1" placeholder="70" value={yieldQuantity} onChange={e => setYieldQuantity(e.target.value)} />
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
                <textarea className="form-input" placeholder="อธิบายสูตร วิธีทำ หรือหมายเหตุ..." value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: 80 }} />
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Package size={20} style={{ color: 'var(--accent-emerald)' }} /> วัตถุดิบ
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={addIngredientRow}>
                <Plus size={16} /> เพิ่มวัตถุดิบ
              </button>
            </div>

            {ingredients.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <p>ยังไม่มีวัตถุดิบในคลัง กรุณาเพิ่มวัตถุดิบก่อน</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {ingredientEntries.map((entry, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px 140px 40px', gap: 'var(--space-3)', alignItems: 'end' }}>
                    <div className="form-group">
                      {idx === 0 && <label className="form-label">เลือกวัตถุดิบ</label>}
                      <select className="form-input form-select" value={entry.ingredient_id} onChange={e => updateIngredientRow(idx, 'ingredient_id', e.target.value)}>
                        <option value="">-- เลือก --</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name} ({formatCurrency(ing.price_per_unit)}/{ing.unit})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      {idx === 0 && <label className="form-label">ปริมาณใช้</label>}
                      <input className="form-input" type="number" placeholder="0" value={entry.quantity_used} onChange={e => updateIngredientRow(idx, 'quantity_used', e.target.value)} />
                    </div>
                    <div className="form-group">
                      {idx === 0 && <label className="form-label">หน่วย</label>}
                      <select className="form-input form-select" value={entry.unit} onChange={e => updateIngredientRow(idx, 'unit', e.target.value)}>
                        <option value={ingredients.find(ig => ig.id === entry.ingredient_id)?.unit || 'กรัม'}>
                          {ingredients.find(ig => ig.id === entry.ingredient_id)?.unit || 'กรัม'} (ย่อย)
                        </option>
                        <option value="แพ็ค">แพ็ค/ถุง</option>
                      </select>
                    </div>
                    <div className="form-group">
                      {idx === 0 && <label className="form-label">รูปแบบการระบุ</label>}
                      <select className="form-input form-select" value={entry.input_mode} onChange={e => updateIngredientRow(idx, 'input_mode', e.target.value as 'per_piece' | 'total_batch')}>
                        <option value="per_piece">ต่อ 1 ชิ้น</option>
                        <option value="total_batch">รวมทั้งสูตร ({yieldQuantity || 1} ชิ้น)</option>
                      </select>
                    </div>
                    <button className="btn-icon btn-ghost" onClick={() => removeIngredientRow(idx)} style={{ color: 'var(--danger)', marginBottom: 2 }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-Recipes */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                  <GitBranch size={20} style={{ color: 'var(--primary-400)' }} /> สูตรย่อย (Sub-Recipe)
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>
                  ใช้สูตรอาหารอื่นเป็นวัตถุดิบในสูตรนี้ เช่น ใช้แป้งทองม้วน 5 ลูก
                </p>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={addSubRecipeRow} disabled={recipes.length === 0}>
                <Plus size={16} /> เพิ่มสูตรย่อย
              </button>
            </div>

            {subRecipeEntries.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem', border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                ไม่ได้ใช้สูตรย่อย — กดปุ่มด้านบนเพื่อเพิ่ม
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {subRecipeEntries.map((entry, idx) => {
                  const subRecipe = recipes.find(r => r.id === entry.sub_recipe_id);
                  const subCostTotal = subRecipe ? getRecipeCost(subRecipe.id) : 0;
                  const subYield = subRecipe?.yield_quantity || 1;
                  const costPerUnit = subCostTotal / subYield;
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 40px', gap: 'var(--space-3)', alignItems: 'end' }}>
                      <div className="form-group">
                        {idx === 0 && <label className="form-label">เลือกสูตรย่อย</label>}
                        <select className="form-input form-select" value={entry.sub_recipe_id} onChange={e => updateSubRecipeRow(idx, 'sub_recipe_id', e.target.value)}>
                          <option value="">-- เลือกสูตร --</option>
                          {recipes.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name} (yield: {r.yield_quantity} ชิ้น | {formatCurrency(getRecipeCost(r.id) / (r.yield_quantity || 1))}/ชิ้น)
                            </option>
                          ))}
                        </select>
                        {subRecipe && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            ต้นทุนรวม {formatCurrency(subCostTotal)} / {subYield} ชิ้น = {formatCurrency(costPerUnit)}/ชิ้น
                          </div>
                        )}
                      </div>
                      <div className="form-group">
                        {idx === 0 && <label className="form-label">จำนวนที่ใช้</label>}
                        <input className="form-input" type="number" min="0.1" step="0.1" placeholder="1" value={entry.quantity_used} onChange={e => updateSubRecipeRow(idx, 'quantity_used', e.target.value)} />
                      </div>
                      <div className="form-group">
                        {idx === 0 && <label className="form-label">หน่วย</label>}
                        <input className="form-input" placeholder="ชิ้น" value={entry.unit} onChange={e => updateSubRecipeRow(idx, 'unit', e.target.value)} />
                      </div>
                      <button className="btn-icon btn-ghost" onClick={() => removeSubRecipeRow(idx)} style={{ color: 'var(--danger)', marginBottom: 2 }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cost Summary */}
        <div style={{ position: 'sticky', top: 'calc(var(--topbar-height) + var(--space-8))' }}>
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Calculator size={20} style={{ color: 'var(--primary-400)' }} /> สรุปต้นทุน
            </h3>

            {/* Ingredient costs */}
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

            {/* Sub-recipe costs */}
            {costBreakdown.subRecipeDetails.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>สูตรย่อย</div>
                {costBreakdown.subRecipeDetails.map((d, i) => (
                  <div key={i} style={{ marginBottom: 'var(--space-1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      <span>{d.name} ({d.qty} {d.unit})</span>
                      <span>{formatCurrency(d.cost)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                      {formatCurrency(d.costPerUnit)}/ชิ้น
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ต้นทุนรวม (ทั้งสูตร)</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{formatCurrency(costBreakdown.totalCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>จำนวนที่ได้</span>
                <span style={{ fontWeight: 600 }}>{yieldQuantity || 1} ชิ้น</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                <span style={{ fontWeight: 600 }}>ต้นทุน/ชิ้น</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-400)' }}>
                  {formatCurrency(costBreakdown.costPerPiece)}
                </span>
              </div>
            </div>

            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-6)' }} onClick={handleSubmit}>
              <ChefHat size={18} /> สร้างสูตร
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
