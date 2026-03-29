import { useState, useEffect, useRef } from 'react';
import { MdMenu, MdNotifications, MdDarkMode, MdLightMode } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { listenNotifications, markNotificationRead } from '../firebase/firestore';
import logoImage from '../assets/hero.png';

export default function Header({ onMenuClick, pageTitle }) {
  const { userProfile, currentUser } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isDark, setIsDark] = useState(false);
  const notifRef = useRef(null);

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

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = listenNotifications(currentUser.uid, (docs) => setNotifications(docs));
    return unsub;
  }, [currentUser]);

  const unreadCount = notifications.filter((n) => !n.read_status).length;

  const handleNotifClick = async (notif) => {
    if (!notif.read_status) await markNotificationRead(notif.id);
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

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="hamburger" onClick={onMenuClick} aria-label="Toggle menu">
          <MdMenu />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logoImage} alt="Logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <span className="header-title">{pageTitle || 'Campus Twin'}</span>
        </div>
      </div>
      <div className="header-right">
        {/* Theme Toggle */}
        <button className="notif-btn" onClick={toggleTheme} aria-label="Toggle dark mode" style={{ marginRight: 8 }}>
          {isDark ? <MdLightMode /> : <MdDarkMode />}
        </button>

        {/* Notification Bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="notif-btn"
            onClick={() => setShowNotif((v) => !v)}
            aria-label="Notifications"
          >
            <MdNotifications />
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {showNotif && (
            <div className="notif-dropdown">
              <div className="notif-header">
                <h4>Notifications</h4>
                {unreadCount > 0 && (
                  <span className="badge badge-primary">{unreadCount} new</span>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item ${!n.read_status ? 'unread' : ''}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <p>{n.message}</p>
                    <div className="notif-time">{formatTime(n.createdAt)}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
