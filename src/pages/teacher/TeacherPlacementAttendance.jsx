import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getStudentsByClass, addDocument, updateDocument, queryDocuments, getAll } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { MdSave, MdWork, MdCheck, MdHowToReg } from 'react-icons/md';

export default function TeacherPlacementAttendance() {
  const { userProfile } = useAuth();
  
  // Data States
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { student_uid: 'present' | 'absent' }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [teacherName, setTeacherName] = useState('');
  const [comment, setComment] = useState('');

  const [allAttendanceLogs, setAllAttendanceLogs] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryGroup, setSelectedHistoryGroup] = useState(null);
  const [condoneRequests, setCondoneRequests] = useState([]);

  // 1. Fetch all placement sessions & classes
  useEffect(() => {
    const initData = async () => {
      if (!userProfile?.uid) return;
      setLoading(true);
      try {
        if (userProfile?.name) {
          setTeacherName(userProfile.name);
        }

        // Fetch all placement sessions
        const allSess = await getAll('placementSessions');
        setSessions(allSess);

        // Fetch all academic classes to select class section
        const allClasses = await getAll('classes');
        setClasses(allClasses);

        // Fetch all placement attendance records for history
        const allAtt = await getAll('placementAttendance');
        setAllAttendanceLogs(allAtt);

        // Fetch all condone requests
        const allCondones = await getAll('placementCondoneRequests');
        setCondoneRequests(allCondones);

        if (allSess.length > 0) {
          setSelectedSession(allSess[0]);
        }
      } catch (err) {
        console.error('Error loading placement sessions:', err);
        toast.error('Failed to initialize placement attendance data');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [userProfile]);

  // 2. We allow selecting any class for session attendance marking
  const eligibleClasses = classes;

  // 3. Automatically select first class when session changes
  useEffect(() => {
    if (eligibleClasses.length > 0) {
      setSelectedClassId(eligibleClasses[0].id || eligibleClasses[0].$id);
      loadClassStudents(eligibleClasses[0].id || eligibleClasses[0].$id);
    } else {
      setSelectedClassId('');
      setStudents([]);
      setAttendance({});
    }
  }, [selectedSession, classes]);

  // 4. Load students for selected class and retrieve existing attendance
  const loadClassStudents = async (classId) => {
    if (!classId || !selectedSession) return;
    setLoading(true);
    try {
      // Get all students inside chosen class
      const classStuds = await getStudentsByClass(classId);
      setStudents(classStuds);

      // Query existing placement attendance records for this session
      const attDocs = await queryDocuments('placementAttendance', [
        Query.equal('session_id', selectedSession.$id)
      ]);

      const mapped = {};
      // Default all class students to 'absent' (or 'present' based on preference, absent is safer)
      classStuds.forEach(s => {
        mapped[s.uid || s.id] = 'absent';
      });

      // Overlay saved attendance status
      let loadedComment = '';
      attDocs.forEach(doc => {
        if (mapped[doc.student_uid] !== undefined) {
          mapped[doc.student_uid] = doc.status; // 'present' or 'absent'
          if (doc.comment) {
            loadedComment = doc.comment;
          }
        }
      });

      setAttendance(mapped);
      setComment(loadedComment);
    } catch (err) {
      console.error('Error loading class students:', err);
      toast.error('Failed to load class roster');
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    loadClassStudents(classId);
  };

  const toggleStudentAttendance = (studentUid) => {
    setAttendance(prev => ({
      ...prev,
      [studentUid]: prev[studentUid] === 'present' ? 'absent' : 'present'
    }));
  };

  const markAll = (status) => {
    const updated = {};
    students.forEach(s => {
      updated[s.uid || s.id] = status;
    });
    setAttendance(updated);
  };

  // 5. Submit attendance records to database
  const saveAttendance = async () => {
    if (!selectedSession) return toast.error('No session selected');
    if (students.length === 0) return toast.error('No students to mark');
    if (!teacherName.trim()) return toast.error('Please enter your name');

    setSaving(true);
    try {
      const selectedClass = classes.find(c => (c.id || c.$id) === selectedClassId);
      const classLabel = selectedClass ? (selectedClass.label || selectedClass.name || selectedClass.id) : '';
      const markedAt = new Date().toISOString();

      for (const student of students) {
        const studentUid = student.uid || student.id;
        const currentStatus = attendance[studentUid] || 'absent';

        // Always create a new document for multiple markings support
        await addDocument('placementAttendance', {
          session_id: selectedSession.$id,
          student_uid: studentUid,
          student_name: student.name,
          student_usn: student.usn,
          branch_id: student.branch_id || '',
          status: currentStatus,
          marked_at: markedAt,
          marked_by_name: teacherName.trim(),
          class_label: classLabel,
          comment: comment.trim()
        });
      }

      // Mark session attendance_marked to true in database
      await updateDocument('placementSessions', selectedSession.$id, {
        attendance_marked: true
      });

      // Refresh all sessions and local attendance logs
      const updatedAtt = await getAll('placementAttendance');
      setAllAttendanceLogs(updatedAtt);

      toast.success('Placement attendance logs updated successfully!');
    } catch (err) {
      console.error('Error saving placement attendance:', err);
      toast.error('Failed to save attendance logs');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveCondone = async (req) => {
    try {
      // 1. Update condone request status to 'approved'
      await updateDocument('placementCondoneRequests', req.$id, { status: 'approved' });
      
      // 2. Update attendance record status to 'present'
      await updateDocument('placementAttendance', req.attendance_id, { status: 'present' });
      
      toast.success('Attendance condone request approved!');
      
      // Refresh local data
      const updatedCondones = await getAll('placementCondoneRequests');
      setCondoneRequests(updatedCondones);
      const updatedAtt = await getAll('placementAttendance');
      setAllAttendanceLogs(updatedAtt);
    } catch (err) {
      console.error('Error approving condone:', err);
      toast.error('Failed to approve condone request');
    }
  };

  const handleRejectCondone = async (req) => {
    try {
      await updateDocument('placementCondoneRequests', req.$id, { status: 'rejected' });
      toast.success('Attendance condone request rejected');
      
      // Refresh local data
      const updatedCondones = await getAll('placementCondoneRequests');
      setCondoneRequests(updatedCondones);
    } catch (err) {
      console.error('Error rejecting condone:', err);
      toast.error('Failed to reject condone request');
    }
  };

  const presentCount = Object.values(attendance).filter(v => v === 'present').length;

  return (
    <Layout pageTitle="Placement Attendance">
      <h1 className="page-title">Placement Portal Attendance</h1>
      <p className="page-subtitle">Record student attendance for assigned training sessions and placement drives</p>

      {sessions.length === 0 ? (
        <div className="empty-state card" style={{ padding: 48, textAlign: 'center' }}>
          <div className="empty-icon" style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: 12 }}><MdWork /></div>
          <h3>No Assigned Sessions</h3>
          <p className="text-muted">You are not currently assigned to mark attendance for any upcoming placement sessions.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Selector Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {/* Session Selector */}
              <div style={{ flex: '1 1 240px' }}>
                <label className="form-label">Select Session / Drive</label>
                <select 
                  className="form-control"
                  value={selectedSession?.$id || ''}
                  onChange={e => setSelectedSession(sessions.find(s => s.$id === e.target.value))}
                >
                  {sessions.map(s => (
                    <option key={s.$id} value={s.$id}>
                      {s.title} ({s.company_name || 'General Training'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Class/Section Selector */}
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label">Select Class Section</label>
                <select 
                  className="form-control"
                  value={selectedClassId}
                  onChange={e => handleClassChange(e.target.value)}
                >
                  {eligibleClasses.length === 0 ? (
                    <option value="">No Eligible Classes</option>
                  ) : (
                    eligibleClasses.map(cls => (
                      <option key={cls.id || cls.$id} value={cls.id || cls.$id}>
                        {cls.label || cls.name || cls.id}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Teacher Name Input */}
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label">Your Name (Teacher Name) *</label>
                <input 
                  type="text" className="form-control" placeholder="Enter your name"
                  value={teacherName} onChange={e => setTeacherName(e.target.value)}
                  required
                />
              </div>

              {/* Session Comment / Period Input */}
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label">Period / Hour / Remarks</label>
                <input 
                  type="text" className="form-control" placeholder="e.g. Hour 3 Aptitude"
                  value={comment} onChange={e => setComment(e.target.value)}
                />
              </div>
            </div>

            {selectedSession && (
              <div style={{ marginTop: 16, background: 'var(--surface-2)', padding: 14, borderRadius: 8, fontSize: '0.84rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>📅 <strong>Date:</strong> {selectedSession.date}</div>
                  <div>⏰ <strong>Time:</strong> {selectedSession.time}</div>
                  <div>📍 <strong>Venue:</strong> {selectedSession.venue}</div>
                  <div>🎙️ <strong>Speaker:</strong> {selectedSession.speaker || 'Internal'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Roster & Marking */}
          {selectedClassId && (
            <div className="card" style={{ padding: 24 }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                  <div className="loader" />
                </div>
              ) : students.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No students registered in this class section.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <h3 style={{ margin: 0 }}>Class List ({students.length})</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="badge badge-primary">Present: {presentCount} / {students.length}</span>
                      <button className="btn btn-sm btn-ghost" onClick={() => markAll('present')}>All Present</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => markAll('absent')}>All Absent</button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {students.map(st => {
                      const stUid = st.uid || st.id;
                      const isPresent = attendance[stUid] === 'present';
                      return (
                        <div
                          key={stUid}
                          onClick={() => toggleStudentAttendance(stUid)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 18px',
                            borderRadius: 'var(--radius)',
                            border: `1.5px solid ${isPresent ? 'var(--success)' : 'var(--danger)'}`,
                            background: isPresent ? 'var(--success-light)' : 'var(--danger-light)',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.94rem' }}>{st.name}</span>
                            <span style={{ marginLeft: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{st.usn}</span>
                          </div>
                          <span className={`badge badge-${isPresent ? 'present' : 'absent'}`}>
                            {isPresent ? '✓ Present' : '✗ Absent'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <button className="btn btn-primary btn-block" onClick={saveAttendance} disabled={saving}>
                      <MdSave style={{ verticalAlign: 'middle', marginRight: 6 }} /> 
                      {saving ? 'Saving attendance logs...' : 'Save Attendance Logs'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Condone Requests Section */}
          {(() => {
            const pendingCondones = condoneRequests.filter(req => 
              req.marked_by_name?.toLowerCase() === teacherName?.trim().toLowerCase()
            );

            if (pendingCondones.length === 0) return null;

            return (
              <div className="card" style={{ padding: 24, marginBottom: 20 }}>
                <h3 style={{ marginBottom: 16 }}>Attendance Condone Requests ({pendingCondones.filter(c => c.status === 'pending').length} Pending)</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: 12 }}>Student</th>
                        <th style={{ padding: 12 }}>Session</th>
                        <th style={{ padding: 12 }}>Reason</th>
                        <th style={{ padding: 12 }}>Submitted At</th>
                        <th style={{ padding: 12 }}>Status</th>
                        <th style={{ padding: 12, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCondones.map(req => {
                        const isPending = req.status === 'pending';
                        return (
                          <tr key={req.$id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: 12 }}>
                              <strong>{req.student_name}</strong>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>USN: {req.student_usn}</div>
                            </td>
                            <td style={{ padding: 12 }}>{req.session_title}</td>
                            <td style={{ padding: 12, whiteSpace: 'normal', maxWidth: 250, wordBreak: 'break-word' }}>{req.reason}</td>
                            <td style={{ padding: 12 }}>{new Date(req.createdAt).toLocaleString()}</td>
                            <td style={{ padding: 12 }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: 4,
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                background: req.status === 'approved' ? '#d1fae5' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                                color: req.status === 'approved' ? '#065f46' : req.status === 'rejected' ? '#991b1b' : '#92400e',
                                textTransform: 'uppercase'
                              }}>
                                {req.status}
                              </span>
                            </td>
                            <td style={{ padding: 12, textAlign: 'center' }}>
                              {isPending ? (
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                  <button 
                                    className="btn btn-xs btn-success"
                                    style={{ color: 'white' }}
                                    onClick={() => handleApproveCondone(req)}
                                  >
                                    Accept
                                  </button>
                                  <button 
                                    className="btn btn-xs btn-danger"
                                    style={{ color: 'white' }}
                                    onClick={() => handleRejectCondone(req)}
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Processed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Marking History Section */}
          {(() => {
            const teacherLogs = allAttendanceLogs.filter(log => 
              log.marked_by_name?.toLowerCase() === teacherName?.trim().toLowerCase()
            );

            if (teacherLogs.length === 0) return null;

            // Group by session_id, class_label, comment, marked_by_name, and approximate time (within 30 seconds)
            const groups = [];
            const sortedLogs = [...teacherLogs].sort((a, b) => new Date(b.marked_at || 0) - new Date(a.marked_at || 0));

            sortedLogs.forEach(log => {
              const logTime = new Date(log.marked_at || 0);
              
              const match = groups.find(g => 
                g.session_id === log.session_id &&
                g.class_label === log.class_label &&
                g.comment === log.comment &&
                g.marked_by_name === log.marked_by_name &&
                Math.abs(new Date(g.marked_at) - logTime) < 30000 // 30 seconds tolerance
              );

              if (match) {
                if (!match.records.some(r => r.student_uid === log.student_uid)) {
                  match.records.push(log);
                }
              } else {
                groups.push({
                  marked_at: log.marked_at,
                  session_id: log.session_id,
                  class_label: log.class_label || 'General',
                  comment: log.comment || '',
                  marked_by_name: log.marked_by_name || 'Anonymous',
                  records: [log]
                });
              }
            });

            const sortedGroups = groups.sort((a, b) => new Date(b.marked_at) - new Date(a.marked_at));

            return (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ marginBottom: 16 }}>My Attendance Marking History</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: 12 }}>Session</th>
                        <th style={{ padding: 12 }}>Class / Section</th>
                        <th style={{ padding: 12 }}>Remarks / Hour</th>
                        <th style={{ padding: 12 }}>Marked At</th>
                        <th style={{ padding: 12 }}>Roster Summary</th>
                        <th style={{ padding: 12, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedGroups.map(group => {
                        const sess = sessions.find(s => s.$id === group.session_id);
                        const presentCount = group.records.filter(r => r.status === 'present').length;
                        const absentCount = group.records.filter(r => r.status === 'absent').length;
                        return (
                          <tr key={group.marked_at} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: 12 }}>
                              <strong>{sess ? sess.title : 'Unknown Session'}</strong>
                            </td>
                            <td style={{ padding: 12 }}>{group.class_label}</td>
                            <td style={{ padding: 12 }}>{group.comment || '-'}</td>
                            <td style={{ padding: 12 }}>{new Date(group.marked_at).toLocaleString()}</td>
                            <td style={{ padding: 12 }}>
                              <span className="badge badge-present" style={{ marginRight: 6 }}>{presentCount} Present</span>
                              <span className="badge badge-absent">{absentCount} Absent</span>
                            </td>
                            <td style={{ padding: 12, textAlign: 'center' }}>
                              <button 
                                className="btn btn-xs btn-outline"
                                onClick={() => {
                                  setSelectedHistoryGroup(group);
                                  setShowHistoryModal(true);
                                }}
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* History Details Modal */}
      {showHistoryModal && selectedHistoryGroup && (
        <div className="modal-container active">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3>Marking Details</h3>
              <button 
                className="modal-close" 
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedHistoryGroup(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.86rem' }}>
                <div><strong>Session:</strong> {(() => {
                  const s = sessions.find(x => x.$id === selectedHistoryGroup.session_id);
                  return s ? s.title : 'Unknown';
                })()}</div>
                <div><strong>Class Section:</strong> {selectedHistoryGroup.class_label}</div>
                <div><strong>Remarks / Hour:</strong> {selectedHistoryGroup.comment || 'N/A'}</div>
                <div><strong>Marked At:</strong> {new Date(selectedHistoryGroup.marked_at).toLocaleString()}</div>
              </div>
              
              <h4 style={{ marginBottom: 10 }}>Student Roster ({selectedHistoryGroup.records.length})</h4>
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedHistoryGroup.records.map(rec => {
                  const isPresent = rec.status === 'present';
                  return (
                    <div 
                      key={rec.$id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '10px 14px', 
                        background: 'var(--surface-2)', 
                        borderRadius: 6,
                        borderLeft: `4px solid ${isPresent ? 'var(--success)' : 'var(--danger)'}`
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.student_name}</span>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>USN: {rec.student_usn}</div>
                      </div>
                      <span className={`badge badge-${rec.status}`}>
                        {isPresent ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <div style={{ marginTop: 20, textAlign: 'right' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedHistoryGroup(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
