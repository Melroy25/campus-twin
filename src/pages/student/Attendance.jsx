import { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getAttendanceByStudent, getLeaveRequestsByStudent, addDocument, getAll } from '../../appwrite/database';
import { uploadLeaveImage } from '../../appwrite/storage';
import { toast } from 'react-hot-toast';
import { MdClose, MdUpload, MdAdd, MdPerson, MdHistory, MdSend } from 'react-icons/md';

export default function StudentAttendance() {
  const { currentUser, userProfile } = useAuth();
  const [records, setRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'present' | 'absent'
  const [activeSection, setActiveSection] = useState('attendance'); // 'attendance' | 'history'

  // Reconstructed missing states:
  const [selectedSubject, setSelectedSubject] = useState('');
  const [registeredSubjectsFull, setRegisteredSubjectsFull] = useState([]);
  const [teachers, setTeachers] = useState([]);
  
  // Leave request form states:
  const [showModal, setShowModal] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch data function
  const fetchData = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      // Fetch attendance records
      const attendanceData = await getAttendanceByStudent(currentUser.uid);
      setRecords(attendanceData);

      // Fetch leave requests
      const leaveData = await getLeaveRequestsByStudent(currentUser.uid);
      setLeaveRequests(leaveData);

      // Fetch subjects and filter by student's registered subjects
      let registeredIds = [];
      if (userProfile?.registered_subjects) {
        try {
          registeredIds = typeof userProfile.registered_subjects === 'string'
            ? JSON.parse(userProfile.registered_subjects)
            : userProfile.registered_subjects;
        } catch (e) {
          console.error('Failed to parse registered_subjects:', e);
          registeredIds = [];
        }
      }

      if (Array.isArray(registeredIds) && registeredIds.length > 0) {
        const allSubjects = await getAll('subjects');
        const filtered = allSubjects.filter(sub => registeredIds.includes(sub.id || sub.$id));
        setRegisteredSubjectsFull(filtered);
        
        if (filtered.length > 0) {
          setSelectedSubject(filtered[0].courseName);
        }
      } else {
        setRegisteredSubjectsFull([]);
        setSelectedSubject('');
      }

      // Fetch all teachers
      const teachersData = await getAll('teachers');
      setTeachers(teachersData);
    } catch (err) {
      console.error('Error fetching student attendance data:', err);
      toast.error('Failed to load attendance details');
    } finally {
      setLoading(false);
    }
  };

  // Only re-fetch if actual properties change, not on every background maintenance check reference change
  const registeredSubjectsKey = useMemo(() => {
    return typeof userProfile?.registered_subjects === 'string'
      ? userProfile.registered_subjects
      : JSON.stringify(userProfile?.registered_subjects || []);
  }, [userProfile?.registered_subjects]);

  useEffect(() => {
    fetchData();
  }, [currentUser?.uid, userProfile?.class_id, registeredSubjectsKey]);

  const displaySubjects = useMemo(() => {
    return registeredSubjectsFull.map(s => s.courseName);
  }, [registeredSubjectsFull]);

  const selectedSubjectInfo = useMemo(() => {
    if (!selectedSubject) return null;
    return registeredSubjectsFull.find(
      s => s.courseName === selectedSubject || s.courseCode === selectedSubject
    );
  }, [selectedSubject, registeredSubjectsFull]);

  const assignedTeachers = useMemo(() => {
    if (!selectedSubject || !userProfile?.class_id || teachers.length === 0) return [];
    
    const subDoc = registeredSubjectsFull.find(
      s => s.courseName === selectedSubject || s.courseCode === selectedSubject
    );
    if (!subDoc) return [];

    return teachers
      .filter(t => {
        const assignments = t.class_assignments || [];
        return assignments.some(a => {
          const isClassMatch = a.class_id === userProfile.class_id;
          const isSubjectMatch = a.subject && (
            a.subject.trim().toLowerCase() === subDoc.courseName.trim().toLowerCase() ||
            a.subject.trim().toLowerCase() === subDoc.courseCode.trim().toLowerCase() ||
            a.subject === subDoc.id ||
            a.subject === subDoc.$id
          );
          return isClassMatch && isSubjectMatch;
        });
      })
      .map(t => t.name);
  }, [selectedSubject, userProfile, registeredSubjectsFull, teachers]);

  const activeRecords = useMemo(() => {
    if (!selectedSubject) return [];
    const subDoc = registeredSubjectsFull.find(
      s => s.courseName === selectedSubject || s.courseCode === selectedSubject
    );
    if (!subDoc) return [];

    return records.filter(r => {
      const recordSubject = r.subject ? r.subject.trim().toLowerCase() : '';
      const courseNameLower = subDoc.courseName.trim().toLowerCase();
      const courseCodeLower = subDoc.courseCode.trim().toLowerCase();
      return (
        recordSubject === courseNameLower ||
        recordSubject === courseCodeLower ||
        recordSubject.includes(courseNameLower) ||
        recordSubject.includes(courseCodeLower) ||
        recordSubject === subDoc.id ||
        recordSubject === subDoc.$id
      );
    });
  }, [records, selectedSubject, registeredSubjectsFull]);

  const filteredRecords = activeRecords.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  }).sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

  const presentCount = activeRecords.filter(r => r.status === 'present').length;
  const absentCount = activeRecords.filter(r => r.status === 'absent').length;
  const totalConducted = presentCount + absentCount;
  const percentage = totalConducted > 0 ? Math.round((presentCount / totalConducted) * 100) : 0;

  // Check if a leave request was sent for a given date
  const getLeaveForDate = (date) => {
    return leaveRequests.find(lr => {
      const fromDate = lr.from_date || lr.date;
      return fromDate === date;
    });
  };

  const submitLeave = async () => {
    if (!reason || !leaveDate) return toast.error('Please fill all required fields');
    setSubmitting(true);
    try {
      let imageUrl = '';
      if (file) imageUrl = await uploadLeaveImage(currentUser.uid, file);
      await addDocument('leaveRequests', {
        student_id: currentUser.uid,
        from_date: leaveDate,
        to_date: leaveDate,
        reason: reason,
        proof_url: imageUrl,
        status: 'pending',
        applied_at: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      toast.success('Leave request submitted!');
      setShowModal(false); setReason(''); setLeaveDate(''); setFile(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to submit: ${err?.message || 'Unknown error'}`);
    } finally { setSubmitting(false); }
  };

  return (
    <Layout pageTitle="Attendance">
      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : registeredSubjectsFull.length === 0 ? (
        <div style={{ padding: '40px 16px', display: 'flex', justifyContent: 'center' }}>
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', maxWidth: 600, width: '100%' }}>
            <div style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: 16 }}>⚠️</div>
            <h3>No Registered Courses</h3>
            <p className="text-muted" style={{ margin: '8px auto 20px', fontSize: '0.9rem', maxWidth: 400 }}>
              You haven't registered for any subjects this semester. Please complete your course registration to start tracking your attendance.
            </p>
            <a href="/student/courses" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none', width: 'fit-content', margin: '0 auto' }}>
              Go to Course Registration
            </a>
          </div>
        </div>
      ) : (

        <div className="attendance-mobile-container" style={{ maxWidth: 800, margin: '0 auto' }}>
          
          {/* Responsive SJEC Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', // Improved, more readable blue gradient
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            marginBottom: '24px',
            boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                 <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '1px' }}>Student Profile</p>
                 <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0', color: 'white' }}>
                  {userProfile?.name?.toUpperCase() || 'STUDENT NAME'}
                </h2>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
                  {userProfile?.usn || 'USN'}
                </div>
              </div>
              <div style={{
                width: 60, height: 60, 
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', color: 'white',
                overflow: 'hidden'
              }}>
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <MdPerson />
                )}
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: 20, 
              paddingTop: 16, 
              borderTop: '1px solid rgba(255,255,255,0.1)',
              fontSize: '0.85rem'
            }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0 }}>Class</p>
                <p style={{ fontWeight: 600, margin: 0, color: 'white' }}>{userProfile?.class_label || userProfile?.class_id || 'N/A'}</p>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0 }}>Average</p>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0, color: 'white' }}>{percentage}%</p>
              </div>
            </div>
          </div>

          {/* Subject Selector */}
          <div style={{ 
            display: 'flex', 
            gap: 10, 
            overflowX: 'auto', 
            paddingBottom: 12, 
            marginBottom: 24,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {displaySubjects.map(sub => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                style={{
                  background: selectedSubject === sub ? 'var(--primary)' : 'var(--surface)',
                  border: `1px solid ${selectedSubject === sub ? 'var(--primary)' : 'var(--border)'}`,
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontWeight: 600,
                  color: selectedSubject === sub ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  boxShadow: selectedSubject === sub ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {sub}
              </button>
            ))}
          </div>

          {selectedSubjectInfo && (
            <div style={{
              display: 'flex',
              gap: 16,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '12px 18px',
              marginBottom: 24,
              fontSize: '0.88rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Subject Code:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                  {selectedSubjectInfo.courseCode}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Faculty:</span>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                  {assignedTeachers.length > 0 ? assignedTeachers.join(', ') : 'Not Assigned'}
                </span>
              </div>
            </div>
          )}

          {/* Main Content Area: Log and Stats Side-by-Side */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '24px' }}>
            
            {/* Records List Section */}
            <div className="card" style={{ flex: '1 1 60%', minWidth: '300px', padding: 0, overflow: 'hidden', margin: 0 }}>
              <div className="flex-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Attendance Log</h3>
                
                <div style={{ display: 'flex', gap: 6 }}>
                  {['all', 'present', 'absent'].map(f => (
                    <button 
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: filter === f ? 'var(--primary-light)' : 'transparent',
                        color: filter === f ? 'var(--primary)' : 'var(--text-muted)',
                        border: 'none',
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {filteredRecords.length === 0 ? (
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                     <p>No {filter !== 'all' ? filter : ''} records found for this subject.</p>
                  </div>
                ) : (
                  filteredRecords.map((item, i) => (
                    <div key={item.id} style={{ 
                      padding: '14px 20px', 
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16
                    }}>
                      <div style={{ 
                        width: 40, height: 40, 
                        borderRadius: '8px', 
                        background: item.status === 'present' ? 'var(--success-light)' : 'var(--danger-light)',
                        color: item.status === 'present' ? 'var(--success)' : 'var(--danger)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', fontWeight: 700, flexShrink: 0
                      }}>
                        {item.status === 'present' ? 'P' : 'A'}
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.date}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.time || 'N/A'} • Period {item.period || '-'}</div>
                        {item.status === 'absent' && getLeaveForDate(item.date) && (
                          <div style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 3,
                            marginTop: 4, 
                            fontSize: '0.7rem', 
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: getLeaveForDate(item.date).status === 'approved' 
                              ? 'var(--success-light)' 
                              : getLeaveForDate(item.date).status === 'rejected' 
                                ? 'var(--danger-light)'
                                : 'rgba(245, 158, 11, 0.1)',
                            color: getLeaveForDate(item.date).status === 'approved' 
                              ? 'var(--success)' 
                              : getLeaveForDate(item.date).status === 'rejected' 
                                ? 'var(--danger)'
                                : '#f59e0b'
                          }}>
                            <MdSend style={{ fontSize: '0.65rem' }} />
                            {getLeaveForDate(item.date).status === 'approved' 
                              ? 'Leave Approved' 
                              : getLeaveForDate(item.date).status === 'rejected' 
                                ? 'Leave Rejected'
                                : 'Leave Request Sent'}
                          </div>
                        )}
                      </div>

                      <div style={{ 
                        textAlign: 'right',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: item.status === 'present' ? 'var(--success-light)' : 'var(--danger-light)',
                        color: item.status === 'present' ? 'var(--success)' : 'var(--danger)',
                        textTransform: 'uppercase'
                      }}>
                        {item.status}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Summary Stats Cards */}
            <div style={{ flex: '1 1 30%', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="card" style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Total Classes</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalConducted}</div>
              </div>
              <div className="card" style={{ padding: '16px', background: 'var(--success-light)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--success)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Present</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--success)' }}>{presentCount}</div>
              </div>
              <div className="card" style={{ padding: '16px', background: 'var(--danger-light)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--danger)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Absent</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--danger)' }}>{absentCount}</div>
              </div>
            </div>

          </div>

          {/* Tab buttons for Attendance / History */}
          <div style={{ 
            display: 'flex', 
            gap: 8, 
            marginBottom: 16 
          }}>
            <button 
              className="btn btn-sm"
              onClick={() => setActiveSection('attendance')}
              style={{
                flex: 1,
                padding: '10px',
                background: activeSection === 'attendance' ? 'var(--primary)' : 'var(--surface)',
                color: activeSection === 'attendance' ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${activeSection === 'attendance' ? 'var(--primary)' : 'var(--border)'}`,
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderRadius: 'var(--radius)',
                transition: 'all 0.2s ease'
              }}
            >
              <MdAdd style={{ verticalAlign: 'middle', marginRight: 4 }} /> Apply for Leave
            </button>
            <button 
              className="btn btn-sm"
              onClick={() => setActiveSection('history')}
              style={{
                flex: 1,
                padding: '10px',
                background: activeSection === 'history' ? 'var(--primary)' : 'var(--surface)',
                color: activeSection === 'history' ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${activeSection === 'history' ? 'var(--primary)' : 'var(--border)'}`,
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderRadius: 'var(--radius)',
                transition: 'all 0.2s ease'
              }}
            >
              <MdHistory style={{ verticalAlign: 'middle', marginRight: 4 }} /> Leave History ({leaveRequests.length})
            </button>
          </div>

          {/* Apply for Leave button (when attendance tab is active) */}
          {activeSection === 'attendance' && (
            <div className="flex-center">
              <button className="btn btn-ghost btn-sm w-full" style={{ padding: '12px' }} onClick={() => setShowModal(true)}>
                <MdAdd /> Apply for Leave Request
              </button>
            </div>
          )}

          {/* Leave History Section */}
          {activeSection === 'history' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid var(--border)', 
                background: 'var(--surface-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <MdHistory style={{ color: 'var(--primary)', fontSize: '1.1rem' }} />
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Leave Request History</h3>
              </div>

              {leaveRequests.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <p>No leave requests submitted yet.</p>
                </div>
              ) : (
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                  {[...leaveRequests]
                    .sort((a, b) => new Date(b.applied_at || b.createdAt || 0) - new Date(a.applied_at || a.createdAt || 0))
                    .map((lr) => {
                      const statusColors = {
                        pending: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', label: '⏳ Pending' },
                        approved: { bg: 'var(--success-light)', color: 'var(--success)', label: '✅ Approved' },
                        rejected: { bg: 'var(--danger-light)', color: 'var(--danger)', label: '❌ Rejected' }
                      };
                      const st = statusColors[lr.status] || statusColors.pending;

                      return (
                        <div key={lr.id} style={{ 
                          padding: '16px 20px', 
                          borderBottom: '1px solid var(--border)',
                          borderLeft: `4px solid ${st.color}`,
                        }}>
                          {/* Date and status row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                              📅 {lr.from_date || lr.date || 'N/A'}
                            </div>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: '12px',
                              background: st.bg,
                              color: st.color,
                              textTransform: 'uppercase'
                            }}>
                              {st.label}
                            </span>
                          </div>

                          {/* Reason */}
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Reason:</strong> {lr.reason || lr.reason_text || 'N/A'}
                          </div>

                          {/* Applied at */}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: lr.teacher_comment ? 10 : 0 }}>
                            Applied: {lr.applied_at ? new Date(lr.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </div>

                          {/* Teacher Comment */}
                          {lr.teacher_comment && (
                            <div style={{
                              marginTop: 8,
                              padding: '10px 14px',
                              background: lr.status === 'approved' 
                                ? 'rgba(16, 185, 129, 0.06)' 
                                : lr.status === 'rejected' 
                                  ? 'rgba(239, 68, 68, 0.06)' 
                                  : 'var(--surface-2)',
                              borderRadius: 'var(--radius)',
                              border: `1px solid ${lr.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : lr.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'var(--border)'}`,
                              fontSize: '0.83rem',
                              position: 'relative'
                            }}>
                              <div style={{ 
                                fontSize: '0.72rem', 
                                fontWeight: 700, 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.5px',
                                color: st.color, 
                                marginBottom: 4 
                              }}>
                                💬 Teacher's Comment
                              </div>
                              <div style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>
                                "{lr.teacher_comment}"
                              </div>
                            </div>
                          )}

                          {/* Proof link */}
                          {(lr.proof_url || lr.image_url) && (
                            <a 
                              href={lr.proof_url || lr.image_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 8,
                                fontSize: '0.78rem',
                                color: 'var(--primary)',
                                textDecoration: 'none',
                                fontWeight: 600
                              }}
                            >
                              📎 View Submitted Proof
                            </a>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Leave Request Modal */}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Submit Leave Request</span>
              <button className="modal-close" onClick={() => setShowModal(false)}><MdClose /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-control" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <textarea className="form-control" rows={3} placeholder="Why are you applying for leave?" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Supporting Document (optional)</label>
              <label className="file-upload-area" htmlFor="leave-file">
                <div className="upload-icon"><MdUpload /></div>
                <p>{file ? file.name : 'Click to upload image/document'}</p>
                <input id="leave-file" type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitLeave} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
