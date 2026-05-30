import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClasses } from '../appwrite/database';
import {
  MdDashboard, MdSchedule, MdCheckCircle, MdBarChart,
  MdStar, MdDescription, MdListAlt, MdEvent,
  MdGroup, MdPeople, MdSettings, MdEventNote,
  MdLogout, MdHowToReg, MdThumbUp, MdClose,
  MdSchool, MdInbox, MdHome, MdPerson, MdBook, MdFolder,
  MdCalendarToday, MdWork
} from 'react-icons/md';
import logoImage from '../assets/about-section-college.jpg';

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
    { label: 'Placement Portal', icon: <MdWork />, path: '/placement' },
    { label: 'Complaint Box', icon: <MdInbox />, path: '/student/complaints' },
    { label: 'Class Chat', icon: <MdGroup />, path: '/student/chat' },
  ],
  teacher: [
    { label: 'Home', icon: <MdHome />, path: '/teacher' },
    { label: 'Timetable', icon: <MdSchedule />, path: '/teacher/timetable' },
    { label: 'Mark Attendance', icon: <MdHowToReg />, path: '/teacher/attendance' },
    { label: 'Add Marks', icon: <MdBarChart />, path: '/teacher/marks' },
    { label: 'Leave Requests', icon: <MdDescription />, path: '/teacher/leave' },
    { label: 'Complaint Box', icon: <MdInbox />, path: '/teacher/complaints' },
    { label: 'Class Chat', icon: <MdGroup />, path: '/teacher/chat' },
  ],
  mentor: [
    { label: 'Create Class', icon: <MdSchool />, path: '/mentor/classes' },
    { label: 'My Class', icon: <MdHome />, path: '/mentor' },
    { label: 'My Students', icon: <MdPeople />, path: '/mentor/students' },
    { label: 'Manage Exam History', icon: <MdSchool />, path: '/mentor/exam-history' },
    { label: 'AICTE Approvals', icon: <MdThumbUp />, path: '/mentor/aicte' },
    { label: 'Complaint Box', icon: <MdInbox />, path: '/mentor/complaints' },
    { label: 'Class Chat', icon: <MdGroup />, path: '/mentor/chat' },
  ],
  admin: [
    { label: 'Dashboard', icon: <MdDashboard />, path: '/admin' },
    { label: 'Manage Classes', icon: <MdSchool />, path: '/admin/classes' },
    { label: 'Manage Subjects', icon: <MdBook />, path: '/admin/subjects' },
    { label: 'Manage Users', icon: <MdGroup />, path: '/admin/users' },
    { label: 'Manage Timetable', icon: <MdSchedule />, path: '/admin/timetable' },
    { label: 'Upload Marks Cards', icon: <MdDescription />, path: '/admin/marks-cards' },
    { label: 'Post Events', icon: <MdEventNote />, path: '/admin/events' },
    { label: 'Complaint Box', icon: <MdInbox />, path: '/admin/complaints' },
    { label: 'Class Chat', icon: <MdGroup />, path: '/admin/chat' },
  ],
};

export default function Sidebar({ isOpen, onClose }) {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMentor, setIsMentor] = useState(false);

  useEffect(() => {
    if (!userProfile || userProfile.role !== 'teacher') return;
    const checkMentorStatus = async () => {
      try {
        const classesList = await getClasses();
        const uid = userProfile.uid;
        const matches = classesList.some(c => c.mentor_id === uid || c.advisor_id === uid);
        setIsMentor(matches);
      } catch (err) {
        console.error("Failed to fetch classes in sidebar", err);
      }
    };
    checkMentorStatus();
  }, [userProfile]);

  const role = userProfile?.role || 'student';
  let navItems = [...(NAV_ITEMS[role] || [])];

  if (role === 'admin') {
    if (userProfile?.is_super_admin) {
      // Super Admin nav items
      navItems = [
        { label: 'Dashboard', icon: <MdDashboard />, path: '/admin' },
        { label: 'Manage Branches', icon: <MdSettings />, path: '/admin/branches' },
        { label: 'Manage Classes', icon: <MdSchool />, path: '/admin/classes' },
        { label: 'Manage Subjects', icon: <MdBook />, path: '/admin/subjects' },
        { label: 'Manage Users', icon: <MdGroup />, path: '/admin/users' },
        { label: 'Manage Calendar & PDFs', icon: <MdCalendarToday />, path: '/admin/timetable' },
        { label: 'Post Events', icon: <MdEventNote />, path: '/admin/events' },
        { label: 'Complaint Box', icon: <MdInbox />, path: '/admin/complaints' },
        { label: 'Class Chat', icon: <MdGroup />, path: '/admin/chat' },
      ];
    } else {
      // Branch Admin nav items
      navItems = [
        { label: 'Dashboard', icon: <MdDashboard />, path: '/admin' },
        { label: 'Branch Settings', icon: <MdSettings />, path: '/branch/settings' },
        { label: 'Manage Classes', icon: <MdSchool />, path: '/admin/classes' },
        { label: 'Manage Subjects', icon: <MdBook />, path: '/admin/subjects' },
        { label: 'Manage Users', icon: <MdGroup />, path: '/admin/users' },
        { label: 'Manage Timetable', icon: <MdSchedule />, path: '/admin/timetable' },
        { label: 'Upload Marks Cards', icon: <MdDescription />, path: '/admin/marks-cards' },
        { label: 'Post Events', icon: <MdEventNote />, path: '/admin/events' },
        { label: 'Complaint Box', icon: <MdInbox />, path: '/admin/complaints' },
        { label: 'Class Chat', icon: <MdGroup />, path: '/admin/chat' },
      ];
    }
  } else if (role === 'teacher' && isMentor) {
    const mentorItems = [
      { label: 'Mentor Dashboard', icon: <MdDashboard />, path: '/mentor' },
      { label: 'My Students', icon: <MdPeople />, path: '/mentor/students' },
      { label: 'Manage Exam History', icon: <MdSchool />, path: '/mentor/exam-history' },
      { label: 'AICTE Approvals', icon: <MdThumbUp />, path: '/mentor/aicte' },
    ];
    navItems = [
      ...navItems.slice(0, 4),
      ...mentorItems,
      ...navItems.slice(4)
    ];
  }

  if (role !== 'admin') {
    navItems.push({ label: 'My Documents', icon: <MdFolder />, path: '/documents' });
  }

  if (userProfile?.maintenance) {
    navItems = navItems.filter(item => 
      item.label === 'Class Chat' || item.label === 'My Documents'
    );
  }

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

  const roleLabel = {
    student: 'Student',
    teacher: 'Teacher',
    mentor: 'Mentor',
    admin: 'Admin',
  }[role] || role;

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
          <img src={logoImage} alt="Campus Twin Logo" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: '6px' }} />
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
          <div className="sidebar-section-label">{roleLabel} Menu</div>
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
          <div 
            className="sidebar-user" 
            onClick={() => handleNav('/profile')}
            style={{ cursor: 'pointer' }}
          >
            <div className="sidebar-user-avatar">
              {userProfile?.avatar_url ? (
                <img 
                  src={userProfile.avatar_url} 
                  alt="avatar" 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                initials
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userProfile?.name || 'User'}
              </div>
              <div className="sidebar-user-role">{userProfile?.usn || role}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
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
