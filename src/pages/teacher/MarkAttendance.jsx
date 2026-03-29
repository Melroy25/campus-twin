import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { getStudentsByClass, addDocument, queryDocuments } from '../../firebase/firestore';
import { where } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { MdSave } from 'react-icons/md';

export default function TeacherMarkAttendance() {
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadStudents = async () => {
    if (!classId.trim()) return toast.error('Enter class ID');
    setLoading(true);
    const data = await getStudentsByClass(classId.trim());
    setStudents(data);
    const init = {};
    data.forEach((s) => { init[s.id] = 'present'; });
    setAttendance(init);
    setLoading(false);
  };

  const toggleAttendance = (studentId) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }));
  };

  const saveAttendance = async () => {
    if (!subject) return toast.error('Enter a subject');
    if (students.length === 0) return toast.error('Load students first');
    setSaving(true);
    try {
      await Promise.all(students.map((s) =>
        addDocument('attendance', {
          student_id: s.id,
          subject,
          date,
          status: attendance[s.id] || 'absent',
        })
      ));
      toast.success('Attendance saved for all students!');
    } catch { toast.error('Failed to save attendance'); }
    finally { setSaving(false); }
  };

  const presentCount = Object.values(attendance).filter((v) => v === 'present').length;

  return (
    <Layout pageTitle="Mark Attendance">
      <h1 className="page-title">Mark Attendance</h1>
      <p className="page-subtitle">Record student attendance for your class</p>

      <div className="card mb-24">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <input className="form-control" style={{ maxWidth: 200 }} placeholder="Class ID (e.g. CS-A-2024)" value={classId} onChange={(e) => setClassId(e.target.value)} />
          <input className="form-control" style={{ maxWidth: 180 }} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <input type="date" className="form-control" style={{ maxWidth: 170 }} value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-primary" onClick={loadStudents}>Load Students</button>
        </div>

        {loading ? (
          <div className="loader-container" style={{ minHeight: 100 }}><div className="loader" /></div>
        ) : students.length === 0 ? (
          <div className="empty-state"><p>Load a class to see students.</p></div>
        ) : (
          <>
            <div className="flex-between mb-16">
              <h3>Student List ({students.length})</h3>
              <span className="badge badge-approved">Present: {presentCount} / {students.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {students.map((student) => {
                const isPresent = attendance[student.id] === 'present';
                return (
                  <div key={student.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', borderRadius: 'var(--radius)',
                    border: `1.5px solid ${isPresent ? 'var(--success)' : 'var(--danger)'}`,
                    background: isPresent ? 'var(--success-light)' : 'var(--danger-light)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }} onClick={() => toggleAttendance(student.id)}>
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
    </Layout>
  );
}
