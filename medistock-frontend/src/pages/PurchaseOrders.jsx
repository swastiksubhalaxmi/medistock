import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Trash2,
  Search,
  X,
  Clipboard,
  Eye,
  Calendar,
  User,
  DollarSign,
  Edit,
  RotateCcw,
  CheckCircle,
  Clock,
  IndianRupee,
  FileText
} from 'lucide-react';

const PurchaseOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierMedicines, setSupplierMedicines] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newOrderStatus, setNewOrderStatus] = useState('');

  // Create PO form states
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [lineItems, setLineItems] = useState([
    { supplierMedicineId: '', quantity: 1, unitPrice: 0 }
  ]);

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Role permissions
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const isAdminOrPharmacist = user?.roles?.some(role => ['ROLE_ADMIN', 'ROLE_PHARMACIST'].includes(role));
  const isSupplier = user?.roles?.includes('ROLE_SUPPLIER');

  const fetchData = async () => {
    try {
      setLoading(true);
      if (isSupplier) {
        const orderRes = await api.get('/purchase-orders');
        if (orderRes.data.success) setOrders(orderRes.data.data);
      } else {
        const [orderRes, supplierRes] = await Promise.all([
          api.get('/purchase-orders'),
          api.get('/suppliers')
        ]);

        if (orderRes.data.success) setOrders(orderRes.data.data);
        if (supplierRes.data.success) setSuppliers(supplierRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error loading purchase orders data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const loadSupplierMedicines = async (supplierId) => {
    if (!supplierId) {
      setSupplierMedicines([]);
      return;
    }
    try {
      const res = await api.get(`/suppliers/${supplierId}/medicines`);
      if (res.data.success) {
        const rawMedicines = res.data.data || [];
        const uniqueMedicines = [];
        const seenKeys = new Set();
        for (const med of rawMedicines) {
          const name = (med.name || '').trim().toLowerCase();
          const genericName = (med.genericName || '').trim().toLowerCase();
          const manufacturer = (med.manufacturer || '').trim().toLowerCase();
          const key = `${name}|${genericName}|${manufacturer}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueMedicines.push(med);
          }
        }
        setSupplierMedicines(uniqueMedicines);
      }
    } catch (err) {
      console.error('Error loading supplier medicines', err);
    }
  };

  // Load medicines dynamically when selectedSupplierId changes
  useEffect(() => {
    if (createModalOpen && selectedSupplierId) {
      loadSupplierMedicines(selectedSupplierId);
    }
  }, [selectedSupplierId, createModalOpen]);

  const openCreateModal = () => {
    const initialSupplierId = suppliers[0]?.id || '';
    setSelectedSupplierId(initialSupplierId);
    setLineItems([{ supplierMedicineId: '', quantity: 1, unitPrice: 0 }]);
    setFormError('');
    setCreateModalOpen(true);
    if (initialSupplierId) {
      loadSupplierMedicines(initialSupplierId);
    }
  };

  const handleAddLineItem = () => {
    const defaultMed = supplierMedicines[0];
    setLineItems(prev => [
      ...prev,
      { supplierMedicineId: defaultMed?.id?.toString() || '', quantity: 1, unitPrice: defaultMed?.price || 0 }
    ]);
  };

  const handleRemoveLineItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const showToast = (message, type = 'danger') => {
    const existingToasts = document.querySelectorAll('.po-toast-alert');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `alert alert-${type} po-toast-alert`;
    toast.innerText = message;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '99999';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  };

  const handleLineItemChange = (index, field, value) => {
    setLineItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;

      const updated = { ...item, [field]: value };

      if (field === 'supplierMedicineId') {
        const matchingMed = supplierMedicines.find(m => m.id.toString() === value.toString());
        if (matchingMed) {
          updated.unitPrice = matchingMed.price;
        }
      }

      if (field === 'quantity') {
        const valStr = value !== undefined && value !== null ? String(value).trim() : '';
        const numVal = parseInt(valStr, 10);
        if (valStr === '' || isNaN(numVal) || numVal < 1) {
          const msg = "Quantity cannot be null or negative.";
          setFormError(msg);
          updated.quantity = 1;
        } else {
          updated.quantity = numVal;
          setFormError('');
        }
      }

      return updated;
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      setFormError('Supplier selection is required.');
      return;
    }

    const hasInvalidQuantity = lineItems.some(item => {
      const valStr = item.quantity !== undefined && item.quantity !== null ? String(item.quantity).trim() : '';
      const numVal = parseInt(valStr, 10);
      return valStr === '' || isNaN(numVal) || numVal < 1;
    });

    if (hasInvalidQuantity) {
      const msg = "Quantity cannot be null or negative.";
      setFormError(msg);
      return;
    }

    const invalidItem = lineItems.some(item => !item.supplierMedicineId || !item.unitPrice);
    if (invalidItem) {
      setFormError('Please verify all items have a valid medicine selection and price.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    const payload = {
      supplierId: parseInt(selectedSupplierId),
      items: lineItems.map(item => ({
        supplierMedicineId: parseInt(item.supplierMedicineId),
        quantity: parseInt(item.quantity, 10),
        unitPrice: parseFloat(item.unitPrice)
      }))
    };

    try {
      const response = await api.post('/purchase-orders', payload);
      if (response.data.success) {
        setOrders(prev => [response.data.data, ...prev]);
        setCreateModalOpen(false);
      } else {
        setFormError(response.data.message || 'Failed to create purchase order');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error processing purchase order request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetails = (order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  const handleOpenStatusModal = (order) => {
    setSelectedOrder(order);
    setNewOrderStatus(order.status);
    setFormError('');
    setStatusModalOpen(true);
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const response = await api.patch(`/purchase-orders/${selectedOrder.id}/status`, null, {
        params: { status: newOrderStatus }
      });
      if (response.data.success) {
        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? response.data.data : o));
        setStatusModalOpen(false);
        if (detailModalOpen && selectedOrder?.id === response.data.data.id) {
          setSelectedOrder(response.data.data);
        }
      } else {
        setFormError(response.data.message || 'Failed to update order status');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error updating order status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatusDirect = async (orderId, targetStatus) => {
    try {
      setSubmitting(true);
      setFormError('');
      const response = await api.patch(`/purchase-orders/${orderId}/status`, null, {
        params: { status: targetStatus }
      });
      if (response.data.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? response.data.data : o));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(response.data.data);
        }

        // Show success toast
        const toast = document.createElement('div');
        toast.className = 'alert alert-success';
        toast.innerText = `Purchase Order status updated to ${targetStatus}`;
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '9999';
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
      } else {
        setFormError(response.data.message || 'Failed to update order status');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error updating order status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, orderNo) => {
    if (window.confirm(`Are you sure you want to delete purchase order "${orderNo}"?`)) {
      try {
        const response = await api.delete(`/purchase-orders/${id}`);
        if (response.data.success) {
          setOrders(prev => prev.filter(o => o.id !== id));
        } else {
          alert(response.data.message || 'Failed to delete order');
        }
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Error occurred during deletion');
      }
    }
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '₹0.00';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const calculateTotal = () => {
    for (const item of lineItems) {
      const valStr = item.quantity !== undefined && item.quantity !== null ? String(item.quantity).trim() : '';
      const numVal = parseInt(valStr, 10);
      if (valStr === '' || isNaN(numVal) || numVal < 1) {
        return 0;
      }
    }
    return lineItems.reduce((acc, item) => acc + (parseInt(item.quantity, 10) * parseFloat(item.unitPrice || 0)), 0);
  };

  const getExpectedDeliveryDate = (orderDateStr) => {
    if (!orderDateStr) return 'N/A';
    try {
      const d = new Date(orderDateStr);
      d.setDate(d.getDate() + 7);
      return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.createdByUsername?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading && orders.length === 0) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading orders database...</div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  // ============================================
  // SUPPLIER VIEW RENDER
  // ============================================
  if (isSupplier) {
    const totalPoValue = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
    const pendingCount = orders.filter(o => o.status === 'PENDING').length;
    const approvedCount = orders.filter(o => o.status === 'APPROVED' || o.status === 'SHIPPED').length;
    const receivedCount = orders.filter(o => o.status === 'RECEIVED').length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Header card */}
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
            <Clipboard size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
              Orders From MediStock
            </h2>
            <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              View and track purchase orders received from MediStock.
            </p>
          </div>
          <button
            className="btn-icon"
            onClick={fetchData}
            title="Refresh Orders"
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* 4 PO Metrics widgets */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div className="card stat-card blue">
            <div className="stat-info">
              <span className="stat-label">Total PO Value (INR)</span>
              <span className="stat-value">{formatCurrency(totalPoValue)}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Cumulative Order Amount
              </span>
            </div>
            <div className="stat-icon"><IndianRupee size={24} /></div>
          </div>

          <div className="card stat-card amber">
            <div className="stat-info">
              <span className="stat-label">Pending Approval</span>
              <span className="stat-value">{pendingCount}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '6px' }}>
                Awaiting Response
              </span>
            </div>
            <div className="stat-icon"><Clock size={24} /></div>
          </div>

          <div className="card stat-card blue">
            <div className="stat-info">
              <span className="stat-label">Approved Orders</span>
              <span className="stat-value">{approvedCount}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '6px' }}>
                Fulfillment In Progress
              </span>
            </div>
            <div className="stat-icon"><CheckCircle size={24} /></div>
          </div>

          <div className="card stat-card emerald">
            <div className="stat-info">
              <span className="stat-label">Received Shipments</span>
              <span className="stat-value">{receivedCount}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '6px' }}>
                Delivered & Confirmed
              </span>
            </div>
            <div className="stat-icon"><CheckCircle size={24} /></div>
          </div>
        </div>

        {/* Search bar */}
        <div className="search-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div className="search-input-wrap" style={{ flex: 1, minWidth: '280px' }}>
            <Search />
            <input
              type="text"
              placeholder="Search by PO order number or supplier name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '160px', height: '42px' }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="SHIPPED">SHIPPED</option>
              <option value="RECEIVED">RECEIVED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        {/* PO Table */}
        <div className="card">
          {filteredOrders.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
              No purchase orders found matching your query.
            </div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Order No.</th>
                    <th>Supplier Vendor</th>
                    <th>Order Date</th>
                    <th>Expected Delivery</th>
                    <th>Total Amount (INR)</th>
                    <th>Status</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => {
                    const formattedOrderDate = order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
                    return (
                      <tr key={order.id}>
                        <td><strong style={{ color: 'white' }}>{order.orderNumber}</strong></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{order.supplier?.name || 'Apex Health Pharma Distributors'}</td>
                        <td>{formattedOrderDate}</td>
                        <td>{getExpectedDeliveryDate(order.orderDate)}</td>
                        <td style={{ fontWeight: 550 }}>{formatCurrency(order.totalAmount)}</td>
                        <td>
                          <span className={`badge ${order.status === 'RECEIVED' ? 'badge-success' :
                              order.status === 'APPROVED' || order.status === 'SHIPPED' ? 'badge-info' :
                                order.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning'
                            }`} style={{ fontWeight: 600 }}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleOpenDetails(order)}
                              style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Eye size={12} />
                              <span>View PO</span>
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

        {/* CUSTOM DETAILED PO MODAL FOR SUPPLIER */}
        {detailModalOpen && selectedOrder && (
          <div className="modal-overlay">
            <div className="card modal-content" style={{ maxWidth: '680px', width: '100%' }}>
              <div className="card-header-flex" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.05em' }}>
                    {selectedOrder.orderNumber}
                  </div>
                  <h3 style={{ margin: '4px 0 0 0', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '1.25rem' }}>
                    Purchase Order Details
                  </h3>
                </div>
                <button className="btn-icon" onClick={() => setDetailModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              {formError && <div className="alert alert-danger" style={{ marginTop: '16px' }}>{formError}</div>}

              {/* Order Stats / Meta details */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px 24px',
                margin: '20px 0',
                background: 'rgba(255,255,255,0.02)',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem'
              }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '3px' }}>SUPPLIER</div>
                  <strong style={{ color: 'white' }}>{selectedOrder.supplier?.name}</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '3px' }}>STATUS</div>
                  <div>
                    <span className={`badge ${selectedOrder.status === 'RECEIVED' ? 'badge-success' :
                        selectedOrder.status === 'APPROVED' || selectedOrder.status === 'SHIPPED' ? 'badge-info' :
                          selectedOrder.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning'
                      }`} style={{ fontWeight: 600 }}>
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '3px' }}>ORDER DATE</div>
                  <strong style={{ color: 'white' }}>
                    {selectedOrder.orderDate ? new Date(selectedOrder.orderDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                  </strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '3px' }}>EXPECTED DELIVERY</div>
                  <strong style={{ color: 'white' }}>
                    {getExpectedDeliveryDate(selectedOrder.orderDate)}
                  </strong>
                </div>
              </div>

              {/* Ordered items list */}
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Outfit, sans-serif' }}>
                Line Items ({selectedOrder.items?.length || 0})
              </h4>
              <div className="table-responsive" style={{ maxHeight: '200px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong style={{ color: 'white', fontSize: '0.9rem' }}>{item.medicineName}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Qty: {item.quantity} x {formatCurrency(item.unitPrice)}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(item.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total block */}
              <div style={{
                marginTop: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                padding: '12px 18px',
                borderRadius: '8px'
              }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>TOTAL PURCHASE VALUE:</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--primary)', fontFamily: 'Outfit' }}>
                  {formatCurrency(selectedOrder.totalAmount)}
                </strong>
              </div>

              {/* Scribe Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedOrder.status === 'PENDING' && (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleUpdateStatusDirect(selectedOrder.id, 'APPROVED')}
                        disabled={submitting}
                        style={{ padding: '8px 20px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        {submitting ? 'Approving...' : 'Approve PO'}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleUpdateStatusDirect(selectedOrder.id, 'CANCELLED')}
                        disabled={submitting}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: 'none',
                          border: '1px solid var(--danger)',
                          color: 'var(--danger)'
                        }}
                      >
                        Cancel PO
                      </button>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => alert(`Downloading PDF invoice document for ${selectedOrder.orderNumber}...`)}
                    style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <FileText size={14} />
                    <span>PDF Invoice</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // ADMIN & PHARMACIST VIEW RENDER (DEFAULT)
  // ============================================
  return (
    <div>
      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <Search />
          <input
            type="text"
            placeholder="Search orders by PO#, supplier name, or creator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '160px', height: '42px' }}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          {isAdmin && (
            <button className="btn btn-primary" onClick={openCreateModal} style={{ height: '42px' }}>
              <Plus size={16} />
              <span>Generate PO</span>
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {filteredOrders.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
            No purchase orders found matching your query.
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th>PO Number</th>
                  <th>Supplier Vendor</th>
                  <th>Order Date</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, index) => {
                  const formattedDate = order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A';
                  return (
                    <tr key={order.id}>
                      <td>#{index + 1}</td>
                      <td><strong style={{ color: 'white' }}>{order.orderNumber}</strong></td>
                      <td>{order.supplier?.name}</td>
                      <td>{formattedDate}</td>
                      <td style={{ fontWeight: 550 }}>{formatCurrency(order.totalAmount)}</td>
                      <td>
                        <span className={`badge ${order.status === 'COMPLETED' || order.status === 'RECEIVED' ? 'badge-success' :
                            order.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning'
                          }`}>
                          {order.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn-icon view"
                            onClick={() => handleOpenDetails(order)}
                            title="View Details"
                          >
                            <Eye size={14} />
                          </button>
                          {(isAdminOrPharmacist || isSupplier) && (
                            <button
                              className="btn-icon edit"
                              onClick={() => handleOpenStatusModal(order)}
                              title="Update Status"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          {isAdminOrPharmacist && (
                            <button
                              className="btn-icon delete"
                              onClick={() => handleDelete(order.id, order.orderNumber)}
                              title="Delete Order"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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

      {/* Create Order Modal */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '720px' }}>
            <div className="card-header-flex">
              <h3 style={{ fontFamily: 'Outfit, sans-serif' }}>Generate Purchase Order</h3>
              <button className="btn-icon" onClick={() => setCreateModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert alert-danger">{formError}</div>}

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label htmlFor="supplierSelect">Target Supplier *</label>
                <select
                  id="supplierSelect"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  disabled={submitting}
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.contactPerson || 'No Rep'})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: '20px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 600 }}>Medicine Items List *</label>
                <button type="button" className="btn btn-secondary" onClick={handleAddLineItem} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                  + Add Line
                </button>
              </div>

              <div className="po-items-list">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="po-item-row">
                    <select
                      value={item.supplierMedicineId}
                      onChange={(e) => handleLineItemChange(idx, 'supplierMedicineId', e.target.value)}
                      disabled={submitting}
                      required
                    >
                      <option value="">Select Medicine</option>
                      {supplierMedicines.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.supplierAvailableQuantity !== undefined ? `— Avail: ${m.supplierAvailableQuantity} units` : ''}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          const currentVal = parseInt(item.quantity, 10);
                          if (isNaN(currentVal) || currentVal <= 1) {
                            e.preventDefault();
                            const msg = "Quantity cannot be null or negative.";
                            setFormError(msg);
                            handleLineItemChange(idx, 'quantity', 1);
                          }
                        }
                      }}
                      required
                      disabled={submitting}
                    />

                    <input
                      type="number"
                      step="0.01"
                      placeholder="Supplier Price"
                      value={item.unitPrice}
                      readOnly={true}
                      disabled={true}
                      title="Purchase price is locked to the price set by the supplier"
                      style={{ cursor: 'not-allowed', opacity: 0.8, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                      required
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(idx)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                      disabled={lineItems.length === 1 || submitting}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Calculated Total:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', fontFamily: 'Outfit' }}>
                  {formatCurrency(calculateTotal())}
                </span>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Issue Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {detailModalOpen && selectedOrder && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '640px' }}>
            <div className="card-header-flex">
              <h3 style={{ fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clipboard size={20} style={{ color: 'var(--primary)' }} />
                PO: {selectedOrder.orderNumber}
              </h3>
              <button className="btn-icon" onClick={() => setDetailModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Supplier</div>
                <div style={{ fontWeight: 600, color: 'white', marginTop: '4px' }}>{selectedOrder.supplier?.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rep: {selectedOrder.supplier?.contactPerson || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Order Status</div>
                <div style={{ marginTop: '4px' }}>
                  <span className={`badge ${selectedOrder.status === 'COMPLETED' || selectedOrder.status === 'RECEIVED' ? 'badge-success' :
                      selectedOrder.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning'
                    }`}>
                    {selectedOrder.status}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Order Date</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', marginTop: '4px' }}>
                  <Calendar size={14} /> {selectedOrder.orderDate ? new Date(selectedOrder.orderDate).toLocaleString() : 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Issued By</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', marginTop: '4px' }}>
                  <User size={14} /> {selectedOrder.createdByUsername || 'System'}
                </div>
              </div>
            </div>

            <label style={{ fontWeight: 600, display: 'block', marginBottom: '10px' }}>Ordered Items</label>
            <div className="table-responsive" style={{ maxHeight: '250px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((item) => (
                    <tr key={item.id}>
                      <td><strong style={{ color: 'white' }}>{item.medicineName}</strong></td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td><strong>{formatCurrency(item.totalPrice)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <span style={{ fontWeight: 600 }}>Grand Total:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', fontFamily: 'Outfit' }}>
                {formatCurrency(selectedOrder.totalAmount)}
              </span>
            </div>

            <div className="modal-footer" style={{ marginTop: '20px' }}>
              {(isAdminOrPharmacist || isSupplier) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleOpenStatusModal(selectedOrder);
                  }}
                  style={{ gap: '6px' }}
                >
                  <Edit size={14} />
                  <span>Change Status</span>
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setDetailModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {statusModalOpen && selectedOrder && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '400px' }}>
            <div className="card-header-flex">
              <h3 style={{ fontFamily: 'Outfit, sans-serif' }}>Update Status: {selectedOrder.orderNumber}</h3>
              <button className="btn-icon" onClick={() => setStatusModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {formError && <div className="alert alert-danger">{formError}</div>}

            <form onSubmit={handleStatusSubmit}>
              <div className="form-group">
                <label htmlFor="statusSelect">Select Order Status</label>
                <select
                  id="statusSelect"
                  value={newOrderStatus}
                  onChange={(e) => setNewOrderStatus(e.target.value)}
                  disabled={submitting}
                >
                  {isSupplier ? (
                    <>
                      {selectedOrder?.status === 'PENDING' && (
                        <>
                          <option value="PENDING">PENDING</option>
                          <option value="APPROVED">APPROVED (Accept)</option>
                          <option value="CANCELLED">CANCELLED (Reject)</option>
                        </>
                      )}
                      {selectedOrder?.status === 'APPROVED' && (
                        <>
                          <option value="APPROVED">APPROVED</option>
                          <option value="SHIPPED">SHIPPED</option>
                        </>
                      )}
                      {selectedOrder?.status === 'SHIPPED' && (
                        <option value="SHIPPED">SHIPPED</option>
                      )}
                      {selectedOrder?.status === 'RECEIVED' && (
                        <option value="RECEIVED">RECEIVED</option>
                      )}
                      {selectedOrder?.status === 'CANCELLED' && (
                        <option value="CANCELLED">CANCELLED</option>
                      )}
                    </>
                  ) : (
                    <>
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="SHIPPED">SHIPPED</option>
                      <option value="RECEIVED">RECEIVED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </>
                  )}
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStatusModalOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Applying...' : 'Apply Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
