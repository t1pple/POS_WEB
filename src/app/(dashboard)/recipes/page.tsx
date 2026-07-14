'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils/format';
import { Plus, ChefHat, Search } from 'lucide-react';
import { useState } from 'react';

export default function RecipesPage() {
  const { recipes, getRecipeCost } = useStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ทั้งหมด');

  const categories = useMemo(() => {
    const cats = new Set(recipes.map(r => r.category));
    return ['ทั้งหมด', ...Array.from(cats)];
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'ทั้งหมด' || r.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [recipes, search, categoryFilter]);

  const categoryEmojis: Record<string, string> = {
    'เครื่องดื่ม': '☕', 'อาหาร': '🍝', 'ขนม': '🍪',
    'เบเกอรี่': '🧁', 'ของทานเล่น': '🍿', 'อื่นๆ': '📦',
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>สูตรอาหาร</h1>
          <p>จัดการสูตรการผลิตและคำนวณต้นทุน ({recipes.length} สูตร)</p>
        </div>
        <div className="page-header-actions">
          <Link href="/recipes/create" className="btn btn-primary">
            <Plus size={18} /> สร้างสูตรใหม่
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
              placeholder="ค้นหาสูตรอาหาร..."
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

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ChefHat size={36} /></div>
          <h3>ยังไม่มีสูตรอาหาร</h3>
          <p>สร้างสูตรอาหารโดยเลือกวัตถุดิบจากคลัง เพื่อคำนวณต้นทุนการผลิต</p>
          <Link href="/recipes/create" className="btn btn-primary">
            <Plus size={18} /> สร้างสูตรใหม่
          </Link>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--space-5)',
        }}>
          {filteredRecipes.map((recipe, idx) => {
            const totalCost = getRecipeCost(recipe.id);
            const yieldQty = recipe.yield_quantity || 1;
            const costPerPiece = totalCost / yieldQty;

            return (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className={`recipe-card animate-fade-in-up stagger-${Math.min(idx + 1, 8)}`}
              >
                <div className="recipe-card-image">
                  {categoryEmojis[recipe.category] || '🍽️'}
                </div>
                <div className="recipe-card-body">
                  <div className="recipe-card-name">{recipe.name}</div>
                  <div className="recipe-card-category">
                    <span className="badge badge-primary">{recipe.category}</span>
                  </div>
                  <div className="recipe-card-stats">
                    <div className="recipe-card-stat">
                      <div className="recipe-card-stat-value" style={{ color: 'var(--accent-amber)' }}>
                        {formatCurrency(totalCost)}
                      </div>
                      <div className="recipe-card-stat-label">ต้นทุนรวม</div>
                    </div>
                    <div className="recipe-card-stat">
                      <div className="recipe-card-stat-value">
                        {yieldQty} ชิ้น
                      </div>
                      <div className="recipe-card-stat-label">yield</div>
                    </div>
                    <div className="recipe-card-stat">
                      <div className="recipe-card-stat-value" style={{ color: 'var(--primary-400)' }}>
                        {formatCurrency(costPerPiece)}
                      </div>
                      <div className="recipe-card-stat-label">ต้นทุน/ชิ้น</div>
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
