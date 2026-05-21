import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { getAll, queryDocuments, listenComplaints } from '../../appwrite/database';
import { where } from '../../appwrite/database';
import { MdGroup, MdSchedule, MdEvent, MdCheckCircle, MdInbox, MdSchool } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ students: 0, teachers: 0, openComplaints: 0, events: 0, classes: 0 });

  useEffect(() => {
    // Static counts
    Promise.all([
      getAll('students'),
      getAll('teachers'),
      getAll('events'),
      getAll('classes'),
    ]).then(([students, teachers, events, classes]) => {
      setStats((prev) => ({ ...prev, students: students.length, teachers: teachers.length, events: events.length, classes: classes.length }));
    });
  }, []);

  useEffect(() => {
    // Real-time complaint count
    const unsub = listenComplaints((complaints) => {
      const open = complaints.filter((c) => c.status === 'open').length;
      setStats((prev) => ({ ...prev, openComplaints: open }));
    });
    return unsub;
  }, []);

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: '🎓', color: 'var(--primary-light)', iconColor: 'var(--primary)' },
    { label: 'Teachers & Mentors', value: stats.teachers, icon: '👨‍🏫', color: 'var(--success-light)', iconColor: 'var(--success)' },
    { label: 'Class Sections', value: stats.classes, icon: '🏫', color: 'var(--info-light)', iconColor: 'var(--info)' },
    { label: 'Open Complaints', value: stats.openComplaints, icon: '📬', color: 'var(--danger-light)', iconColor: 'var(--danger)' },
    { label: 'Events Posted', value: stats.events, icon: '🎉', color: 'var(--warning-light)', iconColor: '#856404' },
  ];

  const quickActions = [
    { label: 'Manage Classes', path: '/admin/classes', icon: <MdSchool />, desc: 'Create branches, years and sections' },
    { label: 'Manage Users', path: '/admin/users', icon: <MdGroup />, desc: 'Create student, teacher, and admin accounts' },
    { label: 'Manage Timetable', path: '/admin/timetable', icon: <MdSchedule />, desc: 'Edit timetable and class schedules' },
    { label: 'Post Events', path: '/admin/events', icon: <MdEvent />, desc: 'Share announcements and upcoming events' },
    { label: 'Complaint Box', path: '/admin/complaints', icon: <MdInbox />, desc: 'Review and resolve anonymous complaints' },
    { label: 'Upload Marks Cards', path: '/admin/marks-cards', icon: <MdCheckCircle />, desc: 'Upload semester PDFs for students' },
  ];

  return (
    <Layout pageTitle="Admin Dashboard">
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-subtitle">Overview of campus activity</p>

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
              style={{ cursor: 'pointer', transition: 'box-shadow 0.15s', borderColor: 'var(--border)' }}
              onClick={() => navigate(item.path)}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
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
