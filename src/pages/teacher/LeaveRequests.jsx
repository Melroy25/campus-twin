import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { getPendingLeaveRequests, updateDocument, addNotification } from '../../firebase/firestore';
import { toast } from 'react-hot-toast';
import { MdCheck, MdClose, MdOpenInNew } from 'react-icons/md';

export default function TeacherLeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    const data = await getPendingLeaveRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (req, action) => {
    await updateDocument('leaveRequests', req.id, { status: action });
    const msg = action === 'approved'
      ? '✅ Your leave request has been approved.'
      : '❌ Your leave request has been rejected.';
    await addNotification(req.student_id, msg);
    toast.success(`Request ${action}`);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map((req) => (
            <div key={req.id} className="card">
              <div className="flex-between mb-8">
                <div>
                  <span className="font-semibold" style={{ fontSize: '0.9rem' }}>Student ID: {req.student_id.slice(0, 10)}...</span>
                  <span style={{ marginLeft: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date: {req.date}</span>
                </div>
                <span className="badge badge-pending">pending</span>
              </div>
              <p style={{ fontSize: '0.875rem', marginBottom: 10 }}>
                <strong>Reason:</strong> {req.reason_text}
              </p>
              {req.image_url && (
                <a href={req.image_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ marginBottom: 10, display: 'inline-flex' }}>
                  <MdOpenInNew /> View Proof
                </a>
              )}
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
