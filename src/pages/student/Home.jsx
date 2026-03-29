import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { listenEvents, getAttendanceByStudent, getAttendanceSummary, getAICTEByStudent } from '../../firebase/firestore';
import { MdCheckCircle, MdStar, MdEvent, MdPerson } from 'react-icons/md';

export default function StudentHome() {
  const { userProfile, currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [aicteTotal, setAicteTotal] = useState(0);

  useEffect(() => {
    const unsub = listenEvents(setEvents);
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    getAttendanceByStudent(currentUser.uid).then((records) => {
      setAttendance(getAttendanceSummary(records));
    });
    getAICTEByStudent(currentUser.uid).then((items) => {
      const total = items
        .filter((i) => i.status === 'approved')
        .reduce((sum, i) => sum + (Number(i.points) || 0), 0);
      setAicteTotal(Math.min(total, 25));
    });
  }, [currentUser]);

  const avgAttendance = attendance.length
    ? Math.round(attendance.reduce((s, a) => s + a.percentage, 0) / attendance.length)
    : null;

  const formatDate = (val) => {
    if (!val) return '';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Layout pageTitle="Home">
      <div>
        {/* Greeting */}
        <div className="mb-24">
          <h1 className="page-title">👋 Hello, {userProfile?.name?.split(' ')[0] || 'Student'}!</h1>
          <p className="page-subtitle">Here's what's happening at your campus today.</p>
        </div>

        {/* Stat Cards */}
        <div className="stat-grid mb-24">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <MdCheckCircle />
            </div>
            <div className="stat-value">
              {avgAttendance !== null ? `${avgAttendance}%` : '—'}
            </div>
            <div className="stat-label">Avg. Attendance</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--warning-light)', color: '#856404' }}>
              <MdStar />
            </div>
            <div className="stat-value">{aicteTotal}/25</div>
            <div className="stat-label">AICTE Points</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <MdPerson />
            </div>
            <div className="stat-value">{userProfile?.class_id || '—'}</div>
            <div className="stat-label">Class</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
              <MdEvent />
            </div>
            <div className="stat-value">{events.length}</div>
            <div className="stat-label">Upcoming Events</div>
          </div>
        </div>

        {/* Events / Announcements */}
        <div className="card">
          <div className="flex-between mb-16">
            <h3>📢 Announcements & Events</h3>
            <a href="/student/events" style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 500 }}>
              View all →
            </a>
          </div>

          {events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <p>No upcoming events posted yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {events.slice(0, 5).map((ev) => (
                <div key={ev.id} style={{
                  display: 'flex', gap: 16, alignItems: 'flex-start',
                  padding: '12px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', flexShrink: 0,
                  }}>
                    {ev.image ? <img src={ev.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : '🎉'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ev.title}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(ev.date)}</span>
                    </div>
                    <p style={{ fontSize: '0.82rem' }}>{ev.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
