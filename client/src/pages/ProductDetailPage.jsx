import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useStore } from '../context/StoreContext';
import { useCart, formatPaise } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import Icons from '../components/Icons';

export const ProductDetailPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { selectedBranch } = useStore();
  const { addItem, items } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const activeBranchId = selectedBranch?._id || 'dmart-kukatpally';

        // Clean lookup term: replace hyphens with spaces for slug matching (e.g. marie-gold -> marie gold)
        const cleanQuery = decodeURIComponent(productId || '').replace(/-/g, ' ').trim();

        // 1. Try querying product search by slug or ID
        let found = null;
        try {
          const res = await api.get('/products/search', {
            params: {
              q: cleanQuery,
              branchId: activeBranchId
            }
          });
          const items = res.products || res.data?.products || res.data || [];
          if (Array.isArray(items) && items.length > 0) {
            // Pick exact match or first result
            found = items.find((p) =>
              p._id === productId ||
              p.barcode === productId ||
              p.name?.toLowerCase().includes(cleanQuery.toLowerCase())
            ) || items[0];
          }
        } catch (searchErr) {
          console.warn('[ProductDetail] Search query failed:', searchErr.message);
        }

        // 2. If not found by search query, try direct ID lookup
        if (!found && productId && !productId.includes('-')) {
          try {
            const res = await api.get(`/products/${productId}`);
            found = res.product || res.data?.product || res.data;
          } catch {}
        }

        // 3. Fallback dummy if offline or demo product slug (e.g. marie-gold)
        if (!found && cleanQuery.toLowerCase().includes('marie')) {
          found = {
            _id: '6aa7ca4117ef2891f33eb12f',
            name: 'Britannia Marie Gold Biscuits (36.6g)',
            brand: 'Britannia',
            barcode: '8901063012118',
            category: 'Biscuits & Cookies',
            price: 5,
            mrp: 10,
            unitPricePaise: 500,
            mrpPaise: 1000,
            sellingPricePaise: 500,
            available: true,
            stockQuantity: 15,
            packageSize: '36.6g',
            description: 'Crisp, light and packed with essential vitamins and minerals. Perfect companion for your daily tea.',
            imageUrl: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=500&fit=crop'
          };
        }

        if (!isCancelled) {
          if (found) {
            setProduct(found);
          } else {
            setError('Product not found in current supermarket inventory.');
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[ProductDetail] Error loading product:', err);
          setError(err.message || 'Failed to load product details.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchProduct();

    return () => {
      isCancelled = true;
    };
  }, [productId, selectedBranch]);

  const pricePaise = product
    ? (product.sellingPricePaise || product.unitPricePaise || Math.round((product.price || 0) * 100))
    : 0;
  const mrpPaise = product
    ? (product.mrpPaise || Math.round((product.mrp || product.price || 0) * 100))
    : pricePaise;
  const savingsPaise = Math.max(0, mrpPaise - pricePaise);

  const isInCart = Boolean(product && items.some((it) => (it.productId || it._id) === (product._id || product.id)));

  if (loading) {
    return (
      <div className="container page-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', marginBottom: '16px', color: 'var(--primary)' }}>
          <Icons.Sparkles size={36} />
        </div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Loading product details...</h2>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container page-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div className="glass-card" style={{ maxWidth: '440px', margin: '0 auto', padding: '36px 24px', borderRadius: '24px' }}>
          <Icons.AlertCircle size={44} color="#ef4444" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>Product Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.92rem' }}>
            {error || 'We could not find the requested product in the current catalog.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="btn btn-primary"
              style={{ borderRadius: '14px', fontWeight: 800 }}
            >
              Browse Products
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn btn-secondary"
              style={{ borderRadius: '14px', fontWeight: 700 }}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-container" style={{ paddingBottom: '110px' }}>
      {/* Breadcrumb Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.84rem',
          color: 'var(--text-muted)',
          marginBottom: '20px',
          fontWeight: 600
        }}
      >
        <Link to="/home" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
        <span>›</span>
        <Link to="/products" style={{ color: 'inherit', textDecoration: 'none' }}>Products</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{product.name}</span>
      </div>

      <div
        className="glass-card"
        style={{
          padding: '28px',
          borderRadius: '24px',
          border: '1px solid var(--border-card)',
          background: 'var(--bg-surface)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '32px',
          alignItems: 'start'
        }}
      >
        {/* Left: Product Image & Badges */}
        <div>
          <div
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: '20px',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-surface-muted)',
              border: '1px solid var(--border-subtle)',
              position: 'relative'
            }}
          >
            <img
              src={
                product.imageUrl ||
                product.images?.find((img) => img.isPrimary)?.url ||
                product.images?.[0]?.url ||
                'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&fit=crop'
              }
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {savingsPaise > 0 && (
              <span
                className="badge badge-discount"
                style={{
                  position: 'absolute',
                  top: '14px',
                  left: '14px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                SAVE {formatPaise(savingsPaise)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Product Details & Purchase Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: 'var(--primary)',
                  letterSpacing: '0.04em'
                }}
              >
                {product.brand || product.category || 'Supermarket Fresh'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {product.packageSize || 'Standard Pack'}
              </span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.65rem',
                fontWeight: 900,
                color: 'var(--text-primary)',
                lineHeight: 1.25,
                margin: '0 0 12px 0'
              }}
            >
              {product.name}
            </h1>

            {/* Price section */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--primary)' }}>
                {formatPaise(pricePaise)}
              </span>
              {mrpPaise > pricePaise && (
                <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                  {formatPaise(mrpPaise)}
                </span>
              )}
            </div>

            {/* Branch Stock Status Badge */}
            <div style={{ marginBottom: '18px' }}>
              {product.available !== false && (product.stockQuantity ?? 10) > 0 ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    background: '#ecfdf5',
                    color: '#059669',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Icons.Check size={16} />
                  <span>In Stock at {selectedBranch?.name || 'D Mart Kukatpally'}</span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <Icons.AlertCircle size={16} />
                  <span>Out of Stock at this store</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--bg-surface-muted)', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {product.description}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => navigate('/scan')}
              className="btn btn-primary btn-block"
              style={{
                padding: '14px',
                borderRadius: '16px',
                fontWeight: 800,
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Icons.Camera size={20} />
              <span>Scan Barcode in Store to Add</span>
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                to="/cart"
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Icons.ShoppingCart size={17} />
                <span>View My Cart</span>
              </Link>

              <button
                type="button"
                onClick={() => navigate('/products')}
                className="btn btn-ghost"
                style={{
                  padding: '12px 18px',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '0.92rem'
                }}
              >
                All Products
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
