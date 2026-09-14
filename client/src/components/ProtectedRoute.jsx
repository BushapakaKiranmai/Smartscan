import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ color: '#10b981', fontSize: '1.1rem', fontWeight: 600 }}>Loading session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles) {
    const currentRole = (role || '').toUpperCase();
    const hasPermission = allowedRoles.some((allowed) => {
      const target = String(allowed).toUpperCase();
      if (currentRole === target) return true;
      if ((target === 'SUPER_ADMIN' || target === 'ADMIN') && (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN')) return true;
      if ((target === 'BRANCH_STAFF' || target === 'STAFF') && (currentRole === 'BRANCH_STAFF' || currentRole === 'STAFF')) return true;
      if ((target === 'BRANCH_MANAGER' || target === 'MANAGER') && (currentRole === 'BRANCH_MANAGER' || currentRole === 'MANAGER')) return true;
      return false;
    });

    if (!hasPermission) {
      return (
        <div className="container page-container" style={{ textAlign: 'center', paddingTop: '100px' }}>
          <div className="glass-card" style={{ padding: '32px', maxWidth: '480px', margin: '0 auto' }}>
            <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>Access Restricted</h2>
            <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
              You do not have administrative permission to access this terminal.
            </p>
            <a href="/" className="btn btn-primary">Return to Store</a>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;
