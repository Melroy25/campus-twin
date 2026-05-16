import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getById, queryDocuments } from '../../appwrite/database';
import { where } from '../../appwrite/database';
import { useNavigate } from 'react-router-dom';
import {
  MdHowToReg, MdBarChart, MdSchool, MdToday, MdPeople, MdArrowForward
} from 'react-icons/md';

export default function TeacherHome() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const assignments = userProfile?.class_assignments || [];

      // Fetch class details
      const classDetails = await Promise.all(
        assignments.map(async (a) => {
          const cls = await getById('classes', a.class_id);
          return { ...a, classInfo: cls };
        })
      );
      setAssignedClasses(classDetails);

      // Today's timetable entries for all assigned classes
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = days[new Date().getDay()];
      const scheduleEntries = [];
      for (const a of assignments) {
        const entries = await queryDocuments(
          'timetable',
          where('class_id', '==', a.class_id),
          where('day', '==', today),
          ...(a.subject ? [where('subject', '==', a.subject)] : [])
        );
        scheduleEntries.push(...entries.map((e) => ({ ...e, subject: a.subject })));
      }
      setTodaySchedule(scheduleEntries);

      // Recent attendance sessions (last 5)
      const allRecent = [];
      for (const a of assignments) {
        const records = await queryDocuments(
          'attendance',
          where('subject', '==', a.subject || '')
        );
        // Get unique dates
        const dates = [...new Set(records.map((r) => r.date))].sort().reverse().slice(0, 3);
        dates.forEach((d) => {
          const presentForDate = records.filter((r) => r.date === d && r.status === 'present').length;
          const totalForDate = records.filter((r) => r.date === d).length;
          allRecent.push({ date: d, subject: a.subject, present: presentForDate, total: totalForDate, class_id: a.class_id });
        });
      }
      allRecent.sort((a, b) => b.date.localeCompare(a.date));
      setRecentAttendance(allRecent.slice(0, 5));
      setLoading(false);
    };
    if (userProfile) load();
  }, [userProfile]);

  const quickActions = [
    { label: 'Mark Attendance', icon: <MdHowToReg />, path: '/teacher/attendance', color: 'var(--primary-light)', iconColor: 'var(--primary)' },
    { label: 'Add Marks', icon: <MdBarChart />, path: '/teacher/marks', color: 'var(--success-light)', iconColor: 'var(--success)' },
  ];

  return (
    <Layout pageTitle="Teacher Home">
      <h1 className="page-title">Hello, {userProfile?.name?.split(' ')[0] || 'Teacher'} 👋</h1>
      <p className="page-subtitle">Your class assignments and today's overview</p>

      {/* Quick actions */}
      <div className="grid-2 mb-24">
        {quickActions.map((a) => (
          <div
            key={a.path}
            className="card"
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px' }}
            onClick={() => navigate(a.path)}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--radius)',
              background: a.color, color: a.iconColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
            }}>{a.icon}</div>
            <div style={{ flex: 1 }}>
              <div className="font-semibold">{a.label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Quick access</div>
            </div>
            <MdArrowForward style={{ color: 'var(--text-muted)' }} />
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Assigned classes */}
          <div className="card">
            <h3 className="mb-16"><MdSchool style={{ verticalAlign: 'middle' }} /> Your Assigned Classes</h3>
            {assignedClasses.length === 0 ? (
              <div className="empty-state" style={{ minHeight: 100 }}>
                <p>No classes assigned yet. Contact admin.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {assignedClasses.map((a, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: 'var(--primary-light)', color: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.78rem', flexShrink: 0,
                    }}>{a.classInfo?.branch || '?'}</div>
                    <div>
                      <div className="font-semibold" style={{ fontSize: '0.9rem' }}>
                        {a.classInfo?.label || a.class_id}
                      </div>
                      {a.subject && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                          📚 {a.subject}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's schedule */}
          <div className="card">
            <h3 className="mb-16"><MdToday style={{ verticalAlign: 'middle' }} /> Today's Schedule</h3>
            {todaySchedule.length === 0 ? (
              <div className="empty-state" style={{ minHeight: 100 }}>
                <p>No classes scheduled for today.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todaySchedule.map((s) => (
                  <div key={s.id} style={{
                    padding: '10px 12px', background: 'var(--primary-light)',
                    borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span className="font-semibold" style={{ fontSize: '0.88rem' }}>{s.subject}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>{s.time || s.period}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent attendance */}
      {recentAttendance.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="mb-16"><MdPeople style={{ verticalAlign: 'middle' }} /> Recent Attendance Sessions</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Present / Total</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {recentAttendance.map((r, i) => {
                  const pct = r.total ? Math.round((r.present / r.total) * 100) : 0;
                  return (
                    <tr key={i}>
                      <td>{r.date}</td>
                      <td>{r.subject}</td>
                      <td>{r.present} / {r.total}</td>
                      <td style={{ fontWeight: 700, color: pct >= 75 ? 'var(--success)' : 'var(--danger)' }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
