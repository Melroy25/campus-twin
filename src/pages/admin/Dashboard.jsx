import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { getAll, listenComplaints } from '../../appwrite/database';
import { useAuth } from '../../context/AuthContext';
import { MdGroup, MdSchedule, MdEvent, MdCheckCircle, MdInbox, MdSchool, MdSettings, MdAnalytics, MdCalendarToday, MdEmail } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ students: 0, teachers: 0, openComplaints: 0, events: 0, classes: 0 });

  useEffect(() => {
    // Static counts
    Promise.all([
      getAll('students'),
      getAll('teachers'),
      getAll('events'),
      getAll('classes'),
    ]).then(([students, teachers, events, classes]) => {
      if (userProfile?.is_super_admin) {
        // Super Admin gets all data
        setStats((prev) => ({
          ...prev,
          students: students.length,
          teachers: teachers.length,
          events: events.length,
          classes: classes.length
        }));
      } else {
        // Branch Admin gets filtered data
        const branchId = userProfile?.branch_id;
        const filteredStudents = students.filter(s => s.branch_id === branchId);
        const filteredTeachers = teachers.filter(t => t.branch_id === branchId || t.department === branchId);
        const filteredClasses = classes.filter(c => c.branch === branchId || c.class_id?.startsWith(branchId));
        // Events are usually global but let's keep all
        setStats((prev) => ({
          ...prev,
          students: filteredStudents.length,
          teachers: filteredTeachers.length,
          events: events.length,
          classes: filteredClasses.length
        }));
      }
    });
  }, [userProfile]);

  useEffect(() => {
    // Real-time complaint count
    const unsub = listenComplaints((complaints) => {
      const open = complaints.filter((c) => {
        if (userProfile?.is_super_admin) {
          return c.status === 'open';
        } else {
          return c.status === 'open' && (c.branch_id === userProfile?.branch_id || c.category === userProfile?.branch_id);
        }
      }).length;
      setStats((prev) => ({ ...prev, openComplaints: open }));
    });
    return unsub;
  }, [userProfile]);

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: '🎓', color: 'var(--primary-light)', iconColor: 'var(--primary)' },
    { label: 'Teachers & Mentors', value: stats.teachers, icon: '👨‍🏫', color: 'var(--success-light)', iconColor: 'var(--success)' },
    { label: 'Class Sections', value: stats.classes, icon: '🏫', color: 'var(--info-light)', iconColor: 'var(--info)' },
    { label: 'Open Complaints', value: stats.openComplaints, icon: '📬', color: 'var(--danger-light)', iconColor: 'var(--danger)' },
    { label: 'Events Posted', value: stats.events, icon: '🎉', color: 'var(--warning-light)', iconColor: '#856404' },
  ];

  // Dynamic quick actions depending on Super vs Branch admin
  const quickActions = userProfile?.is_super_admin ? [
    { label: 'Manage Branches', path: '/admin/branches', icon: <MdSettings />, desc: 'Configure departments and maintenance status' },
    { label: 'Manage Classes', path: '/admin/classes', icon: <MdSchool />, desc: 'Create branches, years and sections' },
    { label: 'Manage Users', path: '/admin/users', icon: <MdGroup />, desc: 'Create student, teacher, and admin accounts' },
    { label: 'Manage Calendar', path: '/admin/timetable?tab=coe', icon: <MdCalendarToday />, desc: 'Set semester dates and Calendar of Events' },
    { label: 'Post Events', path: '/admin/events', icon: <MdEvent />, desc: 'Share announcements and upcoming events' },
    { label: 'Complaint Box', path: '/admin/complaints', icon: <MdInbox />, desc: 'Review and resolve anonymous complaints' },
    { label: 'Parent Emailer', path: '/admin/emailer', icon: <MdEmail />, desc: 'Send marks & attendance reports to parents' },
  ] : [
    { label: 'Branch Settings', path: '/branch/settings', icon: <MdSettings />, desc: 'Manage department settings and maintenance mode' },
    { label: 'Manage Classes', path: '/admin/classes', icon: <MdSchool />, desc: 'Create sections and configure class settings' },
    { label: 'Manage Users', path: '/admin/users', icon: <MdGroup />, desc: 'Create student, teacher, and admin accounts' },
    { label: 'Manage Timetable', path: '/admin/timetable', icon: <MdSchedule />, desc: 'Edit weekly class timetable grids' },
    { label: 'Post Events', path: '/admin/events', icon: <MdEvent />, desc: 'Share announcements and upcoming events' },
    { label: 'Complaint Box', path: '/admin/complaints', icon: <MdInbox />, desc: 'Review and resolve anonymous complaints' },
    { label: 'Upload Marks Cards', path: '/admin/marks-cards', icon: <MdCheckCircle />, desc: 'Upload semester PDFs for students' },
    { label: 'Parent Emailer', path: '/admin/emailer', icon: <MdEmail />, desc: 'Send marks & attendance reports to parents' },
  ];

  return (
    <Layout pageTitle="Admin Dashboard">
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-subtitle">
        {userProfile?.is_super_admin 
          ? 'Overview of campus activity (Main Admin)' 
          : `Overview of department activity (${userProfile?.branch_id} Admin)`}
      </p>

      <div className="stat-grid mb-24">
        {statCards.map((c) => (
          <div key={c.label} className="stat-card">
            <div className="stat-icon" style={{ background: c.color, color: c.iconColor, fontSize: '1.3rem' }}>{c.icon}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="mb-16">Quick Actions</h3>
        <div className="grid-2">
          {quickActions.map((item) => (
            <div
              key={item.path}
              className="card"
              style={{ cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s', borderColor: 'var(--border)' }}
              onClick={() => navigate(item.path)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: 8 }}>{item.icon}</div>
              <h4 style={{ marginBottom: 4, color: 'var(--text-primary)' }}>{item.label}</h4>
              <p style={{ fontSize: '0.82rem' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
