'use client';

import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { ArrowLeft, Trash2, ChefHat, Package, GitBranch, Edit2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#7c5cfc', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#fb923c', '#60a5fa'];

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { getRecipeWithDetails, getRecipeCost, deleteRecipe, addToast } = useStore();

  const recipe = useMemo(() => getRecipeWithDetails(id), [id, getRecipeWithDetails]);

  if (!recipe) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><ChefHat size={36} /></div>
        <h3>ไม่พบสูตรอาหาร</h3>
        <Link href="/recipes" className="btn btn-primary">กลับไปหน้าสูตร</Link>
      </div>
    );
  }

  const handleDelete = () => {
    if (confirm(`ต้องการลบสูตร "${recipe.name}" หรือไม่?`)) {
      deleteRecipe(recipe.id);
      addToast('success', 'ลบสูตรสำเร็จ');
      router.push('/recipes');
    }
  };

  const totalCost = recipe.total_cost || 0;
  const yieldQty = recipe.yield_quantity || 1;
  const costPerPiece = totalCost / yieldQty;

  // Cost breakdown for pie chart
  const costData = useMemo(() => {
    const data: { name: string; value: number }[] = [];
    if (recipe.ingredients) {
      for (const ri of recipe.ingredients) {
        if ((ri as any).cost > 0) {
          data.push({ name: (ri as any).ingredient?.name || 'วัตถุดิบ', value: (ri as any).cost });
        }
      }
    }
    if (recipe.sub_recipes) {
      for (const rsr of recipe.sub_recipes) {
        if ((rsr as any).cost > 0) {
          data.push({ name: `[สูตร] ${(rsr as any).sub_recipe?.name || 'สูตรย่อย'}`, value: (rsr as any).cost });
        }
      }
    }
    return data;
  }, [recipe]);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost" onClick={() => router.back()} style={{ marginBottom: 'var(--space-2)' }}>
            <ArrowLeft size={18} /> กลับ
          </button>
          <h1>{recipe.name}</h1>
          <p>{recipe.description || recipe.category}</p>
        </div>
        <div className="page-header-actions">
          <Link href={`/recipes/${recipe.id}/edit`} className="btn btn-secondary">
            <Edit2 size={18} /> แก้ไข
          </Link>
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={18} /> ลบสูตร
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        {/* Left: Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

          {/* Stats — ต้นทุนเท่านั้น */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-card-label">ต้นทุนรวม (ทั้งสูตร)</div>
              <div className="stat-card-value" style={{ color: 'var(--accent-amber)' }}>
                {formatCurrency(totalCost)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">จำนวนที่ได้</div>
              <div className="stat-card-value">{formatNumber(yieldQty)} ชิ้น</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">ต้นทุน/ชิ้น</div>
              <div className="stat-card-value" style={{ color: 'var(--primary-400)' }}>
                {formatCurrency(costPerPiece)}
              </div>
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Package size={18} style={{ color: 'var(--accent-emerald)' }} /> วัตถุดิบที่ใช้
            </h3>
            <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>วัตถุดิบ</th>
                    <th style={{ textAlign: 'right' }}>ปริมาณใช้</th>
                    <th style={{ textAlign: 'right' }}>ราคา/หน่วย</th>
                    <th style={{ textAlign: 'right' }}>ต้นทุน</th>
                  </tr>
                </thead>
                <tbody>
                  {(recipe.ingredients || []).map((ri: any) => (
                    <tr key={ri.id}>
                      <td style={{ fontWeight: 500 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{ri.ingredient?.name}</span>
                          {ri.input_mode === 'per_piece' && recipe.yield_quantity > 1 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                              (ต่อชิ้น: {formatNumber(ri.quantity_used / recipe.yield_quantity)} {ri.unit})
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(ri.quantity_used)} {ri.unit}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {formatCurrency(ri.unit === 'แพ็ค' ? ri.ingredient?.price : ri.ingredient?.price_per_unit || 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(ri.cost || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub-Recipes Table */}
          {recipe.sub_recipes && recipe.sub_recipes.length > 0 && (
            <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <GitBranch size={18} style={{ color: 'var(--primary-400)' }} /> สูตรย่อยที่ใช้
              </h3>
              <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>สูตรย่อย</th>
                      <th style={{ textAlign: 'right' }}>จำนวนที่ใช้</th>
                      <th style={{ textAlign: 'right' }}>ต้นทุน/หน่วย</th>
                      <th style={{ textAlign: 'right' }}>ต้นทุนรวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recipe.sub_recipes || []).map((rsr: any) => {
                      const subYield = rsr.sub_recipe?.yield_quantity || 1;
                      const subTotal = getRecipeCost(rsr.sub_recipe_id);
                      const perUnit = subTotal / subYield;
                      return (
                        <tr key={rsr.id}>
                          <td style={{ fontWeight: 500 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <Link href={`/recipes/${rsr.sub_recipe_id}`} style={{ color: 'var(--primary-400)' }}>
                                {rsr.sub_recipe?.name}
                              </Link>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                yield {subYield} ชิ้น | ต้นทุนรวม {formatCurrency(subTotal)}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(rsr.quantity_used)} {rsr.unit}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(perUnit)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(rsr.cost || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right: Pie Chart */}
        <div>
          <div className="chart-container">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">📊 สัดส่วนต้นทุน</h3>
                <p className="chart-subtitle">แบ่งตามวัตถุดิบที่ใช้ในสูตร</p>
              </div>
            </div>
            {costData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={costData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  >
                    {costData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8125rem',
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), 'ต้นทุน']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
                ยังไม่มีข้อมูลต้นทุน
              </div>
            )}
          </div>

          {/* Cost summary card */}
          <div className="glass-card-static" style={{ padding: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ต้นทุนรวมทั้งสูตร</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{formatCurrency(totalCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>จำนวนที่ผลิตได้</span>
                <span style={{ fontWeight: 500 }}>{formatNumber(yieldQty)} ชิ้น</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
                <span style={{ fontWeight: 600 }}>ต้นทุนต่อชิ้น</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-400)' }}>{formatCurrency(costPerPiece)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
