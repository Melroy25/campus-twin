import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { queryDocuments, getById } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import {
  MdDashboard, MdHotel, MdFlightTakeoff, MdReceipt,
  MdChat, MdBook, MdLogout, MdNotifications,
  MdDarkMode, MdLightMode, MdMenu, MdClose, MdPerson,
  MdCampaign
} from 'react-icons/md';
import logoImage from '../../assets/about-section-college.jpg';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationDropdown from '../NotificationDropdown';

export default function HostelLayout({ children, activeTab, setActiveTab, role, hostelType }) {
  const { userProfile, logout, currentUser } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);
  const [hostelMaintenance, setHostelMaintenance] = useState(false);

  const notifUserId = role === 'warden' ? 'warden' : (currentUser?.uid || 'guest');
  const {
    notifications,
    unreadCount,
    resetUnreadCount,
    dismissNotification,
    clearAll,
    pendingDismissList,
    undoDismiss
  } = useNotifications(notifUserId);

  // Sync theme status
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.body.classList.add('dark-theme');
      setIsDark(true);
    }
  }, []);

  // Sync hostel maintenance status
  useEffect(() => {
    const checkHostelMaintenance = async () => {
      try {
        const doc = await getById('hostelNotices', `hostel_settings_${hostelType}`);
        if (doc && doc.content) {
          const parsed = JSON.parse(doc.content);
          if (parsed && parsed.maintenance_mode) {
            setHostelMaintenance(true);
            if (role === 'student' && !['chat', 'updates', 'rules'].includes(activeTab)) {
              setActiveTab('chat');
            }
          } else {
            setHostelMaintenance(false);
          }
        } else {
          setHostelMaintenance(false);
        }
      } catch (e) {
        console.warn("Failed to check hostel maintenance:", e);
      }
    };
    checkHostelMaintenance();
  }, [activeTab, role, hostelType, setActiveTab]);

  const toggleTheme = () => {
    if (isDark) {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  // Close notifications on click outside
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);



  const handleLogout = async () => {
    if (role === 'warden') {
      localStorage.removeItem('hostel_warden_session');
      toast.success('Logged out from Warden Portal');
      navigate('/hostel/login');
    } else {
      navigate('/');
    }
  };

  const menuItems = role === 'warden' ? [
    { id: 'dashboard', label: 'Dashboard', icon: <MdDashboard /> },
    { id: 'rooms', label: 'Room Management', icon: <MdHotel /> },
    { id: 'complaints', label: 'Complaints Admin', icon: <MdBook /> },
    { id: 'leaves', label: 'Leaves Admin', icon: <MdFlightTakeoff /> },
    { id: 'bills', label: 'Bills & Fees', icon: <MdReceipt /> },
    { id: 'updates', label: 'Updates & Polls', icon: <MdCampaign /> },
    { id: 'chat', label: 'Hostel Chat', icon: <MdChat /> },
    { id: 'rules', label: 'Rules & Guide', icon: <MdBook /> }
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: <MdDashboard /> },
    { id: 'rooms', label: 'Room Allocation', icon: <MdHotel /> },
    { id: 'complaints', label: 'File Complaint', icon: <MdBook /> },
    { id: 'leaves', label: 'Leave Requests', icon: <MdFlightTakeoff /> },
    { id: 'bills', label: 'Bills & Payments', icon: <MdReceipt /> },
    { id: 'updates', label: 'Hostel Updates', icon: <MdCampaign /> },
    { id: 'chat', label: 'Hostel Chat', icon: <MdChat /> },
    { id: 'rules', label: 'Hostel Rules', icon: <MdBook /> }
  ];

  let filteredMenuItems = [...menuItems];
  if (role === 'student' && hostelMaintenance) {
    filteredMenuItems = filteredMenuItems.filter(item => ['chat', 'updates', 'rules'].includes(item.id));
  }

  // Theme configuration colors
  const accentColor = hostelType === 'girls' ? '#ec4899' : '#3b82f6';
  const accentBgLight = hostelType === 'girls' ? '#fce7f3' : '#dbeafe';


  return (
    <div className="app-layout">
      {/* Sidebar overlay on mobile */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{ borderRight: `1px solid var(--border)` }}>
        <div className="sidebar-logo" style={{ borderBottom: `1px solid var(--border)` }}>
          <img src={logoImage} alt="Campus Twin Logo" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '8px' }} />
          <div>
            <div className="sidebar-logo-text" style={{ fontSize: '0.98rem' }}>Campus Twin</div>
            <div className="sidebar-logo-sub" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: accentColor, fontWeight: 700 }}>
              {hostelType === 'girls' ? 'Girls Hostel' : 'Boys Hostel'}
            </div>
          </div>
          <button className="sidebar-close-btn" style={{ display: 'none', marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)' }} onClick={() => setSidebarOpen(false)}>
            <MdClose />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label" style={{ color: accentColor }}>
            {role === 'warden' ? 'Warden Console' : 'Student Portal'}
          </div>
          {filteredMenuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <div
                key={item.id}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                style={{
                  color: isActive ? 'white' : undefined,
                  background: isActive ? accentColor : undefined,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-text">{item.label}</span>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer" style={{ borderTop: `1px solid var(--border)` }}>
          <button
            onClick={handleLogout}
            className="btn btn-outline btn-block"
            style={{ borderColor: accentColor, color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <MdLogout /> {role === 'warden' ? 'Warden Log Out' : 'Exit Hostel'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="header" style={{ borderBottom: `1px solid var(--border)`, background: 'var(--surface-1)' }}>
          <div className="header-left">
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>
              <MdMenu />
            </button>
            <span className="header-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>
              {hostelType === 'girls'
                ? (role === 'warden' ? 'Girls Warden Portal' : 'Girls Student Portal')
                : (role === 'warden' ? 'Boys Warden Portal' : 'Boys Student Portal')
              }
            </span>
          </div>

          <div className="header-right">
            {/* Theme Toggle */}
            <button className="notif-btn" onClick={toggleTheme} style={{ marginRight: 10 }}>
              {isDark ? <MdLightMode /> : <MdDarkMode />}
            </button>

            {/* Notification Bell */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                className="notif-btn"
                onClick={() => setShowNotif((v) => {
                  const next = !v;
                  if (next) resetUnreadCount();
                  return next;
                })}
              >
                <MdNotifications />
                {unreadCount > 0 && (
                  <span className="notif-badge" style={{ background: accentColor }}>{unreadCount}</span>
                )}
              </button>

              {showNotif && (
                <NotificationDropdown
                  notifications={notifications}
                  dismissNotification={dismissNotification}
                  clearAll={clearAll}
                  pendingDismissList={pendingDismissList}
                  undoDismiss={undoDismiss}
                  accentColor={accentColor}
                  onClose={() => setShowNotif(false)}
                />
              )}
            </div>
          </div>
        </header>

        <main className="page-content" style={{ background: 'var(--surface-2)', minHeight: 'calc(100vh - 64px)', padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
