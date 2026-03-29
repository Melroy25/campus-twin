import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getAICTEByMentor, updateDocument, addNotification } from '../../firebase/firestore';
import { toast } from 'react-hot-toast';
import { MdCheck, MdClose, MdOpenInNew, MdStar } from 'react-icons/md';

export default function MentorAICTEApprovals() {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    if (!currentUser?.uid) return;
    const data = await getAICTEByMentor(currentUser.uid);
    setActivities(data);
    setLoading(false);
  };

  useEffect(() => { fetchActivities(); }, [currentUser]);

  const handleAction = async (activity, action) => {
    await updateDocument('aictePoints', activity.id, { status: action });
    const msg = action === 'approved'
      ? `⭐ Your AICTE activity "${activity.category}" (${activity.points} pts) has been approved!`
      : `❌ Your AICTE activity "${activity.category}" was not approved.`;
    await addNotification(activity.student_id, msg);
    toast.success(`Activity ${action}!`);
    fetchActivities();
  };

  return (
    <Layout pageTitle="AICTE Approvals">
      <h1 className="page-title">AICTE Points Approval</h1>
      <p className="page-subtitle">Review and approve AICTE activity submissions from your mentees</p>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : activities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MdStar /></div>
          <p>No pending AICTE activity submissions from your mentees.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activities.map((act) => (
            <div key={act.id} className="card">
              <div className="flex-between mb-8">
                <div>
                  <span className="font-semibold" style={{ fontSize: '0.9rem' }}>{act.category}</span>
                  <span style={{
                    marginLeft: 10,
                    padding: '2px 8px',
                    background: 'var(--warning-light)',
                    color: '#856404',
                    borderRadius: 20,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}>
                    <MdStar style={{ verticalAlign: 'middle', marginRight: 2 }} />{act.points} pts
                  </span>
                </div>
                <span className="badge badge-pending">pending</span>
              </div>
              <p style={{ fontSize: '0.875rem', marginBottom: 10 }}>{act.description}</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                Student ID: {act.student_id}
              </p>
              {act.proof_url && (
                <a href={act.proof_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ marginBottom: 10, display: 'inline-flex' }}>
                  <MdOpenInNew /> View Proof
                </a>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-success btn-sm" onClick={() => handleAction(act, 'approved')}>
                  <MdCheck /> Approve
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleAction(act, 'rejected')}>
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
