'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { Plus, Search, Edit2, Trash2, BoxIcon, X, Minus } from 'lucide-react';

export default function PackagingPage() {
  const { packaging, addPackaging, updatePackaging, deletePackaging, addToast } = useStore();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', quantity: '', price: '', stock_quantity: '', unit: 'ชิ้น',
  });

  const filtered = useMemo(() => {
    if (!search) return packaging;
    return packaging.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [packaging, search]);

  const resetForm = () => {
    setFormData({ name: '', quantity: '', price: '', stock_quantity: '', unit: 'ชิ้น' });
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (id: string) => {
    const pkg = packaging.find(p => p.id === id);
    if (!pkg) return;
    setFormData({
      name: pkg.name,
      quantity: String(pkg.quantity),
      price: String(pkg.price),
      stock_quantity: String(pkg.stock_quantity),
      unit: pkg.unit,
    });
    setEditingId(id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.quantity || !formData.price || !formData.stock_quantity) {
      addToast('error', 'กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    const qty = parseFloat(formData.quantity);
    const price = parseFloat(formData.price);
    const stock = parseFloat(formData.stock_quantity);

    if (editingId) {
      await updatePackaging(editingId, { name: formData.name, quantity: qty, price, stock_quantity: stock, unit: formData.unit });
      addToast('success', `แก้ไข "${formData.name}" สำเร็จ`);
    } else {
      await addPackaging({ name: formData.name, quantity: qty, price, stock_quantity: stock, unit: formData.unit });
      addToast('success', `เพิ่ม "${formData.name}" สำเร็จ`);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const pkg = packaging.find(p => p.id === id);
    if (confirm(`ต้องการลบ "${pkg?.name}" หรือไม่?`)) {
      await deletePackaging(id);
      addToast('success', 'ลบบรรจุภัณฑ์สำเร็จ');
    }
  };

  const handleAdjustStock = async (id: string, delta: number) => {
    if (adjusting === id) return;
    const pkg = packaging.find(p => p.id === id);
    if (!pkg) return;
    const next = Math.max(0, pkg.stock_quantity + delta);
    setAdjusting(id);
    await updatePackaging(id, { stock_quantity: next });
    setAdjusting(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>คลังบรรจุภัณฑ์</h1>
          <p>จัดการบรรจุภัณฑ์ทั้งหมด ({packaging.length} รายการ)</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={18} /> เพิ่มบรรจุภัณฑ์
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
              className="search-input"
              placeholder="ค้นหาบรรจุภัณฑ์..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="toolbar-right">
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
            แสดง {filtered.length} จาก {packaging.length} รายการ
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><BoxIcon size={36} /></div>
          <h3>ยังไม่มีบรรจุภัณฑ์</h3>
          <p>เพิ่มบรรจุภัณฑ์เพื่อใช้ในสูตรอาหาร</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={18} /> เพิ่มบรรจุภัณฑ์
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อบรรจุภัณฑ์</th>
                <th style={{ textAlign: 'right' }}>ปริมาณซื้อ</th>
                <th style={{ textAlign: 'right' }}>ราคา</th>
                <th style={{ textAlign: 'right' }}>ราคา/หน่วย</th>
                <th style={{ textAlign: 'center' }}>คงเหลือ (แพ็ค)</th>
                <th>สถานะ</th>
                <th style={{ textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(pkg => {
                const stockStatus = pkg.stock_quantity <= 0 ? 'out-of-stock' : pkg.stock_quantity < 1 ? 'low-stock' : 'in-stock';
                const stockLabel = pkg.stock_quantity <= 0 ? 'หมด' : pkg.stock_quantity < 1 ? 'เหลือน้อย' : 'พร้อมใช้';
                const isAdjusting = adjusting === pkg.id;
                return (
                  <tr key={pkg.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 'var(--radius-md)',
                          background: 'var(--surface-2)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          color: 'var(--accent-amber)', flexShrink: 0,
                        }}>
                          <BoxIcon size={18} />
                        </div>
                        <span style={{ fontWeight: 500 }}>{pkg.name}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(pkg.quantity)} {pkg.unit}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(pkg.price)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-cyan)' }}>
                      {formatCurrency(pkg.price_per_unit)}/{pkg.unit}
                    </td>

                    {/* Stepper column */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8, overflow: 'hidden',
                          background: 'var(--surface-2)',
                        }}>
                          <button
                            onClick={() => handleAdjustStock(pkg.id, -1)}
                            disabled={isAdjusting || pkg.stock_quantity <= 0}
                            title="ลด 1 แพ็ค"
                            style={{
                              width: 30, height: 30,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'none', border: 'none',
                              color: pkg.stock_quantity <= 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                              cursor: pkg.stock_quantity <= 0 || isAdjusting ? 'not-allowed' : 'pointer',
                              opacity: pkg.stock_quantity <= 0 || isAdjusting ? 0.4 : 1,
                            }}
                          >
                            <Minus size={12} strokeWidth={2.5} />
                          </button>
                          <div style={{
                            minWidth: 44, textAlign: 'center',
                            fontSize: '0.8125rem', fontWeight: 600,
                            color: isAdjusting ? 'var(--text-tertiary)' : 'var(--text-primary)',
                            borderLeft: '1px solid var(--border-subtle)',
                            borderRight: '1px solid var(--border-subtle)',
                            lineHeight: '30px', height: 30,
                          }}>
                            {isAdjusting ? '…' : Math.ceil(pkg.stock_quantity)}
                          </div>
                          <button
                            onClick={() => handleAdjustStock(pkg.id, 1)}
                            disabled={isAdjusting}
                            title="เพิ่ม 1 แพ็ค"
                            style={{
                              width: 30, height: 30,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'none', border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: isAdjusting ? 'not-allowed' : 'pointer',
                              opacity: isAdjusting ? 0.4 : 1,
                            }}
                          >
                            <Plus size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 3 }}>
                        {formatNumber(pkg.stock_quantity * pkg.quantity)} {pkg.unit}
                      </div>
                    </td>

                    <td>
                      <div className="stock-status">
                        <div className={`stock-dot ${stockStatus}`} />
                        <span className={`badge ${stockStatus === 'in-stock' ? 'badge-success' : stockStatus === 'low-stock' ? 'badge-warning' : 'badge-danger'}`}>
                          {stockLabel}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)' }}>
                        <button className="btn-icon btn-ghost" onClick={() => openEdit(pkg.id)} title="แก้ไข">
                          <Edit2 size={16} />
                        </button>
                        <button className="btn-icon btn-ghost" onClick={() => handleDelete(pkg.id)} title="ลบ" style={{ color: 'var(--danger)' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'แก้ไขบรรจุภัณฑ์' : 'เพิ่มบรรจุภัณฑ์ใหม่'}</h2>
              <button className="btn-icon btn-ghost" onClick={resetForm}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">ชื่อบรรจุภัณฑ์ <span className="form-required">*</span></label>
                <input
                  className="form-input"
                  placeholder="เช่น แก้วพลาสติก 16oz"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">ปริมาณที่ซื้อ <span className="form-required">*</span></label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="100"
                    value={formData.quantity}
                    onChange={e => setFormData(p => ({ ...p, quantity: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">ราคารวม (บาท) <span className="form-required">*</span></label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    placeholder="100.00"
                    value={formData.price}
                    onChange={e => setFormData(p => ({ ...p, price: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">หน่วย</label>
                  <select
                    className="form-input form-select"
                    value={formData.unit}
                    onChange={e => setFormData(p => ({ ...p, unit: e.target.value }))}
                  >
                    {['ชิ้น', 'ใบ', 'อัน', 'แพ็ค', 'กล่อง', 'ถุง'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">จำนวนในคลัง (แพ็ค) <span className="form-required">*</span></label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="5"
                    value={formData.stock_quantity}
                    onChange={e => setFormData(p => ({ ...p, stock_quantity: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={resetForm}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มบรรจุภัณฑ์'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
