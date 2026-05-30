import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { getPendingLeaveRequests, updateDocument, addNotification, getAll } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdCheck, MdClose, MdOpenInNew, MdComment } from 'react-icons/md';

export default function TeacherLeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState({}); // { reqId: 'comment text' }
  const [students, setStudents] = useState([]);

  const fetchRequests = async () => {
    const data = await getPendingLeaveRequests();
    const allStudents = await getAll('students');
    setStudents(allStudents);
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const getStudentName = (studentId) => {
    const s = students.find(st => st.uid === studentId || st.id === studentId);
    return s ? `${s.name} (${s.usn || s.class_id})` : studentId?.slice(0, 12) + '...';
  };

  const handleAction = async (req, action) => {
    const comment = comments[req.id] || '';
    await updateDocument('leaveRequests', req.id, { 
      status: action,
      teacher_comment: comment 
    });
    const commentText = comment ? `\nTeacher's Comment: "${comment}"` : '';
    const msg = action === 'approved'
      ? `✅ Your leave request for ${req.from_date || req.date} has been approved.${commentText}`
      : `❌ Your leave request for ${req.from_date || req.date} has been rejected.${commentText}`;
    await addNotification(req.student_id, msg);
    toast.success(`Request ${action}`);
    // Clear the comment for this request
    setComments(prev => { const n = {...prev}; delete n[req.id]; return n; });
    fetchRequests();
  };

  return (
    <Layout pageTitle="Leave Requests">
      <h1 className="page-title">Leave Requests</h1>
      <p className="page-subtitle">Review and approve pending student leave applications</p>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No pending leave requests.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {requests.map((req) => (
            <div key={req.id} className="card" style={{ padding: '20px' }}>
              {/* Header row */}
              <div className="flex-between mb-8">
                <div>
                  <span className="font-semibold" style={{ fontSize: '0.95rem' }}>
                    {getStudentName(req.student_id)}
                  </span>
                  <span style={{ marginLeft: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Date: {req.from_date || req.date}
                  </span>
                </div>
                <span className="badge badge-pending">pending</span>
              </div>

              {/* Reason */}
              <p style={{ fontSize: '0.875rem', marginBottom: 12, color: 'var(--text-secondary)' }}>
                <strong>Reason:</strong> {req.reason || req.reason_text}
              </p>

              {/* Proof link */}
              {(req.proof_url || req.image_url) && (
                <a href={req.proof_url || req.image_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ marginBottom: 12, display: 'inline-flex' }}>
                  <MdOpenInNew /> View Proof
                </a>
              )}

              {/* Teacher Comment Input */}
              <div style={{ 
                marginBottom: 14, 
                padding: '12px', 
                background: 'var(--surface-2)', 
                borderRadius: 'var(--radius)', 
                border: '1px solid var(--border)' 
              }}>
                <label style={{ 
                  fontSize: '0.78rem', 
                  fontWeight: 600, 
                  color: 'var(--text-muted)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 4, 
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <MdComment style={{ fontSize: '0.9rem' }} /> Teacher Comment (optional)
                </label>
                <textarea
                  rows={2}
                  className="form-control"
                  placeholder="e.g. Attendance condoned, Not approved - insufficient reason..."
                  value={comments[req.id] || ''}
                  onChange={(e) => setComments(prev => ({ ...prev, [req.id]: e.target.value }))}
                  style={{ 
                    fontSize: '0.85rem', 
                    resize: 'vertical', 
                    background: 'var(--surface)',
                    minHeight: '50px'
                  }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-success btn-sm" onClick={() => handleAction(req, 'approved')}>
                  <MdCheck /> Approve
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleAction(req, 'rejected')}>
                  <MdClose /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
