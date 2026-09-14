import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import Icons from '../components/Icons';

export const StoreSelectPage = () => {
  const {
    branches,
    selectedBranch,
    selectBranch,
    loading,
    locationStatus,
    requestUserLocation
  } = useStore();

  const navigate = useNavigate();
  const toast = useToast();

  const handleSelectBranch = (branch) => {
    selectBranch(branch);
    toast.success(`Selected store: ${branch.name}`);
    navigate('/scan');
  };

  return (
    <div className="container page-container" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '90px' }}>
      {/* Top Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px', paddingTop: '10px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            padding: '6px 16px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 800,
            fontSize: '0.82rem',
            marginBottom: '12px',
            border: '1px solid var(--primary-subtle)'
          }}
        >
          <Icons.Store size={16} />
          <span>Supermarket Location</span>
        </div>
        <h1 className="title-display" style={{ fontSize: '1.9rem', marginBottom: '8px' }}>
          Select Supermarket Branch
        </h1>
        <p className="subtitle" style={{ maxWidth: '520px', margin: '0 auto', fontSize: '0.92rem' }}>
          Choose your branch to verify real-time shelf availability and price before adding to your cart.
        </p>
      </div>

      {/* Geolocation Section: "Find supermarkets near you" */}
      <div
        className="glass-card"
        style={{
          padding: '20px 24px',
          borderRadius: '20px',
          marginBottom: '26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'linear-gradient(135deg, rgba(236, 253, 245, 0.8) 0%, rgba(255, 255, 255, 0.95) 100%)',
          border: '1.5px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              flexShrink: 0
            }}
          >
            <Icons.MapPin size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
              Find supermarkets near you
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {locationStatus === 'granted'
                ? 'Nearest branches calculated based on your location.'
                : locationStatus === 'denied'
                ? 'Location permission denied. You can select your branch manually below.'
                : 'Allow location to automatically see distances to nearby D Mart branches.'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={requestUserLocation}
          disabled={locationStatus === 'locating'}
          className="btn btn-primary"
          style={{
            borderRadius: 'var(--radius-full)',
            padding: '10px 20px',
            fontSize: '0.88rem',
            fontWeight: 800,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Icons.Navigation size={16} />
          <span>
            {locationStatus === 'locating'
              ? 'Locating...'
              : locationStatus === 'granted'
              ? 'Recalculate Distance'
              : 'Allow Location'}
          </span>
        </button>
      </div>

      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          D Mart Branches (Hyderabad)
        </h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {branches.length} Branches Available
        </span>
      </div>

      {/* Branches List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--primary)', fontWeight: 700 }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(16,185,129,0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div>Loading branches...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {branches.map((branch) => {
            const isCurrent = selectedBranch?._id === branch._id;

            return (
              <div
                key={branch._id}
                className="glass-card"
                style={{
                  padding: '20px 22px',
                  borderRadius: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border-card)',
                  background: isCurrent ? 'var(--primary-light)' : 'var(--bg-surface)',
                  boxShadow: isCurrent ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {branch.name}
                    </h3>

                    {branch.distanceText && (
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.14)',
                          color: 'var(--primary)',
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Icons.MapPin size={12} />
                        <span>{branch.distanceText}</span>
                      </span>
                    )}

                    {isCurrent && (
                      <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                        <Icons.CheckCircle2 size={12} />
                        Active Branch
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    <Icons.MapPin size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span>{branch.address?.street}, {branch.address?.city}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <Icons.Clock size={14} style={{ flexShrink: 0 }} />
                    <span>Open Today: {branch.operatingHours?.openTime || '07:00'} - {branch.operatingHours?.closeTime || '23:00'}</span>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleSelectBranch(branch)}
                    className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      borderRadius: 'var(--radius-full)',
                      padding: '10px 22px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isCurrent ? (
                      <>
                        <Icons.CheckCircle2 size={16} />
                        <span>Start Shopping</span>
                      </>
                    ) : (
                      <>
                        <Icons.ArrowRight size={16} />
                        <span>Select Branch</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreSelectPage;
