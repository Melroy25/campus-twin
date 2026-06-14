import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getStudentsByClass, addDocument, updateDocument, getById, getAll, queryDocuments, where } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdSave, MdBarChart } from 'react-icons/md';

export default function TeacherAddMarks() {
  const { userProfile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const raw = userProfile?.class_assignments || [];
      const [withInfo, subjectsData] = await Promise.all([
        Promise.all(
          raw.map(async (a) => {
            const cls = await getById('classes', a.class_id);
            return { ...a, classInfo: cls };
          })
        ),
        getAll('subjects')
      ]);
      setSubjects(subjectsData);
      setAssignments(withInfo);
      if (withInfo.length > 0) {
        const subDoc = subjectsData.find(s => s.courseName === withInfo[0].subject);
        loadStudents(withInfo[0].class_id, withInfo[0].subject, subDoc?.is_lab_integrated === true);
      }
    };
    if (userProfile) load();
  }, [userProfile]);

  const loadStudents = async (classId, subjectName, isIntegrated) => {
    setLoading(true);
    try {
      const [studentsData, marksData] = await Promise.all([
        getStudentsByClass(classId),
        queryDocuments('marks', [
          where('subject', '==', subjectName || '')
        ])
      ]);

      setStudents(studentsData);

      const initMarks = {};
      studentsData.forEach((s) => {
        const existingDoc = marksData.find(m => m.student_id === s.id);
        if (existingDoc) {
          try {
            const parsed = JSON.parse(existingDoc.marks_obtained);
            initMarks[s.id] = {
              docId: existingDoc.id || existingDoc.$id,
              ia1: parsed.ia1 !== undefined && parsed.ia1 !== null ? String(parsed.ia1) : '',
              ia2: parsed.ia2 !== undefined && parsed.ia2 !== null ? String(parsed.ia2) : '',
              ass1: parsed.ass1 !== undefined && parsed.ass1 !== null ? String(parsed.ass1) : '',
              ass2: parsed.ass2 !== undefined && parsed.ass2 !== null ? String(parsed.ass2) : '',
              lab1: parsed.lab1 !== undefined && parsed.lab1 !== null ? String(parsed.lab1) : '',
              lab2: parsed.lab2 !== undefined && parsed.lab2 !== null ? String(parsed.lab2) : '',
              total: parsed.total ?? 0
            };
          } catch (e) {
            initMarks[s.id] = { docId: existingDoc.id || existingDoc.$id, ia1: '', ia2: '', ass1: '', ass2: '', lab1: '', lab2: '', total: 0 };
          }
        } else {
          initMarks[s.id] = { docId: null, ia1: '', ia2: '', ass1: '', ass2: '', lab1: '', lab2: '', total: 0 };
        }
      });
      setMarks(initMarks);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load students or marks');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (m, isIntegrated) => {
    const ia1 = m.ia1 === '' ? 0 : Number(m.ia1) || 0;
    const ia2 = m.ia2 === '' ? 0 : Number(m.ia2) || 0;
    const ass1 = m.ass1 === '' ? 0 : Number(m.ass1) || 0;
    const ass2 = m.ass2 === '' ? 0 : Number(m.ass2) || 0;

    if (isIntegrated) {
      const lab1 = m.lab1 === '' ? 0 : Number(m.lab1) || 0;
      const lab2 = m.lab2 === '' ? 0 : Number(m.lab2) || 0;

      // Lab CIE = (IA1 + IA2) * 0.2 [Max 20] + (Lab1 + Lab2) * 0.1 [Max 10] + Assg1 + Assg2 [Max 20]
      const theoryIaPortion = (ia1 + ia2) * 0.2;
      const labPortion = (lab1 + lab2) * 0.1;
      const assPortion = ass1 + ass2;

      const finalTotal = theoryIaPortion + labPortion + assPortion; // Max 50
      return Math.round(finalTotal);
    }

    // Theory CIE = (IA1 + IA2) * 0.3 [Max 30] + Assg1 + Assg2 [Max 20]
    const theoryIaScaled = (ia1 + ia2) * 0.3;
    const assSum = ass1 + ass2;
    const theoryTotal = theoryIaScaled + assSum; // Max 50

    return Math.round(theoryTotal);
  };

  const handleAssignmentChange = (idx) => {
    setSelectedIdx(idx);
    const assignment = assignments[idx];
    if (assignment) {
      const subDoc = subjects.find(s => s.courseName === assignment.subject);
      loadStudents(assignment.class_id, assignment.subject, subDoc?.is_lab_integrated === true);
    }
  };

  const updateMark = (studentId, field, value) => {
    setMarks((prev) => {
      const updatedStudent = { ...prev[studentId], [field]: value };
      const current = assignments[selectedIdx];
      const subDoc = subjects.find(s => s.courseName === current?.subject);
      const isIntegrated = subDoc?.is_lab_integrated === true;
      updatedStudent.total = calculateTotal(updatedStudent, isIntegrated);
      return { ...prev, [studentId]: updatedStudent };
    });
  };

  const saveAllMarks = async () => {
    const current = assignments[selectedIdx];
    if (students.length === 0) return toast.error('Load students first');
    const currentSubject = subjects.find(s => s.courseName === current?.subject);
    const isIntegrated = currentSubject?.is_lab_integrated === true;

    setSaving(true);
    try {
      await Promise.all(students.map(async (s) => {
        const m = marks[s.id] || {};
        const total = calculateTotal(m, isIntegrated);

        const payload = {
          ia1: m.ia1 === '' ? null : Number(m.ia1),
          ia2: m.ia2 === '' ? null : Number(m.ia2),
          ass1: m.ass1 === '' ? null : Number(m.ass1),
          ass2: m.ass2 === '' ? null : Number(m.ass2),
          ...(isIntegrated ? {
            lab1: m.lab1 === '' ? null : Number(m.lab1),
            lab2: m.lab2 === '' ? null : Number(m.lab2),
          } : {}),
          total: total
        };

        const marksObtainedJson = JSON.stringify(payload);

        if (m.docId) {
          // Update
          await updateDocument('marks', m.docId, {
            marks_obtained: marksObtainedJson,
            semester: current.classInfo?.semester || '1st Semester',
            createdAt: new Date().toISOString()
          });
        } else {
          // Create
          const newDoc = await addDocument('marks', {
            student_id: s.id,
            exam_type: 'Internal',
            subject: current.subject || '',
            marks_obtained: marksObtainedJson,
            max_marks: '50',
            semester: current.classInfo?.semester || '1st Semester',
            createdAt: new Date().toISOString()
          });
          // Update local state with docId
          setMarks(prev => ({
            ...prev,
            [s.id]: { ...prev[s.id], docId: newDoc.id || newDoc.$id }
          }));
        }
      }));
      toast.success('Marks saved for all students!');
    } catch (e) {
      console.error(e);
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
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
              🏫 Class: <strong>{current.classInfo?.label || current.class_id}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;
              ⚙️ Course Type: <strong>{subjects.find(s => s.courseName === current.subject)?.is_lab_integrated ? 'Lab Integrated' : 'Theory Only'}</strong>
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
                      <th>IA 1 /50</th>
                      <th>IA 2 /50</th>
                      <th>Assg 1 /10</th>
                      <th>Assg 2 /10</th>
                      {subjects.find(sub => sub.courseName === current?.subject)?.is_lab_integrated && (
                        <>
                          <th>Lab 1 /50</th>
                          <th>Lab 2 /50</th>
                        </>
                      )}
                      <th>Total /50</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const m = marks[s.id] || {};
                      const isIntegrated = subjects.find(sub => sub.courseName === current?.subject)?.is_lab_integrated === true;
                      const total = calculateTotal(m, isIntegrated);
                      
                      const fields = isIntegrated 
                        ? ['ia1', 'ia2', 'ass1', 'ass2', 'lab1', 'lab2']
                        : ['ia1', 'ia2', 'ass1', 'ass2'];

                      return (
                        <tr key={s.id}>
                          <td className="font-semibold">{s.name}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{s.usn}</td>
                          {fields.map((field) => {
                            const maxVal = (field.startsWith('ia') || field.startsWith('lab')) ? 50 : 10;
                            return (
                              <td key={field}>
                                <input
                                  type="number" min={0} max={maxVal}
                                  placeholder={`/${maxVal}`}
                                  className="form-control"
                                  style={{ width: 70, padding: '6px 8px', textAlign: 'center' }}
                                  value={m[field] ?? ''}
                                  onChange={(e) => updateMark(s.id, field, e.target.value)}
                                />
                              </td>
                            );
                          })}
                          <td className="font-bold" style={{ color: total >= 40 ? 'var(--success)' : total >= 25 ? 'var(--info)' : 'var(--danger)' }}>
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
