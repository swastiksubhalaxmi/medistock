import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import {
  LayoutDashboard,
  Pill,
  Tags,
  Truck,
  Warehouse,
  ClipboardList,
  Users as UsersIcon,
  LogOut,
  Activity,
  Receipt,
  History,
  User,
  MessageSquare,
  Clock,
  FileText,
  Bell,
  Sun,
  Moon,
  Calendar,
  RotateCw,
  BarChart3,
  Settings
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
  };

  const getUserThemeKey = (u) => {
    const userIdentifier = u?.id ? `id_${u.id}` : u?.username ? `user_${u.username}` : 'guest';
    return `medistock_theme_${userIdentifier}`;
  };

  const [theme, setTheme] = useState(() => {
    const key = getUserThemeKey(user);
    return localStorage.getItem(key) || 'dark';
  });

  useEffect(() => {
    const key = getUserThemeKey(user);
    const savedTheme = localStorage.getItem(key) || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, [user?.id, user?.username]);

  useEffect(() => {
    const key = getUserThemeKey(user);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(key, theme);
  }, [theme, user?.id, user?.username]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      if (res.data.success && Array.isArray(res.data.data)) {
        const allAlerts = res.data.data;
        const readStorageKey = `medistock_read_notifications_${user.id || user.username}`;
        const readIds = JSON.parse(localStorage.getItem(readStorageKey) || '[]');
        const unread = allAlerts.filter(a => !readIds.includes(a.id)).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error('Error fetching unread notification count:', err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  const menuItems = [
    {
      path: '/',
      label: 'Dashboard',
      icon: <LayoutDashboard size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_DOCTOR', 'ROLE_USER', 'ROLE_STAFF', 'ROLE_SUPPLIER']
    },
    {
      path: '/messages',
      label: 'Messages',
      icon: <MessageSquare size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF', 'ROLE_SUPPLIER', 'ROLE_DOCTOR']
    },
    {
      path: '/medicines',
      label: 'Medicines',
      icon: <Pill size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_DOCTOR', 'ROLE_SUPPLIER', 'ROLE_USER', 'ROLE_STAFF']
    },
    {
      path: '/expiry',
      label: 'Expiry',
      icon: <Clock size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF']
    },
    {
      path: '/categories',
      label: 'Categories',
      icon: <Tags size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF', 'ROLE_SUPPLIER']
    },
    {
      path: '/suppliers',
      label: 'Suppliers',
      icon: <Truck size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST']
    },
    {
      path: '/stock-movements',
      label: 'Inventory',
      icon: <Warehouse size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF']
    },
    {
      path: '/purchase-orders',
      label: 'Purchase Orders',
      icon: <ClipboardList size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_SUPPLIER']
    },
    {
      path: '/billing',
      label: 'Billing / POS',
      icon: <Receipt size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF']
    },
    {
      path: '/sales',
      label: 'Sales History',
      icon: <History size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF']
    },
    {
      path: '/users',
      label: 'Users & Roles',
      icon: <UsersIcon size={18} />,
      roles: ['ROLE_ADMIN']
    },
    {
      path: '/reports',
      label: 'Reports',
      icon: <FileText size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF']
    },
    {
      path: '/notifications',
      label: 'Notifications',
      icon: <Bell size={18} />,
      roles: ['ROLE_ADMIN', 'ROLE_PHARMACIST', 'ROLE_STAFF', 'ROLE_SUPPLIER']
    },
    {
      path: '/profile',
      label: 'Profile',
      icon: <User size={18} />,
      roles: ['ROLE_SUPPLIER']
    }
  ];

  // Filter items matching user's roles
  const filteredMenuItems = menuItems.filter(item =>
    item.roles.some(role => user?.roles?.includes(role))
  );

  const isStaff = user?.roles?.includes('ROLE_STAFF');

  const getPageTitle = () => {
    const isSupplier = user?.roles?.includes('ROLE_SUPPLIER');
    const currentItem = menuItems.find(item => item.path === location.pathname);
    if (currentItem) {
      if (isSupplier && currentItem.path === '/purchase-orders') {
        return 'Orders From MediStock';
      }
      if (currentItem.label === 'Dashboard') {
        if (user?.roles?.includes('ROLE_ADMIN')) {
          return 'Admin Dashboard';
        } else if (user?.roles?.includes('ROLE_PHARMACIST')) {
          return 'Pharmacist Dashboard';
        } else if (user?.roles?.includes('ROLE_STAFF')) {
          return 'Staff Dashboard';
        }
      }
      return currentItem.label;
    }
    return 'MediStock Inventory';
  };

  const getUserRoleLabel = () => {
    if (!user?.roles || user.roles.length === 0) return 'User';
    return user.roles.map(role => {
      const upperRole = role.toUpperCase();
      switch (upperRole) {
        case 'ROLE_ADMIN': return 'Admin';
        case 'ROLE_PHARMACIST': return 'Pharmacist';
        case 'ROLE_STAFF': return 'Staff';
        case 'ROLE_SUPPLIER': return 'Supplier';
        case 'ROLE_DOCTOR': return 'Doctor';
        case 'ROLE_USER': return 'User';
        default:
          const clean = role.replace(/^ROLE_/i, '');
          return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
      }
    }).join(', ');
  };

  return (
    <div className="app-wrapper">
      {/* Sidebar Layout */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Activity size={24} style={{ color: 'var(--primary)' }} />
          <span className="logo-text">MEDISTOCK</span>
        </div>

        <nav className={`sidebar-menu ${isStaff ? 'no-scroll' : ''}`}>
          {filteredMenuItems.map((item) => {
            const isSupplier = user?.roles?.includes('ROLE_SUPPLIER');
            const isActive = location.pathname === item.path || (isSupplier && item.path === '/' && location.pathname === '/supplier/dashboard');
            const label = isSupplier && item.path === '/purchase-orders' ? 'Orders From MediStock' : item.label;
            const isNotificationItem = item.path === '/notifications';

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`menu-item ${isActive ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '12px', position: 'relative' }}
              >
                {item.icon}
                <span style={{ fontWeight: isActive ? 600 : 500 }}>{label}</span>

                {isNotificationItem && unreadCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    lineHeight: 1
                  }}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content min-w-0">
        <header className="top-header">
          <div className="header-title">
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{getPageTitle()}</h1>
            {location.pathname === '/' && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
                Welcome back, {user?.username || 'User'}! Here's what's happening with your inventory today.
              </p>
            )}
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Sync / Refresh Button */}
            <button
              onClick={() => window.location.reload()}
              title="Refresh Telemetry"
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                padding: 0
              }}
            >
              <RotateCw size={15} />
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              title="Toggle Light Mode"
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                padding: 0
              }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Notification Bell */}
            <Link 
              to="/notifications" 
              title="Notifications"
              style={{ 
                color: 'var(--text-main)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* User Avatar Badge Dropdown */}
            <div 
              ref={dropdownRef}
              style={{ position: 'relative' }}
            >
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="user-profile-badge-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {user?.username ? user.username.substring(0, 2).toUpperCase() : 'AD'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {user?.username || 'User'} <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>▼</span>
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: 1.1 }}>{getUserRoleLabel()}</span>
                </div>
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '8px',
                  width: '160px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '6px 0',
                }}>
                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      color: 'var(--text-secondary)',
                      textDecoration: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      transition: 'background-color 0.2s ease, color 0.2s ease',
                    }}
                    className="dropdown-item"
                  >
                    <User size={15} style={{ color: 'var(--primary)' }} />
                    <span>My Profile</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      color: 'var(--text-secondary)',
                      background: 'none',
                      border: 'none',
                      width: '100%',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease, color 0.2s ease',
                    }}
                    className="dropdown-item"
                  >
                    <LogOut size={15} style={{ color: '#ef4444' }} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
