'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export default function SignInPage() {
  const router = useRouter();
  const { login, addToast } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('error', 'กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        addToast('success', 'เข้าสู่ระบบสำเร็จ!');
        router.push('/dashboard');
      } else {
        addToast('error', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (e) {
      addToast('error', 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
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
          <h1>เข้าสู่ระบบ</h1>
          <p>ยินดีต้อนรับกลับ! กรุณาเข้าสู่ระบบเพื่อจัดการร้านของคุณ</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="signin-email">อีเมล</label>
            <input
              id="signin-email"
              type="email"
              className="form-input"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signin-password">รหัสผ่าน</label>
            <div style={{ position: 'relative' }}>
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: '44px' }}
                autoComplete="current-password"
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
                <LogIn size={18} />
                เข้าสู่ระบบ
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          ยังไม่มีบัญชี?{' '}
          <Link href="/signup">สมัครสมาชิก</Link>
        </div>
      </div>
    </div>
  );
}
