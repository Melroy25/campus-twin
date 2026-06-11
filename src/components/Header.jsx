import { useState, useEffect, useRef } from 'react';
import { MdMenu, MdNotifications, MdDarkMode, MdLightMode, MdLanguage } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import logoImage from '../assets/about-section-college.jpg';
import { useNotifications } from '../hooks/useNotifications';
import NotificationDropdown from './NotificationDropdown';

export default function Header({ onMenuClick, pageTitle }) {
  const { userProfile, currentUser } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const notifRef = useRef(null);

  const {
    notifications,
    unreadCount,
    resetUnreadCount,
    dismissNotification,
    clearAll,
    pendingDismissList,
    undoDismiss
  } = useNotifications(currentUser?.uid);

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

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <button className="hamburger" onClick={onMenuClick} aria-label="Toggle menu">
          <MdMenu />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logoImage} alt="Logo" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: '4px' }} />
          <span className="header-title">{pageTitle || 'Campus Twin'}</span>
        </div>
      </div>
      <div className="header-right">
        {/* College Website Link */}
        <a 
          href="https://sjec.ac.in/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="notif-btn" 
          aria-label="College Website" 
          title="College Website"
          style={{ marginRight: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: 'inherit' }}
        >
          <MdLanguage />
        </a>

        {/* Theme Toggle */}
        <button className="notif-btn" onClick={toggleTheme} aria-label="Toggle dark mode" style={{ marginRight: 8 }}>
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
            aria-label="Notifications"
          >
            <MdNotifications />
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {showNotif && (
            <NotificationDropdown
              notifications={notifications}
              dismissNotification={dismissNotification}
              clearAll={clearAll}
              pendingDismissList={pendingDismissList}
              undoDismiss={undoDismiss}
              onClose={() => setShowNotif(false)}
            />
          )}
        </div>
      </div>
    </header>
  );
}
