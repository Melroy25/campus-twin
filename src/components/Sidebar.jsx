import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MdDashboard, MdSchedule, MdCheckCircle, MdBarChart,
  MdStar, MdDescription, MdListAlt, MdEvent,
  MdGroup, MdPeople, MdSettings, MdEventNote,
  MdLogout, MdHowToReg, MdThumbUp, MdClose
} from 'react-icons/md';
import logoImage from '../assets/hero.png';

const NAV_ITEMS = {
  student: [
    { label: 'Home', icon: <MdDashboard />, path: '/student' },
    { label: 'Timetable', icon: <MdSchedule />, path: '/student/timetable' },
    { label: 'Attendance', icon: <MdCheckCircle />, path: '/student/attendance' },
    { label: 'Internal Marks', icon: <MdBarChart />, path: '/student/marks' },
    { label: 'AICTE Points', icon: <MdStar />, path: '/student/aicte' },
    { label: 'Marks Card', icon: <MdDescription />, path: '/student/marks-card' },
    { label: 'Course Registration', icon: <MdListAlt />, path: '/student/courses' },
    { label: 'Events', icon: <MdEvent />, path: '/student/events' },
  ],
  teacher: [
    { label: 'Mark Attendance', icon: <MdHowToReg />, path: '/teacher/attendance' },
    { label: 'Add Marks', icon: <MdBarChart />, path: '/teacher/marks' },
    { label: 'Leave Requests', icon: <MdDescription />, path: '/teacher/leave' },
  ],
  mentor: [
    { label: 'AICTE Approvals', icon: <MdThumbUp />, path: '/mentor/aicte' },
  ],
  admin: [
    { label: 'Dashboard', icon: <MdDashboard />, path: '/admin' },
    { label: 'Manage Users', icon: <MdGroup />, path: '/admin/users' },
    { label: 'Manage Timetable', icon: <MdSchedule />, path: '/admin/timetable' },
    { label: 'Upload Marks Cards', icon: <MdDescription />, path: '/admin/marks-cards' },
    { label: 'Post Events', icon: <MdEventNote />, path: '/admin/events' },
  ],
};

export default function Sidebar({ isOpen, onClose }) {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const role = userProfile?.role || 'student';
  const navItems = NAV_ITEMS[role] || [];

  const handleNav = (path) => {
    navigate(path);
    onClose?.();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = userProfile?.name
    ? userProfile.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <img src={logoImage} alt="Campus Twin Logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          <div>
            <div className="sidebar-logo-text">Campus Twin</div>
            <div className="sidebar-logo-sub">Digital College System</div>
          </div>
          {/* Close btn on mobile */}
          <button
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', display: 'none' }}
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <MdClose />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">{role === 'student' ? 'Student' : role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Mentor'} Menu</div>
          {navItems.map((item) => (
            <div
              key={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => handleNav(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userProfile?.name || 'User'}
              </div>
              <div className="sidebar-user-role">{userProfile?.usn || role}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}
              title="Logout"
            >
              <MdLogout />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
