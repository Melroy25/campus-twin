import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { queryDocuments } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import {
  MdDashboard, MdWork, MdNotifications, MdLogout,
  MdDarkMode, MdLightMode, MdMenu, MdClose,
  MdDescription, MdAutoAwesome, MdBook, MdEventSeat,
  MdSchool, MdCampaign, MdBarChart, MdGroup
} from 'react-icons/md';
import logoImage from '../../assets/about-section-college.jpg';

export default function PlacementLayout({ children, activeTab, setActiveTab, role }) {
  const { userProfile, logout, currentUser } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);

  // Sync theme status
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.body.classList.add('dark-theme');
      setIsDark(true);
    }
  }, []);

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

  // Fetch placement specific notifications / announcements
  const loadPlacementNotifications = async () => {
    try {
      if (role === 'admin') {
        // Coordinator alerts
        setNotifications([
          { id: 'ca1', message: '3 pending resume reviews require action', createdAt: new Date().toISOString(), read: false },
          { id: 'ca2', message: 'New applications submitted for Google India SDE drive', createdAt: new Date().toISOString(), read: true }
        ]);
      } else {
        // Query recent student announcements
        const anns = await queryDocuments('placementAnnouncements', []);
        const list = anns.slice(0, 5).map(a => ({
          id: a.$id,
          message: `${a.is_important ? '🚨 IMPORTANT: ' : ''}${a.title} - ${a.content.substring(0, 80)}...`,
          createdAt: a.createdAt || new Date().toISOString(),
          read: false
        }));
        setNotifications(list);
      }
    } catch (err) {
      console.warn("Error loading notifications:", err);
    }
  };

  useEffect(() => {
    loadPlacementNotifications();
  }, [role]);

  const handleLogout = async () => {
    if (role === 'admin') {
      localStorage.removeItem('placement_admin_session');
      toast.success('Logged out from Placement Coordinator Portal');
      navigate('/placement/login');
    } else {
      navigate('/');
    }
  };

  const menuItems = role === 'admin' ? [
    { id: 'dashboard', label: 'Analytics Dash', icon: <MdBarChart /> },
    { id: 'students', label: 'Student Directory', icon: <MdGroup /> },
    { id: 'sessions', label: 'Manage Sessions', icon: <MdEventSeat /> },
    { id: 'companies', label: 'Manage Companies', icon: <MdWork /> },
    { id: 'announcements', label: 'Announcements', icon: <MdCampaign /> },
    { id: 'showcase', label: 'Placed Showcase', icon: <MdSchool /> }
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: <MdDashboard /> },
    { id: 'resume', label: 'Resume Builder', icon: <MdDescription /> },
    { id: 'coach', label: 'AI Resume Coach', icon: <MdAutoAwesome /> },
    { id: 'openings', label: 'Job Openings', icon: <MdWork /> },
    { id: 'sessions', label: 'Training Sessions', icon: <MdEventSeat /> },
    { id: 'resources', label: 'Prep Resources', icon: <MdBook /> }
  ];

  const accentColor = '#6366f1'; // Indigo
  const accentBgLight = 'rgba(99, 102, 241, 0.15)';
  const unreadCount = notifications.filter(n => !n.read).length;

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
              Placement Hub
            </div>
          </div>
          <button className="sidebar-close-btn" style={{ display: 'none', marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)' }} onClick={() => setSidebarOpen(false)}>
            <MdClose />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label" style={{ color: accentColor }}>
            {role === 'admin' ? 'Coordinator Console' : 'Student Portal'}
          </div>
          {menuItems.map((item) => {
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
            <MdLogout /> {role === 'admin' ? 'Coord Log Out' : 'Exit Placement'}
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
              {role === 'admin' ? 'Placement Admin' : 'Student Placement Portal'}
            </span>
          </div>

          <div className="header-right">
            {/* Theme Toggle */}
            <button className="notif-btn" onClick={toggleTheme} style={{ marginRight: 10 }}>
              {isDark ? <MdLightMode /> : <MdDarkMode />}
            </button>

            {/* Notification Bell */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button className="notif-btn" onClick={() => setShowNotif(!showNotif)}>
                <MdNotifications />
                {unreadCount > 0 && (
                  <span className="notif-badge" style={{ background: accentColor }}>{unreadCount}</span>
                )}
              </button>

              {showNotif && (
                <div className="notif-dropdown" style={{ right: 0, top: 40, width: 320 }}>
                  <div className="notif-header" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ margin: 0 }}>Announcements</h4>
                    {unreadCount > 0 && (
                      <span className="badge" style={{ background: accentBgLight, color: accentColor }}>{unreadCount} new</span>
                    )}
                  </div>
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div className="empty-state" style={{ padding: 20 }}>
                        <p style={{ margin: 0, fontSize: '0.86rem' }}>No recent notifications</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`notif-item ${!n.read ? 'unread' : ''}`}
                          style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px', cursor: 'pointer' }}
                        >
                          <p style={{ margin: '0 0 4px 0', fontSize: '0.84rem', lineHeight: '1.3' }}>{n.message}</p>
                          <div className="notif-time" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(n.createdAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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
