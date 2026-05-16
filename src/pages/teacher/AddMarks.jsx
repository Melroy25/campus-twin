import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getStudentsByClass, addDocument, getById } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdSave, MdBarChart } from 'react-icons/md';

export default function TeacherAddMarks() {
  const { userProfile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      if (withInfo.length > 0) loadStudents(withInfo[0].class_id);
    };
    if (userProfile) load();
  }, [userProfile]);

  const loadStudents = async (classId) => {
    setLoading(true);
    const data = await getStudentsByClass(classId);
    setStudents(data);
    const initMarks = {};
    data.forEach((s) => { initMarks[s.id] = { test1: '', test2: '', assignment: '' }; });
    setMarks(initMarks);
    setLoading(false);
  };

  const handleAssignmentChange = (idx) => {
    setSelectedIdx(idx);
    loadStudents(assignments[idx]?.class_id);
  };

  const updateMark = (studentId, field, value) => {
    setMarks((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const saveAllMarks = async () => {
    const current = assignments[selectedIdx];
    if (students.length === 0) return toast.error('Load students first');
    setSaving(true);
    try {
      await Promise.all(students.map((s) => {
        const m = marks[s.id] || {};
        return addDocument('marks', {
          student_id: s.id,
          class_id: current.class_id,
          subject: current.subject || '',
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

  const current = assignments[selectedIdx];

  return (
    <Layout pageTitle="Add Marks">
      <h1 className="page-title">Add Internal Marks</h1>
      <p className="page-subtitle">Enter test and assignment marks for your assigned classes</p>

      {assignments.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 200 }}>
          <div className="empty-icon"><MdBarChart /></div>
          <p>No classes assigned to you yet. Contact admin to assign classes.</p>
        </div>
      ) : (
        <div className="card mb-24">
          {/* Class selector */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Select Class & Subject</label>
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
          </div>

          {current && (
            <div style={{ marginBottom: 14, padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              📚 Subject: <strong>{current.subject || 'N/A'}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;
              🏫 Class: <strong>{current.classInfo?.label || current.class_id}</strong>
            </div>
          )}

          {loading ? (
            <div className="loader-container" style={{ minHeight: 100 }}><div className="loader" /></div>
          ) : students.length === 0 ? (
            <div className="empty-state"><p>No students found in this class.</p></div>
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
                          {['test1', 'test2', 'assignment'].map((field) => (
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
                          <td className="font-bold" style={{ color: total >= 24 ? 'var(--success)' : total >= 18 ? 'var(--info)' : 'var(--danger)' }}>
                            {total}
                          </td>
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
      )}
    </Layout>
  );
}
