import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { queryDocuments } from '../../appwrite/database';
import { Query } from 'appwrite';
import {
  MdDashboard, MdBed, MdReportProblem, MdEventNote, MdReceipt,
  MdChat, MdAnnouncement, MdMeetingRoom, MdPeople, MdWarning,
  MdCheckCircle, MdAccessTime, MdTrendingUp, MdArrowForward,
  MdNotifications, MdPerson, MdHotel, MdPayment
} from 'react-icons/md';

export default function HostelDashboard({ hostelType, role, onNavigate }) {
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);

  // Detect dark theme
  const isDark = document.body.classList.contains('dark-theme');

  const accentColor = hostelType === 'girls' ? '#ec4899' : '#3b82f6';
  const accentLight = hostelType === 'girls' ? '#fce7f3' : '#dbeafe';
  const accentDark = hostelType === 'girls' ? '#be185d' : '#1e40af';
  const gradientStart = hostelType === 'girls' ? '#ec4899' : '#3b82f6';
  const gradientEnd = hostelType === 'girls' ? '#f472b6' : '#60a5fa';
  const gradientBg = `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 50%, ${hostelType === 'girls' ? '#a855f7' : '#818cf8'} 100%)`;

  // Get warden session info
  const wardenSession = role === 'warden'
    ? (() => { try { return JSON.parse(localStorage.getItem('hostel_warden_session')); } catch { return null; } })()
    : null;

  const userName = role === 'warden'
    ? (wardenSession?.name || 'Warden')
    : (userProfile?.name || currentUser?.name || 'Student');

  useEffect(() => {
    fetchDashboardData();
  }, [hostelType, role]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const hostelQuery = Query.equal('hostel_type', hostelType);

      if (role === 'student') {
        const studentId = userProfile?.uid || currentUser?.$id || '';

        const [complaints, leaves, bills] = await Promise.all([
          queryDocuments('hostelComplaints', [Query.equal('student_id', studentId), hostelQuery]),
          queryDocuments('hostelLeaveRequests', [Query.equal('student_id', studentId), hostelQuery]),
          queryDocuments('hostelBills', [Query.equal('student_id', studentId), hostelQuery]),
        ]);

        const pendingComplaints = complaints.filter(c => c.status === 'pending' || c.status === 'open').length;
        const pendingLeaves = leaves.filter(l => l.approval_status === 'pending').length;
        const unpaidBills = bills.filter(b => b.status === 'unpaid' || b.status === 'pending').length;

        // Find student room info
        const roomNumber = userProfile?.room_number || '—';

        setStats({
          roomNumber,
          pendingComplaints,
          pendingLeaves,
          unpaidBills,
        });

        // Build recent activity from complaints & bills
        const activity = [
          ...complaints.map(c => ({
            id: c.$id,
            type: 'complaint',
            title: `Complaint: ${c.category || 'General'}`,
            message: c.message?.substring(0, 80) + (c.message?.length > 80 ? '...' : ''),
            status: c.status,
            date: c.createdAt || c.$createdAt,
          })),
          ...bills.map(b => ({
            id: b.$id,
            type: 'bill',
            title: `Bill: ${b.billing_month || 'Monthly'}`,
            message: `Amount: ₹${b.amount} — Due: ${b.due_date || 'N/A'}`,
            status: b.status,
            date: b.createdAt || b.$createdAt,
          })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

        setRecentActivity(activity);
      } else {
        // Warden dashboard
        const [rooms, complaints, leaves, bills] = await Promise.all([
          queryDocuments('hostelRooms', [hostelQuery]),
          queryDocuments('hostelComplaints', [hostelQuery]),
          queryDocuments('hostelLeaveRequests', [hostelQuery]),
          queryDocuments('hostelBills', [hostelQuery]),
        ]);

        const totalRooms = rooms.length;
        const totalOccupied = rooms.reduce((sum, r) => sum + (r.occupied_count || 0), 0);
        const totalCapacity = rooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
        const vacancy = totalCapacity - totalOccupied;
        const pendingComplaints = complaints.filter(c => c.status === 'pending' || c.status === 'open').length;
        const pendingLeaves = leaves.filter(l => l.approval_status === 'pending').length;
        const unpaidBills = bills.filter(b => b.status === 'unpaid' || b.status === 'pending').length;

        setStats({
          totalRooms,
          totalOccupied,
          vacancy,
          pendingComplaints,
          pendingLeaves,
          unpaidBills,
        });

        // Build recent activity from complaints & leaves
        const activity = [
          ...complaints.map(c => ({
            id: c.$id,
            type: 'complaint',
            title: `${c.student_name || 'Student'} — ${c.category || 'Complaint'}`,
            message: c.message?.substring(0, 80) + (c.message?.length > 80 ? '...' : ''),
            status: c.status,
            date: c.createdAt || c.$createdAt,
          })),
          ...leaves.map(l => ({
            id: l.$id,
            type: 'leave',
            title: `${l.student_name || 'Student'} — Leave Request`,
            message: `${l.from_date || ''} to ${l.to_date || ''} — ${l.reason?.substring(0, 50) || ''}`,
            status: l.approval_status,
            date: l.createdAt || l.$createdAt,
          })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

        setRecentActivity(activity);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    const map = {
      pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
      open: { bg: '#fef3c7', color: '#92400e', label: 'Open' },
      resolved: { bg: '#d1fae5', color: '#065f46', label: 'Resolved' },
      approved: { bg: '#d1fae5', color: '#065f46', label: 'Approved' },
      rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
      paid: { bg: '#d1fae5', color: '#065f46', label: 'Paid' },
      unpaid: { bg: '#fee2e2', color: '#991b1b', label: 'Unpaid' },
    };
    const info = map[s] || { bg: '#e5e7eb', color: '#374151', label: status || 'N/A' };
    return (
      <span style={{
        padding: '2px 10px',
        borderRadius: 20,
        fontSize: '0.7rem',
        fontWeight: 600,
        background: info.bg,
        color: info.color,
        textTransform: 'capitalize',
      }}>
        {info.label}
      </span>
    );
  };

  const getActivityIcon = (type) => {
    if (type === 'complaint') return <MdReportProblem style={{ color: '#f59e0b', fontSize: '1.1rem' }} />;
    if (type === 'leave') return <MdEventNote style={{ color: '#8b5cf6', fontSize: '1.1rem' }} />;
    if (type === 'bill') return <MdReceipt style={{ color: '#ef4444', fontSize: '1.1rem' }} />;
    return <MdNotifications style={{ color: accentColor, fontSize: '1.1rem' }} />;
  };

  // --- Glassmorphism card style helper (theme-aware) ---
  const glassCard = (extra = {}) => ({
    background: 'var(--surface-1)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 20,
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    ...extra,
  });

  // --- Loading state ---
  if (loading) {
    return (
      <div className="loader-container" style={{ minHeight: '60vh' }}>
        <div className="loader" style={{ borderTopColor: accentColor }} />
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Loading dashboard...</p>
      </div>
    );
  }

  // =================== STUDENT DASHBOARD ===================
  if (role === 'student') {
    const studentStats = [
      {
        icon: <MdBed />,
        label: 'Room Number',
        value: stats.roomNumber || '—',
        bg: accentLight,
        iconColor: accentDark,
      },
      {
        icon: <MdReportProblem />,
        label: 'Pending Complaints',
        value: stats.pendingComplaints || 0,
        bg: '#fef3c7',
        iconColor: '#92400e',
      },
      {
        icon: <MdEventNote />,
        label: 'Pending Leaves',
        value: stats.pendingLeaves || 0,
        bg: '#ede9fe',
        iconColor: '#5b21b6',
      },
      {
        icon: <MdPayment />,
        label: 'Unpaid Bills',
        value: stats.unpaidBills || 0,
        bg: '#fee2e2',
        iconColor: '#991b1b',
      },
    ];

    const quickActions = [
      { icon: <MdReportProblem />, label: 'File Complaint', tab: 'complaints' },
      { icon: <MdEventNote />, label: 'Request Leave', tab: 'leave' },
      { icon: <MdReceipt />, label: 'View Bills', tab: 'bills' },
      { icon: <MdChat />, label: 'Chat', tab: 'chat' },
    ];

    return (
      <div style={{ animation: 'fadeIn 0.4s ease' }}>
        {/* Hero Banner */}
        <div style={{
          background: gradientBg,
          borderRadius: 20,
          padding: '32px 28px',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
          color: 'white',
          textShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 160, height: 160, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
          }} />
          <div style={{
            position: 'absolute', bottom: -30, right: 80,
            width: 100, height: 100, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }} />
          <div style={{
            position: 'absolute', top: 20, right: 140,
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
              fontSize: '0.78rem', opacity: 1, fontWeight: 600, color: 'white',
            }}>
              <MdHotel style={{ fontSize: '1rem' }} />
              {hostelType === 'girls' ? 'Girls' : 'Boys'} Hostel Portal
            </div>
            <h1 style={{
              fontSize: '1.6rem', fontWeight: 800, margin: 0, lineHeight: 1.2,
              letterSpacing: '-0.5px',
            }}>
              Welcome back, {userName}! 👋
            </h1>
            <p style={{
              margin: '8px 0 0', fontSize: '0.88rem', opacity: 1, fontWeight: 400, color: 'rgba(255,255,255,0.95)',
            }}>
              {stats.roomNumber && stats.roomNumber !== '—'
                ? `Room ${stats.roomNumber} • ${hostelType === 'girls' ? 'Girls' : 'Boys'} Block`
                : `${hostelType === 'girls' ? 'Girls' : 'Boys'} Block • Hostel Management`
              }
            </p>
          </div>
        </div>

        {/* Stat Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}>
          {studentStats.map((stat, i) => (
            <div
              key={i}
              style={glassCard({ cursor: 'default', padding: '20px 18px' })}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 12px 40px ${accentColor}15`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.06)';
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: stat.bg, color: stat.iconColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem', marginBottom: 12,
              }}>
                {stat.icon}
              </div>
              <div style={{
                fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)',
                lineHeight: 1, marginBottom: 4,
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: '0.75rem', color: 'var(--text-muted)',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Two-column layout: Recent Notifications + Quick Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}>
          {/* Recent Notifications */}
          <div style={glassCard({ padding: 0, overflow: 'hidden' })}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdNotifications style={{ color: accentColor, fontSize: '1.1rem' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Recent Activity</h3>
              </div>
              <span style={{
                fontSize: '0.7rem', color: accentColor, fontWeight: 600,
                background: accentLight, padding: '2px 8px', borderRadius: 12,
              }}>
                {recentActivity.length} items
              </span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {recentActivity.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <MdNotifications style={{ fontSize: '2rem', opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ fontSize: '0.82rem', margin: 0 }}>No recent activity</p>
                </div>
              ) : (
                recentActivity.map((item, i) => (
                  <div
                    key={item.id || i}
                    style={{
                      padding: '12px 20px',
                      borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      transition: 'background 0.2s',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: item.type === 'complaint' ? '#fef3c7' : item.type === 'bill' ? '#fee2e2' : '#ede9fe',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 2,
                    }}>
                      {getActivityIcon(item.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        justifyContent: 'space-between', marginBottom: 2,
                      }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.title}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                      <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
                        {item.message}
                      </p>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                        {formatDate(item.date)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={glassCard()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <MdTrendingUp style={{ color: accentColor, fontSize: '1.1rem' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Quick Actions</h3>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}>
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate && onNavigate(action.tab)}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 10, padding: '22px 12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = `0 8px 24px ${accentColor}20`;
                    e.currentTarget.style.borderColor = accentColor;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: accentLight, color: accentDark,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem',
                  }}>
                    {action.icon}
                  </div>
                  <span style={{
                    fontSize: '0.78rem', fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}>
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Responsive override for mobile */}
        <style>{`
          @media (max-width: 768px) {
            div[style*="gridTemplateColumns: '1fr 1fr'"],
            div[style*="grid-template-columns"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // =================== WARDEN DASHBOARD ===================
  const wardenStats = [
    {
      icon: <MdMeetingRoom />,
      label: 'Total Rooms',
      value: stats.totalRooms || 0,
      bg: accentLight,
      iconColor: accentDark,
    },
    {
      icon: <MdPeople />,
      label: 'Total Occupied',
      value: stats.totalOccupied || 0,
      bg: '#d1fae5',
      iconColor: '#065f46',
    },
    {
      icon: <MdHotel />,
      label: 'Vacancy',
      value: stats.vacancy || 0,
      bg: '#e0f2fe',
      iconColor: '#0369a1',
    },
    {
      icon: <MdReportProblem />,
      label: 'Pending Complaints',
      value: stats.pendingComplaints || 0,
      bg: '#fef3c7',
      iconColor: '#92400e',
    },
    {
      icon: <MdEventNote />,
      label: 'Pending Leaves',
      value: stats.pendingLeaves || 0,
      bg: '#ede9fe',
      iconColor: '#5b21b6',
    },
    {
      icon: <MdPayment />,
      label: 'Unpaid Bills',
      value: stats.unpaidBills || 0,
      bg: '#fee2e2',
      iconColor: '#991b1b',
    },
  ];

  const wardenQuickActions = [
    { icon: <MdMeetingRoom />, label: 'Manage Rooms', tab: 'rooms' },
    { icon: <MdReportProblem />, label: 'Review Complaints', tab: 'complaints' },
    { icon: <MdEventNote />, label: 'Review Leaves', tab: 'leave' },
    { icon: <MdAnnouncement />, label: 'Post Notice', tab: 'notices' },
  ];

  // Calculate occupancy percentage for the progress bar
  const occupancyPercent = stats.totalRooms
    ? Math.round(((stats.totalOccupied || 0) / ((stats.totalOccupied || 0) + (stats.vacancy || 0))) * 100)
    : 0;

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Warden Hero Banner */}
      <div style={{
        background: gradientBg,
        borderRadius: 20,
        padding: '32px 28px',
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
        color: 'white',
        textShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute', top: -50, right: -50,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: '50%',
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', top: 30, right: 180,
          width: 50, height: 50, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              fontSize: '0.78rem', opacity: 1, fontWeight: 600, color: 'white',
            }}>
              <MdDashboard style={{ fontSize: '1rem' }} />
              Warden Control Panel
            </div>
            <h1 style={{
              fontSize: '1.6rem', fontWeight: 800, margin: 0, lineHeight: 1.2,
              letterSpacing: '-0.5px', color: 'white',
            }}>
              Warden Dashboard — {hostelType === 'girls' ? 'Girls' : 'Boys'} Block
            </h1>
            <p style={{
              margin: '8px 0 0', fontSize: '0.88rem', opacity: 1, color: 'rgba(255,255,255,0.95)',
            }}>
              Welcome, {userName}. Manage rooms, complaints, and student requests.
            </p>
          </div>

          {/* Occupancy indicator */}
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            borderRadius: 14,
            padding: '14px 20px',
            minWidth: 180,
          }}>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 500, marginBottom: 6 }}>
              Occupancy Rate
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>
              {occupancyPercent}%
            </div>
            <div style={{
              height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${occupancyPercent}%`,
                background: 'white', borderRadius: 3,
                transition: 'width 0.8s ease',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 14,
        marginBottom: 28,
      }}>
        {wardenStats.map((stat, i) => (
          <div
            key={i}
            style={glassCard({ padding: '18px 16px', cursor: 'default' })}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = `0 12px 40px ${accentColor}15`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.06)';
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: stat.bg, color: stat.iconColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', marginBottom: 10,
            }}>
              {stat.icon}
            </div>
            <div style={{
              fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)',
              lineHeight: 1, marginBottom: 4,
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: '0.72rem', color: 'var(--text-muted)',
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px',
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Recent Activity + Quick Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gap: 20,
      }}>
        {/* Recent Activity Feed */}
        <div style={glassCard({ padding: 0, overflow: 'hidden' })}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdAccessTime style={{ color: accentColor, fontSize: '1.1rem' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Recent Activity</h3>
            </div>
            <span style={{
              fontSize: '0.7rem', color: accentColor, fontWeight: 600,
              background: accentLight, padding: '2px 8px', borderRadius: 12,
            }}>
              {recentActivity.length} items
            </span>
          </div>
          <div style={{ padding: '4px 0', maxHeight: 380, overflowY: 'auto' }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <MdCheckCircle style={{ fontSize: '2.2rem', opacity: 0.3, marginBottom: 8 }} />
                <p style={{ fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>All caught up!</p>
                <p style={{ fontSize: '0.76rem', margin: '4px 0 0', opacity: 0.7 }}>No pending activity</p>
              </div>
            ) : (
              recentActivity.map((item, i) => (
                <div
                  key={item.id || i}
                  style={{
                    padding: '12px 20px',
                    borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    transition: 'background 0.2s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: item.type === 'complaint' ? '#fef3c7' : item.type === 'leave' ? '#ede9fe' : '#fee2e2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    {getActivityIcon(item.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      justifyContent: 'space-between', marginBottom: 2,
                    }}>
                      <span style={{
                        fontSize: '0.82rem', fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.title}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    <p style={{
                      fontSize: '0.76rem', color: 'var(--text-muted)',
                      margin: '2px 0 0', lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.message}
                    </p>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                      {formatDate(item.date)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={glassCard()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <MdTrendingUp style={{ color: accentColor, fontSize: '1.1rem' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Quick Actions</h3>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {wardenQuickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => onNavigate && onNavigate(action.tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  width: '100%',
                  textAlign: 'left',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.boxShadow = `0 6px 20px ${accentColor}18`;
                  e.currentTarget.style.borderColor = accentColor;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: accentLight, color: accentDark,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem', flexShrink: 0,
                }}>
                  {action.icon}
                </div>
                <span style={{
                  fontSize: '0.85rem', fontWeight: 600,
                  color: 'var(--text-primary)', flex: 1,
                }}>
                  {action.label}
                </span>
                <MdArrowForward style={{
                  color: 'var(--text-muted)', fontSize: '1rem',
                  opacity: 0.5,
                }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive style overrides */}
      <style>{`
        @media (max-width: 900px) {
          div[style*="1.4fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          div[style*="repeat(auto-fit"] {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
