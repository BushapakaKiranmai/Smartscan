import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { formatPaise } from '../context/CartContext';
import Icons from '../components/Icons';

export const WishlistPage = () => {
  const navigate = useNavigate();
  const { selectedBranch } = useStore();

  const [wishlistItems, setWishlistItems] = useState(() => {
    try {
      const saved = localStorage.getItem('smartscan_wishlist');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Default supermarket favorites if none saved yet
    return [
      {
        id: '6aa7ca4117ef2891f33eb12f',
        name: 'Britannia Marie Gold Biscuits (36.6g)',
        brand: 'Britannia',
        pricePaise: 500,
        mrpPaise: 1000,
        slug: 'marie-gold',
        barcode: '8901063012118',
        available: true,
        imageUrl: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=300&fit=crop'
      },
      {
        id: '6aa7ca4117ef2891f33eb130',
        name: 'Amul Taaza Homogenised Toned Milk 1L',
        brand: 'Amul',
        pricePaise: 7400,
        mrpPaise: 7800,
        slug: 'amul-taaza-milk-1l',
        barcode: '8901262010053',
        available: true,
        imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300&fit=crop'
      },
      {
        id: '6aa7ca4117ef2891f33eb131',
        name: 'Tata Salt Vacuum Evaporated Iodised 1kg',
        brand: 'Tata Salt',
        pricePaise: 2800,
        mrpPaise: 3000,
        slug: 'tata-salt-1kg',
        barcode: '8901030383708',
        available: true,
        imageUrl: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=300&fit=crop'
      }
    ];
  });

  const removeItem = (id) => {
    const updated = wishlistItems.filter((it) => it.id !== id);
    setWishlistItems(updated);
    try {
      localStorage.setItem('smartscan_wishlist', JSON.stringify(updated));
    } catch {}
  };

  return (
    <div className="container page-container" style={{ paddingBottom: '110px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-primary">
            <Icons.Heart size={13} />
            Saved Items
          </span>
        </div>
        <h1 className="title-section" style={{ marginBottom: '4px' }}>
          My Supermarket Wishlist
        </h1>
        <p className="subtitle">
          Your saved supermarket items and weekly grocery staples. Point your phone camera at the physical barcodes when you reach the aisles!
        </p>
      </div>

      {wishlistItems.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '440px', margin: '0 auto' }}>
          <Icons.Heart size={44} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>Your Wishlist is Empty</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.92rem' }}>
            Explore supermarket shelves and save products to scan later in the aisle.
          </p>
          <Link to="/products" className="btn btn-primary" style={{ borderRadius: '14px', fontWeight: 800 }}>
            Browse Catalog
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '18px'
          }}
        >
          {wishlistItems.map((item) => (
            <div
              key={item.id}
              className="glass-card"
              style={{
                padding: '20px',
                borderRadius: '20px',
                border: '1px solid var(--border-card)',
                background: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{
                      width: '72px',
                      height: '72px',
                      objectFit: 'cover',
                      borderRadius: '14px',
                      backgroundColor: 'var(--bg-surface-muted)'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {item.brand}
                    </div>
                    <Link
                      to={`/products/${item.slug || item.id}`}
                      style={{
                        fontSize: '0.98rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        textDecoration: 'none',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.3
                      }}
                    >
                      {item.name}
                    </Link>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary)', marginTop: '4px' }}>
                      {formatPaise(item.pricePaise)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => navigate('/scan')}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, fontWeight: 800, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Icons.Camera size={15} />
                  <span>Scan to Buy</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ borderRadius: '12px', padding: '6px 12px' }}
                  title="Remove from wishlist"
                >
                  <Icons.Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
