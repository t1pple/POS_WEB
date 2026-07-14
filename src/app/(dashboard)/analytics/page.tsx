'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { BarChart3, TrendingUp, Calendar } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';

export default function AnalyticsPage() {
  const { orders, orderItems, products } = useStore();
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const filteredOrders = useMemo(() => {
    if (period === 'all') return orders;
    const now = new Date();
    const daysBack = period === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    return orders.filter((o: any) => new Date(o.created_at) >= cutoff);
  }, [orders, period]);

  const totalRevenue = filteredOrders.reduce((s: number, o: any) => s + o.total_revenue, 0);
  const totalCost = filteredOrders.reduce((s: number, o: any) => s + o.total_cost, 0);
  const totalProfit = filteredOrders.reduce((s: number, o: any) => s + o.total_profit, 0);
  const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

  // Daily trend
  const dailyTrend = useMemo(() => {
    const dayMap = new Map<string, { revenue: number; cost: number; profit: number; orders: number }>();
    for (const order of filteredOrders) {
      const day = new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      const existing = dayMap.get(day) || { revenue: 0, cost: 0, profit: 0, orders: 0 };
      existing.revenue += order.total_revenue;
      existing.cost += order.total_cost;
      existing.profit += order.total_profit;
      existing.orders++;
      dayMap.set(day, existing);
    }
    return Array.from(dayMap.entries()).map(([name, data]) => ({ name, ...data }));
  }, [filteredOrders]);

  // Product performance
  const productPerformance = useMemo(() => {
    const map = new Map<string, { name: string; sold: number; revenue: number; cost: number; profit: number }>();
    const filteredOrderIds = new Set(filteredOrders.map((o: any) => o.id));

    for (const item of orderItems) {
      if (!filteredOrderIds.has(item.order_id)) continue;
      const product = products.find((p: any) => p.id === item.product_id);
      if (!product) continue;
      const existing = map.get(item.product_id) || { name: product.name, sold: 0, revenue: 0, cost: 0, profit: 0 };
      existing.sold += item.quantity;
      existing.revenue += item.subtotal_revenue;
      existing.cost += item.subtotal_cost;
      existing.profit += item.subtotal_revenue - item.subtotal_cost;
      map.set(item.product_id, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, orderItems, products]);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>วิเคราะห์ยอดขาย</h1>
          <p>วิเคราะห์ผลประกอบการร้านอย่างละเอียด</p>
        </div>
        <div className="page-header-actions">
          <div className="filter-chips">
            {([['7d', '7 วัน'], ['30d', '30 วัน'], ['all', 'ทั้งหมด']] as const).map(([v, label]) => (
              <button key={v} className={`filter-chip ${period === v ? 'active' : ''}`} onClick={() => setPeriod(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-label">รายได้รวม</div>
              <div className="stat-card-value">{formatCurrency(totalRevenue)}</div>
            </div>
            <div className="stat-card-icon purple"><TrendingUp size={22} /></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">ต้นทุนรวม</div>
          <div className="stat-card-value" style={{ color: 'var(--accent-amber)' }}>{formatCurrency(totalCost)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">กำไรรวม</div>
          <div className="stat-card-value" style={{ color: totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(totalProfit)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">ค่าเฉลี่ย/ออเดอร์</div>
          <div className="stat-card-value">{formatCurrency(avgOrderValue)}</div>
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="chart-container" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="chart-header">
          <div>
            <h3 className="chart-title">📈 แนวโน้มรายได้รายวัน</h3>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} />
            <YAxis stroke="var(--text-tertiary)" fontSize={12} tickFormatter={(v: number) => `฿${v}`} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
              formatter={(value) => [`฿${formatNumber(Number(value))}`, '']}
            />
            <Legend />
            <Line type="monotone" dataKey="revenue" name="รายได้" stroke="#7c5cfc" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="profit" name="กำไร" stroke="#34d399" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="cost" name="ต้นทุน" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Product Performance */}
      <div className="dashboard-grid dashboard-grid-2">
        <div className="chart-container">
          <div className="chart-header">
            <h3 className="chart-title">🏆 ผลประกอบการรายสินค้า</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productPerformance.slice(0, 5)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" stroke="var(--text-tertiary)" fontSize={12} tickFormatter={(v) => `฿${v}`} />
              <YAxis type="category" dataKey="name" stroke="var(--text-tertiary)" fontSize={12} width={120} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
                formatter={(value) => [`฿${formatNumber(Number(value))}`, '']}
              />
              <Legend />
              <Bar dataKey="revenue" name="รายได้" fill="#7c5cfc" radius={[0, 4, 4, 0]} />
              <Bar dataKey="profit" name="กำไร" fill="#34d399" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Product Performance Table */}
        <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>รายการสินค้าขายดี</h3>
          <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>สินค้า</th>
                  <th style={{ textAlign: 'right' }}>ขาย (ชิ้น)</th>
                  <th style={{ textAlign: 'right' }}>รายรับ</th>
                  <th style={{ textAlign: 'right' }}>กำไร</th>
                </tr>
              </thead>
              <tbody>
                {productPerformance.slice(0, 5).map((p, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(p.sold)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(p.revenue)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: p.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {formatCurrency(p.profit)}
                    </td>
                  </tr>
                ))}
                {productPerformance.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>ยังไม่มีข้อมูลการขาย</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
