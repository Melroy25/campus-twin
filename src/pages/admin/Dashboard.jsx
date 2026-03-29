import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { getAll, queryDocuments } from '../../firebase/firestore';
import { where } from 'firebase/firestore';
import { MdGroup, MdSchedule, MdEvent, MdCheckCircle, MdPending } from 'react-icons/md';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, teachers: 0, pendingIssues: 0, events: 0 });

  useEffect(() => {
    Promise.all([
      getAll('students'),
      getAll('teachers'),
      queryDocuments('comments', where('status', '==', 'pending')),
      getAll('events'),
    ]).then(([students, teachers, issues, events]) => {
      setStats({ students: students.length, teachers: teachers.length, pendingIssues: issues.length, events: events.length });
    });
  }, []);

  const cards = [
    { label: 'Total Students', value: stats.students, icon: '🎓', color: 'var(--primary-light)', iconColor: 'var(--primary)' },
    { label: 'Total Teachers', value: stats.teachers, icon: '👨‍🏫', color: 'var(--success-light)', iconColor: 'var(--success)' },
    { label: 'Pending Issues', value: stats.pendingIssues, icon: '⚠️', color: 'var(--warning-light)', iconColor: '#856404' },
    { label: 'Events Posted', value: stats.events, icon: '🎉', color: 'var(--info-light)', iconColor: 'var(--info)' },
  ];

  return (
    <Layout pageTitle="Admin Dashboard">
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-subtitle">Overview of campus activity</p>

      <div className="stat-grid mb-24">
        {cards.map((c) => (
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
          {[
            { label: 'Manage Users', path: '/admin/users', icon: <MdGroup />, desc: 'Create student, teacher, mentor accounts' },
            { label: 'Manage Timetable', path: '/admin/timetable', icon: <MdSchedule />, desc: 'Edit timetable and approve issue reports' },
            { label: 'Upload Marks Cards', path: '/admin/marks-cards', icon: <MdCheckCircle />, desc: 'Upload semester PDFs for students' },
            { label: 'Post Events', path: '/admin/events', icon: <MdEvent />, desc: 'Share announcements and events' },
          ].map((item) => (
            <a key={item.path} href={item.path} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s', borderColor: 'var(--border)' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
              >
                <div style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: 8 }}>{item.icon}</div>
                <h4 style={{ marginBottom: 4, color: 'var(--text-primary)' }}>{item.label}</h4>
                <p style={{ fontSize: '0.82rem' }}>{item.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  );
}
