import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import {
  queryDocuments, getById,
  getAttendanceByStudent, getAttendanceSummary, getAICTEByStudent, getStudentsByClass
} from '../../appwrite/database';
import { where } from '../../appwrite/database';
import { MdPeople, MdSearch, MdExpandMore, MdExpandLess, MdStar, MdCheckCircle } from 'react-icons/md';

export default function MentorStudents() {
  const { userProfile, currentUser } = useAuth();
  const [mentees, setMentees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menteeData, setMenteeData] = useState({});
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!currentUser?.uid) return;
    const load = async () => {
      // Fetch students who have this mentor assigned
      const students = await queryDocuments('students', where('mentor_id', '==', currentUser.uid));
      setMentees(students);

      // Fetch distinct class details for these students
      const classIds = [...new Set(students.map(s => s.class_id).filter(Boolean))];
      const classData = await Promise.all(classIds.map(id => getById('classes', id)));
      setClasses(classData.filter(Boolean));

      const data = {};
      await Promise.all(students.map(async (s) => {
        const [attendance, aicte] = await Promise.all([
          getAttendanceByStudent(s.id),
          getAICTEByStudent(s.id),
        ]);
        const summary = getAttendanceSummary(attendance);
        const avgPct = summary.length
          ? Math.round(summary.reduce((sum, r) => sum + r.percentage, 0) / summary.length)
          : null;
        data[s.id] = {
          summary,
          avgPct,
          aicte,
          pendingAICTE: aicte.filter((a) => a.status === 'pending').length,
          approvedAICTE: aicte.filter((a) => a.status === 'approved').length,
          totalAICTEPoints: aicte
            .filter((a) => a.status === 'approved')
            .reduce((sum, a) => sum + (Number(a.points) || 0), 0),
        };
      }));
      setMenteeData(data);
      setLoading(false);
    };
    load();
  }, [currentUser, userProfile]);

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const attnColor = (pct) => {
    if (pct === null || pct === undefined) return 'var(--text-muted)';
    if (pct >= 75) return 'var(--success)';
    if (pct >= 60) return '#f59e0b';
    return 'var(--danger)';
  };

  const clsName = (classId) => {
    const c = classes.find((cl) => cl.id === classId);
    return c?.label || classId || '—';
  };

  const filtered = mentees.filter((m) =>
    (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.usn || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout pageTitle="My Mentees">
      <h1 className="page-title">My Mentees</h1>
      <p className="page-subtitle">Detailed view of all your assigned students</p>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <MdSearch style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }} />
        <input
          className="form-control"
          placeholder="Search by name or USN…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {filtered.length} of {mentees.length} mentees
        </span>
      </div>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MdPeople /></div>
          <p>{search ? 'No students match your search.' : 'No mentees assigned yet.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((s) => {
            const d = menteeData[s.id] || {};
            const isOpen = expanded[s.id];
            return (
              <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header row */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', cursor: 'pointer',
                  }}
                  onClick={() => toggleExpand(s.id)}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: 'var(--primary)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '1rem', flexShrink: 0,
                  }}>{s.name?.charAt(0)?.toUpperCase()}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-semibold">{s.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {s.usn} · {clsName(s.class_id)}
                    </div>
                  </div>

                  {/* Quick badges */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      fontWeight: 700, fontSize: '0.9rem',
                      color: attnColor(d.avgPct),
                    }}>{d.avgPct !== null && d.avgPct !== undefined ? `${d.avgPct}%` : '–'}</div>
                    {d.pendingAICTE > 0 && (
                      <span className="badge badge-pending" style={{ fontSize: '0.72rem' }}>
                        <MdStar style={{ verticalAlign: 'middle' }} /> {d.pendingAICTE}
                      </span>
                    )}
                    {isOpen ? <MdExpandLess /> : <MdExpandMore />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--surface-2)' }}>
                    <div className="grid-2" style={{ gap: 16 }}>
                      {/* Attendance breakdown */}
                      <div>
                        <h4 style={{ fontSize: '0.85rem', marginBottom: 10 }}>
                          <MdCheckCircle style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--success)' }} />
                          Attendance by Subject
                        </h4>
                        {d.summary?.length === 0 ? (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No attendance records yet.</p>
                        ) : (
                          d.summary?.map((row) => (
                            <div key={row.subject} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                                <span>{row.subject}</span>
                                <span style={{ fontWeight: 700, color: attnColor(row.percentage) }}>{row.percentage}%</span>
                              </div>
                              <div style={{ height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${row.percentage}%`,
                                  background: attnColor(row.percentage),
                                  borderRadius: 10, transition: 'width 0.4s',
                                }} />
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* AICTE summary */}
                      <div>
                        <h4 style={{ fontSize: '0.85rem', marginBottom: 10 }}>
                          <MdStar style={{ verticalAlign: 'middle', marginRight: 4, color: '#f59e0b' }} />
                          AICTE Points
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[
                            { label: 'Total Submissions', value: d.aicte?.length || 0 },
                            { label: 'Approved', value: d.approvedAICTE || 0, color: 'var(--success)' },
                            { label: 'Pending Approval', value: d.pendingAICTE || 0, color: '#f59e0b' },
                            { label: 'Total Points Earned', value: d.totalAICTEPoints || 0, color: 'var(--primary)' },
                          ].map((item) => (
                            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                              <span style={{ fontWeight: 700, color: item.color || 'var(--text-primary)' }}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
