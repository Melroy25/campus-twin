import { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getAttendanceByStudent, getLeaveRequestsByStudent, addDocument } from '../../appwrite/database';
import { uploadLeaveImage } from '../../appwrite/storage';
import { toast } from 'react-hot-toast';
import { MdClose, MdUpload, MdAdd, MdPerson } from 'react-icons/md';

export default function StudentAttendance() {
  const { currentUser, userProfile } = useAuth();
  const [records, setRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'present' | 'absent'

  const filteredRecords = activeRecords.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  }).sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

  const presentCount = records.filter(r => r.subject === selectedSubject && r.status === 'present').length;
  const absentCount = records.filter(r => r.subject === selectedSubject && r.status === 'absent').length;
  const totalConducted = presentCount + absentCount;
  const percentage = totalConducted > 0 ? Math.round((presentCount / totalConducted) * 100) : 0;
  const stillToGo = Math.max(0, 40 - totalConducted);

  const submitLeave = async () => {
    if (!reason || !leaveDate) return toast.error('Please fill all required fields');
    setSubmitting(true);
    try {
      let imageUrl = '';
      if (file) imageUrl = await uploadLeaveImage(currentUser.uid, file);
      await addDocument('leaveRequests', {
        student_id: currentUser.uid,
        date: leaveDate,
        reason_text: reason,
        image_url: imageUrl,
        status: 'pending',
      });
      toast.success('Leave request submitted!');
      setShowModal(false); setReason(''); setLeaveDate(''); setFile(null);
      fetchData();
    } catch {
      toast.error('Failed to submit leave request');
    } finally { setSubmitting(false); }
  };

  return (
    <Layout pageTitle="Attendance">
      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : (
        <div className="attendance-mobile-container" style={{ maxWidth: 800, margin: '0 auto' }}>
          
          {/* Responsive SJEC Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0a64b5 0%, #1781e3 100%)',
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
                 <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>Student Profile</p>
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
                fontSize: '2rem', color: 'white'
              }}>
                <MdPerson />
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
                <p style={{ opacity: 0.7, margin: 0 }}>Class</p>
                <p style={{ fontWeight: 600, margin: 0 }}>{userProfile?.class_id || 'N/A'}</p>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{ opacity: 0.7, margin: 0 }}>Average</p>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>{percentage}%</p>
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

          {/* Summary Stats Cards */}
          <div className="grid-3 mb-24" style={{ gap: 12 }}>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Present</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{presentCount}</div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Absent</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger)' }}>{absentCount}</div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Remaining</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--secondary)' }}>{stillToGo}</div>
            </div>
          </div>

          {/* Records List Section */}
          <div className="card mb-24" style={{ padding: 0, overflow: 'hidden' }}>
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

          <div className="flex-center">
            <button className="btn btn-ghost btn-sm w-full" style={{ padding: '12px' }} onClick={() => setShowModal(true)}>
              <MdAdd /> Apply for Leave Request
            </button>
          </div>
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
