import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const StoreContext = createContext(null);

export const DEFAULT_BRANCH = {
  _id: 'dmart-kukatpally',
  supermarketId: 'dmart-main',
  branchCode: 'DMART-KUK-01',
  name: 'D Mart Kukatpally',
  latitude: 17.4849,
  longitude: 78.4138,
  address: {
    street: 'Kukatpally Main Road, Near Metro Station',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500072'
  },
  operatingHours: {
    openTime: '07:00',
    closeTime: '23:00'
  },
  status: 'ACTIVE'
};

export const StoreProvider = ({ children }) => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // 'idle' | 'locating' | 'granted' | 'denied'

  const [selectedBranch, setSelectedBranchState] = useState(() => {
    try {
      const saved = localStorage.getItem('smartscan_branch');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If old sample branch was saved, migrate to D Mart Kukatpally
        if (parsed?._id && parsed._id.startsWith('dmart-')) {
          return parsed;
        }
      }
      return DEFAULT_BRANCH;
    } catch {
      return DEFAULT_BRANCH;
    }
  });

  // Load branches (optionally with coordinates for distance computation)
  const loadBranches = useCallback(async (coords = null) => {
    try {
      setLoading(true);
      const url = coords ? `/branches/nearby?lat=${coords.lat}&lng=${coords.lng}` : '/branches/nearby';
      const res = await api.get(url);
      const data = res?.data || res;
      if (Array.isArray(data) && data.length > 0) {
        setBranches(data);
        // If selected branch exists in refreshed list, keep it; otherwise default to first
        setSelectedBranchState((prev) => {
          const match = data.find((b) => b._id === prev?._id);
          const active = match || data[0];
          localStorage.setItem('smartscan_branch', JSON.stringify(active));
          localStorage.setItem('smartscan_branch_id', active._id);
          return active;
        });
      }
    } catch (err) {
      console.error('[Store] Failed to load branches:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // One-shot Geolocation request to find nearby branches
  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    setLocationStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(coords);
        setLocationStatus('granted');
        loadBranches(coords);
      },
      (err) => {
        console.warn('[Store] Geolocation denied or unavailable:', err.message);
        setLocationStatus('denied');
        loadBranches();
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }, [loadBranches]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const selectBranch = (branch) => {
    if (!branch) return;
    setSelectedBranchState(branch);
    localStorage.setItem('smartscan_branch', JSON.stringify(branch));
    localStorage.setItem('smartscan_branch_id', branch._id);
  };

  const value = {
    branches,
    selectedBranch,
    selectBranch,
    loading,
    userLocation,
    locationStatus,
    requestUserLocation,
    refreshBranches: () => loadBranches(userLocation)
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

export default StoreContext;
