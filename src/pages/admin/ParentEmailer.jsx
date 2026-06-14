import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { getAll, getAttendanceByStudent, getAttendanceSummary, getMarksByStudent } from '../../appwrite/database';
import { useAuth } from '../../context/AuthContext';
import { MdEmail, MdPeople, MdCheckCircle, MdSchool, MdArrowBack } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function ParentEmailer() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [allMarks, setAllMarks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Email sending status states
  const [selectedStudents, setSelectedStudents] = useState({});
  const [sendingStatus, setSendingStatus] = useState({}); // studentId -> 'idle' | 'sending' | 'success' | 'failed'
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAll('classes'),
      getAll('students'),
      getAll('attendance'),
      getAll('marks'),
      getAll('subjects')
    ]).then(([classesData, studentsData, attendanceData, marksData, subjectsData]) => {
      // Filter by branch if not super admin
      if (userProfile?.is_super_admin) {
        setClasses(classesData);
        setStudents(studentsData);
      } else {
        const branchId = userProfile?.branch_id;
        const filteredClasses = classesData.filter(c => c.branch === branchId || c.class_id?.startsWith(branchId));
        const filteredStudents = studentsData.filter(s => s.branch_id === branchId);
        setClasses(filteredClasses);
        setStudents(filteredStudents);
      }
      setAllAttendance(attendanceData);
      setAllMarks(marksData);
      setSubjects(subjectsData);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      toast.error('Failed to load data.');
      setLoading(false);
    });
  }, [userProfile]);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStudents = students.filter(s => s.class_id === selectedClassId);

  const parseMarkDetails = (m, isIntegrated) => {
    let details = {
      ia1: null,
      ia2: null,
      ass1: null,
      ass2: null,
      lab1: null,
      lab2: null,
      total: 0,
      isIntegrated: isIntegrated,
      isLegacy: false
    };

    if (m.marks_obtained) {
      try {
        const parsed = JSON.parse(m.marks_obtained);
        details = {
          ia1: parsed.ia1 ?? null,
          ia2: parsed.ia2 ?? null,
          ass1: parsed.ass1 ?? null,
          ass2: parsed.ass2 ?? null,
          lab1: parsed.lab1 ?? null,
          lab2: parsed.lab2 ?? null,
          total: parsed.total ?? 0,
          isIntegrated: isIntegrated,
          isLegacy: false
        };
      } catch (e) {
        console.error("Failed to parse marks_obtained JSON", e);
      }
    } else {
      // Fallback to legacy fields
      const t1 = m.test1 ?? null;
      const t2 = m.test2 ?? null;
      const ass = m.assignment ?? null;
      const tot = (t1 || 0) + (t2 || 0) + (ass || 0);
      details = {
        ia1: t1,
        ia2: t2,
        ass1: ass,
        ass2: null,
        lab1: null,
        lab2: null,
        total: tot,
        isIntegrated: false,
        isLegacy: true
      };
    }
    return details;
  };

  const getGrade = (parsed) => {
    let obtainedSum = 0;
    let maxSum = 0;

    const iaMax = parsed.isLegacy ? 10 : 50;
    const assMax = 10;
    const labMax = 50;

    if (parsed.ia1 !== null) { obtainedSum += parsed.ia1; maxSum += iaMax; }
    if (parsed.ia2 !== null) { obtainedSum += parsed.ia2; maxSum += iaMax; }
    if (parsed.ass1 !== null) { obtainedSum += parsed.ass1; maxSum += assMax; }
    if (parsed.ass2 !== null) { obtainedSum += parsed.ass2; maxSum += assMax; }
    
    if (parsed.isIntegrated) {
      if (parsed.lab1 !== null) { obtainedSum += parsed.lab1; maxSum += labMax; }
      if (parsed.lab2 !== null) { obtainedSum += parsed.lab2; maxSum += labMax; }
    }

    if (maxSum === 0) return { grade: '—', label: 'No Marks Uploaded', color: '#64748b' };

    const scaleFactor = 2; 
    const pct = ((obtainedSum * scaleFactor) / (maxSum * scaleFactor)) * 100;
    if (pct >= 90) return { grade: 'O', label: 'Outstanding', color: '#10b981' };
    if (pct >= 80) return { grade: 'A+', label: 'Excellent', color: '#3b82f6' };
    if (pct >= 70) return { grade: 'A', label: 'Very Good', color: '#6366f1' };
    if (pct >= 60) return { grade: 'B+', label: 'Good', color: '#f59e0b' };
    if (pct >= 50) return { grade: 'B', label: 'Average', color: '#a855f7' };
    return { grade: 'F', label: 'Fail / Shortage', color: '#ef4444' };
  };

  // Computes student summary data (attendance average + CIE marks list)
  const getStudentMetrics = (studentId) => {
    // 1. Attendance
    const studAttendance = allAttendance.filter(a => a.student_id === studentId);
    const summary = getAttendanceSummary(studAttendance);
    const avgAttendance = summary.length
      ? Math.round(summary.reduce((s, a) => s + a.percentage, 0) / summary.length)
      : null;
    const attendanceList = summary.map(a => ({
      subject: a.subject,
      present: a.present || 0,
      absent: a.absent || 0,
      percentage: a.percentage
    }));

    // 2. Marks
    const studMarks = allMarks.filter(m => m.student_id === studentId);
    const marksList = studMarks.map(m => {
      const subDoc = subjects.find(s => s.courseName.trim().toLowerCase() === m.subject.trim().toLowerCase());
      const isIntegrated = subDoc?.is_lab_integrated === true;
      const parsed = parseMarkDetails(m, isIntegrated);
      const { grade, color } = getGrade(parsed);

      return {
        subject: m.subject,
        ia1: parsed.ia1,
        ia2: parsed.ia2,
        ass1: parsed.ass1,
        ass2: parsed.ass2,
        lab1: parsed.isIntegrated ? parsed.lab1 : 'NA',
        lab2: parsed.isIntegrated ? parsed.lab2 : 'NA',
        total: parsed.total,
        isLegacy: parsed.isLegacy,
        grade,
        color
      };
    });

    return { avgAttendance, attendanceList, marksList };
  };

  const handleSelectAll = (e) => {
    const checked = e.target.checked;
    const nextSelected = {};
    classStudents.forEach(s => {
      if (s.parent1_email) {
        nextSelected[s.id] = checked;
      }
    });
    setSelectedStudents(nextSelected);
  };

  const handleToggleSelect = (id) => {
    setSelectedStudents(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Triggers Netlify Serverless API request
  const sendEmailReport = async (student, metrics) => {
    try {
      const response = await fetch('/.netlify/functions/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: student.name,
          usn: student.usn,
          classLabel: selectedClass?.label || student.class_id,
          email: student.parent1_email,
          marksList: metrics.marksList,
          attendancePct: metrics.avgAttendance,
          attendanceList: metrics.attendanceList
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Server error');
      return resData;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSendBatch = async () => {
    const toSend = classStudents.filter(s => selectedStudents[s.id] && s.parent1_email);
    if (toSend.length === 0) {
      return toast.error('No students selected or no parent emails available.');
    }

    setIsSendingBatch(true);
    setProgress(0);
    
    const initialStatus = {};
    toSend.forEach(s => { initialStatus[s.id] = 'sending'; });
    setSendingStatus(initialStatus);

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < toSend.length; i++) {
      const student = toSend[i];
      const metrics = getStudentMetrics(student.id);

      try {
        await sendEmailReport(student, metrics);
        setSendingStatus(prev => ({ ...prev, [student.id]: 'success' }));
        succeeded++;
      } catch (err) {
        setSendingStatus(prev => ({ ...prev, [student.id]: 'failed' }));
        failed++;
      }

      setProgress(Math.round(((i + 1) / toSend.length) * 100));
    }

    setIsSendingBatch(false);
    toast.success(`Dispatched complete: ${succeeded} succeeded, ${failed} failed.`);
  };

  const selectedCount = Object.values(selectedStudents).filter(Boolean).length;

  return (
    <Layout pageTitle="Parent Emailer Hub">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <button 
          onClick={() => navigate('/admin')}
          className="btn btn-ghost"
          style={{ padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Back to Dashboard"
        >
          <MdArrowBack size={20} />
        </button>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Parent Emailer Hub</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Broadcast internal marks and attendance cards to parents via SMTP mailers</p>
        </div>
      </div>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 250 }}><div className="loader" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Class Selector Card */}
          <div className="card" style={{ border: '1px solid var(--border)' }}>
            <h3 className="mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdSchool style={{ color: 'var(--primary)' }} /> Select Target Class Section
            </h3>
            
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="form-control"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedStudents({});
                  setSendingStatus({});
                  setProgress(0);
                }}
                style={{ maxWidth: 320 }}
              >
                <option value="">-- Choose a Class Section --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.label} ({c.semester} Sem)</option>
                ))}
              </select>
              
              {selectedClassId && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  👥 {classStudents.length} Students found in section
                </span>
              )}
            </div>
          </div>

          {/* Students list */}
          {selectedClassId && (
            <div className="card" style={{ border: '1px solid var(--border)', padding: 0, overflow: 'hidden' }}>
              
              {/* Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Mailing Roster</h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Select students to receive report cards. Email addresses must be assigned by mentors beforehand.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {selectedCount} Selected
                  </span>
                  <button
                    onClick={handleSendBatch}
                    disabled={isSendingBatch || selectedCount === 0}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}
                  >
                    <MdEmail /> Send Email Broadcast
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {isSendingBatch && (
                <div style={{ background: 'var(--border)', height: 6, position: 'relative' }}>
                  <div style={{ background: 'var(--success)', height: '100%', width: `${progress}%`, transition: 'width 0.4s ease' }} />
                </div>
              )}

              {/* Table */}
              {classStudents.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <div className="empty-icon"><MdPeople /></div>
                  <p>No students assigned to this class section yet.</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ margin: 0, borderRadius: 0, border: 'none' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', padding: '12px 16px' }}>
                          <input 
                            type="checkbox"
                            onChange={handleSelectAll}
                            checked={classStudents.length > 0 && classStudents.every(s => !s.parent1_email || selectedStudents[s.id])}
                          />
                        </th>
                        <th>Student Name</th>
                        <th>USN</th>
                        <th>Parent Email(s)</th>
                        <th style={{ textAlign: 'center' }}>Attendance</th>
                        <th style={{ textAlign: 'center' }}>Grade Stats</th>
                        <th style={{ textAlign: 'center' }}>Mailing Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map(s => {
                        const metrics = getStudentMetrics(s.id);
                        const isSelected = !!selectedStudents[s.id];
                        const status = sendingStatus[s.id] || 'idle';

                        return (
                          <tr key={s.id} style={{ background: isSelected ? 'rgba(79, 70, 229, 0.02)' : 'transparent' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                disabled={!s.parent1_email || isSendingBatch}
                                onChange={() => handleToggleSelect(s.id)}
                              />
                            </td>
                            <td>
                              <strong style={{ color: 'var(--text-primary)' }}>{s.name}</strong>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{s.usn}</span>
                            </td>
                            <td>
                              {s.parent1_email ? (
                                <span style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  {s.parent1_email.split(';').map((email, idx) => (
                                    <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      ✉️ <span style={{ fontFamily: 'monospace' }}>{email.trim()}</span>
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>⚠️ Missing Contact</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              {metrics.avgAttendance !== null ? (
                                <span style={{ color: metrics.avgAttendance >= 75 ? 'var(--success)' : 'var(--danger)' }}>
                                  {metrics.avgAttendance}%
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                                {metrics.marksList.length} Subjects graded
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {status === 'idle' && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ready</span>}
                              {status === 'sending' && <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>⏳ Sending...</span>}
                              {status === 'success' && <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 'bold' }}>✅ Sent</span>}
                              {status === 'failed' && <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 'bold' }}>❌ Failed</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
