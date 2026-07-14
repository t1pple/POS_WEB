'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();
  const { signup, addToast } = useStore();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    shopMode: 'new', // 'new' or 'join'
    inviteCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      addToast('error', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    if (formData.shopMode === 'join' && !formData.inviteCode) {
      addToast('error', 'กรุณากรอกรหัสคำเชิญ');
      return;
    }
    if (formData.password.length < 6) {
      addToast('error', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      addToast('error', 'รหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      const success = await signup({
        first_name: formData.first_name,
        last_name: formData.last_name,
        shop_name: formData.shopMode === 'new' ? 'ร้านของฉัน' : undefined,
        invite_code: formData.shopMode === 'join' ? formData.inviteCode : undefined,
        email: formData.email,
        password: formData.password,
      });
      if (success) {
        addToast('success', 'สมัครสมาชิกสำเร็จ! ยินดีต้อนรับ');
        router.push('/dashboard');
      }
    } catch (e) {
      addToast('error', 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-gradient" />
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-icon">P</div>
          <h1>สมัครสมาชิก</h1>
          <p>สร้างบัญชีเพื่อเริ่มจัดการร้านของคุณ</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="signup-fname">
                ชื่อ <span className="form-required">*</span>
              </label>
              <input
                id="signup-fname"
                type="text"
                className="form-input"
                placeholder="สมชาย"
                value={formData.first_name}
                onChange={e => updateField('first_name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-lname">
                นามสกุล <span className="form-required">*</span>
              </label>
              <input
                id="signup-lname"
                type="text"
                className="form-input"
                placeholder="ใจดี"
                value={formData.last_name}
                onChange={e => updateField('last_name', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
            <label className="form-label">ร้านของคุณ</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className={`btn ${formData.shopMode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => updateField('shopMode', 'new')}
              >
                สร้างร้านใหม่
              </button>
              <button
                type="button"
                className={`btn ${formData.shopMode === 'join' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => updateField('shopMode', 'join')}
              >
                มีร้านอยู่แล้ว
              </button>
            </div>
          </div>

          {formData.shopMode === 'join' && (
            <div className="form-group">
              <label className="form-label" htmlFor="signup-invite">
                รหัสคำเชิญ <span className="form-required">*</span>
              </label>
              <input
                id="signup-invite"
                type="text"
                className="form-input"
                placeholder="กรอกรหัสคำเชิญ 6 หลัก"
                value={formData.inviteCode}
                onChange={e => updateField('inviteCode', e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">
              อีเมล <span className="form-required">*</span>
            </label>
            <input
              id="signup-email"
              type="email"
              className="form-input"
              placeholder="your@email.com"
              value={formData.email}
              onChange={e => updateField('email', e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">
                รหัสผ่าน <span className="form-required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => updateField('password', e.target.value)}
                  style={{ paddingRight: '44px' }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-confirm">
                ยืนยันรหัสผ่าน <span className="form-required">*</span>
              </label>
              <input
                id="signup-confirm"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={e => updateField('confirmPassword', e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: 'var(--space-2)' }}
          >
            {loading ? (
              <div className="loading-spinner" />
            ) : (
              <>
                <UserPlus size={18} />
                สมัครสมาชิก
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/signin">เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
