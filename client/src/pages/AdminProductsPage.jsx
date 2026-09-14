import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { formatPaise } from '../context/CartContext';
import Icons from '../components/Icons';

const BRANCHES = [
  { id: 'dmart-kukatpally', name: 'D Mart Kukatpally', shortName: 'Kukatpally' },
  { id: 'dmart-miyapur', name: 'D Mart Miyapur', shortName: 'Miyapur' },
  { id: 'dmart-madhapur', name: 'D Mart Madhapur', shortName: 'Madhapur' }
];

export const AdminProductsPage = () => {
  const { selectedBranch } = useStore();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Branch inventory edit states
  const [activeBranchTab, setActiveBranchTab] = useState('dmart-kukatpally');
  const [branchStockInput, setBranchStockInput] = useState('0');
  const [branchAvailableInput, setBranchAvailableInput] = useState(true);
  const [savingBranchInventory, setSavingBranchInventory] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    baseBarcode: '',
    brand: '',
    category: 'Grocery',
    unit: 'PCS',
    priceRupees: '',
    stockQuantity: '',
    imageUrl: '',
    description: ''
  });

  const categories = [
    'Dairy & Eggs',
    'Bakery',
    'Grains & Rice',
    'Snacks & Biscuits',
    'Personal Care',
    'Cooking Essentials',
    'Beverages',
    'Produce & Vegetables',
    'Grocery'
  ];

  // Fetch products from backend
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/products', {
        params: {
          search: search.trim() || undefined,
          branchId: selectedBranch?._id || undefined,
          page,
          limit: 25
        }
      });

      if (res.data?.products) {
        setProducts(res.data.products);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [search, selectedBranch, page, toast]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 250);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  // Open Add Product Modal
  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      baseBarcode: '',
      brand: '',
      category: 'Grocery',
      unit: 'PCS',
      priceRupees: '',
      stockQuantity: '50',
      imageUrl: '',
      description: ''
    });
    setIsAddModalOpen(true);
  };

  const updateBranchTabInputs = (product, branchId) => {
    const inv = (product.branchInventories || []).find((bi) => bi.branchId === branchId);
    if (inv) {
      setBranchStockInput(String(inv.stockQuantity ?? 0));
      setBranchAvailableInput(Boolean(inv.available) && inv.stockQuantity > 0);
    } else {
      setBranchStockInput('0');
      setBranchAvailableInput(false);
    }
  };

  const handleSelectBranchTab = (branchId) => {
    setActiveBranchTab(branchId);
    if (selectedProduct) {
      updateBranchTabInputs(selectedProduct, branchId);
    }
  };

  // Open Edit Product Modal
  const handleOpenEditModal = (product) => {
    setSelectedProduct(product);
    const priceInRupees = ((product.sellingPricePaise || product.defaultPricePaise || 0) / 100).toFixed(2);
    setFormData({
      name: product.name || '',
      baseBarcode: product.baseBarcode || '',
      brand: product.brand || '',
      category: product.category || 'Grocery',
      unit: product.unit || 'PCS',
      priceRupees: priceInRupees,
      stockQuantity: String(product.stockQuantity !== undefined ? product.stockQuantity : 50),
      imageUrl: product.images?.[0]?.url || '',
      description: product.description || ''
    });

    const initialBranch = selectedBranch?._id || 'dmart-kukatpally';
    setActiveBranchTab(initialBranch);
    updateBranchTabInputs(product, initialBranch);
    setIsEditModalOpen(true);
  };

  const handleSaveBranchInventory = async () => {
    if (!selectedProduct) return;
    const stockQty = Math.max(0, parseInt(branchStockInput, 10) || 0);
    const avail = stockQty > 0 ? branchAvailableInput : false;

    try {
      setSavingBranchInventory(true);
      await api.post(`/branches/${activeBranchTab}/inventory`, {
        productId: selectedProduct._id,
        stockQuantity: stockQty,
        available: avail
      });

      const branchName = BRANCHES.find((b) => b.id === activeBranchTab)?.name || activeBranchTab;
      toast.success(`Inventory updated for ${branchName}!`);

      // Update selectedProduct locally so tab updates immediately
      setSelectedProduct((prev) => {
        if (!prev) return prev;
        const currentInvs = prev.branchInventories ? [...prev.branchInventories] : [];
        const idx = currentInvs.findIndex((bi) => bi.branchId === activeBranchTab);
        const updatedRecord = {
          branchId: activeBranchTab,
          stockQuantity: stockQty,
          available: avail,
          updatedAt: new Date()
        };
        if (idx > -1) {
          currentInvs[idx] = updatedRecord;
        } else {
          currentInvs.push(updatedRecord);
        }
        return { ...prev, branchInventories: currentInvs };
      });

      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to update branch inventory.');
    } finally {
      setSavingBranchInventory(false);
    }
  };

  // Handle Add Product Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.baseBarcode.trim() || !formData.priceRupees) {
      toast.warning('Please enter Name, Barcode, and Price.');
      return;
    }

    const pricePaise = Math.round(parseFloat(formData.priceRupees) * 100);
    const stock = parseInt(formData.stockQuantity, 10) || 0;

    try {
      setSubmitting(true);
      await api.post('/products', {
        name: formData.name.trim(),
        baseBarcode: formData.baseBarcode.trim(),
        brand: formData.brand.trim() || 'General',
        category: formData.category,
        unit: formData.unit,
        defaultPricePaise: pricePaise,
        branchId: selectedBranch?._id,
        stockQuantity: stock,
        images: formData.imageUrl.trim() ? [{ url: formData.imageUrl.trim(), isPrimary: true }] : undefined,
        description: formData.description.trim()
      });

      toast.success(`Product "${formData.name}" added successfully!`);
      setIsAddModalOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to create product.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Product Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const pricePaise = Math.round(parseFloat(formData.priceRupees) * 100);
    const stock = parseInt(formData.stockQuantity, 10) || 0;

    try {
      setSubmitting(true);
      await api.put(`/products/${selectedProduct._id}`, {
        name: formData.name.trim(),
        baseBarcode: formData.baseBarcode.trim(),
        brand: formData.brand.trim(),
        category: formData.category,
        unit: formData.unit,
        defaultPricePaise: pricePaise,
        sellingPricePaise: pricePaise,
        mrpPaise: pricePaise,
        branchId: selectedBranch?._id,
        stockQuantity: stock,
        images: formData.imageUrl.trim() ? [{ url: formData.imageUrl.trim(), isPrimary: true }] : undefined,
        description: formData.description.trim()
      });

      toast.success(`Product "${formData.name}" updated successfully!`);
      setIsEditModalOpen(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to update product.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Product
  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to deactivate "${product.name}"?`)) return;

    try {
      await api.delete(`/products/${product._id}`);
      toast.info(`Product "${product.name}" deactivated.`);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to deactivate product.');
    }
  };

  return (
    <div className="container page-container" style={{ paddingBottom: '90px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-warning" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#ffffff' }}>
              <Icons.ShieldCheck size={13} />
              Admin Portal
            </span>
            {selectedBranch && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Managing Inventory for: <strong style={{ color: 'var(--primary)' }}>{selectedBranch.name}</strong>
              </span>
            )}
          </div>
          <h1 className="title-section" style={{ marginBottom: '4px' }}>
            Store Product & Barcode Management
          </h1>
          <p className="subtitle">
            Add, update prices, manage stock quantities, and configure barcodes in the database.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Icons.Plus size={18} />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Search Input Bar */}
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
          <Icons.Search size={18} />
        </div>
        <input
          type="text"
          className="form-input"
          placeholder="Search products by barcode, product name, brand, or category..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ paddingLeft: '44px', height: '46px', fontSize: '0.95rem' }}
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
              cursor: 'pointer'
            }}
          >
            <Icons.X size={18} />
          </button>
        )}
      </div>

      {/* Product Management Table */}
      <div className="glass-card" style={{ overflow: 'hidden', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-muted)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '14px 18px' }}>Barcode</th>
                <th style={{ padding: '14px 18px' }}>Product Details</th>
                <th style={{ padding: '14px 18px' }}>Category</th>
                <th style={{ padding: '14px 18px' }}>Price (₹)</th>
                <th style={{ padding: '14px 18px' }}>Branch Inventory (Stock & Status)</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    Loading database products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const price = p.sellingPricePaise || p.defaultPricePaise || 0;

                  return (
                    <tr key={p._id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'var(--bg-surface-muted)',
                            border: '1px solid var(--border-card)',
                            color: 'var(--primary)',
                            fontSize: '0.85rem'
                          }}
                        >
                          {p.baseBarcode || p.barcode}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Brand: {p.brand} • Unit: {p.unit}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                          {p.category}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                        {formatPaise(price)}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '190px' }}>
                          {BRANCHES.map((br) => {
                            const inv = (p.branchInventories || []).find((bi) => bi.branchId === br.id);
                            const isAvail = inv && inv.available && inv.stockQuantity > 0;
                            const stock = inv ? inv.stockQuantity : 0;
                            return (
                              <div key={br.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                  {br.shortName}:
                                </span>
                                <span
                                  className={`badge ${isAvail ? 'badge-success' : 'badge-danger'}`}
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '2px 8px',
                                    fontWeight: 700,
                                    minWidth: '95px',
                                    textAlign: 'center',
                                    display: 'inline-block'
                                  }}
                                >
                                  {stock} ({isAvail ? 'Available' : 'Unavailable'})
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            <Icons.CheckCircle2 size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)', padding: '6px 10px', fontSize: '0.8rem' }}
                            title="Deactivate Product"
                          >
                            <Icons.Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Add New Product to Database</h2>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-ghost btn-icon">
                <Icons.X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Amul Pure Ghee (1L)"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Barcode (Digits) *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{ fontFamily: 'monospace' }}
                    value={formData.baseBarcode}
                    onChange={(e) => setFormData({ ...formData, baseBarcode: e.target.value })}
                    placeholder="e.g. 8901262010053"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Brand</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Amul"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select
                    className="form-input"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="PCS">PCS</option>
                    <option value="KG">KG</option>
                    <option value="G">G</option>
                    <option value="L">L</option>
                    <option value="ML">ML</option>
                    <option value="PACK">PACK</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="form-input"
                    value={formData.priceRupees}
                    onChange={(e) => setFormData({ ...formData, priceRupees: e.target.value })}
                    placeholder="e.g. 60.00"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="form-input"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                    placeholder="e.g. 50"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Product Image URL (Optional)</label>
                  <input
                    type="url"
                    className="form-input"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Adding...' : 'Add Product to Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {isEditModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Edit Product Details</h2>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-ghost btn-icon">
                <Icons.X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Barcode *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{ fontFamily: 'monospace' }}
                    value={formData.baseBarcode}
                    onChange={(e) => setFormData({ ...formData, baseBarcode: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Brand</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select
                    className="form-input"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="PCS">PCS</option>
                    <option value="KG">KG</option>
                    <option value="G">G</option>
                    <option value="L">L</option>
                    <option value="ML">ML</option>
                    <option value="PACK">PACK</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="form-input"
                    value={formData.priceRupees}
                    onChange={(e) => setFormData({ ...formData, priceRupees: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="form-input"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  />
                </div>
              </div>

              {/* Branch Inventory Configuration Card */}
              <div
                style={{
                  marginTop: '18px',
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'var(--bg-surface-muted)',
                  border: '1px solid var(--border-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icons.Store size={18} color="var(--primary)" />
                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      Branch-Wise Inventory & Stock
                    </strong>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Independent per-branch stock
                  </span>
                </div>

                {/* Branch selector tabs */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  {BRANCHES.map((br) => {
                    const isSelected = activeBranchTab === br.id;
                    const inv = (selectedProduct?.branchInventories || []).find((bi) => bi.branchId === br.id);
                    const isAvail = inv && inv.available && inv.stockQuantity > 0;
                    return (
                      <button
                        key={br.id}
                        type="button"
                        onClick={() => handleSelectBranchTab(br.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-card)',
                          background: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)',
                          color: isSelected ? 'var(--primary)' : 'var(--text-secondary)'
                        }}
                      >
                        <span>{br.shortName}</span>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: isAvail ? '#10b981' : '#ef4444'
                          }}
                        />
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.76rem' }}>
                      {BRANCHES.find((b) => b.id === activeBranchTab)?.shortName} Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={branchStockInput}
                      onChange={(e) => setBranchStockInput(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.76rem' }}>Availability</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '42px' }}>
                      <input
                        type="checkbox"
                        checked={branchAvailableInput}
                        onChange={(e) => setBranchAvailableInput(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {branchAvailableInput && parseInt(branchStockInput, 10) > 0 ? '✓ Available' : '✕ Unavailable'}
                      </span>
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={savingBranchInventory}
                    onClick={handleSaveBranchInventory}
                    className="btn btn-primary btn-sm"
                    style={{ height: '42px', fontWeight: 700, whiteSpace: 'nowrap' }}
                  >
                    {savingBranchInventory ? 'Saving...' : 'Save Branch Stock'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Save Product Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;
