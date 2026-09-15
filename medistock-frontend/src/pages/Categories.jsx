import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X, 
  ArrowLeft, 
  RotateCcw, 
  Tags, 
  Pill, 
  AlertTriangle, 
  Folder, 
  CheckCircle, 
  Archive, 
  BarChart3, 
  Clock 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Categories = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const isSupplier = user?.roles?.includes('ROLE_SUPPLIER');
  const isStaff = user?.roles?.includes('ROLE_STAFF') && !user?.roles?.includes('ROLE_ADMIN') && !user?.roles?.includes('ROLE_PHARMACIST');

  const [categories, setCategories] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states (Admin only)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Supplier view states
  const [viewingCategory, setViewingCategory] = useState(null);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      if (response.data.success) {
        setCategories(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch categories');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error fetching categories');
    }
  };

  const fetchSupplierMedicines = async () => {
    if (!isSupplier) return;
    try {
      const response = await api.get('/medicines');
      if (response.data.success) {
        setMedicines(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching supplier medicines for categories view', err);
    }
  };

  const initData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchCategories(), fetchSupplierMedicines()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initData();
  }, []);

  // Admin Modal Handlers
  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, description: category.description || '' });
    setFormError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (editingCategory) {
        const response = await api.put(`/categories/${editingCategory.id}`, formData);
        if (response.data.success) {
          setCategories(prev => prev.map(c => c.id === editingCategory.id ? response.data.data : c));
          setModalOpen(false);
        } else {
          setFormError(response.data.message || 'Failed to update category');
        }
      } else {
        const response = await api.post('/categories', formData);
        if (response.data.success) {
          setCategories(prev => [...prev, response.data.data]);
          setModalOpen(false);
        } else {
          setFormError(response.data.message || 'Failed to create category');
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error saving category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete the category "${name}"? This operation cannot be undone.`)) {
      try {
        const response = await api.delete(`/categories/${id}`);
        if (response.data.success) {
          setCategories(prev => prev.filter(c => c.id !== id));
        } else {
          alert(response.data.message || 'Failed to delete category');
        }
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Error deleting category');
      }
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading categories...</div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  // ============================================
  // SUPPLIER SPECIFIC CALCULATIONS & SUB-VIEWS
  // ============================================
  if (isSupplier) {
    // 1. Filter categories to only those containing medicines supplied by this supplier
    const supplierCategories = categories.filter(cat => 
      medicines.some(med => med.category?.id === cat.id)
    );

    // Group medicines by category ID
    const getCategoryMedicines = (catId) => {
      return medicines.filter(med => med.category?.id === catId);
    };

    // Calculate category level stats
    const getCategoryStats = (catId) => {
      const catMeds = getCategoryMedicines(catId);
      const total = catMeds.length;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let healthyCount = 0;

      catMeds.forEach(med => {
        const qty = med.supplierAvailableQuantity || 0;
        const min = med.reorderLevel || 30;
        if (qty === 0) {
          outOfStockCount++;
        } else if (qty <= min) {
          lowStockCount++;
        } else {
          healthyCount++;
        }
      });

      return {
        total,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        healthy: healthyCount,
        statusHealth: (lowStockCount > 0 || outOfStockCount > 0) ? 'ATTENTION REQ' : 'HEALTHY'
      };
    };

    // Global Stats for Catalog Cards
    const totalCategoriesCount = supplierCategories.length;
    const totalMedicinesCount = medicines.length;

    // Largest Category
    let largestCatName = 'N/A';
    let maxMedsCount = 0;
    supplierCategories.forEach(cat => {
      const count = getCategoryMedicines(cat.id).length;
      if (count > maxMedsCount) {
        maxMedsCount = count;
        largestCatName = cat.name;
      }
    });

    // Stock Risk Alert (count of supplier categories that need attention)
    let stockRiskCount = 0;
    supplierCategories.forEach(cat => {
      const stats = getCategoryStats(cat.id);
      if (stats.statusHealth === 'ATTENTION REQ') {
        stockRiskCount++;
      }
    });

    // Filter categories by search query
    const filteredSupplierCategories = supplierCategories.filter(cat =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cat.description && cat.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // --- RENDER DETAIL VIEW ---
    if (viewingCategory) {
      const cat = viewingCategory;
      const catMeds = getCategoryMedicines(cat.id);
      const stats = getCategoryStats(cat.id);

      // Low Stock Medicines List
      const lowStockMeds = catMeds.filter(med => {
        const qty = med.supplierAvailableQuantity || 0;
        const min = med.reorderLevel || 30;
        return qty > 0 && qty <= min;
      });

      // Out of Stock Medicines List
      const outOfStockMeds = catMeds.filter(med => (med.supplierAvailableQuantity || 0) === 0);

      // Expiring soon in next 90 days
      const today = new Date();
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(today.getDate() + 90);

      const expiringMeds = catMeds.filter(med => {
        if (!med.expiryDate) return false;
        const expDate = new Date(med.expiryDate);
        return expDate >= today && expDate <= ninetyDaysFromNow;
      });

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setViewingCategory(null)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <ArrowLeft size={16} />
              <span>Back to Categories</span>
            </button>
            
            <button 
              className="btn-icon" 
              onClick={initData} 
              title="Refresh Catalog Data"
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* Header Card */}
          <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Folder size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                  {cat.name}
                </h2>
                <span className="badge badge-success">ACTIVE CATEGORY</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: #{cat.id}</span>
              </div>
              <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {cat.description || 'No description provided for this classification.'}
              </p>
            </div>
          </div>

          {/* Metrics Widget Row */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            <div className="card stat-card blue" style={{ padding: '16px' }}>
              <span className="stat-label" style={{ fontSize: '0.8rem' }}>Total Medicines</span>
              <span className="stat-value" style={{ fontSize: '1.6rem' }}>{stats.total}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Formulations</span>
            </div>
            <div className="card stat-card emerald" style={{ padding: '16px' }}>
              <span className="stat-label" style={{ fontSize: '0.8rem' }}>In Stock</span>
              <span className="stat-value" style={{ fontSize: '1.6rem' }}>{stats.healthy}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px' }}>Healthy Inventory</span>
            </div>
            <div className="card stat-card amber" style={{ padding: '16px' }}>
              <span className="stat-label" style={{ fontSize: '0.8rem' }}>Low Stock</span>
              <span className="stat-value" style={{ fontSize: '1.6rem' }}>{stats.lowStock}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px' }}>Below Threshold</span>
            </div>
            <div className="card stat-card red" style={{ padding: '16px' }}>
              <span className="stat-label" style={{ fontSize: '0.8rem' }}>Out of Stock</span>
              <span className="stat-value" style={{ fontSize: '1.6rem' }}>{stats.outOfStock}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '4px' }}>Depleted Items</span>
            </div>
            <div className="card stat-card blue" style={{ padding: '16px' }}>
              <span className="stat-label" style={{ fontSize: '0.8rem' }}>Active Formulations</span>
              <span className="stat-value" style={{ fontSize: '1.6rem' }}>{stats.total}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px' }}>Available for Sale</span>
            </div>
            <div className="card stat-card blue" style={{ padding: '16px', opacity: 0.7 }}>
              <span className="stat-label" style={{ fontSize: '0.8rem' }}>Inactive Items</span>
              <span className="stat-value" style={{ fontSize: '1.6rem' }}>0</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Archived</span>
            </div>
          </div>

          {/* Section: Low Stock Medicines */}
          <div>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0', fontFamily: 'Outfit, sans-serif' }}>
              ⚠️ Low Stock Medicines ({lowStockMeds.length})
            </h3>
            {lowStockMeds.length === 0 ? (
              <div className="card" style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                All active medicines in this category have healthy stock levels.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {lowStockMeds.map(med => {
                  const qty = med.supplierAvailableQuantity || 0;
                  const min = med.reorderLevel || 30;
                  const short = min - qty;
                  return (
                    <div className="card" key={med.id} style={{ padding: '16px', borderLeft: '4px solid var(--warning)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '0.95rem', color: 'white' }}>{med.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {med.code} • {med.manufacturer || 'Unknown Manufacturer'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '0.85rem' }}>
                        <span>Stock: <strong style={{ color: 'var(--warning)', fontWeight: 600 }}>{qty} units</strong></span>
                        <span style={{ color: 'var(--text-secondary)' }}>Min: {min} (Short: {short})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Out Of Stock Medicines */}
          <div>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0', fontFamily: 'Outfit, sans-serif' }}>
              🚫 Out Of Stock Medicines ({outOfStockMeds.length})
            </h3>
            {outOfStockMeds.length === 0 ? (
              <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                <CheckCircle size={16} />
                <span>No medicines are currently out of stock in this category.</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {outOfStockMeds.map(med => (
                  <div className="card" key={med.id} style={{ padding: '16px', borderLeft: '4px solid var(--danger)' }}>
                    <strong style={{ fontSize: '0.95rem', color: 'white' }}>{med.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {med.code} • {med.manufacturer || 'Unknown Manufacturer'}
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600 }}>
                      OUT OF STOCK (Min threshold: {med.reorderLevel || 30})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Expiring Soon Batches */}
          <div>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0', fontFamily: 'Outfit, sans-serif' }}>
              ⏰ Expiring Soon Batches (Next 90 Days) ({expiringMeds.length})
            </h3>
            {expiringMeds.length === 0 ? (
              <div className="card" style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                No active batches are expiring in the next 90 days.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {expiringMeds.map(med => {
                  const qty = med.supplierAvailableQuantity || 0;
                  const formattedDate = med.expiryDate ? new Date(med.expiryDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
                  return (
                    <div className="card" key={med.id} style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '0.95rem', color: 'white' }}>{med.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Batch: {med.batchNumber || 'N/A'} • Loc: {med.locationRack || 'Vault C-01'}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600 }}>{qty} units</span>
                      </div>
                      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Expiry Date:</span>
                        <strong style={{ color: 'var(--danger)' }}>Exp: {formattedDate}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    // --- RENDER MAIN CATALOG LIST VIEW ---
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Header and Refresh Button */}
        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)'
          }}>
            <Tags size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
              Supplier Category Catalog
            </h2>
            <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              View pharmaceutical categories associated with your active supplier catalog.
            </p>
          </div>
          <button 
            className="btn-icon" 
            onClick={initData} 
            title="Refresh Catalog Data"
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* 4 Metrics cards */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div className="card stat-card blue">
            <div className="stat-info">
              <span className="stat-label">Total Categories</span>
              <span className="stat-value">{totalCategoriesCount}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Active Classifications
              </span>
            </div>
            <div className="stat-icon"><Folder size={24} /></div>
          </div>

          <div className="card stat-card emerald">
            <div className="stat-info">
              <span className="stat-label">Total Medicines</span>
              <span className="stat-value">{totalMedicinesCount}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '6px' }}>
                Categorized Catalog Items
              </span>
            </div>
            <div className="stat-icon"><Pill size={24} /></div>
          </div>

          <div className="card stat-card amber">
            <div className="stat-info">
              <span className="stat-label">Largest Category</span>
              <span className="stat-value" style={{ fontSize: '1.3rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '180px', display: 'block', paddingTop: '4px' }}>
                {largestCatName}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '6px' }}>
                Most Cataloged Items
              </span>
            </div>
            <div className="stat-icon"><BarChart3 size={24} /></div>
          </div>

          <div className="card stat-card red">
            <div className="stat-info">
              <span className="stat-label">Stock Risk Alert</span>
              <span className="stat-value">{stockRiskCount}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '6px' }}>
                Categories with Low Stock
              </span>
            </div>
            <div className="stat-icon"><AlertTriangle size={24} /></div>
          </div>
        </div>

        {/* Search bar */}
        <div className="search-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div className="search-input-wrap" style={{ flex: 1, minWidth: '280px' }}>
            <Search />
            <input
              type="text"
              placeholder="Search categories by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing <strong>{filteredSupplierCategories.length}</strong> of {supplierCategories.length} categories
          </div>
        </div>

        {/* Table list */}
        <div className="card">
          {filteredSupplierCategories.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
              No categories found matching your query.
            </div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Number of Medicines</th>
                    <th>Low Stock Medicines</th>
                    <th>Out of Stock</th>
                    <th>Status Health</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSupplierCategories.map(cat => {
                    const stats = getCategoryStats(cat.id);
                    const isHealthy = stats.statusHealth === 'HEALTHY';
                    return (
                      <tr key={cat.id}>
                        <td>
                          <strong style={{ color: 'white', fontSize: '0.95rem' }}>{cat.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                            {cat.description || 'No description provided'}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                            {stats.total} Medicines
                          </span>
                        </td>
                        <td>
                          {stats.lowStock > 0 ? (
                            <span className="badge badge-warning" style={{ fontWeight: 600 }}>{stats.lowStock} Low Stock</span>
                          ) : (
                            <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>None</span>
                          )}
                        </td>
                        <td>
                          {stats.outOfStock > 0 ? (
                            <span className="badge badge-danger" style={{ fontWeight: 600 }}>{stats.outOfStock} Out of Stock</span>
                          ) : (
                            <span className="badge badge-success" style={{ fontWeight: 500 }}>In Stock</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${isHealthy ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 600, padding: '4px 10px' }}>
                            {stats.statusHealth}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => setViewingCategory(cat)}
                              style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // ADMIN & PHARMACIST DEFAULT CATEGORY CATALOG
  // ============================================
  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div>
      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <Search />
          <input
            type="text"
            placeholder="Search categories by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {!isStaff && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} />
            <span>Add Category</span>
          </button>
        )}
      </div>

      <div className="card">
        {filteredCategories.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
            No categories found matching your query.
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th>Category Name</th>
                  <th>Description</th>
                  {isAdmin && <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category, index) => (
                  <tr key={category.id}>
                    <td>#{index + 1}</td>
                    <td><strong style={{ color: 'white' }}>{category.name}</strong></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{category.description || 'No description provided'}</td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-icon edit" 
                            onClick={() => openEditModal(category)}
                            title="Edit Category"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            className="btn-icon delete" 
                            onClick={() => handleDelete(category.id, category.name)}
                            title="Delete Category"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="card modal-content">
            <div className="card-header-flex">
              <h3 style={{ fontFamily: 'Outfit, sans-serif' }}>
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h3>
              <button className="btn-icon" onClick={handleCloseModal}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert alert-danger">{formError}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Category Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Antibiotics, Analgesics"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe classification purposes, storage rules, or medical domains..."
                  rows="4"
                  disabled={submitting}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
