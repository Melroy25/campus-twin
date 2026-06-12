import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import {
  queryDocuments, getById, getAttendanceByStudent, getAttendanceSummary,
  getAICTEByStudent, updateDocument, getClasses, getStudentsByClass
} from '../../appwrite/database';
import { where } from '../../appwrite/database';
import { MdPeople, MdSchool, MdCheckCircle, MdStar, MdPerson } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function MentorHome() {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const [mentees, setMentees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menteeStats, setMenteeStats] = useState({});

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

      // Load mentor's classes from multiple sources:
      // 1. Classes assigned to the mentor in class_assignments
      // 2. Classes of the mentor's mentees
      // 3. Classes where mentor_id/advisor_id matches currentUser.uid
      let mentorClasses = [];
      try {
        const allClasses = await getClasses();
        const assignedClassIds = new Set([
          ...(userProfile?.class_assignments || []).map(a => a.class_id).filter(Boolean),
          ...students.map(s => s.class_id).filter(Boolean)
        ]);
        mentorClasses = allClasses.filter(c => assignedClassIds.has(c.id) || c.mentor_id === currentUser.uid || c.advisor_id === currentUser.uid);
      } catch (err) {
        console.error("Failed to load classes via getClasses, falling back to getById:", err);
        const assignedClassIds = (userProfile?.class_assignments || []).map((a) => a.class_id).filter(Boolean);
        const menteeClassIds = students.map((s) => s.class_id).filter(Boolean);
        const allClassIds = [...new Set([...assignedClassIds, ...menteeClassIds])];
        const classData = await Promise.all(allClassIds.map((id) => getById('classes', id)));
        mentorClasses = classData.filter(Boolean);
      }
      setClasses(mentorClasses);

      // Get quick stats per mentee
      const stats = {};
      await Promise.all(students.map(async (s) => {
        const [attendance, aicte] = await Promise.all([
          getAttendanceByStudent(s.id),
          getAICTEByStudent(s.id),
        ]);
        const summary = getAttendanceSummary(attendance);
        const avgPct = summary.length
          ? Math.round(summary.reduce((sum, r) => sum + r.percentage, 0) / summary.length)
          : null;
        const pendingAICTE = aicte.filter((a) => a.status === 'pending').length;
        stats[s.id] = { avgPct, pendingAICTE, aicteTotal: aicte.length };
      }));
      setMenteeStats(stats);
      setLoading(false);
    };
    load();
  }, [currentUser, userProfile]);

  const attnColor = (pct) => {
    if (pct === null) return 'var(--text-muted)';
    if (pct >= 75) return 'var(--success)';
    if (pct >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  const mentorClasses = classes;
  const menteesByClass = mentorClasses.map((cls) => ({
    cls,
    students: mentees.filter((s) => s.class_id === cls.id),
  }));
  // Students with no class
  const unclassed = mentees.filter((s) => !s.class_id);

  return (
    <Layout pageTitle="Mentor Home">
      <h1 className="page-title">Hello, {userProfile?.name?.split(' ')[0] || 'Mentor'} 👋</h1>
      <p className="page-subtitle">Overview of your assigned mentees and their progress</p>

      {/* Quick stats */}
      <div className="stat-grid mb-24">
        {[
          { label: 'Total Mentees', value: mentees.length, icon: <MdPeople />, color: 'var(--primary-light)', iconColor: 'var(--primary)' },
          { label: 'Classes', value: classes.length, icon: <MdSchool />, color: 'var(--info-light)', iconColor: 'var(--info)' },
          {
            label: 'Low Attendance (<75%)',
            value: Object.values(menteeStats).filter((s) => s.avgPct !== null && s.avgPct < 75).length,
            icon: <MdCheckCircle />, color: 'var(--danger-light)', iconColor: 'var(--danger)',
          },
          {
            label: 'Pending AICTE',
            value: Object.values(menteeStats).reduce((sum, s) => sum + s.pendingAICTE, 0),
            icon: <MdStar />, color: 'var(--warning-light)', iconColor: '#856404',
          },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color, color: s.iconColor, fontSize: '1.3rem' }}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Assignment info */}
      {userProfile?.class_assignments?.length > 0 && (
        <div className="card mb-24" style={{ background: 'var(--primary-light)', borderColor: 'var(--primary)' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: 10 }}><MdSchool style={{ verticalAlign: 'middle' }} /> Your Assigned Classes</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(() => {
              const seen = new Set();
              return (userProfile.class_assignments
                .filter((a) => {
                  if (seen.has(a.class_id)) return false;
                  seen.add(a.class_id);
                  return true;
                })
                .map((a, i) => {
                  const cls = classes.find((c) => c.id === a.class_id);
                  return (
                    <span key={i} style={{
                      padding: '4px 12px', background: 'var(--primary)',
                      color: '#fff', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
                    }}>{cls?.label || a.class_id}</span>
                  );
                })
              );
            })()}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : (classes.length === 0 && unclassed.length === 0) ? (
        <div className="empty-state">
          <div className="empty-icon"><MdPeople /></div>
          <p>No classes or mentees assigned yet. Ask admin to assign classes or students to you.</p>
        </div>
      ) : (
        <>
          {menteesByClass.map(({ cls, students }) => (
            <div key={cls.id} className="card mb-16">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}><MdSchool style={{ verticalAlign: 'middle', marginRight: 6 }} />{cls.label}</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {cls.chat_enabled ? (
                    <>
                      <span className="badge badge-approved" style={{ margin: 0 }}>Class Chat Active</span>
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{ fontSize: '0.78rem', background: 'var(--primary-light)', padding: '5px 10px', cursor: 'pointer' }}
                        onClick={() => navigate(`/mentor/chat?class_id=${cls.id}`)}
                      >
                        Join Chat
                      </button>
                    </>
                  ) : (
                    <span className="badge badge-pending" style={{ margin: 0 }}>Chat Disabled (Awaiting Class Advisor)</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {students.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 14px' }}>
                    No mentees in this class section yet.
                  </p>
                ) : (
                  students.map((s) => {
                    const stat = menteeStats[s.id] || {};
                    return (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '12px 14px',
                          border: '1.5px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer', transition: 'box-shadow 0.15s',
                        }}
                        onClick={() => navigate('/mentor/students')}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%',
                          background: 'var(--primary)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                        }}>
                          {s.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="font-semibold" style={{ fontSize: '0.9rem' }}>{s.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.usn}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: attnColor(stat.avgPct) }}>
                            {stat.avgPct !== null ? `${stat.avgPct}%` : '—'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Attendance</div>
                        </div>
                        {stat.pendingAICTE > 0 && (
                          <span className="badge badge-pending" style={{ flexShrink: 0 }}>
                            <MdStar style={{ verticalAlign: 'middle' }} /> {stat.pendingAICTE} AICTE
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}

          {unclassed.length > 0 && (
            <div className="card mb-16">
              <h3 style={{ marginBottom: 14 }}>👤 Mentees (No Class Assigned)</h3>
              {unclassed.map((s) => (
                <div key={s.id} style={{ padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <MdPerson /><span className="font-semibold">{s.name}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.usn}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={() => navigate('/mentor/students')}>
              <MdPeople /> View All Mentees in Detail →
            </button>
          </div>
        </>
      )}
    </Layout>
  );
}
