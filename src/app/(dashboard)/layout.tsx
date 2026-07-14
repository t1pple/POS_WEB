'use client';

import { useState, ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  LayoutDashboard, Package, BoxIcon, ChefHat, ClipboardList,
  Menu, X, LogOut, BarChart3, ScanBarcode, ShoppingBag, Moon, Sun
} from 'lucide-react';
import { useTheme } from 'next-themes';

const navItems = [
  { label: 'แดชบอร์ด', href: '/dashboard', icon: LayoutDashboard },
  { section: 'คลังสินค้า' },
  { label: 'วัตถุดิบ', href: '/ingredients', icon: Package },
  { label: 'บรรจุภัณฑ์', href: '/packaging', icon: BoxIcon },
  { section: 'จัดการสินค้า' },
  { label: 'สูตรอาหาร', href: '/recipes', icon: ChefHat },
  { label: 'สินค้า', href: '/products', icon: ShoppingBag },
  { label: 'ออเดอร์', href: '/orders', icon: ClipboardList },
  { label: 'แผนการผลิต', href: '/production', icon: BoxIcon },
  { section: 'เครื่องมือ' },
  { label: 'วิเคราะห์', href: '/analytics', icon: BarChart3 },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, shop, logout } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  // To avoid hydration mismatch for theme toggle icon, only render it after mount
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  const initials = profile
    ? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`
    : 'U';

  // Find current page title
  const currentNav = navItems.find(item => 'href' in item && item.href && pathname.startsWith(item.href));
  const pageTitle = currentNav && 'label' in currentNav ? currentNav.label : 'แดชบอร์ด';

  return (
    <div>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 99, display: 'none',
          }}
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">P</div>
          <div className="sidebar-logo-text">
            <h2>POS Web</h2>
            <span>{shop?.name || 'ร้านค้า'}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, idx) => {
            if ('section' in item) {
              return (
                <div key={`section-${idx}`} className="sidebar-section-title">
                  {item.section}
                </div>
              );
            }
            const Icon = item.icon;
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href!);
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-link-icon">
                  <Icon size={20} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {profile?.first_name} {profile?.last_name}
              </div>
              <div className="sidebar-user-shop">
                {shop?.name}
                {shop?.invite_code && <div style={{ fontSize: '0.75rem', marginTop: '2px', opacity: 0.8 }}>รหัสร้าน: {shop.invite_code}</div>}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-icon btn-ghost"
              title="ออกจากระบบ"
              style={{ flexShrink: 0 }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="topbar-menu-btn btn-icon btn-ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ display: 'none' }}
            id="mobile-menu-btn"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <h1 className="topbar-title">{pageTitle}</h1>
        </div>
        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
            {new Date().toLocaleDateString('th-TH', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="btn-icon btn-ghost"
              style={{ padding: 8 }}
              title="สลับโหมดหน้าจอ"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          #mobile-menu-btn { display: flex !important; }
          .mobile-overlay { display: block !important; }
        }
      `}</style>
    </div>
  );
}
