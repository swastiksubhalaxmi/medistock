import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RotateCcw,
  Tag
} from 'lucide-react';

const Medicines = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [medicines, setMedicines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedStockStatus, setSelectedStockStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Sorting State
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    genericName: '',
    manufacturer: '',
    price: '',
    expiryDate: '',
    batchNumber: '',
    categoryId: '',
    supplierId: '',
    initialQuantity: 0,
    reorderLevel: 10,
    maxQuantity: 100,
    locationRack: ''
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Permission Checks: ADMIN and PHARMACIST can modify
  const canModify = user?.roles?.some(role => ['ROLE_ADMIN', 'ROLE_PHARMACIST'].includes(role));
  const isSupplier = user?.roles?.includes('ROLE_SUPPLIER');
  const isStaff = user?.roles?.includes('ROLE_STAFF') && !user?.roles?.includes('ROLE_ADMIN') && !user?.roles?.includes('ROLE_PHARMACIST');

  // Supplier medicine management modal state
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierAllMeds, setSupplierAllMeds] = useState([]);
  const [selectedSupplierMedId, setSelectedSupplierMedId] = useState('');
  const [supplierAvailQty, setSupplierAvailQty] = useState(0);
  const [submittingSupplierMed, setSubmittingSupplierMed] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState('');
  const [createNewFormulation, setCreateNewFormulation] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Bulk selling price modal states
  const [bulkPriceModalOpen, setBulkPriceModalOpen] = useState(false);
  const [bulkSupplierId, setBulkSupplierId] = useState('');
  const [bulkMode, setBulkMode] = useState('MARKUP');
  const [bulkValue, setBulkValue] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [bulkFormError, setBulkFormError] = useState('');

  const openBulkPriceModal = () => {
    setBulkSupplierId(selectedSupplier || suppliers[0]?.id?.toString() || '');
    setBulkMode('MARKUP');
    setBulkValue('20');
    setBulkFormError('');
    setBulkPriceModalOpen(true);
  };

  const handleBulkPriceSubmit = async (e) => {
    e.preventDefault();
    if (!bulkSupplierId) {
      setBulkFormError('Please select a supplier');
      return;
    }
    if (!bulkValue || parseFloat(bulkValue) <= 0) {
      setBulkFormError('Please enter a valid positive value');
      return;
    }

    try {
      setSubmittingBulk(true);
      setBulkFormError('');
      const params = {};
      if (bulkMode === 'MARKUP') {
        params.markupPercentage = parseFloat(bulkValue);
      } else {
        params.fixedSellingPrice = parseFloat(bulkValue);
      }

      const response = await api.put(`/medicines/suppliers/${bulkSupplierId}/bulk-selling-price`, null, { params });
      if (response.data.success) {
        setBulkPriceModalOpen(false);
        fetchMedicines();
      } else {
        setBulkFormError(response.data.message || 'Failed to update selling prices');
      }
    } catch (err) {
      setBulkFormError(err.response?.data?.message || err.message || 'Error updating selling prices');
    } finally {
      setSubmittingBulk(false);
    }
  };

  const openSupplierAddModal = async (med = null) => {
    setSupplierFormError('');
    setNewCategoryName('');
    if (med) {
      setCreateNewFormulation(false);
      setSupplierAvailQty(med.supplierAvailableQuantity || 0);
      setSelectedSupplierMedId(med.id.toString());
      setFormData({
        name: med.name,
        code: med.code,
        genericName: med.genericName || '',
        manufacturer: med.manufacturer || '',
        price: med.price?.toString() || '',
        expiryDate: med.expiryDate || '',
        categoryId: med.category?.id?.toString() || '',
        initialQuantity: med.supplierAvailableQuantity || 0
      });
    } else {
      setCreateNewFormulation(true);
      setSupplierAvailQty(0);
      setSelectedSupplierMedId('');
      setFormData({
        name: '',
        code: '',
        genericName: '',
        manufacturer: '',
        price: '',
        expiryDate: '',
        categoryId: '',
        initialQuantity: 0
      });
    }
    setSupplierModalOpen(true);
  };

  const handleSaveSupplierAvailability = async (e) => {
    e.preventDefault();
    if (!createNewFormulation && !selectedSupplierMedId) {
      setSupplierFormError('Please select a medicine');
      return;
    }
    try {
      setSubmittingSupplierMed(true);
      setSupplierFormError('');
      let res;
      if (createNewFormulation) {
        const payload = {
          name: formData.name,
          code: formData.code,
          genericName: formData.genericName,
          manufacturer: formData.manufacturer,
          price: parseFloat(formData.price) || 0,
          expiryDate: formData.expiryDate || null,
          categoryId: formData.categoryId === 'NEW' ? null : (formData.categoryId ? parseInt(formData.categoryId) : null),
          categoryName: formData.categoryId === 'NEW' ? newCategoryName : null,
          initialQuantity: parseInt(supplierAvailQty) || 0
        };
        res = await api.post('/supplier/medicines', payload);
      } else {
        res = await api.put(`/supplier/medicines/${selectedSupplierMedId}/availability`, null, {
          params: { availableQuantity: parseInt(supplierAvailQty) || 0 }
        });
      }
      if (res.data.success) {
        setSupplierModalOpen(false);
        fetchMedicines();
      } else {
        setSupplierFormError(res.data.message || 'Failed to update medicine availability');
      }
    } catch (err) {
      setSupplierFormError(err.response?.data?.message || err.message || 'Error updating medicine availability');
    } finally {
      setSubmittingSupplierMed(false);
    }
  };

  const handleRemoveSupplierMedicine = async (medId, medName) => {
    if (window.confirm(`Are you sure you want to remove "${medName}" from your supplied medicines list?`)) {
      try {
        const res = await api.delete(`/supplier/medicines/${medId}`);
        if (res.data.success) {
          fetchMedicines();
        } else {
          alert(res.data.message || 'Failed to remove medicine');
        }
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Error removing medicine');
      }
    }
  };

  const fetchInitialFilters = async () => {
    try {
      const [catRes, supRes] = await Promise.all([
        api.get('/categories'),
        api.get('/suppliers')
      ]);
      if (catRes.data.success) setCategories(catRes.data.data);
      if (supRes.data.success) setSuppliers(supRes.data.data);
    } catch (err) {
      console.error('Error loading filter options', err);
    }
  };

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage - 1,
        size: pageSize
      };
      if (searchQuery.trim()) params.search = searchQuery;
      if (selectedCategory) params.categoryId = selectedCategory;
      if (selectedSupplier) params.supplierId = selectedSupplier;
      if (selectedStockStatus && selectedStockStatus !== 'ALL') params.stockStatus = selectedStockStatus;
      if (sortField) {
        params.sortBy = sortField;
        params.sortDirection = sortDirection || 'ASC';
      }

      const response = await api.get('/medicines', { params });
      if (response.data.success) {
        const pageData = response.data.data;
        setMedicines(pageData.content || []);
        setTotalPages(pageData.totalPages || 1);
        setTotalElements(pageData.totalElements || 0);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error loading medicines catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialFilters();
  }, []);

  // Sync dashboard links quick actions
  useEffect(() => {
    if (location.state && location.state.filterStatus) {
      setSelectedStockStatus(location.state.filterStatus);
      setSearchQuery('');
      setSelectedCategory('');
      setSelectedSupplier('');
      setSortField('');
      setSortDirection('');
      setCurrentPage(1);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Dynamic filter trigger with debouncing on search query
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchMedicines();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [currentPage, pageSize, searchQuery, selectedCategory, selectedSupplier, selectedStockStatus, sortField, sortDirection]);

  // Whenever filters change (except pagination), reset page to 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedSupplier, selectedStockStatus]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedSupplier('');
    setSelectedStockStatus('ALL');
    setSortField('');
    setSortDirection('');
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      if (sortDirection === 'ASC') {
        setSortDirection('DESC');
      } else {
        setSortField('');
        setSortDirection('');
      }
    } else {
      setSortField(field);
      setSortDirection('ASC');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ChevronsUpDown size={14} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />;
    }
    if (sortDirection === 'ASC') {
      return <ChevronUp size={14} style={{ color: 'var(--primary)' }} />;
    }
    return <ChevronDown size={14} style={{ color: 'var(--primary)' }} />;
  };

  const openCreateModal = () => {
    setEditingMedicine(null);
    setFormData({
      name: '',
      code: '',
      genericName: '',
      manufacturer: '',
      unitPrice: '',
      sellingPrice: '',
      price: '',
      expiryDate: '',
      batchNumber: '',
      categoryId: categories[0]?.id || '',
      supplierId: suppliers[0]?.id || '',
      initialQuantity: 0,
      reorderLevel: 10,
      maxQuantity: 100,
      locationRack: ''
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (medicine) => {
    setEditingMedicine(medicine);
    setFormData({
      name: medicine.name,
      code: medicine.code,
      genericName: medicine.genericName || '',
      manufacturer: medicine.manufacturer || '',
      unitPrice: medicine.unitPrice != null ? medicine.unitPrice.toString() : '',
      sellingPrice: medicine.sellingPrice != null ? medicine.sellingPrice.toString() : (medicine.price != null ? medicine.price.toString() : ''),
      price: medicine.price != null ? medicine.price.toString() : '',
      expiryDate: medicine.expiryDate || '',
      batchNumber: medicine.batchNumber || '',
      categoryId: medicine.category?.id || '',
      supplierId: medicine.supplier?.id || '',
      initialQuantity: medicine.currentStock || 0,
      reorderLevel: medicine.reorderLevel || 10,
      maxQuantity: 100,
      locationRack: ''
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Name and Code are required fields.');
      return;
    }

    const effectiveSelling = formData.sellingPrice || formData.price;
    if (!effectiveSelling) {
      setFormError('Selling price is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    const payload = {
      ...formData,
      unitPrice: formData.unitPrice ? parseFloat(formData.unitPrice) : null,
      sellingPrice: parseFloat(effectiveSelling),
      price: parseFloat(effectiveSelling),
      categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
      supplierId: formData.supplierId ? parseInt(formData.supplierId) : null,
      initialQuantity: parseInt(formData.initialQuantity) || 0,
      reorderLevel: parseInt(formData.reorderLevel) || 0,
      maxQuantity: parseInt(formData.maxQuantity) || 100
    };

    try {
      if (editingMedicine) {
        const response = await api.put(`/medicines/${editingMedicine.id}`, payload);
        if (response.data.success) {
          fetchMedicines();
          setModalOpen(false);
        } else {
          setFormError(response.data.message || 'Failed to update medicine');
        }
      } else {
        const response = await api.post('/medicines', payload);
        if (response.data.success) {
          fetchMedicines();
          setModalOpen(false);
        } else {
          setFormError(response.data.message || 'Failed to create medicine');
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error saving medicine details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}" from the inventory database?`)) {
      try {
        const response = await api.delete(`/medicines/${id}`);
        if (response.data.success) {
          fetchMedicines();
        } else {
          alert(response.data.message || 'Deletion failed');
        }
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Error occurred during deletion');
      }
    }
  };

  const renderStockBadge = (med) => {
    const statuses = Array.isArray(med.stockStatus) ? med.stockStatus : (med.stockStatus ? [med.stockStatus] : []);
    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {statuses.map((status, index) => {
          if (status === 'AVAILABLE') {
            return <span key={index} className="badge badge-success">Available</span>;
          }
          if (status === 'NEAR_EXPIRY') {
            return <span key={index} className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 600 }}>Near Expiry</span>;
          }
          if (status === 'LOW_STOCK') {
            return <span key={index} className="badge" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#f97316', fontWeight: 600 }}>Low Stock</span>;
          }
          if (status === 'EXPIRED') {
            return <span key={index} className="badge badge-danger pulse-red">Expired</span>;
          }
          if (status === 'OUT_OF_STOCK') {
            return <span key={index} className="badge" style={{ backgroundColor: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', fontWeight: 600 }}>Out Of Stock</span>;
          }
          return <span key={index} className="badge">{status}</span>;
        })}
      </div>
    );
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(
        <button
          key={i}
          className={`btn ${currentPage === i ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCurrentPage(i)}
          style={{ padding: '6px 12px', fontSize: '0.85rem', minWidth: '32px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  if (loading && medicines.length === 0) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading catalog...</div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div>
      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <Search />
          <input
            type="text"
            placeholder="Search medicines by name, code, generic formula, manufacturer..."
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '160px', height: '42px' }}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {!isSupplier && (
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              style={{ width: '160px', height: '42px' }}
            >
              <option value="">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          <select
            value={selectedStockStatus}
            onChange={(e) => setSelectedStockStatus(e.target.value)}
            style={{ width: '160px', height: '42px' }}
          >
            <option value="ALL">All Stock Status</option>
            <option value="AVAILABLE">Available</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out Of Stock</option>
            <option value="NEAR_EXPIRY">Near Expiry</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <button
            className="btn btn-secondary"
            onClick={handleResetFilters}
            title="Reset Filters"
            style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>

          {canModify && !isSupplier && (
            <button className="btn btn-secondary" onClick={openBulkPriceModal} style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={16} />
              <span>Bulk Set Sell Price</span>
            </button>
          )}

          {canModify && (
            <button className="btn btn-primary" onClick={openCreateModal} style={{ height: '42px' }}>
              <Plus size={16} />
              <span>Add Medicine</span>
            </button>
          )}

          {isSupplier && (
            <button className="btn btn-primary" onClick={() => openSupplierAddModal(null)} style={{ height: '42px' }}>
              <Plus size={16} />
              <span>Add Medicine to Supply List</span>
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {medicines.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
            No medicines listed.
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="medicines-table" style={{ position: 'relative' }}>
                <thead>
                  <tr>
                    <th className="col-code" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#0f172a' }}>Code</th>
                    <th
                      className="col-brand"
                      onClick={() => handleSort('NAME')}
                      style={{ cursor: 'pointer', position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#0f172a', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Brand Name
                        {getSortIcon('NAME')}
                      </div>
                    </th>
                    <th className="col-generic" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#0f172a' }}>Generic Formula</th>
                    <th
                      className="col-category"
                      onClick={() => handleSort('CATEGORY')}
                      style={{ cursor: 'pointer', position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#0f172a', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Category
                        {getSortIcon('CATEGORY')}
                      </div>
                    </th>
                    <th className="col-price" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#0f172a' }}>{isSupplier ? 'Price' : (isStaff ? 'Selling Price' : 'Purchase / Selling Price')}</th>
                    <th
                      className="col-stock"
                      onClick={() => handleSort('QUANTITY')}
                      style={{ cursor: 'pointer', position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#0f172a', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Stock
                        {getSortIcon('QUANTITY')}
                      </div>
                    </th>
                    <th className="col-status" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#0f172a' }}>Status</th>
                    <th
                      className="col-expiry"
                      onClick={() => handleSort('EXPIRY_DATE')}
                      style={{ cursor: 'pointer', position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#0f172a', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Expiry Date
                        {getSortIcon('EXPIRY_DATE')}
                      </div>
                    </th>
                    {!isSupplier && <th className="col-supplier" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#0f172a' }}>Supplier</th>}

                    {(canModify || isSupplier) && <th className="col-actions" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#0f172a', textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((med) => (
                    <tr key={med.id}>
                      <td><span className="badge badge-info">{med.code}</span></td>
                      <td>
                        <strong style={{ color: 'white' }}>{med.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{med.manufacturer}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{med.genericName || 'N/A'}</td>
                      <td>{med.category?.name || 'Unassigned'}</td>
                      <td>
                        {isSupplier ? (
                          <strong>{formatCurrency(med.price)}</strong>
                        ) : isStaff ? (
                          <strong>{med.sellingPrice != null ? formatCurrency(med.sellingPrice) : (med.price != null ? formatCurrency(med.price) : <span style={{ color: '#f59e0b', fontStyle: 'italic' }}>Unset</span>)}</strong>
                        ) : (
                          <>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Buy: </span>
                              <strong>{med.unitPrice != null ? formatCurrency(med.unitPrice) : 'N/A'}</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sell: </span>
                              <strong>{med.sellingPrice != null ? formatCurrency(med.sellingPrice) : (med.price != null ? formatCurrency(med.price) : <span style={{ color: '#f59e0b', fontStyle: 'italic' }}>Unset</span>)}</strong>
                            </div>
                          </>
                        )}
                      </td>
                      <td><strong>{med.currentStock || 0} unit(s)</strong></td>
                      <td>{renderStockBadge(med)}</td>
                      <td>{med.expiryDate || 'N/A'}</td>
                      {!isSupplier && (
                        <td>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {med.supplier?.name || 'Unassigned'}
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            <span className="badge badge-success" style={{ fontWeight: 600, textTransform: 'none' }}>
                              {med.supplierAvailableQuantity || 0} units
                            </span>
                          </div>
                        </td>
                      )}
                      {(canModify || isSupplier) && (
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {canModify && (
                              <>
                                <button
                                  className="btn-icon edit"
                                  onClick={() => openEditModal(med)}
                                  title="Edit Details"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  className="btn-icon delete"
                                  onClick={() => handleDelete(med.id, med.name)}
                                  title="Remove Medicine"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                            {isSupplier && (
                              <>
                                <button
                                  className="btn-icon edit"
                                  onClick={() => openSupplierAddModal(med)}
                                  title="Edit Available Quantity"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  className="btn-icon delete"
                                  onClick={() => handleRemoveSupplierMedicine(med.id, med.name)}
                                  title="Remove from Supply List"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--border-radius-md)', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> to <strong>{Math.min(currentPage * pageSize, totalElements)}</strong> of <strong>{totalElements}</strong> medicines
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '6px 12px', fontSize: '0.85rem', height: '34px' }}
                >
                  Previous
                </button>

                {renderPageNumbers()}

                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '6px 12px', fontSize: '0.85rem', height: '34px' }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Medicine Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '640px' }}>
            <div className="card-header-flex">
              <h3 style={{ fontFamily: 'Outfit, sans-serif' }}>
                {editingMedicine ? 'Edit Medicine Details' : 'Add New Medicine'}
              </h3>
              <button className="btn-icon" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert alert-danger">{formError}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Brand Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Paracetamol, Amoxicillin"
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="code">Unique Code *</label>
                  <input
                    type="text"
                    id="code"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    placeholder="e.g. MED-0012"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="genericName">Generic/Chemical Name</label>
                  <input
                    type="text"
                    id="genericName"
                    name="genericName"
                    value={formData.genericName}
                    onChange={handleInputChange}
                    placeholder="e.g. Acetaminophen"
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="manufacturer">Manufacturer</label>
                  <input
                    type="text"
                    id="manufacturer"
                    name="manufacturer"
                    value={formData.manufacturer}
                    onChange={handleInputChange}
                    placeholder="e.g. Pfizer, GSK"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-row">
                {!isStaff && (
                  <div className="form-group">
                    <label htmlFor="unitPrice">Purchase/Buying Cost (INR)</label>
                    <input
                      type="number"
                      step="0.01"
                      id="unitPrice"
                      name="unitPrice"
                      value={formData.unitPrice || ''}
                      onChange={handleInputChange}
                      placeholder="e.g. 45.00"
                      disabled={submitting}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="sellingPrice">Retail Selling Price (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    id="sellingPrice"
                    name="sellingPrice"
                    value={formData.sellingPrice || formData.price || ''}
                    onChange={handleInputChange}
                    placeholder="e.g. 60.00"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="expiryDate">Expiry Date</label>
                  <input
                    type="date"
                    id="expiryDate"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="batchNumber">Batch Number</label>
                  <input
                    type="text"
                    id="batchNumber"
                    name="batchNumber"
                    value={formData.batchNumber}
                    onChange={handleInputChange}
                    placeholder="e.g. BATCH-A99"
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="categoryId">Category Classification</label>
                  <select
                    id="categoryId"
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleInputChange}
                    disabled={submitting}
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="supplierId">Default Supplier</label>
                  <select
                    id="supplierId"
                    name="supplierId"
                    value={formData.supplierId}
                    onChange={handleInputChange}
                    disabled={submitting}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="locationRack">Storage Location (Rack)</label>
                  <input
                    type="text"
                    id="locationRack"
                    name="locationRack"
                    value={formData.locationRack}
                    onChange={handleInputChange}
                    placeholder="e.g. Rack-B4"
                    disabled={submitting}
                  />
                </div>
              </div>

              {!editingMedicine && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="initialQuantity">Initial Quantity</label>
                    <input
                      type="number"
                      id="initialQuantity"
                      name="initialQuantity"
                      value={formData.initialQuantity}
                      onChange={handleInputChange}
                      min="0"
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="reorderLevel">Reorder Warning Level</label>
                    <input
                      type="number"
                      id="reorderLevel"
                      name="reorderLevel"
                      value={formData.reorderLevel}
                      onChange={handleInputChange}
                      min="0"
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Medicine Availability Modal */}
      {supplierModalOpen && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '520px' }}>
            <div className="card-header-flex">
              <h3 style={{ fontFamily: 'Outfit, sans-serif' }}>Manage Supplied Medicine Availability</h3>
              <button className="btn-icon" onClick={() => setSupplierModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {supplierFormError && <div className="alert alert-danger">{supplierFormError}</div>}

            <form onSubmit={handleSaveSupplierAvailability}>
              {createNewFormulation ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Brand Name *</label>
                      <input 
                        type="text" 
                        value={formData.name} 
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Paracetamol"
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Unique Code *</label>
                      <input 
                        type="text" 
                        value={formData.code} 
                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                        placeholder="e.g. MED-0012"
                        required 
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Generic/Chemical Name</label>
                      <input 
                        type="text" 
                        value={formData.genericName} 
                        onChange={(e) => setFormData(prev => ({ ...prev, genericName: e.target.value }))}
                        placeholder="e.g. Acetaminophen"
                      />
                    </div>
                    <div className="form-group">
                      <label>Manufacturer</label>
                      <input 
                        type="text" 
                        value={formData.manufacturer} 
                        onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                        placeholder="e.g. GSK"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Unit Price (INR) *</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={formData.price} 
                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                        placeholder="0.00"
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Expiry Date</label>
                      <input 
                        type="date" 
                        value={formData.expiryDate} 
                        onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Category Classification</label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, categoryId: e.target.value }));
                        if (e.target.value !== 'NEW') {
                          setNewCategoryName('');
                        }
                      }}
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      <option value="NEW">+ Create New Category</option>
                    </select>
                    {formData.categoryId === 'NEW' && (
                      <input 
                        type="text" 
                        value={newCategoryName} 
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Enter new category name..."
                        required 
                        style={{ marginTop: '8px' }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Supplied Medicine
                  </span>
                  <h4 style={{ margin: '6px 0 0 0', color: 'white', fontWeight: 600, fontSize: '1.05rem', fontFamily: 'Outfit' }}>
                    {formData.name}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '4px', display: 'block', fontWeight: 500 }}>
                    Code: {formData.code}
                  </span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="supQtyInput">Available Supplier Quantity (Units) *</label>
                <input
                  id="supQtyInput"
                  type="number"
                  min="0"
                  value={supplierAvailQty}
                  onChange={(e) => setSupplierAvailQty(e.target.value)}
                  placeholder="e.g. 500"
                  disabled={submittingSupplierMed}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Specify how many units of this medicine your firm has currently ready for supply.
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSupplierModalOpen(false)} disabled={submittingSupplierMed}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingSupplierMed}>
                  {submittingSupplierMed ? 'Saving...' : 'Save to Supply List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Selling Price Modal */}
      {bulkPriceModalOpen && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '520px' }}>
            <div className="card-header-flex">
              <h3 style={{ fontFamily: 'Outfit, sans-serif' }}>Bulk Set Selling Price by Supplier</h3>
              <button className="btn-icon" onClick={() => setBulkPriceModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {bulkFormError && <div className="alert alert-danger">{bulkFormError}</div>}

            <form onSubmit={handleBulkPriceSubmit}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Select Supplier *</label>
                <select
                  value={bulkSupplierId}
                  onChange={(e) => setBulkSupplierId(e.target.value)}
                  disabled={submittingBulk}
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Pricing Mode *</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="bulkMode"
                      value="MARKUP"
                      checked={bulkMode === 'MARKUP'}
                      onChange={() => setBulkMode('MARKUP')}
                    />
                    Percentage Markup (+%) over Buying Price
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="bulkMode"
                      value="FIXED"
                      checked={bulkMode === 'FIXED'}
                      onChange={() => setBulkMode('FIXED')}
                    />
                    Flat Selling Price (INR)
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>
                  {bulkMode === 'MARKUP' ? 'Markup Percentage (%) *' : 'Flat Retail Selling Price (INR) *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder={bulkMode === 'MARKUP' ? 'e.g. 20 (for +20% markup)' : 'e.g. 50.00'}
                  disabled={submittingBulk}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {bulkMode === 'MARKUP' 
                    ? 'All medicines from this supplier will have selling price set to Buying Cost + % Markup.' 
                    : 'All medicines from this supplier will be updated to this exact retail selling price.'}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setBulkPriceModalOpen(false)} disabled={submittingBulk}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingBulk}>
                  {submittingBulk ? 'Updating...' : 'Apply Bulk Selling Price'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Medicines;
