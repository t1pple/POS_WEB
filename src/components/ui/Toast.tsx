'use client';

import { useStore } from '@/lib/store';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useStore();

  if (toasts.length === 0) return null;

  const iconMap = {
    success: <CheckCircle size={18} />,
    error: <AlertCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  const colorMap = {
    success: 'var(--success)',
    error: 'var(--danger)',
    warning: 'var(--warning)',
    info: 'var(--info)',
  };

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span style={{ color: colorMap[toast.type], display: 'flex' }}>{iconMap[toast.type]}</span>
          <span style={{ flex: 1, fontSize: '0.875rem' }}>{toast.message}</span>
          <button
            className="btn-icon btn-ghost"
            onClick={() => removeToast(toast.id)}
            style={{ width: 28, height: 28, flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
