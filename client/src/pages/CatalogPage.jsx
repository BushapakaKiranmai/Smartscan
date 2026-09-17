import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import Icons from '../components/Icons';

/**
 * Product Search & Catalog Page — Availability Check Only
 *
 * Search Page Purpose:
 * SEARCH → CHECK AVAILABILITY → SEE PRODUCT DETAILS → SCAN PRODUCT
 */
export const CatalogPage = ({ category = null }) => {
  const { selectedBranch, selectBranch, branches } = useStore();
  const toast = useToast();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(category || '');
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  // Available branches fallback list
  const storeBranches = branches.length > 0 ? branches : [
    { _id: 'dmart-kukatpally', id: 'dmart-kukatpally', name: 'D Mart Kukatpally', branchCode: 'DMART-KUK-01' },
    { _id: 'dmart-miyapur', id: 'dmart-miyapur', name: 'D Mart Miyapur', branchCode: 'DMART-MIY-02' },
    { _id: 'dmart-madhapur', id: 'dmart-madhapur', name: 'D Mart Madhapur', branchCode: 'DMART-MAD-03' }
  ];

  // Sync category change to search
  useEffect(() => {
    if (category) {
      setSearch(category);
    }
  }, [category]);

  // Fetch product availability for the selected branch (Read-Only query)
  useEffect(() => {
    let isCancelled = false;

    const fetchBranchProducts = async () => {
      try {
        setLoading(true);
        const activeBranchId = selectedBranch?._id || 'dmart-kukatpally';
        const queryTerm = search.trim() || category || undefined;
        const res = await api.get('/products/search', {
          params: {
            q: queryTerm,
            branchId: activeBranchId
          }
        });

        if (!isCancelled) {
          const items = res.products || res.data?.products || res.data || [];
          setProducts(Array.isArray(items) ? items : []);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[Product Search] Fetch error:', err.message);
          toast.error('Failed to load products for this branch');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(fetchBranchProducts, 150);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [search, selectedBranch, toast]);

  return (
    <div className="container page-container" style={{ paddingBottom: '100px' }}>
      {/* Top Banner */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-success">
            <Icons.Store size={13} />
            Check Availability Only
          </span>
        </div>
        <h1 className="title-section" style={{ marginBottom: '4px' }}>
          {category ? `${category}'s Collection & Grocery` : 'Product Search & Availability'}
        </h1>
        <p className="subtitle">
          {category
            ? `Explore ${category.toLowerCase()}'s items and essentials at your selected branch.`
            : 'Check live product availability at your selected branch. This search page is read-only. Use Scan & Go to scan and add items.'}
        </p>
      </div>

      {/* 1. Selected Supermarket Branch Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'var(--bg-surface)',
          borderRadius: '16px',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-xs)',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.35rem' }}>📍</span>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {selectedBranch?.name || 'D Mart Kukatpally'}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Live branch inventory active
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsBranchModalOpen(true)}
          className="btn btn-secondary btn-sm"
          style={{
            fontWeight: 800,
            fontSize: '0.82rem',
            padding: '6px 14px',
            borderRadius: '12px'
          }}
        >
          (Change)
        </button>
      </div>

      {/* 2. Search Input Box */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <div
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none'
          }}
        >
          <Icons.Search size={19} />
        </div>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search: Marie Gold, product name, brand..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            paddingLeft: '46px',
            paddingRight: search ? '42px' : '16px',
            height: '48px',
            fontSize: '1rem'
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Clear search"
          >
            <Icons.X size={18} />
          </button>
        )}
      </div>

      {/* 3. Search Results */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--primary)', fontWeight: 600 }}>
          <div style={{ display: 'inline-block', marginBottom: '12px' }}>
            <Icons.Sparkles size={32} />
          </div>
          <div>Checking live availability at {selectedBranch?.name}...</div>
        </div>
      ) : products.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '440px', margin: '0 auto' }}>
          <Icons.Search size={40} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px' }}>No Products Found</h3>
          <p className="subtitle" style={{ marginBottom: '20px' }}>
            No products matched your search query. Try typing another brand or product name.
          </p>
          <button
            type="button"
            onClick={() => setSearch('')}
            className="btn btn-secondary btn-sm"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px'
          }}
        >
          {products.map((product) => {
            const isAvail = Boolean(product.available) && Number(product.stockQuantity) > 0;

            return (
              <div
                key={product._id || product.id}
                className="glass-card"
                style={{
                  padding: '20px',
                  borderRadius: '18px',
                  border: isAvail ? '1px solid var(--border-card)' : '1px solid rgba(239, 68, 68, 0.28)',
                  background: isAvail ? 'var(--bg-surface)' : 'rgba(239, 68, 68, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  boxShadow: 'var(--shadow-xs)'
                }}
              >
                <div>
                  {/* Product Image if available */}
                  {(product.image || product.imageUrl) && (
                    <div
                      style={{
                        width: '100%',
                        height: '140px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        marginBottom: '12px',
                        background: 'var(--bg-surface-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <img
                        src={product.image || product.imageUrl}
                        alt={product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.parentElement.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Product Title */}
                  <h3
                    style={{
                      fontSize: '1.08rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      margin: '0 0 8px 0',
                      lineHeight: 1.3
                    }}
                  >
                    <Link
                      to={`/products/${product.slug || product._id || product.id}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {product.name}
                    </Link>
                  </h3>

                  {/* Price */}
                  <div
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 900,
                      color: 'var(--primary)',
                      lineHeight: 1,
                      marginBottom: '12px'
                    }}
                  >
                    ₹{product.price}
                  </div>

                  {/* Availability Status */}
                  {isAvail ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: '#ecfdf5',
                          color: '#059669',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          width: 'fit-content'
                        }}
                      >
                        ✓ Available
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                        {product.stockQuantity} available
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: '#fef2f2',
                          color: '#dc2626',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          width: 'fit-content'
                        }}
                      >
                        ✕ Not Available
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, marginTop: '2px' }}>
                        Currently unavailable at {selectedBranch?.name || 'D Mart'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Branch Selector Modal */}
      {isBranchModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsBranchModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '420px', padding: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Select Supermarket Branch
              </h2>
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                className="btn btn-ghost btn-icon"
              >
                <Icons.X size={20} />
              </button>
            </div>

            <p className="subtitle" style={{ marginBottom: '18px', fontSize: '0.84rem' }}>
              Product stock and availability differ across branches. Choose your store:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {storeBranches.map((branch) => {
                const isCurrent = selectedBranch?._id === branch._id || selectedBranch?.id === branch.id;
                return (
                  <button
                    key={branch._id || branch.id}
                    type="button"
                    onClick={() => {
                      selectBranch(branch);
                      setIsBranchModalOpen(false);
                      toast.info(`Switched store to ${branch.name}`);
                    }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border-card)',
                      background: isCurrent ? 'var(--primary-light)' : 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        📍 {branch.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {branch.address?.street || branch.branchCode || 'Hyderabad'}
                      </div>
                    </div>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: 'var(--primary)',
                          padding: '2px 8px',
                          background: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid var(--primary)'
                        }}
                      >
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
