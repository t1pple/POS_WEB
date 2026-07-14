'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils/format';
import { Plus, ShoppingBag, Search, Tag, Layers } from 'lucide-react';

export default function ProductsPage() {
  const { products, getProductCost, getProductWithDetails } = useStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ทั้งหมด');

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['ทั้งหมด', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.flavor || '').toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'ทั้งหมด' || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const categoryEmojis: Record<string, string> = {
    'เครื่องดื่ม': '☕', 'อาหาร': '🍝', 'ขนม': '🍪', 'เบเกอรี่': '🧁',
    'ของทานเล่น': '🍿', 'อื่นๆ': '📦',
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>สินค้า</h1>
          <p>สินค้าที่จำหน่ายให้ลูกค้า มาจากสูตรอาหาร ({products.length} รายการ)</p>
        </div>
        <div className="page-header-actions">
          <Link href="/products/create" className="btn btn-primary">
            <Plus size={18} /> เพิ่มสินค้า
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
              className="search-input"
              placeholder="ค้นหาสินค้า รสชาติ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-chips">
            {categories.map(cat => (
              <button
                key={cat}
                className={`filter-chip ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ShoppingBag size={36} /></div>
          <h3>ยังไม่มีสินค้า</h3>
          <p>สร้างสินค้าโดยเลือกสูตรอาหาร เพื่อกำหนดราคาขายและคำนวณกำไร</p>
          <Link href="/products/create" className="btn btn-primary">
            <Plus size={18} /> เพิ่มสินค้าแรก
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
          {filteredProducts.map((product, idx) => {
            const cost = getProductCost(product.id);
            const profit = product.selling_price - cost;
            const margin = product.selling_price > 0 ? (profit / product.selling_price) * 100 : 0;

            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className={`recipe-card animate-fade-in-up stagger-${Math.min(idx + 1, 8)}`}
              >
                <div className="recipe-card-image">
                  {categoryEmojis[product.category] || '🛍️'}
                </div>
                <div className="recipe-card-body">
                  <div className="recipe-card-name">{product.name}</div>
                  {product.flavor && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 'var(--space-1)' }}>
                      <Tag size={12} /> {product.flavor}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 'var(--space-2)' }}>
                    <Layers size={12} /> {product.pieces_per_pack} ชิ้น/แพ็ค
                  </div>
                  <div className="recipe-card-stats">
                    <div className="recipe-card-stat">
                      <div className="recipe-card-stat-value">{formatCurrency(product.selling_price)}</div>
                      <div className="recipe-card-stat-label">ราคาขาย</div>
                    </div>
                    <div className="recipe-card-stat">
                      <div className="recipe-card-stat-value" style={{ color: 'var(--accent-amber)' }}>
                        {formatCurrency(cost)}
                      </div>
                      <div className="recipe-card-stat-label">ต้นทุน</div>
                    </div>
                    <div className="recipe-card-stat">
                      <div
                        className="recipe-card-stat-value"
                        style={{ color: profit >= 0 ? 'var(--success)' : 'var(--danger)' }}
                      >
                        {margin.toFixed(0)}%
                      </div>
                      <div className="recipe-card-stat-label">Margin</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
