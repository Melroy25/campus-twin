import { useState, useEffect } from 'react';
import { MdNotifications, MdClose, MdCheck, MdUndo, MdSchool, MdWork, MdHotel } from 'react-icons/md';

export default function NotificationDropdown({
  notifications,
  dismissNotification,
  clearAll,
  pendingDismissList,
  undoDismiss,
  accentColor = '#4285F4',
  onClose
}) {
  const [activeTab, setActiveTab] = useState('college');

  // Filter notifications by category
  const getNotificationsByCategory = (cat) => {
    return notifications.filter((n) => {
      const c = n.category || 'college';
      return c === cat;
    });
  };

  const collegeNotifs = getNotificationsByCategory('college');
  const placementNotifs = getNotificationsByCategory('placement');
  const hostelNotifs = getNotificationsByCategory('hostel');

  const getActiveList = () => {
    if (activeTab === 'placement') return placementNotifs;
    if (activeTab === 'hostel') return hostelNotifs;
    return collegeNotifs;
  };

  const activeList = getActiveList();

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTabBadgeCount = (cat) => {
    return getNotificationsByCategory(cat).length;
  };

  // Banner countdown timer display helper
  const latestPending = pendingDismissList.length > 0 ? pendingDismissList[pendingDismissList.length - 1] : null;

  return (
    <div
      className="notif-dropdown-premium"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        width: '360px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        marginTop: '10px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, var(--surface), var(--surface-2))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MdNotifications size={20} style={{ color: accentColor }} />
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Alerts & Notices
          </h4>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeList.length > 0 && (
            <button
              onClick={() => clearAll(activeTab)}
              style={{
                background: 'none',
                border: 'none',
                color: accentColor,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'background 0.2s',
              }}
              className="clear-all-btn"
              onMouseEnter={(e) => (e.target.style.background = 'var(--primary-light)')}
              onMouseLeave={(e) => (e.target.style.background = 'none')}
            >
              Clear All
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '4px',
              borderRadius: '50%',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.target.style.background = 'var(--surface-2)')}
            onMouseLeave={(e) => (e.target.style.background = 'none')}
          >
            <MdClose size={18} />
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface-2)',
          padding: '4px',
          gap: '4px',
        }}
      >
        {[
          { id: 'college', label: 'College', icon: <MdSchool /> },
          { id: 'placement', label: 'Placement', icon: <MdWork /> },
          { id: 'hostel', label: 'Hostel', icon: <MdHotel /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const count = getTabBadgeCount(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 4px',
                border: 'none',
                borderRadius: '10px',
                backgroundColor: isActive ? 'var(--surface)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  style={{
                    backgroundColor: isActive ? accentColor : 'var(--border)',
                    color: isActive ? 'white' : 'var(--text-secondary)',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div style={{ maxHeight: '280px', overflowY: 'auto', backgroundColor: 'var(--surface)' }}>
        {activeList.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <MdNotifications size={36} style={{ opacity: 0.2 }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>No recent {activeTab} notifications</p>
          </div>
        ) : (
          activeList.map((n) => (
            <div
              key={n.$id || n.id}
              style={{
                display: 'flex',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.2s',
                position: 'relative',
              }}
              className="notif-item-premium"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    lineHeight: '1.4',
                    wordBreak: 'break-word',
                  }}
                >
                  {n.message}
                </p>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {formatTime(n.createdAt)}
                </div>
              </div>
              <button
                onClick={() => dismissNotification(n.$id || n.id)}
                style={{
                  alignSelf: 'center',
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                title="Dismiss Alert"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.color = accentColor;
                  e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <MdCheck size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Undo Banner overlay */}
      {latestPending && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            backgroundColor: 'var(--text-primary)',
            color: 'var(--surface)',
            fontSize: '0.8rem',
            fontWeight: 500,
            borderTop: '1px solid var(--border)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span>{latestPending.label} (5s)</span>
          <button
            onClick={() => undoDismiss(latestPending.timerId)}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '4px',
              color: 'var(--surface)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
          >
            <MdUndo size={14} />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
