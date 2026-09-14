import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPaise } from '../context/CartContext';
import Icons from './Icons';

export const ProductCard = ({ product, branchInventory = null }) => {
  const navigate = useNavigate();

  const primaryImage =
    product.images?.find((img) => img.isPrimary)?.url ||
    product.images?.[0]?.url ||
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&fit=crop';

  // Determine pricing & stock
  const mrpPaise = branchInventory?.mrpPaise || product.defaultPricePaise;
  const sellingPricePaise =
    branchInventory?.specialOfferPricePaise ||
    branchInventory?.sellingPricePaise ||
    product.defaultPricePaise;

  const savingsPaise = Math.max(0, mrpPaise - sellingPricePaise);
  const isDiscounted = savingsPaise > 0;
  const stockQuantity = branchInventory?.stockQuantity ?? 50;
  const isOutOfStock = stockQuantity <= 0;

  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
        position: 'relative',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      {/* Discount Sticker */}
      {isDiscounted && (
        <span
          className="badge badge-discount"
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: 2,
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          SAVE {formatPaise(savingsPaise)}
        </span>
      )}

      {/* Product Image Container */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1/1',
          backgroundColor: 'var(--bg-surface-muted)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <img
          src={primaryImage}
          alt={product.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform var(--transition-normal)'
          }}
          loading="lazy"
        />
      </div>

      {/* Product Details */}
      <div
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {product.brand || product.category || 'Retail'}
            </span>
            <span style={{ fontSize: '0.72rem', color: isOutOfStock ? 'var(--danger)' : 'var(--primary)', fontWeight: 600 }}>
              {isOutOfStock ? 'Out of Stock' : 'In Stock'}
            </span>
          </div>

          <h3
            style={{
              fontSize: '0.98rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.35,
              marginBottom: '6px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
            title={product.name}
          >
            {product.name}
          </h3>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {product.packageSize ? `${product.packageSize} ${product.unitOfMeasure || ''}` : product.unitOfMeasure}
          </div>
        </div>

        {/* Pricing & Cart Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {formatPaise(sellingPricePaise)}
              </span>
              {isDiscounted && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                  {formatPaise(mrpPaise)}
                </span>
              )}
            </div>
          </div>

          {/* Scan Action Button */}
          {!isOutOfStock ? (
            <button
              type="button"
              onClick={() => navigate('/scan')}
              className="btn btn-primary btn-sm"
              style={{
                padding: '6px 14px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Icons.Camera size={15} />
              <span>Scan Product</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="btn btn-secondary btn-sm"
              style={{
                padding: '6px 14px',
                opacity: 0.6,
                cursor: 'not-allowed',
                background: 'var(--bg-surface-muted)',
                color: 'var(--text-muted)'
              }}
            >
              Not Available
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
