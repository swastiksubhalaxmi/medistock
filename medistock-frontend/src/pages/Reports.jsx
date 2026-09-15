import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  Download, 
  Printer, 
  BarChart3, 
  AlertTriangle, 
  Clock, 
  ShoppingCart, 
  Pill, 
  Boxes,
  CheckCircle,
  Filter,
  History
} from 'lucide-react';

const Reports = () => {
  const { user } = useAuth();
  const isStaff = user?.roles?.includes('ROLE_STAFF') && !user?.roles?.includes('ROLE_ADMIN') && !user?.roles?.includes('ROLE_PHARMACIST');

  const [metrics, setMetrics] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(isStaff ? 'SALES_REPORT' : 'INVENTORY_SUMMARY');
  const [activePrintReport, setActivePrintReport] = useState(null);

  useEffect(() => {
    if (isStaff) {
      setSelectedReport('SALES_REPORT');
    }
  }, [isStaff]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setActivePrintReport(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    if (activePrintReport) {
      const timer = setTimeout(() => {
        window.print();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activePrintReport]);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        if (isStaff) {
          const salesRes = await api.get('/sales').catch(() => null);
          if (salesRes && salesRes.data && salesRes.data.success) {
            setSales(salesRes.data.data || []);
          }
        } else {
          const [dashRes, medRes, poRes] = await Promise.all([
            api.get('/dashboard').catch(() => null),
            api.get('/medicines').catch(() => null),
            api.get('/purchase-orders').catch(() => null)
          ]);

          if (dashRes && dashRes.data && dashRes.data.success) {
            setMetrics(dashRes.data.data);
          }

          if (medRes && medRes.data) {
            const list = Array.isArray(medRes.data) ? medRes.data : (medRes.data.data || []);
            setMedicines(list);
          }

          if (poRes && poRes.data && poRes.data.success) {
            setPurchaseOrders(poRes.data.data || []);
          }
        }
      } catch (err) {
        console.error('Error fetching report metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [isStaff]);

  const handleExportCSV = (type) => {
    const reportTypeToUse = type || selectedReport;
    let headers = [];
    let rows = [];
    let filename = 'medistock_report.csv';

    if (reportTypeToUse === 'SALES_REPORT') {
      filename = 'medistock_sales_report.csv';
      headers = ['Invoice Number', 'Date & Time', 'Customer Name', 'Customer Phone', 'Sold By', 'Payment Method', 'Total Amount', 'Discount Amount', 'Final Amount'];
      rows = sales.map(s => [
        s.invoiceNumber || 'N/A',
        s.saleDate ? new Date(s.saleDate).toLocaleString('en-IN') : 'N/A',
        s.customerName || 'Walk-in Customer',
        s.customerPhone || 'N/A',
        s.createdByUsername || 'N/A',
        s.paymentMethod || 'N/A',
        s.totalAmount || 0,
        s.discountAmount || 0,
        s.finalAmount || 0
      ]);
    } else if (reportTypeToUse === 'INVENTORY_SUMMARY') {
      filename = 'medistock_inventory_summary.csv';
      headers = ['Metric', 'Value'];
      rows = [
        ['Total Medicines Count', metrics?.totalMedicines || medicines.length || 0],
        ['Total Inventory Valuation', metrics?.totalInventoryValue || 0],
        ['Available Medicines', metrics?.availableMedicinesCount || 0],
        ['Low Stock Medicines Count', metrics?.lowStockMedicinesCount || 0],
        ['Out of Stock Count', metrics?.outOfStockMedicinesCount || 0],
        ['Near Expiry Count (<30d)', metrics?.nearExpiryMedicinesCount || 0],
        ['Expired Medicines Count', metrics?.expiredMedicinesCount || 0],
        ['Total Purchase Orders', metrics?.totalPurchaseOrders || 0],
        ['Total Suppliers', metrics?.totalSuppliers || 0],
      ];
    } else if (reportTypeToUse === 'LOW_STOCK') {
      filename = 'medistock_low_stock_audit.csv';
      headers = ['Code', 'Medicine Name', 'Current Stock', 'Reorder Level', 'Rack Location'];
      const lowStockItems = metrics?.lowStockItems || medicines.filter(m => (m.currentStock ?? m.quantity ?? 0) <= (m.reorderLevel ?? 10));
      rows = lowStockItems.map(i => [i.code || i.medicineCode, i.name || i.medicineName, i.currentStock ?? i.quantity, i.reorderLevel || 'N/A', i.locationRack || 'N/A']);
    } else if (reportTypeToUse === 'EXPIRY_REPORT') {
      filename = 'medistock_expiry_audit.csv';
      headers = ['Code', 'Medicine Name', 'Batch Number', 'Expiry Date', 'Days Remaining', 'Stock'];
      rows = medicines.map(m => {
        const exp = m.expiryDate ? new Date(m.expiryDate) : null;
        const days = exp ? Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24)) : 'N/A';
        return [m.code || `ID-${m.id}`, m.name, m.batchNumber || 'N/A', m.expiryDate || 'N/A', days, m.currentStock ?? m.quantity ?? 0];
      });
    } else {
      filename = 'medistock_purchase_orders.csv';
      headers = ['PO Number', 'Supplier', 'Date', 'Total Amount', 'Status'];
      rows = (metrics?.recentOrders || []).map(o => [o.orderNumber, o.supplier?.name || 'Supplier', o.orderDate || 'N/A', o.totalAmount, o.status]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reportsList = isStaff
    ? [
        {
          id: 'SALES_REPORT',
          title: 'Sales History & Revenue Audit Report',
          description: 'Detailed audit of sales transactions, customer receipts, payment methods, and revenue totals.',
          icon: <History size={22} style={{ color: 'var(--primary)' }} />,
          badge: 'Sales Audit'
        }
      ]
    : [
        {
          id: 'INVENTORY_SUMMARY',
          title: 'Full Inventory Telemetry & Asset Report',
          description: 'Comprehensive audit of total medicines, catalogue valuation, available stock, and supplier counts.',
          icon: <Boxes size={22} style={{ color: 'var(--primary)' }} />,
          badge: 'Core Audit'
        },
        {
          id: 'LOW_STOCK',
          title: 'Low Stock & Restock Priority Audit',
          description: 'Detailed watchlist of items reaching or falling below safety reorder levels.',
          icon: <AlertTriangle size={22} style={{ color: 'var(--warning)' }} />,
          badge: 'Action Required'
        },
        {
          id: 'EXPIRY_REPORT',
          title: 'Expiry Risk & Shelf-Life Telemetry Report',
          description: 'Complete breakdown of medicines expiring within 30, 60, 90 days, or already expired.',
          icon: <Clock size={22} style={{ color: 'var(--danger)' }} />,
          badge: 'Risk Audit'
        },
        {
          id: 'PURCHASE_ORDERS',
          title: 'Purchase Orders & Supplier History Report',
          description: 'Detailed transaction logs of all purchase orders placed with suppliers and delivery statuses.',
          icon: <ShoppingCart size={22} style={{ color: '#8b5cf6' }} />,
          badge: 'Procurement'
        }
      ];

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '₹0.00';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const renderSalesReport = () => {
    const totalRevenue = sales.reduce((acc, curr) => acc + (curr.finalAmount || 0), 0);

    return (
      <div className="print-report-portal">
        <div className="print-report-header">
          <h1 className="print-report-title">MediStock Inventory Management System</h1>
          <p className="print-report-meta">
            <strong>Report:</strong> Sales History & Revenue Audit Report <br />
            <strong>Generated:</strong> {new Date().toLocaleString('en-IN')} <br />
            <strong>Data Scope:</strong> Staff Sales Transactions & Revenue Metrics
          </p>
        </div>

        <h2 className="print-section-title">Sales Telemetry Summary</h2>
        <div className="print-grid">
          <div className="print-card">
            <div className="print-card-title">Total Sales Transactions</div>
            <div className="print-card-value">{sales.length}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Total Revenue Collected</div>
            <div className="print-card-value">{formatCurrency(totalRevenue)}</div>
          </div>
        </div>

        <h2 className="print-section-title">Sales Transactions Ledger</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date & Time</th>
              <th>Customer Name</th>
              <th>Customer Phone</th>
              <th>Sold By</th>
              <th>Payment Method</th>
              <th>Final Amount</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No sales records found in history.</td>
              </tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id || s.invoiceNumber}>
                  <td>{s.invoiceNumber}</td>
                  <td>{s.saleDate ? new Date(s.saleDate).toLocaleString('en-IN') : 'N/A'}</td>
                  <td>{s.customerName || 'Walk-in Customer'}</td>
                  <td>{s.customerPhone || 'N/A'}</td>
                  <td>{s.createdByUsername || 'N/A'}</td>
                  <td>{s.paymentMethod}</td>
                  <td>{formatCurrency(s.finalAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderInventorySummaryReport = () => {
    return (
      <div className="print-report-portal">
        <div className="print-report-header">
          <h1 className="print-report-title">MediStock Inventory Management System</h1>
          <p className="print-report-meta">
            <strong>Report:</strong> Full Inventory Telemetry & Asset Report <br />
            <strong>Generated:</strong> {new Date().toLocaleString('en-IN')} <br />
            <strong>Data Scope:</strong> Live Stock Metrics & Total Assets
          </p>
        </div>

        <h2 className="print-section-title">Telemetry Summary</h2>
        <div className="print-grid">
          <div className="print-card">
            <div className="print-card-title">Total Medicines Count</div>
            <div className="print-card-value">{medicines.length}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Total Catalogue Valuation</div>
            <div className="print-card-value">{formatCurrency(metrics?.totalInventoryValue)}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Available Medicines</div>
            <div className="print-card-value">{metrics?.availableMedicinesCount || 0}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Low Stock Watchlist</div>
            <div className="print-card-value">{metrics?.lowStockMedicinesCount || 0}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Out of Stock Items</div>
            <div className="print-card-value">{metrics?.outOfStockMedicinesCount || 0}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Near Expiry Watchlist (&lt;30d)</div>
            <div className="print-card-value">{metrics?.nearExpiryMedicinesCount || 0}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Expired Medicines</div>
            <div className="print-card-value">{metrics?.expiredMedicinesCount || 0}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Total Purchase Orders</div>
            <div className="print-card-value">{metrics?.totalPurchaseOrders || 0}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Active Suppliers</div>
            <div className="print-card-value">{metrics?.totalSuppliers || 0}</div>
          </div>
        </div>

        <h2 className="print-section-title">Complete Inventory Ledger</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Manufacturer</th>
              <th>Price</th>
              <th>Current Stock</th>
              <th>Total Value</th>
              <th>Expiry Date</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((m) => (
              <tr key={m.id}>
                <td>{m.code || `ID-${m.id}`}</td>
                <td>{m.name}</td>
                <td>{m.manufacturer || 'N/A'}</td>
                <td>{formatCurrency(m.price)}</td>
                <td>{m.currentStock ?? m.quantity ?? 0}</td>
                <td>{formatCurrency((m.currentStock ?? m.quantity ?? 0) * (m.price || 0))}</td>
                <td>{m.expiryDate || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderLowStockReport = () => {
    const lowStockItems = metrics?.lowStockItems || medicines.filter(m => (m.currentStock ?? m.quantity ?? 0) <= (m.reorderLevel ?? 10));
    return (
      <div className="print-report-portal">
        <div className="print-report-header">
          <h1 className="print-report-title">MediStock Inventory Management System</h1>
          <p className="print-report-meta">
            <strong>Report:</strong> Low Stock & Restock Priority Audit Watchlist <br />
            <strong>Generated:</strong> {new Date().toLocaleString('en-IN')} <br />
            <strong>Data Scope:</strong> Items reaching or falling below safety reorder threshold
          </p>
        </div>

        <h2 className="print-section-title">Audit Metrics</h2>
        <div className="print-grid">
          <div className="print-card">
            <div className="print-card-title">Low Stock Items Count</div>
            <div className="print-card-value">{lowStockItems.length}</div>
          </div>
        </div>

        <h2 className="print-section-title">Restock Priority Ledger</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Medicine Name</th>
              <th>Current Stock</th>
              <th>Reorder Level</th>
              <th>Deficit</th>
              <th>Rack Location</th>
            </tr>
          </thead>
          <tbody>
            {lowStockItems.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No low stock items currently detected.</td>
              </tr>
            ) : (
              lowStockItems.map((m) => {
                const current = m.currentStock ?? m.quantity ?? 0;
                const reorder = m.reorderLevel ?? 10;
                const deficit = reorder > current ? reorder - current : 0;
                return (
                  <tr key={m.id || m.code}>
                    <td>{m.code || m.medicineCode || 'N/A'}</td>
                    <td>{m.name || m.medicineName}</td>
                    <td>{current}</td>
                    <td>{reorder}</td>
                    <td>{deficit}</td>
                    <td>{m.locationRack || 'N/A'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderExpiryReport = () => {
    const getExpiryStatus = (days) => {
      if (days === 'N/A') return { label: 'Unknown', className: 'unknown' };
      if (days <= 0) return { label: 'Expired', className: 'expired' };
      if (days <= 30) return { label: 'Critical Risk', className: 'critical' };
      if (days <= 90) return { label: 'Near Expiry', className: 'warning' };
      return { label: 'Safe', className: 'safe' };
    };

    const medicinesWithExpiry = medicines.map(m => {
      const exp = m.expiryDate ? new Date(m.expiryDate) : null;
      const days = exp ? Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24)) : 'N/A';
      const status = getExpiryStatus(days);
      return {
        ...m,
        daysRemaining: days,
        status
      };
    }).sort((a, b) => {
      if (a.daysRemaining === 'N/A') return 1;
      if (b.daysRemaining === 'N/A') return -1;
      return a.daysRemaining - b.daysRemaining;
    });

    const expiredCount = medicinesWithExpiry.filter(m => m.daysRemaining !== 'N/A' && m.daysRemaining <= 0).length;
    const criticalCount = medicinesWithExpiry.filter(m => m.daysRemaining !== 'N/A' && m.daysRemaining > 0 && m.daysRemaining <= 30).length;
    const warningCount = medicinesWithExpiry.filter(m => m.daysRemaining !== 'N/A' && m.daysRemaining > 30 && m.daysRemaining <= 90).length;
    const safeCount = medicinesWithExpiry.filter(m => m.daysRemaining !== 'N/A' && m.daysRemaining > 90).length;

    return (
      <div className="print-report-portal">
        <div className="print-report-header">
          <h1 className="print-report-title">MediStock Inventory Management System</h1>
          <p className="print-report-meta">
            <strong>Report:</strong> Expiry Risk & Shelf-Life Telemetry Report <br />
            <strong>Generated:</strong> {new Date().toLocaleString('en-IN')} <br />
            <strong>Data Scope:</strong> Medicine shelf-life audit and risk telemetry
          </p>
        </div>

        <h2 className="print-section-title">Telemetry Summary</h2>
        <div className="print-grid">
          <div className="print-card">
            <div className="print-card-title">Expired Medicines</div>
            <div className="print-card-value" style={{ color: '#ef4444' }}>{expiredCount}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Critical Expiry (0-30 days)</div>
            <div className="print-card-value" style={{ color: '#f97316' }}>{criticalCount}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Near Expiry (31-90 days)</div>
            <div className="print-card-value" style={{ color: '#eab308' }}>{warningCount}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Safe Shelf-Life (&gt;90 days)</div>
            <div className="print-card-value" style={{ color: '#22c55e' }}>{safeCount}</div>
          </div>
        </div>

        <h2 className="print-section-title">Shelf-Life Risk Watchlist</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Medicine Name</th>
              <th>Batch Number</th>
              <th>Expiry Date</th>
              <th>Days Remaining</th>
              <th>Stock Level</th>
              <th>Risk Status</th>
            </tr>
          </thead>
          <tbody>
            {medicinesWithExpiry.map((m) => (
              <tr key={m.id}>
                <td>{m.code || `ID-${m.id}`}</td>
                <td>{m.name}</td>
                <td>{m.batchNumber || 'N/A'}</td>
                <td>{m.expiryDate || 'N/A'}</td>
                <td>
                  {m.daysRemaining === 'N/A' ? 'N/A' : m.daysRemaining <= 0 ? `EXPIRED (${Math.abs(m.daysRemaining)}d ago)` : `${m.daysRemaining} days`}
                </td>
                <td>{m.currentStock ?? m.quantity ?? 0}</td>
                <td>
                  <span className={`print-status ${m.status.className}`}>
                    {m.status.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPurchaseOrdersReport = () => {
    const ordersToUse = purchaseOrders.length > 0 ? purchaseOrders : (metrics?.recentOrders || []);
    const totalSpend = ordersToUse.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    return (
      <div className="print-report-portal">
        <div className="print-report-header">
          <h1 className="print-report-title">MediStock Inventory Management System</h1>
          <p className="print-report-meta">
            <strong>Report:</strong> Purchase Orders & Supplier History Report <br />
            <strong>Generated:</strong> {new Date().toLocaleString('en-IN')} <br />
            <strong>Data Scope:</strong> Procurement transaction history and order telemetry
          </p>
        </div>

        <h2 className="print-section-title">Procurement Spend Summary</h2>
        <div className="print-grid">
          <div className="print-card">
            <div className="print-card-title">Total Orders Count</div>
            <div className="print-card-value">{ordersToUse.length}</div>
          </div>
          <div className="print-card">
            <div className="print-card-title">Total Spend Valuation</div>
            <div className="print-card-value">{formatCurrency(totalSpend)}</div>
          </div>
        </div>

        <h2 className="print-section-title">Procurement Ledger</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Order Date</th>
              <th>Ordered Items</th>
              <th>Total Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ordersToUse.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No purchase orders found in history.</td>
              </tr>
            ) : (
              ordersToUse.map((o) => {
                const formattedDate = o.orderDate ? new Date(o.orderDate).toLocaleDateString('en-IN') : 'N/A';
                const itemsList = o.items ? o.items.map(item => `${item.medicineName} x ${item.quantity}`).join(', ') : 'N/A';
                return (
                  <tr key={o.id || o.orderNumber}>
                    <td>{o.orderNumber}</td>
                    <td>{o.supplier?.name || 'N/A'}</td>
                    <td>{formattedDate}</td>
                    <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={itemsList}>
                      {itemsList}
                    </td>
                    <td>{formatCurrency(o.totalAmount)}</td>
                    <td style={{ fontWeight: 600 }}>{o.status}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderActivePrintReport = () => {
    if (!activePrintReport) return null;
    switch (activePrintReport) {
      case 'SALES_REPORT':
        return renderSalesReport();
      case 'INVENTORY_SUMMARY':
        return renderInventorySummaryReport();
      case 'LOW_STOCK':
        return renderLowStockReport();
      case 'EXPIRY_REPORT':
        return renderExpiryReport();
      case 'PURCHASE_ORDERS':
        return renderPurchaseOrdersReport();
      default:
        return null;
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading report metrics...</div>;
  }

  const staffTotalRevenue = sales.reduce((acc, curr) => acc + (curr.finalAmount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Page Title Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} style={{ color: 'var(--primary)' }} />
            {isStaff ? 'Staff Sales Report Center' : 'Reports & Analytical Export Center'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {isStaff 
              ? 'View transaction metrics, export CSV sales reports, and print sales summaries.' 
              : 'Generate, download CSV, and print PDF inventory compliance reports.'}
          </p>
        </div>
      </div>

      {/* Available Reports Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {reportsList.map(rep => {
          const isSelected = selectedReport === rep.id;

          return (
            <div
              key={rep.id}
              onClick={() => setSelectedReport(rep.id)}
              className="card"
              style={{
                padding: '20px',
                borderLeft: isSelected ? '4px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: isSelected ? 'var(--bg-subtle)' : 'var(--bg-card)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {rep.icon}
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                    {rep.badge}
                  </span>
                </div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                  {rep.title}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  {rep.description}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleExportCSV(rep.id); }}
                  className="btn btn-primary"
                  style={{ flex: 1, height: '36px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActivePrintReport(rep.id); }}
                  className="btn btn-secondary"
                  style={{ height: '36px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Printer size={14} />
                  <span>Print PDF</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff Interactive Sales Preview */}
      {isStaff && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white', fontFamily: 'Outfit, sans-serif' }}>
              Sales History Audit & Revenue Overview
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleExportCSV('SALES_REPORT')}
                className="btn btn-primary"
                style={{ height: '34px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} />
                <span>Export Sales CSV</span>
              </button>
              <button
                onClick={() => setActivePrintReport('SALES_REPORT')}
                className="btn btn-secondary"
                style={{ height: '34px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={14} />
                <span>Print Sales PDF</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Sales Count</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', marginTop: '4px' }}>{sales.length}</div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Sales Revenue</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>{formatCurrency(staffTotalRevenue)}</div>
            </div>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date & Time</th>
                  <th>Customer Name</th>
                  <th>Sold By</th>
                  <th>Pay Mode</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                      No sales records available.
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id || s.invoiceNumber}>
                      <td>
                        <strong style={{ color: 'var(--primary)' }}>{s.invoiceNumber}</strong>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {s.saleDate ? new Date(s.saleDate).toLocaleString('en-IN') : 'N/A'}
                      </td>
                      <td>
                        <span style={{ color: 'white', fontWeight: 500 }}>{s.customerName || 'Walk-in Customer'}</span>
                        {s.customerPhone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.customerPhone}</div>}
                      </td>
                      <td style={{ color: 'white' }}>{s.createdByUsername || 'N/A'}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: s.paymentMethod === 'CASH' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: s.paymentMethod === 'CASH' ? 'var(--warning)' : 'var(--primary)'
                        }}>
                          {s.paymentMethod}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                        {formatCurrency(s.finalAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print Portal */}
      {activePrintReport && createPortal(
        <>
          <style>{`
            @media print {
              #root, .app-wrapper, .sidebar, .main-content, .top-header {
                display: none !important;
              }
              
              .print-report-portal {
                display: block !important;
                background: white !important;
                color: black !important;
                font-family: 'Inter', 'Outfit', sans-serif !important;
                width: 100% !important;
                padding: 20px !important;
                margin: 0 !important;
                box-sizing: border-box !important;
              }

              .print-report-header {
                border-bottom: 2px solid #1e293b;
                padding-bottom: 12px;
                margin-bottom: 20px;
              }

              .print-report-title {
                font-size: 20px;
                font-weight: 700;
                color: #1e293b;
                margin: 0 0 6px 0;
                text-transform: uppercase;
              }

              .print-report-meta {
                font-size: 12px;
                color: #64748b;
                margin: 0;
              }

              .print-section-title {
                font-size: 14px;
                font-weight: 600;
                color: #334155;
                margin: 20px 0 10px 0;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }

              .print-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
                font-size: 11px;
              }

              .print-table th {
                background-color: #f1f5f9 !important;
                color: #1e293b !important;
                font-weight: 600;
                text-align: left;
                padding: 8px 10px;
                border: 1px solid #cbd5e1;
              }

              .print-table td {
                padding: 8px 10px;
                border: 1px solid #cbd5e1;
                color: #0f172a;
              }

              .print-table tr {
                page-break-inside: avoid;
              }

              .print-status {
                font-weight: 600;
                font-size: 10px;
                text-transform: uppercase;
              }
              .print-status.expired { color: #ef4444 !important; }
              .print-status.critical { color: #f97316 !important; }
              .print-status.warning { color: #eab308 !important; }
              .print-status.safe { color: #22c55e !important; }

              .print-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 20px;
              }

              .print-card {
                border: 1px solid #cbd5e1;
                padding: 10px;
                border-radius: 6px;
                background-color: #f8fafc;
                page-break-inside: avoid;
              }

              .print-card-title {
                font-size: 10px;
                color: #64748b;
                text-transform: uppercase;
                font-weight: 600;
                margin: 0 0 4px 0;
              }

              .print-card-value {
                font-size: 16px;
                font-weight: 700;
                color: #0f172a;
                margin: 0;
              }
            }

            @media screen {
              .print-report-portal {
                display: none !important;
              }
            }
          `}</style>
          {renderActivePrintReport()}
        </>,
        document.body
      )}
    </div>
  );
};

export default Reports;
