import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatPaise } from '../context/CartContext';
import Icons from '../components/Icons';

export const OrdersHistoryPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await api.get('/transactions/my');
        const list = res.data?.orders || res.data?.transactions || res.orders || res.transactions || [];
        setOrders(list);
      } catch (err) {
        console.error('[Orders] Fetch history error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <span className="badge badge-success"><Icons.CheckCircle2 size={13} /> Paid</span>;
      case 'COMPLETED':
        return <span className="badge badge-success"><Icons.CheckCircle2 size={13} /> Exited</span>;
      case 'PENDING_PAYMENT':
        return <span className="badge badge-warning"><Icons.Clock size={13} /> Pending</span>;
      case 'CANCELLED':
        return <span className="badge badge-danger"><Icons.AlertTriangle size={13} /> Cancelled</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="container app-workspace page-container">
      <div style={{ marginBottom: '22px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            margin: '0 0 4px 0'
          }}
        >
          Orders & Receipts
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          Review self-checkout receipts, digital invoices, and exit gate passes
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--primary)', fontWeight: 700 }}>
          <Icons.Sparkles size={32} style={{ marginBottom: '12px' }} />
          <div>Loading your checkout history...</div>
        </div>
      ) : orders.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            borderRadius: '24px',
            border: '1px solid var(--border-card)',
            background: 'var(--bg-surface)'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--bg-surface-muted)',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <Icons.Receipt size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
            No Orders Yet
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '280px', margin: '0 auto 24px' }}>
            You haven't completed any self-checkout orders yet.
          </p>
          <Link to="/scan" className="btn btn-primary" style={{ borderRadius: 'var(--radius-md)', fontWeight: 800 }}>
            <Icons.Camera size={18} />
            <span>Start Barcode Scanning</span>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {orders.map((order) => (
            <div
              key={order._id}
              className="glass-card"
              style={{
                padding: '16px 18px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-card)'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                    {order.orderNumber || `ORD-${String(order._id).slice(-8).toUpperCase()}`}
                  </span>
                  {getStatusBadge(order.status)}
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {order.items?.length || 1} items • {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                    {formatPaise(order.pricingSummary?.finalPayableAmountPaise || order.totalAmountPaise || Math.round((order.totalAmount || 0) * 100))}
                  </div>
                </div>

                <Link
                  to={`/order-success/${order._id}`}
                  className="btn btn-secondary btn-sm"
                  style={{ borderRadius: '12px', padding: '6px 10px', fontSize: '0.78rem', fontWeight: 800 }}
                >
                  <span>Pass</span>
                  <Icons.ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersHistoryPage;
