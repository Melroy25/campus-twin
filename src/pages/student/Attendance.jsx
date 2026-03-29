import { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getAttendanceByStudent, getLeaveRequestsByStudent, addDocument } from '../../firebase/firestore';
import { uploadLeaveImage } from '../../firebase/storage';
import { toast } from 'react-hot-toast';
import { MdClose, MdUpload, MdAdd, MdPerson } from 'react-icons/md';

export default function StudentAttendance() {
  const { currentUser, userProfile } = useAuth();
  const [records, setRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!currentUser?.uid) return;
    const res = await getAttendanceByStudent(currentUser.uid);
    setRecords(res);
    
    // Automatically select the first subject
    const subjects = [...new Set(res.map(r => r.subject))];
    if (subjects.length > 0 && !selectedSubject) {
      setSelectedSubject(subjects[0]);
    }

    const lr = await getLeaveRequestsByStudent(currentUser.uid);
    setLeaveRequests(lr);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [currentUser]);

  const subjects = useMemo(() => {
    return [...new Set(records.map(r => r.subject))];
  }, [records]);

  // If no real records, lets create some mock subjects to match the UI screenshot
  const displaySubjects = subjects.length > 0 ? subjects : ['22CSE46L', '22ITC49B', '22CSE41', '22CSE42', '22CSE43', '22CSE44', '22CTE48', '22UHV47', '22CSE451'];
  
  // Set default if empty
  useEffect(() => {
    if (!selectedSubject && displaySubjects.length > 0) {
      setSelectedSubject(displaySubjects[displaySubjects.length > 2 ? 7 : 0]); // Defaulting to 22UHV47 if available like screenshot
    }
  }, [displaySubjects, selectedSubject]);

  const activeRecords = records.filter(r => r.subject === selectedSubject);
  
  // Mocking lists if empty to demonstrate UI
  const presentList = activeRecords.length > 0 
    ? activeRecords.filter(r => r.status === 'present')
    : [{ id: 1, date: '01/03/2026', time: '09:00', status: 'PRESENT' }, { id: 2, date: '02/03/2026', time: '10:00', status: 'PRESENT' }];
    
  const absentList = activeRecords.length > 0 
    ? activeRecords.filter(r => r.status === 'absent')
    : [{ id: 3, date: '15/03/2026', time: '11:00', status: 'ABSENT' }];

  const presentCount = presentList.length;
  const absentCount = absentList.length;
  const totalConducted = presentCount + absentCount;
  const stillToGo = Math.max(0, 40 - totalConducted); // assuming 40 classes total

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
        <div className="attendance-contineo-wrapper">
          
          {/* Contineo-style Header */}
          <div style={{
            background: '#0a64b5', // SJEC blue
            borderRadius: 'var(--radius)',
            padding: '20px 30px',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: 20
          }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>
                {userProfile?.name || 'MELROY LUVIS ALMEIDA'}
              </h2>
            </div>
            
            <div style={{
              width: 90, height: 90, 
              borderRadius: '50%',
              border: '3px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', background: '#e0e0e0', color: '#666'
            }}>
              <MdPerson style={{ fontSize: '4rem' }} />
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                {userProfile?.usn || '4S024CS128'}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                B.E-CS, SEM 04, SEC B
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#666', textAlign: 'right', marginBottom: 20 }}>
            Last Updated On: {new Date().toLocaleDateString('en-GB')}
          </div>

          {/* Subject Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: 20, overflowX: 'auto', paddingBottom: 5 }}>
            {displaySubjects.map(sub => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '10px 15px',
                  fontWeight: selectedSubject === sub ? 600 : 400,
                  color: selectedSubject === sub ? '#000' : '#888',
                  borderBottom: selectedSubject === sub ? '2px solid #000' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap'
                }}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Teacher and Status Cards */}
          <div className="grid-2 mb-24" style={{ gap: 20 }}>
            {/* Teacher Details */}
            <div style={{ border: '1px solid #e0e0e0', padding: 20, display: 'flex', alignItems: 'center', gap: 15, background: 'white' }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#999', textAlign: 'center', border: '1px solid #ddd' }}>
                PICTURE COMING
              </div>
              <div>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#333' }}>Sheen Rose</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>{selectedSubject} - UNIVERSAL HUMAN VALUES-II</p>
              </div>
            </div>

            {/* Attendance Status */}
            <div style={{ border: '1px solid #e0e0e0', padding: 20, display: 'flex', alignItems: 'center', gap: 15, background: 'white' }}>
              <span style={{ fontSize: '1rem', color: '#555' }}>Attendance Status</span>
              <span style={{ background: '#28a745', color: 'white', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>PRESENT [{presentCount}]</span>
              <span style={{ background: '#dc3545', color: 'white', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>ABSENT [{absentCount}]</span>
              <span style={{ background: '#6c757d', color: 'white', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>STILL TO GO [{stillToGo}]</span>
            </div>
          </div>

          {/* Tables Row */}
          <div className="grid-2" style={{ gap: 20, alignItems: 'start' }}>
            {/* Present Table */}
            <div style={{ border: '1px solid #e0e0e0', padding: 20, background: 'white', overflowX: 'auto' }}>
              <div style={{ marginBottom: 15 }}>
                <span style={{ fontSize: '1rem', color: '#333' }}>Present </span>
                <span style={{ background: '#28a745', color: 'white', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>CLASSES</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ color: '#555', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '10px 0' }}>SL NO</th>
                    <th>DATE</th>
                    <th>TIME</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {presentList.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f9f9f9', color: '#666' }}>
                      <td style={{ padding: '10px 0' }}>{i + 1}</td>
                      <td>{item.date || '01/03/2026'}</td>
                      <td>{item.time || '09:00'}</td>
                      <td style={{ fontWeight: 600 }}>{item.status.toUpperCase()}</td>
                    </tr>
                  ))}
                  {presentList.length === 0 && <tr><td colSpan={4} style={{ padding: 10, textAlign: 'center', color: '#999' }}>No classes recorded</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Absent Table */}
            <div style={{ border: '1px solid #e0e0e0', padding: 20, background: 'white', overflowX: 'auto' }}>
              <div style={{ marginBottom: 15 }}>
                <span style={{ fontSize: '1rem', color: '#333' }}>Absent List </span>
                <span style={{ background: '#dc3545', color: 'white', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>CLASSES</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ color: '#555', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '10px 0' }}>SL NO</th>
                    <th>DATE</th>
                    <th>TIME</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {absentList.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f9f9f9', color: '#666' }}>
                      <td style={{ padding: '10px 0' }}>{i + 1}</td>
                      <td>{item.date || '15/03/2026'}</td>
                      <td>{item.time || '11:00'}</td>
                      <td style={{ fontWeight: 600 }}>{item.status.toUpperCase()}</td>
                    </tr>
                  ))}
                  {absentList.length === 0 && <tr><td colSpan={4} style={{ padding: 10, textAlign: 'center', color: '#999' }}>No absent classes</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 40, borderTop: '1px solid var(--border)', paddingTop: 20}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(true)}>
              <MdAdd /> Submit Leave Request
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
