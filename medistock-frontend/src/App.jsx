import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Medicines from './pages/Medicines';
import Categories from './pages/Categories';
import Suppliers from './pages/Suppliers';
import StockMovements from './pages/StockMovements';
import PurchaseOrders from './pages/PurchaseOrders';
import Users from './pages/Users';
import Billing from './pages/Billing';
import SalesHistory from './pages/SalesHistory';
import SupplierDashboard from './pages/supplier/SupplierDashboard';
import SupplierProfile from './pages/supplier/SupplierProfile';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Expiry from './pages/Expiry';
import Reports from './pages/Reports';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Authenticated routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Dashboard accessible by all roles */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/expiry" element={<Expiry />} />
              <Route path="/reports" element={<Reports />} />

              {/* Supplier Dashboard accessible by Supplier */}
              <Route element={<ProtectedRoute allowedRoles={['ROLE_SUPPLIER']} />}>
                <Route path="/supplier/dashboard" element={<SupplierDashboard />} />
                <Route path="/supplier/profile" element={<SupplierProfile />} />
              </Route>

              {/* Profile accessible by all authenticated roles */}
              <Route path="/profile" element={<Profile />} />

              {/* Notifications accessible by Admin, Pharmacist, Staff, and Supplier */}
              <Route element={<ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF', 'ROLE_SUPPLIER']} />}>
                <Route path="/notifications" element={<Notifications />} />
              </Route>

              {/* Medicines catalog accessible by all roles */}
              <Route path="/medicines" element={<Medicines />} />

              {/* Category accessible by Admin, Pharmacist, Staff, and Supplier */}
              <Route element={<ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF', 'ROLE_SUPPLIER']} />}>
                <Route path="/categories" element={<Categories />} />
              </Route>

              {/* Billing and Sales accessible by Admin, Pharmacist, and Staff */}
              <Route element={<ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF']} />}>
                <Route path="/billing" element={<Billing />} />
                <Route path="/sales" element={<SalesHistory />} />
              </Route>

              {/* Suppliers accessible by Admin, Pharmacist */}
              <Route element={<ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_PHARMACIST']} />}>
                <Route path="/suppliers" element={<Suppliers />} />
              </Route>


              {/* Stock Movements accessible by Admin, Pharmacist, and Staff */}
              <Route element={<ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF']} />}>
                <Route path="/stock-movements" element={<StockMovements />} />
              </Route>

              {/* Purchase Orders accessible by Admin, Pharmacist, and Supplier */}
              <Route element={<ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_SUPPLIER']} />}>
                <Route path="/purchase-orders" element={<PurchaseOrders />} />
              </Route>

              {/* Users Control only accessible by Admin */}
              <Route element={<ProtectedRoute allowedRoles={['ROLE_ADMIN']} />}>
                <Route path="/users" element={<Users />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
