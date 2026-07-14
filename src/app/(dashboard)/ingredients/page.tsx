'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { UNIT_OPTIONS } from '@/lib/types';
import {
  Plus, Search, Edit2, Trash2, Package, ScanBarcode, FileText,
  X, Upload, Camera, Minus,
} from 'lucide-react';

export default function IngredientsPage() {
  const { ingredients, addIngredient, updateIngredient, deleteIngredient, addToast } = useStore();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showBillScanner, setShowBillScanner] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', quantity: '', unit: 'กรัม', price: '', stock_quantity: '', barcode: '',
  });

  const filtered = useMemo(() => {
    if (!search) return ingredients;
    const s = search.toLowerCase();
    return ingredients.filter(i =>
      i.name.toLowerCase().includes(s) || (i.barcode && i.barcode.includes(s))
    );
  }, [ingredients, search]);

  const resetForm = () => {
    setFormData({ name: '', quantity: '', unit: 'กรัม', price: '', stock_quantity: '', barcode: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (id: string) => {
    const ing = ingredients.find(i => i.id === id);
    if (!ing) return;
    setFormData({
      name: ing.name,
      quantity: String(ing.quantity),
      unit: ing.unit,
      price: String(ing.price),
      stock_quantity: String(ing.stock_quantity),
      barcode: ing.barcode || '',
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
      await updateIngredient(editingId, {
        name: formData.name,
        quantity: qty,
        unit: formData.unit,
        price,
        stock_quantity: stock,
        barcode: formData.barcode || undefined,
      });
      addToast('success', `แก้ไข "${formData.name}" สำเร็จ`);
    } else {
      await addIngredient({
        name: formData.name,
        quantity: qty,
        unit: formData.unit,
        price,
        stock_quantity: stock,
        barcode: formData.barcode || undefined,
      });
      addToast('success', `เพิ่ม "${formData.name}" สำเร็จ`);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const ing = ingredients.find(i => i.id === id);
    if (confirm(`ต้องการลบ "${ing?.name}" หรือไม่?`)) {
      await deleteIngredient(id);
      addToast('success', 'ลบวัตถุดิบสำเร็จ');
    }
  };

  const handleAdjustStock = async (id: string, delta: number) => {
    if (adjusting === id) return;
    const ing = ingredients.find(i => i.id === id);
    if (!ing) return;
    const next = Math.max(0, ing.stock_quantity + delta);
    setAdjusting(id);
    await updateIngredient(id, { stock_quantity: next });
    setAdjusting(null);
  };

  const pricePerUnit = formData.quantity && formData.price
    ? parseFloat(formData.price) / parseFloat(formData.quantity)
    : 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>คลังวัตถุดิบ</h1>
          <p>จัดการวัตถุดิบทั้งหมดของร้าน ({ingredients.length} รายการ)</p>
        </div>
        <div className="page-header-actions">

          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={18} />
            เพิ่มวัตถุดิบ
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
              className="search-input"
              placeholder="ค้นหาวัตถุดิบ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="toolbar-right">
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
            แสดง {filtered.length} จาก {ingredients.length} รายการ
          </span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Package size={36} /></div>
          <h3>ยังไม่มีวัตถุดิบ</h3>
          <p>เริ่มเพิ่มวัตถุดิบเพื่อสร้างสูตรอาหารของคุณ</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={18} /> เพิ่มวัตถุดิบ
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อวัตถุดิบ</th>
                <th style={{ textAlign: 'right' }}>ปริมาณซื้อ</th>
                <th style={{ textAlign: 'right' }}>ราคา</th>
                <th style={{ textAlign: 'right' }}>ราคา/หน่วย</th>
                <th style={{ textAlign: 'center' }}>คงเหลือ (แพ็ค)</th>
                <th>สถานะ</th>
                <th style={{ textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ing => {
                const stockStatus = ing.stock_quantity <= 0 ? 'out-of-stock' : ing.stock_quantity < 1 ? 'low-stock' : 'in-stock';
                const stockLabel = ing.stock_quantity <= 0 ? 'หมด' : ing.stock_quantity < 1 ? 'เหลือน้อย' : 'พร้อมใช้';
                const isAdjusting = adjusting === ing.id;
                return (
                  <tr key={ing.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 'var(--radius-md)',
                          background: 'var(--surface-2)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          color: 'var(--primary-400)', flexShrink: 0,
                        }}>
                          <Package size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{ing.name}</div>
                          {ing.barcode && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                              {ing.barcode}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(ing.quantity)} {ing.unit}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(ing.price)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-cyan)' }}>
                      {formatCurrency(ing.price_per_unit)}/{ing.unit}
                    </td>

                    {/* Stepper column */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8, overflow: 'hidden',
                          background: 'var(--surface-2)',
                        }}>
                          <button
                            onClick={() => handleAdjustStock(ing.id, -1)}
                            disabled={isAdjusting || ing.stock_quantity <= 0}
                            title="ลด 1 แพ็ค"
                            style={{
                              width: 30, height: 30,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'none', border: 'none',
                              color: ing.stock_quantity <= 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                              cursor: ing.stock_quantity <= 0 || isAdjusting ? 'not-allowed' : 'pointer',
                              opacity: ing.stock_quantity <= 0 || isAdjusting ? 0.4 : 1,
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
                            {isAdjusting ? '…' : Math.ceil(ing.stock_quantity)}
                          </div>
                          <button
                            onClick={() => handleAdjustStock(ing.id, 1)}
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
                        {formatNumber(ing.stock_quantity * ing.quantity)} {ing.unit}
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
                        <button className="btn-icon btn-ghost" onClick={() => openEdit(ing.id)} title="แก้ไข">
                          <Edit2 size={16} />
                        </button>
                        <button className="btn-icon btn-ghost" onClick={() => handleDelete(ing.id)} title="ลบ" style={{ color: 'var(--danger)' }}>
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

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบใหม่'}</h2>
              <button className="btn-icon btn-ghost" onClick={resetForm}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">ชื่อวัตถุดิบ <span className="form-required">*</span></label>
                <input
                  className="form-input"
                  placeholder="เช่น เมล็ดกาแฟอาราบิก้า"
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
                    placeholder="1000"
                    value={formData.quantity}
                    onChange={e => setFormData(p => ({ ...p, quantity: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">หน่วย <span className="form-required">*</span></label>
                  <select
                    className="form-input form-select"
                    value={formData.unit}
                    onChange={e => setFormData(p => ({ ...p, unit: e.target.value }))}
                  >
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">ราคา (บาท) <span className="form-required">*</span></label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="450"
                    value={formData.price}
                    onChange={e => setFormData(p => ({ ...p, price: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">ราคา/หน่วย</label>
                  <div className="form-input" style={{ background: 'var(--surface-2)', color: 'var(--accent-cyan)' }}>
                    {pricePerUnit > 0 ? `${formatCurrency(pricePerUnit)}/${formData.unit}` : '—'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
                <div className="form-group">
                  <label className="form-label">บาร์โค้ด</label>
                  <input
                    className="form-input"
                    placeholder="(ไม่จำเป็น)"
                    value={formData.barcode}
                    onChange={e => setFormData(p => ({ ...p, barcode: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={resetForm}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มวัตถุดิบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <div className="modal-overlay" onClick={() => setShowBarcodeScanner(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">สแกนบาร์โค้ด</h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowBarcodeScanner(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ alignItems: 'center' }}>
              <div className="scanner-container" style={{ height: 300, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Camera size={48} style={{ color: 'var(--text-tertiary)' }} />
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: '0 var(--space-4)' }}>
                  กล้องจะเปิดเมื่อเชื่อมต่อ Barcode Scanner API<br />
                  <span style={{ fontSize: '0.75rem' }}>(Placeholder — รองรับ html5-qrcode)</span>
                </p>
                <div className="scanner-line" />
              </div>
              <div className="form-group" style={{ width: '100%' }}>
                <label className="form-label">หรือกรอกบาร์โค้ดด้วยตัวเอง</label>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <input
                    className="form-input"
                    placeholder="กรอกหมายเลขบาร์โค้ด"
                    value={formData.barcode}
                    onChange={e => setFormData(p => ({ ...p, barcode: e.target.value }))}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (formData.barcode) {
                        const existing = ingredients.find(i => i.barcode === formData.barcode);
                        if (existing) {
                          addToast('info', `พบวัตถุดิบ "${existing.name}" ในคลังแล้ว`);
                          openEdit(existing.id);
                        } else {
                          setShowBarcodeScanner(false);
                          setShowForm(true);
                        }
                      }
                    }}
                  >
                    ค้นหา
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bill Scanner Modal */}
      {showBillScanner && (
        <div className="modal-overlay" onClick={() => setShowBillScanner(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">สแกนบิล / ใบเสร็จ</h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowBillScanner(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="upload-zone" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = () => {
                  addToast('info', 'อัพโหลดรูปสำเร็จ — OCR จะพร้อมใช้เร็วๆ นี้');
                };
                input.click();
              }}>
                <div className="upload-zone-icon">
                  <Upload size={28} />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                  อัพโหลดรูปบิล
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                  ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                  รองรับ JPG, PNG, PDF (สูงสุด 10MB)
                </p>
              </div>

              <div style={{
                padding: 'var(--space-4)',
                background: 'var(--info-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                gap: 'var(--space-3)',
                alignItems: 'flex-start',
              }}>
                <FileText size={20} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--info)' }}>OCR Placeholder</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                    ฟีเจอร์ OCR อัตโนมัติจะพร้อมในเวอร์ชันถัดไป ตอนนี้สามารถอัพโหลดรูปบิลและกรอกข้อมูลด้วยตัวเองได้
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                  กรอกรายการจากบิลด้วยตัวเอง
                </h4>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowBillScanner(false);
                    setShowForm(true);
                  }}
                >
                  <Plus size={18} /> เพิ่มวัตถุดิบจากบิล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
