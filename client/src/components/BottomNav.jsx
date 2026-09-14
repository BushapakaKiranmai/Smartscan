import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Icons from './Icons';

export const BottomNav = () => {
  const { itemCount } = useCart();

  return (
    <nav className="bottom-dock">
      {/* 1. Home */}
      <NavLink
        to="/"
        end
        className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
      >
        <Icons.Home size={22} />
        <span>Home</span>
      </NavLink>

      {/* 2. Cart */}
      <NavLink
        to="/cart"
        className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icons.ShoppingCart size={22} />
          {itemCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-8px',
                background: 'var(--primary)',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 800,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }}
            >
              {itemCount}
            </span>
          )}
        </div>
        <span>Cart</span>
      </NavLink>

      {/* 3. HERO FLOATING CENTER SCAN ACTION */}
      <div className="beacon-ring-wrapper">
        <div className="beacon-ring" />
        <NavLink
          to="/scan"
          className="dock-scan-bubble"
          title="Tap to Scan Product Barcode"
        >
          <Icons.Scan size={24} />
        </NavLink>
      </div>

      {/* 4. Orders */}
      <NavLink
        to="/orders"
        className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
      >
        <Icons.Receipt size={22} />
        <span>Orders</span>
      </NavLink>

      {/* 5. Profile */}
      <NavLink
        to="/profile"
        className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
      >
        <Icons.User size={22} />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
