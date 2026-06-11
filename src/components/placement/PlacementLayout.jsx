import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { queryDocuments, getById } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import {
  MdDashboard, MdWork, MdNotifications, MdLogout,
  MdDarkMode, MdLightMode, MdMenu, MdClose,
  MdDescription, MdAutoAwesome, MdBook, MdEventSeat,
  MdSchool, MdCampaign, MdBarChart, MdGroup, MdCheckCircle,
  MdChat, MdFeedback
} from 'react-icons/md';
import { FaLinkedin } from 'react-icons/fa';
import logoImage from '../../assets/about-section-college.jpg';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationDropdown from '../NotificationDropdown';

export default function PlacementLayout({ children, activeTab, setActiveTab, role }) {
  const { userProfile, logout, currentUser } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);
  const [placementMaintenanceStudents, setPlacementMaintenanceStudents] = useState(false);
  const [placementMaintenanceTeachers, setPlacementMaintenanceTeachers] = useState(false);

  const isAdmin = role === 'admin' || role === 'placement_admin' || role === 'placement_teacher' || role === 'placement_speaker';

  const notifUserId = isAdmin ? 'placement_admin' : (currentUser?.uid || 'guest');
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

  // Sync placement maintenance mode
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const doc = await getById('placementAnnouncements', 'placement_settings');
        if (doc && doc.content) {
          const parsed = JSON.parse(doc.content);
          if (parsed) {
            const isStudentMode = !!(parsed.maintenance_students || parsed.maintenance_mode);
            const isTeacherMode = !!parsed.maintenance_teachers;

            setPlacementMaintenanceStudents(isStudentMode);
            setPlacementMaintenanceTeachers(isTeacherMode);

            if (!isAdmin && isStudentMode) {
              if (activeTab !== 'resume' && activeTab !== 'coach') {
                setActiveTab('resume');
              }
            } else if ((role === 'placement_teacher' || role === 'placement_speaker') && isTeacherMode) {
              if (activeTab !== 'chat') {
                setActiveTab('chat');
              }
            }
          }
        } else {
          setPlacementMaintenanceStudents(false);
          setPlacementMaintenanceTeachers(false);
        }
      } catch (e) {
        console.warn("Failed to check placement maintenance:", e);
      }
    };
    checkMaintenance();
  }, [activeTab, isAdmin, role, setActiveTab]);

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
    if (isAdmin) {
      localStorage.removeItem('placement_admin_session');
      toast.success('Logged out from Placement Coordinator Portal');
      navigate('/placement/login');
    } else {
      navigate('/');
    }
  };

  let menuItems = [];
  if (isAdmin) {
    menuItems = [
      { id: 'dashboard', label: 'Analytics Dash', icon: <MdBarChart />, roles: ['admin', 'placement_admin'] },
      { id: 'students', label: 'Student Directory', icon: <MdGroup />, roles: ['admin', 'placement_admin'] },
      { id: 'sessions', label: 'Manage Sessions', icon: <MdEventSeat />, roles: ['admin', 'placement_admin', 'placement_teacher', 'placement_speaker'] },
      { id: 'companies', label: 'Manage Companies', icon: <MdWork />, roles: ['admin', 'placement_admin'] },
      { id: 'announcements', label: 'Announcements', icon: <MdCampaign />, roles: ['admin', 'placement_admin'] },
      { id: 'showcase', label: 'Placed Showcase', icon: <MdSchool />, roles: ['admin', 'placement_admin'] },
      { id: 'resources', label: 'Prep Resources', icon: <MdBook />, roles: ['admin', 'placement_admin'] },
      { id: 'staff', label: 'Create Speaker Teacher', icon: <MdGroup />, roles: ['admin', 'placement_admin'] },
      { id: 'leaves', label: 'Attendance Grants', icon: <MdFeedback />, roles: ['placement_teacher', 'placement_speaker'] },
      { id: 'chat', label: 'Placement Chat', icon: <MdChat />, roles: ['admin', 'placement_admin', 'placement_teacher', 'placement_speaker'] }
    ].filter(item => item.roles.includes(role));

    if ((role === 'placement_teacher' || role === 'placement_speaker') && placementMaintenanceTeachers) {
      menuItems = menuItems.filter(item => item.id === 'chat');
    }
  } else {
    menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: <MdDashboard /> },
      { id: 'resume', label: 'Resume Builder', icon: <MdDescription /> },
      { id: 'coach', label: 'AI Resume Coach', icon: <MdAutoAwesome /> },
      { id: 'openings', label: 'Job Openings', icon: <MdWork /> },
      { id: 'sessions', label: 'Training Sessions', icon: <MdEventSeat /> },
      { id: 'resources', label: 'Prep Resources', icon: <MdBook /> },
      { id: 'attendance', label: 'Session Attendance', icon: <MdCheckCircle /> }
    ];
    if (placementMaintenanceStudents) {
      menuItems = menuItems.filter(item => item.id === 'resume' || item.id === 'coach');
    }
  }

  const accentColor = '#6366f1'; // Indigo


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
            {isAdmin ? 'Coordinator Console' : 'Student Portal'}
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
            <MdLogout /> {isAdmin ? 'Coord Log Out' : 'Exit Placement'}
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
              {isAdmin ? (
                (role === 'placement_teacher' || role === 'placement_speaker') 
                  ? 'Placement Coordinator' 
                  : 'Placement Admin'
              ) : 'Placement Portal'}
            </span>
          </div>

          <div className="header-right">
            {/* LinkedIn Portal */}
            <a 
              href="https://www.linkedin.com/school/st-joseph-engineering-college-mangaluru/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="notif-btn" 
              style={{ marginRight: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0077b5', textDecoration: 'none' }}
              title="SJEC LinkedIn Portal"
            >
              <FaLinkedin size={20} />
            </a>

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
