'use client';

import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { ArrowLeft, Trash2, ShoppingBag, ChefHat, Tag, Layers, Edit2, BoxIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#7c5cfc', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#fb923c', '#60a5fa'];

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { getProductWithDetails, deleteProduct, addToast } = useStore();

  const product = useMemo(() => getProductWithDetails(id), [id, getProductWithDetails]);

  if (!product) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><ShoppingBag size={36} /></div>
        <h3>ไม่พบสินค้า</h3>
        <Link href="/products" className="btn btn-primary">กลับไปหน้าสินค้า</Link>
      </div>
    );
  }

  const handleDelete = () => {
    if (confirm(`ต้องการลบสินค้า "${product.name}" หรือไม่?`)) {
      deleteProduct(product.id);
      addToast('success', 'ลบสินค้าสำเร็จ');
      router.push('/products');
    }
  };

  const costData = useMemo(() => {
    const data: { name: string; value: number }[] = [];
    (product.product_recipes || []).forEach((pr: any) => {
      if ((pr.cost || 0) > 0) data.push({ name: `[สูตร] ${pr.recipe?.name || ''}`, value: pr.cost });
    });
    (product.product_packaging || []).forEach((pp: any) => {
      if ((pp.cost || 0) > 0) data.push({ name: `[กล่อง] ${pp.packaging?.name || ''}`, value: pp.cost });
    });
    return data;
  }, [product]);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost" onClick={() => router.back()} style={{ marginBottom: 'var(--space-2)' }}>
            <ArrowLeft size={18} /> กลับ
          </button>
          <h1>{product.name}</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {product.flavor && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag size={14} /> {product.flavor}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Layers size={14} /> {product.pieces_per_pack} ชิ้น/แพ็ค
            </span>
            <span className="badge badge-primary">{product.category}</span>
          </p>
        </div>
        <div className="page-header-actions">
          <Link href={`/products/${product.id}/edit`} className="btn btn-secondary">
            <Edit2 size={18} /> แก้ไข
          </Link>
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={18} /> ลบสินค้า
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        {/* Left: Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-card-label">ราคาขาย</div>
              <div className="stat-card-value">{formatCurrency(product.selling_price)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">ต้นทุนรวม</div>
              <div className="stat-card-value" style={{ color: 'var(--accent-amber)' }}>
                {formatCurrency(product.total_cost || 0)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">กำไร</div>
              <div className="stat-card-value" style={{ color: (product.profit || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatCurrency(product.profit || 0)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Margin</div>
              <div className="stat-card-value" style={{ color: (product.margin || 0) >= 50 ? 'var(--success)' : (product.margin || 0) >= 30 ? 'var(--warning)' : 'var(--danger)' }}>
                {(product.margin || 0).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="glass-card-static" style={{ padding: 'var(--space-5)' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{product.description}</p>
            </div>
          )}

          {/* Recipes used */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ChefHat size={18} style={{ color: 'var(--accent-emerald)' }} /> สูตรอาหารที่ใช้ผลิต
            </h3>
            <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>สูตรอาหาร</th>
                    <th style={{ textAlign: 'right' }}>yield (ชิ้น)</th>
                    <th style={{ textAlign: 'right' }}>ใช้ (ชิ้น)</th>
                    <th style={{ textAlign: 'right' }}>ต้นทุน/ชิ้น</th>
                    <th style={{ textAlign: 'right' }}>ต้นทุนรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {(product.product_recipes || []).map((pr: any) => {
                    const recipeYield = pr.recipe?.yield_quantity || 1;
                    const costPerUnit = pr.cost / pr.quantity_used;
                    return (
                      <tr key={pr.id}>
                        <td style={{ fontWeight: 500 }}>
                          <Link href={`/recipes/${pr.recipe_id}`} style={{ color: 'var(--primary-400)' }}>
                            {pr.recipe?.name}
                          </Link>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(recipeYield)}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(pr.quantity_used)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(costPerUnit)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(pr.cost || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Packaging used */}
          {product.product_packaging && product.product_packaging.length > 0 && (
            <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <BoxIcon size={18} style={{ color: 'var(--accent-amber)' }} /> บรรจุภัณฑ์ที่ใช้
              </h3>
              <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>บรรจุภัณฑ์</th>
                      <th style={{ textAlign: 'right' }}>จำนวน</th>
                      <th style={{ textAlign: 'right' }}>ต้นทุน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(product.product_packaging || []).map((pp: any) => (
                      <tr key={pp.id}>
                        <td style={{ fontWeight: 500 }}>{pp.packaging?.name}</td>
                        <td style={{ textAlign: 'right' }}>{pp.quantity_used} {pp.packaging?.unit}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(pp.cost || 0)}</td>
                      </tr>
                    ))}
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
                <p className="chart-subtitle">แบ่งตามสูตรอาหารที่ใช้ผลิต</p>
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

          {/* Summary card */}
          <div className="glass-card-static" style={{ padding: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ต้นทุน/แพ็ค ({product.pieces_per_pack} ชิ้น)</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{formatCurrency(product.total_cost || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ต้นทุน/ชิ้น</span>
                <span style={{ fontWeight: 500 }}>
                  {formatCurrency((product.total_cost || 0) / (product.pieces_per_pack || 1))}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
                <span style={{ fontWeight: 600 }}>สถานะกำไร</span>
                <span className={`badge ${(product.margin || 0) >= 50 ? 'badge-success' : (product.margin || 0) >= 30 ? 'badge-warning' : 'badge-danger'}`}>
                  {(product.margin || 0) >= 50 ? '✓ กำไรดี' : (product.margin || 0) >= 30 ? '~ ปานกลาง' : '✗ ต่ำ'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
