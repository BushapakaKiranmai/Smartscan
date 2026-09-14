import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 4500),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info')
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Floating Toasts Container */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
          maxWidth: '380px',
          width: 'calc(100% - 40px)'
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              padding: '12px 16px',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 500,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              animation: 'fadeIn 0.25s ease-out',
              backdropFilter: 'blur(8px)',
              background:
                t.type === 'success'
                  ? 'rgba(16, 185, 129, 0.95)'
                  : t.type === 'error'
                  ? 'rgba(239, 68, 68, 0.95)'
                  : t.type === 'warning'
                  ? 'rgba(245, 158, 11, 0.95)'
                  : 'rgba(30, 41, 59, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
          >
            <span>{t.message}</span>
            <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>✕</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
