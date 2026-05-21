import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getStudentsByClass, addDocument, getById } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdSave, MdHowToReg } from 'react-icons/md';

export default function TeacherMarkAttendance() {
  const { userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const classIdParam = searchParams.get('class_id');
  const subjectParam = searchParams.get('subject');

  const [assignments, setAssignments] = useState([]); // [{class_id, subject, classInfo}]
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [date, setDate] = useState(() => searchParams.get('date') || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => {
    const paramTime = searchParams.get('time');
    if (paramTime) return paramTime;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  });
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load teacher's class assignments on mount
  useEffect(() => {
    const load = async () => {
      const raw = userProfile?.class_assignments || [];
      const withInfo = await Promise.all(
        raw.map(async (a) => {
          const cls = await getById('classes', a.class_id);
          return { ...a, classInfo: cls };
        })
      );
      setAssignments(withInfo);

      let initialIdx = 0;
      if (classIdParam && subjectParam) {
        const foundIdx = withInfo.findIndex(
          (a) => a.class_id === classIdParam && a.subject === subjectParam
        );
        if (foundIdx !== -1) {
          initialIdx = foundIdx;
        }
      }

      setSelectedIdx(initialIdx);
      if (withInfo.length > 0) {
        loadStudents(withInfo[initialIdx].class_id);
      }
    };
    if (userProfile) load();
  }, [userProfile, classIdParam, subjectParam]);

  const loadStudents = async (classId) => {
    if (!classId) return;
    setLoading(true);
    const data = await getStudentsByClass(classId);
    setStudents(data);
    const init = {};
    data.forEach((s) => { init[s.id] = 'present'; });
    setAttendance(init);
    setLoading(false);
  };

  const handleAssignmentChange = (idx) => {
    setSelectedIdx(idx);
    loadStudents(assignments[idx]?.class_id);
  };

  const toggleAttendance = (studentId) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }));
  };

  const markAll = (status) => {
    const updated = {};
    students.forEach((s) => { updated[s.id] = status; });
    setAttendance(updated);
  };

  const saveAttendance = async () => {
    const current = assignments[selectedIdx];
    if (!current?.subject) return toast.error('Selected assignment has no subject');
    if (students.length === 0) return toast.error('No students in this class');
    setSaving(true);
    try {
      await Promise.all(students.map((s) =>
        addDocument('attendance', {
          student_id: s.id,
          class_id: current.class_id,
          subject: current.subject,
          date,
          time,
          status: attendance[s.id] || 'absent',
          marked_by: userProfile.uid,
        })
      ));
      toast.success(`Attendance saved for ${current.classInfo?.label || current.class_id} — ${current.subject}!`);
    } catch { toast.error('Failed to save attendance'); }
    finally { setSaving(false); }
  };

  const presentCount = Object.values(attendance).filter((v) => v === 'present').length;
  const current = assignments[selectedIdx];

  return (
    <Layout pageTitle="Mark Attendance">
      <h1 className="page-title">Mark Attendance</h1>
      <p className="page-subtitle">Record student attendance for your assigned classes</p>

      {assignments.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 200 }}>
          <div className="empty-icon"><MdHowToReg /></div>
          <p>No classes assigned to you yet. Contact admin to assign classes.</p>
        </div>
      ) : (
        <div className="card mb-24">
          {/* Class selector */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Class & Subject</label>
              <select
                className="form-control"
                value={selectedIdx}
                onChange={(e) => handleAssignmentChange(Number(e.target.value))}
              >
                {assignments.map((a, i) => (
                  <option key={i} value={i}>
                    {a.classInfo?.label || a.class_id}{a.subject ? ` — ${a.subject}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ marginBottom: 4 }}>Date</label>
              <input
                type="date" className="form-control"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label" style={{ marginBottom: 4 }}>Time / Slot</label>
              <input
                type="text" className="form-control"
                placeholder="e.g. 09:30 AM or Period 1"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="loader-container" style={{ minHeight: 100 }}><div className="loader" /></div>
          ) : students.length === 0 ? (
            <div className="empty-state"><p>No students found in this class.</p></div>
          ) : (
            <>
              <div className="flex-between mb-16">
                <h3>Students ({students.length})</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge badge-approved">Present: {presentCount} / {students.length}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => markAll('present')}>All Present</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => markAll('absent')}>All Absent</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {students.map((student) => {
                  const isPresent = attendance[student.id] === 'present';
                  return (
                    <div
                      key={student.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', borderRadius: 'var(--radius)',
                        border: `1.5px solid ${isPresent ? 'var(--success)' : 'var(--danger)'}`,
                        background: isPresent ? 'var(--success-light)' : 'var(--danger-light)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onClick={() => toggleAttendance(student.id)}
                    >
                      <div>
                        <span className="font-semibold" style={{ fontSize: '0.9rem' }}>{student.name}</span>
                        <span style={{ marginLeft: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{student.usn}</span>
                      </div>
                      <span className={`badge badge-${isPresent ? 'present' : 'absent'}`}>
                        {isPresent ? '✓ Present' : '✗ Absent'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 20 }}>
                <button className="btn btn-primary btn-block" onClick={saveAttendance} disabled={saving}>
                  <MdSave /> {saving ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Layout>
  );
}
