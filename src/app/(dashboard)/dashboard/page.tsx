'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils/format';
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingCart, Package,
  AlertTriangle, Award, Calendar, Box, ShoppingBag, ClipboardList, CheckCircle, Clock, Edit2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import Link from 'next/link';

const CHART_COLORS = ['#7c5cfc', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#fb923c'];

export default function DashboardPage() {
  const { orders, orderItems, products, ingredients, packaging, getProductCost, shop, updateShop } = useStore();
  const [timeRange, setTimeRange] = useState<'today' | 'month' | 'year'>('month');
  const [isEditingShop, setIsEditingShop] = useState(false);
  const [tempShopName, setTempShopName] = useState('');

  const handleShopNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tempShopName.trim() && tempShopName !== shop?.name) {
      await updateShop(tempShopName.trim());
    }
    setIsEditingShop(false);
  };

  // Time calculations
  const { currentStart, currentEnd, previousStart, previousEnd } = useMemo(() => {
    const now = new Date();
    let currentStart = new Date();
    let currentEnd = new Date();
    let previousStart = new Date();
    let previousEnd = new Date();

    if (timeRange === 'today') {
      currentStart.setHours(0, 0, 0, 0);
      previousStart.setDate(now.getDate() - 1);
      previousStart.setHours(0, 0, 0, 0);
      previousEnd = new Date(currentStart);
    } else if (timeRange === 'month') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(currentStart);
    } else {
      currentStart = new Date(now.getFullYear(), 0, 1);
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(currentStart);
    }
    return { currentStart, currentEnd, previousStart, previousEnd };
  }, [timeRange]);

  // Overall Stats
  const stats = useMemo(() => {
    const currentOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= currentStart && d <= currentEnd && o.status !== 'cancelled';
    });
    const previousOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= previousStart && d < previousEnd && o.status !== 'cancelled';
    });

    const revenue = currentOrders.reduce((s, o) => s + o.total_revenue, 0);
    const cost = currentOrders.reduce((s, o) => s + o.total_cost, 0);
    const profit = currentOrders.reduce((s, o) => s + o.total_profit, 0);

    const prevRevenue = previousOrders.reduce((s, o) => s + o.total_revenue, 0);
    const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

    return { revenue, cost, profit, orderCount: currentOrders.length, revenueChange };
  }, [orders, currentStart, currentEnd, previousStart, previousEnd]);

  // Production Plan (All Pending Orders)
  const productionPlan = useMemo(() => {
    const targetOrders = orders.filter(o => o.status === 'pending');

    const targetOrderIds = new Set(targetOrders.map(o => o.id));
    const productMap = new Map<string, number>();

    for (const item of orderItems) {
      if (targetOrderIds.has(item.order_id)) {
        const qty = productMap.get(item.product_id) || 0;
        productMap.set(item.product_id, qty + item.quantity);
      }
    }

    const productsToMake = Array.from(productMap.entries()).map(([id, qty]) => {
      const p = products.find(x => x.id === id);
      return { id, name: p?.name || 'Unknown', qty };
    }).sort((a, b) => b.qty - a.qty);

    return { orderCount: targetOrders.length, productsToMake };
  }, [orders, orderItems, products]);

  // Low Stock Alerts (Ingredients & Packaging)
  const lowStockAlerts = useMemo(() => {
    const alerts: { id: string; name: string; type: 'ingredient' | 'packaging'; stock: number; displayUnit: string; isCritical: boolean; sortVal: number }[] = [];
    
    ingredients.forEach(ing => {
      // stock_quantity คือจำนวน "แพ็ค" หรือ "ถุง"
      // แจ้งเตือนเมื่อเหลือน้อยกว่าหรือเท่ากับ 1.5 แพ็ค
      if (ing.stock_quantity <= 1.5) {
        const remainingAmount = ing.stock_quantity * (ing.quantity || 1);
        alerts.push({
          id: ing.id, name: ing.name, type: 'ingredient',
          stock: remainingAmount,
          displayUnit: ing.unit,
          isCritical: ing.stock_quantity <= 0.5,
          sortVal: ing.stock_quantity
        });
      }
    });

    packaging.forEach(pkg => {
      if (pkg.stock_quantity <= 1.5) {
        const remainingAmount = pkg.stock_quantity * (pkg.quantity || 1);
        alerts.push({
          id: pkg.id, name: pkg.name, type: 'packaging',
          stock: remainingAmount,
          displayUnit: 'ชิ้น',
          isCritical: pkg.stock_quantity <= 0.5,
          sortVal: pkg.stock_quantity
        });
      }
    });

    return alerts.sort((a, b) => a.sortVal - b.sortVal).slice(0, 8);
  }, [ingredients, packaging]);

  // Top Selling Products (by Revenue)
  const topProducts = useMemo(() => {
    const productMap = new Map<string, { name: string; sold: number; revenue: number; profit: number }>();
    
    for (const item of orderItems) {
      // only count current range
      const order = orders.find(o => o.id === item.order_id);
      if (!order || order.status === 'cancelled') continue;
      
      const d = new Date(order.created_at);
      if (d < currentStart || d > currentEnd) continue;

      const product = products.find(p => p.id === item.product_id);
      if (!product) continue;

      const existing = productMap.get(item.product_id);
      if (existing) {
        existing.sold += item.quantity;
        existing.revenue += item.subtotal_revenue;
        existing.profit += item.subtotal_revenue - item.subtotal_cost;
      } else {
        productMap.set(item.product_id, {
          name: product.name,
          sold: item.quantity,
          revenue: item.subtotal_revenue,
          profit: item.subtotal_revenue - item.subtotal_cost,
        });
      }
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [orderItems, orders, products, currentStart, currentEnd]);

  // Product Profitability
  const productProfitability = useMemo(() => {
    return products.map(p => {
      const cost = getProductCost(p.id);
      const profit = p.selling_price - cost;
      const margin = p.selling_price > 0 ? (profit / p.selling_price) * 100 : 0;
      return { id: p.id, name: p.name, cost, price: p.selling_price, profit, margin };
    }).sort((a, b) => b.margin - a.margin).slice(0, 10);
  }, [products, getProductCost]);

  // Chart Data (7 Days or 4 Weeks or 12 Months)
  const chartData = useMemo(() => {
    const data = [];
    if (timeRange === 'today') {
      // Show hourly for today
      for (let i = 8; i <= 20; i += 2) {
        const hStart = new Date(currentStart);
        hStart.setHours(i, 0, 0, 0);
        const hEnd = new Date(currentStart);
        hEnd.setHours(i + 2, 0, 0, 0);
        
        const periodOrders = orders.filter(o => {
          const od = new Date(o.created_at);
          return od >= hStart && od < hEnd && o.status !== 'cancelled';
        });
        
        data.push({
          name: `${i}:00`,
          revenue: periodOrders.reduce((s, o) => s + o.total_revenue, 0),
          profit: periodOrders.reduce((s, o) => s + o.total_profit, 0),
        });
      }
    } else if (timeRange === 'month') {
      // Show last 7 days + today
      const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const nextD = new Date(d);
        nextD.setDate(nextD.getDate() + 1);

        const periodOrders = orders.filter(o => {
          const od = new Date(o.created_at);
          return od >= d && od < nextD && o.status !== 'cancelled';
        });

        data.push({
          name: i === 0 ? 'วันนี้' : days[d.getDay()],
          revenue: periodOrders.reduce((s, o) => s + o.total_revenue, 0),
          profit: periodOrders.reduce((s, o) => s + o.total_profit, 0),
        });
      }
    } else {
      // Show months
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const currentMonth = new Date().getMonth();
      for (let i = 5; i >= 0; i--) {
        const targetMonth = (currentMonth - i + 12) % 12;
        const targetYear = currentMonth - i < 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
        
        const mStart = new Date(targetYear, targetMonth, 1);
        const mEnd = new Date(targetYear, targetMonth + 1, 1);

        const periodOrders = orders.filter(o => {
          const od = new Date(o.created_at);
          return od >= mStart && od < mEnd && o.status !== 'cancelled';
        });

        data.push({
          name: months[targetMonth],
          revenue: periodOrders.reduce((s, o) => s + o.total_revenue, 0),
          profit: periodOrders.reduce((s, o) => s + o.total_profit, 0),
        });
      }
    }
    return data;
  }, [orders, timeRange, currentStart]);

  return (
    <div className="animate-slide-up" style={{ paddingBottom: 'var(--space-8)' }}>
      {/* Header & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isEditingShop ? (
              <form onSubmit={handleShopNameSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  autoFocus
                  className="input"
                  style={{ padding: '4px 8px', fontSize: '1.5rem', height: 'auto', fontWeight: 700, margin: 0 }}
                  value={tempShopName}
                  onChange={(e) => setTempShopName(e.target.value)}
                  onBlur={handleShopNameSubmit}
                />
              </form>
            ) : (
              <>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{shop?.name || 'ร้านของฉัน'}</h1>
                <button
                  className="btn-icon btn-ghost"
                  onClick={() => { setTempShopName(shop?.name || ''); setIsEditingShop(true); }}
                  style={{ padding: 4 }}
                  title="แก้ไขชื่อร้าน"
                >
                  <Edit2 size={18} />
                </button>
              </>
            )}
          </div>
          <p style={{ color: 'var(--text-tertiary)', margin: '4px 0 0' }}>ภาพรวมธุรกิจ และวิเคราะห์ข้อมูล</p>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--surface-1)', padding: 4, borderRadius: 'var(--radius-lg)' }}>
          {(['today', 'month', 'year'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              style={{
                background: timeRange === t ? 'var(--surface-3)' : 'transparent',
                color: timeRange === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
                border: 'none',
                padding: '6px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {t === 'today' ? 'วันนี้' : t === 'month' ? 'เดือนนี้' : 'ปีนี้'}
            </button>
          ))}
        </div>
      </div>

      {/* Priority Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        
        {/* Pending Orders Priority Card */}
        <div className="stat-card animate-slide-up stagger-1 hover-scale hover-glow" style={{ background: 'linear-gradient(135deg, var(--primary-600), var(--primary-800))', color: '#fff', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '1.1rem', opacity: 0.9, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={20} /> ออเดอร์ที่รอดำเนินการ
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>
                {orders.filter(o => o.status === 'pending').length} <span style={{ fontSize: '1rem', fontWeight: 500, opacity: 0.8 }}>ออเดอร์</span>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 'var(--radius-lg)' }}>
              <ShoppingCart size={36} color="#fff" />
            </div>
          </div>
          <Link href="/orders" className="btn" style={{ marginTop: 'var(--space-5)', width: '100%', background: '#fff', color: 'var(--primary-800)', fontWeight: 700, border: 'none', padding: '12px', fontSize: '1rem' }}>
            จัดการออเดอร์
          </Link>
        </div>

        {/* Production Plan Priority Card */}
        <div className="stat-card animate-slide-up stagger-2 hover-scale hover-glow" style={{ background: 'linear-gradient(135deg, var(--accent-orange), #ea580c)', color: '#fff', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '1.1rem', opacity: 0.9, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardList size={20} /> งานที่ต้องผลิต
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>
                {productionPlan.productsToMake.reduce((sum, p) => sum + p.qty, 0)} <span style={{ fontSize: '1rem', fontWeight: 500, opacity: 0.8 }}>ชิ้น</span>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 'var(--radius-lg)' }}>
              <Package size={36} color="#fff" />
            </div>
          </div>
          <Link href="/production" className="btn" style={{ marginTop: 'var(--space-5)', width: '100%', background: '#fff', color: '#ea580c', fontWeight: 700, border: 'none', padding: '12px', fontSize: '1rem' }}>
            ดูแผนการผลิต
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card animate-slide-up stagger-3">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-label">รายได้ ({timeRange === 'today' ? 'วันนี้' : timeRange === 'month' ? 'เดือนนี้' : 'ปีนี้'})</div>
              <div className="stat-card-value">{formatCurrency(stats.revenue)}</div>
            </div>
            <div className="stat-card-icon purple">
              <DollarSign size={22} />
            </div>
          </div>
          {stats.revenueChange !== 0 && (
            <div className={`stat-card-change ${stats.revenueChange >= 0 ? 'positive' : 'negative'}`}>
              {stats.revenueChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {formatPercent(stats.revenueChange)} เทียบกับช่วงก่อนหน้า
            </div>
          )}
        </div>

        <div className="stat-card animate-slide-up stagger-4">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-label">ต้นทุนรวม</div>
              <div className="stat-card-value">{formatCurrency(stats.cost)}</div>
            </div>
            <div className="stat-card-icon amber">
              <TrendingDown size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 'auto' }}>
            คิดเป็น {stats.revenue > 0 ? ((stats.cost / stats.revenue) * 100).toFixed(1) : 0}% ของรายได้
          </div>
        </div>

        <div className="stat-card animate-slide-up stagger-5">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-label">กำไรสุทธิ</div>
              <div className="stat-card-value" style={{ color: stats.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatCurrency(stats.profit)}
              </div>
            </div>
            <div className="stat-card-icon emerald">
              <TrendingUp size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 'auto' }}>
            อัตรากำไร (Margin) {stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : 0}%
          </div>
        </div>

        <div className="stat-card animate-slide-up stagger-6">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-label">จำนวนออเดอร์</div>
              <div className="stat-card-value">{stats.orderCount}</div>
            </div>
            <div className="stat-card-icon cyan">
              <ShoppingCart size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 'auto' }}>
            เฉลี่ย {stats.orderCount > 0 ? formatCurrency(stats.revenue / stats.orderCount) : '฿0'} / ออเดอร์
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--space-6)', marginBottom: 'var(--space-8)', alignItems: 'start' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Main Chart */}
          <div className="chart-container animate-slide-up stagger-7" style={{ height: '100%' }}>
            <div className="chart-header">
              <div>
                <h3 className="chart-title">📈 แนวโน้มรายได้และกำไร</h3>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c5cfc" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7c5cfc" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `฿${formatNumber(v, 0)}`} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                  formatter={(value) => [`฿${formatNumber(Number(value))}`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '0.8125rem', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="revenue" name="รายรับ" stroke="#7c5cfc" fill="url(#colorRevenue)" strokeWidth={3} />
                <Area type="monotone" dataKey="profit" name="กำไร" stroke="#34d399" fill="url(#colorProfit)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Product Profitability (Replaced Recipe Profitability) */}
          <div className="chart-container animate-slide-up stagger-8">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">💰 วิเคราะห์ความคุ้มค่าสินค้า (Profitability)</h3>
                <p className="chart-subtitle">แสดงสินค้าที่มีกำไรสูงสุด และน้อยสุด เพื่อใช้วางแผนโปรโมชั่น</p>
              </div>
            </div>
            <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th style={{ textAlign: 'right' }}>ราคาขาย</th>
                    <th style={{ textAlign: 'right' }}>ต้นทุน</th>
                    <th style={{ textAlign: 'right' }}>กำไร/ชิ้น</th>
                    <th style={{ textAlign: 'right' }}>Margin</th>
                    <th style={{ textAlign: 'right', width: 100 }}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {productProfitability.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <ShoppingBag size={16} style={{ color: 'var(--primary-400)' }} />
                          {item.name}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(item.cost)}</td>
                      <td style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: item.profit >= 0 ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {formatCurrency(item.profit)}
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: item.margin >= 50 ? 'var(--success)' : item.margin >= 30 ? 'var(--warning)' : 'var(--danger)',
                      }}>
                        {item.margin.toFixed(1)}%
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`badge ${item.margin >= 50 ? 'badge-success' : item.margin >= 30 ? 'badge-warning' : 'badge-danger'}`}>
                          {item.margin >= 50 ? 'กำไรสูง' : item.margin >= 30 ? 'ปานกลาง' : 'ควรปรับปรุง'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {productProfitability.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>
                        ไม่มีข้อมูลสินค้า
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          


          {/* Top Selling Products */}
          <div className="chart-container animate-slide-up stagger-9">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">🏆 สินค้าขายดี (Top 5)</h3>
              </div>
            </div>
            {topProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>
                ไม่มีข้อมูลยอดขายในช่วงเวลานี้
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {topProducts.map((product, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-3)', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-full)',
                      background: CHART_COLORS[idx],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        ขายได้ {formatNumber(product.sold)} ชิ้น
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--success)' }}>
                        {formatCurrency(product.revenue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="chart-container animate-slide-up stagger-10">
            <div className="chart-header">
              <div>
                <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--warning)' }}>
                  <AlertTriangle size={18} /> ของใกล้หมด (Low Stock)
                </h3>
              </div>
            </div>
            {lowStockAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>
                <Package size={28} style={{ margin: '0 auto var(--space-2)', opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: '0.875rem' }}>สต๊อกเพียงพอ ไม่มีของใกล้หมด</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {lowStockAlerts.map((item, idx) => (
                  <div key={`${item.type}-${item.id}-${idx}`} style={{
                    padding: 'var(--space-3)',
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `3px solid ${item.isCritical ? 'var(--danger)' : 'var(--warning)'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.type === 'ingredient' ? <Box size={14} color="var(--text-tertiary)"/> : <Package size={14} color="var(--text-tertiary)"/>}
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.name}</span>
                      </div>
                      <span className={`badge ${item.isCritical ? 'badge-danger' : 'badge-warning'}`}>
                        เหลือ {formatNumber(item.stock, 0)} {item.displayUnit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
