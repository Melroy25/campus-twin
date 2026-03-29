import { useState } from 'react';
import Layout from '../../components/Layout';
import { getStudentsByClass, getMarksByStudent, setDocument, addDocument } from '../../firebase/firestore';
import { toast } from 'react-hot-toast';
import { MdSave } from 'react-icons/md';

export default function TeacherAddMarks() {
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadStudents = async () => {
    if (!classId.trim() || !subject.trim()) return toast.error('Enter class ID and subject');
    setLoading(true);
    const data = await getStudentsByClass(classId.trim());
    setStudents(data);
    const initMarks = {};
    data.forEach((s) => { initMarks[s.id] = { test1: '', test2: '', assignment: '' }; });
    setMarks(initMarks);
    setLoading(false);
  };

  const updateMark = (studentId, field, value) => {
    setMarks((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const saveAllMarks = async () => {
    if (students.length === 0) return toast.error('Load students first');
    setSaving(true);
    try {
      await Promise.all(students.map((s) => {
        const m = marks[s.id] || {};
        return addDocument('marks', {
          student_id: s.id,
          subject,
          test1: Number(m.test1) || 0,
          test2: Number(m.test2) || 0,
          assignment: Number(m.assignment) || 0,
          total: (Number(m.test1) || 0) + (Number(m.test2) || 0) + (Number(m.assignment) || 0),
        });
      }));
      toast.success('Marks saved for all students!');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <Layout pageTitle="Add Marks">
      <h1 className="page-title">Add Internal Marks</h1>
      <p className="page-subtitle">Enter test and assignment marks for your class</p>

      <div className="card mb-24">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <input className="form-control" style={{ maxWidth: 200 }} placeholder="Class ID" value={classId} onChange={(e) => setClassId(e.target.value)} />
          <input className="form-control" style={{ maxWidth: 200 }} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <button className="btn btn-primary" onClick={loadStudents}>Load Students</button>
        </div>

        {loading ? (
          <div className="loader-container" style={{ minHeight: 100 }}><div className="loader" /></div>
        ) : students.length === 0 ? (
          <div className="empty-state"><p>Load a class to add marks.</p></div>
        ) : (
          <>
            <div className="table-wrapper" style={{ marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>USN</th>
                    <th>Test 1 /10</th>
                    <th>Test 2 /10</th>
                    <th>Assignment /10</th>
                    <th>Total /30</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const m = marks[s.id] || {};
                    const total = (Number(m.test1) || 0) + (Number(m.test2) || 0) + (Number(m.assignment) || 0);
                    return (
                      <tr key={s.id}>
                        <td className="font-semibold">{s.name}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{s.usn}</td>
                        {['test1','test2','assignment'].map((field) => (
                          <td key={field}>
                            <input
                              type="number" min={0} max={10}
                              className="form-control"
                              style={{ width: 70, padding: '6px 8px', textAlign: 'center' }}
                              value={m[field]}
                              onChange={(e) => updateMark(s.id, field, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="font-bold" style={{ color: total >= 24 ? 'var(--success)' : total >= 18 ? 'var(--info)' : 'var(--danger)' }}>{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button className="btn btn-primary" onClick={saveAllMarks} disabled={saving}>
              <MdSave /> {saving ? 'Saving...' : 'Save All Marks'}
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}
