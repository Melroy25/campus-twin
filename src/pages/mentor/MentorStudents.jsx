import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import {
  queryDocuments, getById,
  getAttendanceByStudent, getAttendanceSummary, getAICTEByStudent, getStudentsByClass,
  updateDocument
} from '../../appwrite/database';
import { where } from '../../appwrite/database';
import { MdPeople, MdSearch, MdExpandMore, MdExpandLess, MdStar, MdCheckCircle } from 'react-icons/md';
import { toast } from 'react-hot-toast';

export default function MentorStudents() {
  const { userProfile, currentUser } = useAuth();
  const [mentees, setMentees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menteeData, setMenteeData] = useState({});
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  // Parent details editor states
  const [editingParentStudent, setEditingParentStudent] = useState(null);
  const [parentForm, setParentForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (!currentUser?.uid) return;
    const load = async () => {
      // 1. Fetch students who have this mentor assigned directly
      const directStudents = await queryDocuments('students', [where('mentor_id', '==', currentUser.uid)]);

      // 2. Fetch classes where this teacher is the mentor or advisor
      const [mentoredClasses, advisedClasses] = await Promise.all([
        queryDocuments('classes', [where('mentor_id', '==', currentUser.uid)]),
        queryDocuments('classes', [where('advisor_id', '==', currentUser.uid)])
      ]);

      // Merge unique classes
      const classMap = new Map();
      mentoredClasses.forEach(c => classMap.set(c.id || c.$id, c));
      advisedClasses.forEach(c => classMap.set(c.id || c.$id, c));
      const myClasses = Array.from(classMap.values());

      // 3. Fetch students belonging to those classes
      const classStudentsPromises = myClasses.map(cls => getStudentsByClass(cls.id));
      const classStudentsResults = await Promise.all(classStudentsPromises);
      const classStudents = classStudentsResults.flat();

      // 4. Merge lists by unique student ID
      const studentsMap = new Map();
      directStudents.forEach(s => studentsMap.set(s.id, s));
      classStudents.forEach(s => studentsMap.set(s.id, s));
      const students = Array.from(studentsMap.values());

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

  const startEditParent = (s) => {
    setEditingParentStudent(s.id);
    setParentForm({
      name: s.parent1_name || '',
      email: s.parent1_email || '',
      phone: s.parent1_phone || ''
    });
  };

  const handleSaveParent = async (studentId) => {
    try {
      await updateDocument('students', studentId, {
        parent1_name: parentForm.name,
        parent1_email: parentForm.email,
        parent1_phone: parentForm.phone
      });
      // Update local state
      setMentees(prev => prev.map(m => m.id === studentId ? {
        ...m,
        parent1_name: parentForm.name,
        parent1_email: parentForm.email,
        parent1_phone: parentForm.phone
      } : m));
      setEditingParentStudent(null);
      toast.success('Parent details updated!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update parent details: ' + err.message);
    }
  };

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

                      {/* Parent Details Block */}
                      <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <h4 style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                            👪 Parent Details
                          </h4>
                          {editingParentStudent !== s.id && (
                            <button
                              onClick={() => startEditParent(s)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            >
                              Edit Details
                            </button>
                          )}
                        </div>

                        {editingParentStudent === s.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-1)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            <div className="grid-3" style={{ gap: 10 }}>
                              <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Parent Name(s)</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={parentForm.name}
                                  onChange={(e) => setParentForm(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="e.g. John & Mary Doe"
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Parent Email(s)</label>
                                <input
                                  type="email"
                                  className="form-control form-control-sm"
                                  value={parentForm.email}
                                  onChange={(e) => setParentForm(prev => ({ ...prev, email: e.target.value }))}
                                  placeholder="e.g. parent@example.com"
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Parent Phone(s)</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={parentForm.phone}
                                  onChange={(e) => setParentForm(prev => ({ ...prev, phone: e.target.value }))}
                                  placeholder="e.g. +91 9876543210"
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => setEditingParentStudent(null)}
                                className="btn btn-outline btn-sm"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveParent(s.id)}
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                Save Details
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid-3" style={{ gap: 12, background: 'var(--surface-1)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            <div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Name(s)</span>
                              <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{s.parent1_name || '—'}</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Email(s)</span>
                              <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{s.parent1_email || '—'}</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Phone Number(s)</span>
                              <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{s.parent1_phone || '—'}</strong>
                            </div>
                          </div>
                        )}
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
