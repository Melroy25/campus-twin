import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getById, queryDocuments, getAll, updateDocument } from '../../appwrite/database';
import { where } from '../../appwrite/database';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  MdHowToReg, MdBarChart, MdSchool, MdToday, MdPeople, MdArrowForward
} from 'react-icons/md';

export default function TeacherHome() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [conductedToday, setConductedToday] = useState([]);
  const [activeTab, setActiveTab] = useState('conducted');
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [advisingClasses, setAdvisingClasses] = useState([]);
  const [enablingChatId, setEnablingChatId] = useState(null);

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

      // Fetch classes conducted today (attendance marked by this teacher)
      const todayDateStr = new Date().toISOString().split('T')[0];
      const todayRecords = await queryDocuments('attendance', [
        where('date', '==', todayDateStr)
      ]);
      const myTodayRecords = todayRecords.filter(r => r.marked_by === userProfile.uid);

      // Group records by class_id + subject + time
      const grouped = {};
      myTodayRecords.forEach(r => {
        const key = `${r.class_id}-${r.subject}-${r.time || 'N/A'}`;
        if (!grouped[key]) {
          const matchAssignment = classDetails.find(cd => cd.class_id === r.class_id);
          const classLabel = matchAssignment?.classInfo?.label || r.class_id;
          
          grouped[key] = {
            class_id: r.class_id,
            classLabel,
            subject: r.subject,
            time: r.time,
            present: 0,
            total: 0
          };
        }
        grouped[key].total++;
        if (r.status === 'present') {
          grouped[key].present++;
        }
      });
      setConductedToday(Object.values(grouped));

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

      // Fetch advising classes
      try {
        const allClassList = await getAll('classes');
        const advising = allClassList.filter(c => c.advisor_id === userProfile.uid);
        setAdvisingClasses(advising);
      } catch (err) {
        console.error("Failed to load advising classes", err);
      }

      setLoading(false);
    };
    if (userProfile) load();
  }, [userProfile]);

  const handleEnableChat = async (classId) => {
    setEnablingChatId(classId);
    try {
      await updateDocument('classes', classId, { chat_enabled: true });
      toast.success("Class Chat Group has been enabled!");
      // Update state locally
      setAdvisingClasses(prev => prev.map(c => c.id === classId ? { ...c, chat_enabled: true } : c));
    } catch (err) {
      toast.error("Failed to enable class chat");
      console.error(err);
    } finally {
      setEnablingChatId(null);
    }
  };

  const quickActions = [
    { label: 'Mark Attendance', icon: <MdHowToReg />, path: '/teacher/attendance', color: 'var(--primary-light)', iconColor: 'var(--primary)' },
    { label: 'Add Marks', icon: <MdBarChart />, path: '/teacher/marks', color: 'var(--success-light)', iconColor: 'var(--success)' },
  ];

  return (
    <Layout pageTitle="Teacher Home">
      <h1 className="page-title">Hello, {userProfile?.name?.split(' ')[0] || 'Teacher'} 👋</h1>
      <p className="page-subtitle">Your class assignments and today's overview</p>

      {/* Class Advisor Panel */}
      {advisingClasses.length > 0 && (
        <div className="card mb-24" style={{
          background: 'linear-gradient(135deg, var(--primary-light) 0%, rgba(23, 129, 227, 0.05) 100%)',
          borderColor: 'var(--primary)',
          borderWidth: '1.5px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--primary)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '1.1rem'
            }}>🏫</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)' }}>Class Advisor Panel</h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>Manage communication groups for your advised class sections</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {advisingClasses.map((cls) => (
              <div key={cls.id} style={{
                padding: '14px 16px',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{cls.label}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Status: {cls.chat_enabled ? (
                      <span className="badge badge-approved" style={{ margin: 0, fontSize: '0.7rem' }}>Chat Enabled</span>
                    ) : (
                      <span className="badge badge-pending" style={{ margin: 0, fontSize: '0.7rem' }}>Chat Disabled</span>
                    )}
                  </div>
                </div>
                
                <div>
                  {cls.chat_enabled ? (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => navigate(`/teacher/chat?class_id=${cls.id}`)}
                    >
                      Join Chat Group
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleEnableChat(cls.id)}
                      disabled={enablingChatId === cls.id}
                    >
                      {enablingChatId === cls.id ? 'Enabling...' : 'Enable Class Chat'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

          {/* Today's Schedule & Conducted Classes */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><MdToday style={{ verticalAlign: 'middle' }} /> Today's Classes</h3>
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 2, borderRadius: 6 }}>
                <button
                  className="btn btn-sm"
                  style={{
                    padding: '4px 8px', fontSize: '0.75rem',
                    background: activeTab === 'conducted' ? 'white' : 'transparent',
                    color: activeTab === 'conducted' ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: activeTab === 'conducted' ? 'var(--shadow-sm)' : 'none',
                    border: 'none', cursor: 'pointer'
                  }}
                  onClick={() => setActiveTab('conducted')}
                >
                  Conducted ({conductedToday.length})
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    padding: '4px 8px', fontSize: '0.75rem',
                    background: activeTab === 'timetable' ? 'white' : 'transparent',
                    color: activeTab === 'timetable' ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: activeTab === 'timetable' ? 'var(--shadow-sm)' : 'none',
                    border: 'none', cursor: 'pointer'
                  }}
                  onClick={() => setActiveTab('timetable')}
                >
                  Schedule ({todaySchedule.length})
                </button>
              </div>
            </div>

            {activeTab === 'conducted' ? (
              conductedToday.length === 0 ? (
                <div className="empty-state" style={{ minHeight: 120 }}>
                  <p className="mb-12" style={{ fontSize: '0.85rem' }}>No classes conducted today yet.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/teacher/attendance')}>
                    Mark Attendance Now
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {conductedToday.map((c, idx) => (
                    <div key={idx} style={{
                      padding: '12px 14px', border: '1.5px solid var(--success-light)',
                      background: 'var(--success-light)', borderRadius: 'var(--radius)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <div className="font-semibold" style={{ fontSize: '0.9rem', color: 'var(--success)' }}>
                          {c.classLabel} — {c.subject}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          🕒 {c.time || 'N/A'}
                        </div>
                      </div>
                      <span className="badge badge-approved" style={{ fontSize: '0.78rem' }}>
                        Present: {c.present} / {c.total}
                      </span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              todaySchedule.length === 0 ? (
                <div className="empty-state" style={{ minHeight: 120 }}>
                  <p style={{ fontSize: '0.85rem' }}>No classes scheduled for today in timetable.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todaySchedule.map((s) => (
                    <div key={s.id} style={{
                      padding: '10px 12px', background: 'var(--primary-light)',
                      borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span className="font-semibold" style={{ fontSize: '0.88rem' }}>{s.subject}</span>
                        <div style={{ fontSize: '0.78rem', color: 'var(--primary)' }}>{s.time || s.period}</div>
                      </div>
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{ background: 'white', fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => navigate(`/teacher/attendance?class_id=${s.class_id}&subject=${s.subject}&time=${encodeURIComponent(s.time)}`)}
                      >
                        Mark
                      </button>
                    </div>
                  ))}
                </div>
              )
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
