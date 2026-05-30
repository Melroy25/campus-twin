import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getAICTEByMentor, updateDocument, addNotification } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdCheck, MdClose, MdOpenInNew, MdStar } from 'react-icons/md';

const SEMESTERS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
];

export default function MentorAICTEApprovals() {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // States to track edits per activity ID
  const [pointsState, setPointsState] = useState({});
  const [remarksState, setRemarksState] = useState({});
  const [semesterState, setSemesterState] = useState({});
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'approved', 'rejected'

  const fetchActivities = async () => {
    if (!currentUser?.uid) return;
    const data = await getAICTEByMentor(currentUser.uid);
    setActivities(data);
    setLoading(false);
  };

  useEffect(() => { fetchActivities(); }, [currentUser]);

  const handleAction = async (activity, action, customPoints, remark, customSemester) => {
    const finalPoints = Number(customPoints) !== undefined && customPoints !== '' ? Number(customPoints) : activity.points;
    const finalRemarks = remark || '';
    const finalSemester = customSemester || activity.semester || 'Semester 1';

    try {
      await updateDocument('aictePoints', activity.id, { 
        status: action,
        points: finalPoints,
        remarks: finalRemarks,
        semester: finalSemester
      });

      const msg = action === 'approved'
        ? `⭐ Your AICTE activity "${activity.category}" has been approved for ${finalSemester} with ${finalPoints} points!${finalRemarks ? ` Remarks: "${finalRemarks}"` : ''}`
        : `❌ Your AICTE activity "${activity.category}" was not approved.${finalRemarks ? ` Reason: "${finalRemarks}"` : ''}`;

      await addNotification(activity.student_id, msg);
      toast.success(`Activity ${action}!`);
      fetchActivities();
    } catch (err) {
      toast.error('Failed to update activity status');
      console.error(err);
    }
  };

  const filteredActivities = activities.filter(act => {
    const status = act.status || 'pending';
    return status === activeTab;
  });

  return (
    <Layout pageTitle="AICTE Approvals">
      <h1 className="page-title">AICTE Points Approval</h1>
      <p className="page-subtitle">Review and approve AICTE activity submissions from your mentees</p>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto' }}>
        <button 
          className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-ghost'}`} 
          onClick={() => setActiveTab('pending')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ⏳ Pending ({activities.filter(a => (a.status || 'pending') === 'pending').length})
        </button>
        <button 
          className={`btn ${activeTab === 'approved' ? 'btn-primary' : 'btn-ghost'}`} 
          onClick={() => setActiveTab('approved')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ✅ Approved ({activities.filter(a => a.status === 'approved').length})
        </button>
        <button 
          className={`btn ${activeTab === 'rejected' ? 'btn-primary' : 'btn-ghost'}`} 
          onClick={() => setActiveTab('rejected')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ❌ Rejected ({activities.filter(a => a.status === 'rejected').length})
        </button>
      </div>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : filteredActivities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MdStar /></div>
          <p>No {activeTab} AICTE activity submissions found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredActivities.map((act) => {
            const currentPoints = pointsState[act.id] !== undefined ? pointsState[act.id] : act.points;
            const currentRemark = remarksState[act.id] || '';
            const currentSemester = semesterState[act.id] !== undefined ? semesterState[act.id] : (act.semester || 'Semester 1');

            return (
              <div key={act.id} className="card">
                <div className="flex-between mb-8">
                  <div>
                    <span className="font-semibold" style={{ fontSize: '0.9rem' }}>{act.category}</span>
                    <span style={{
                      marginLeft: 10,
                      padding: '2px 8px',
                      background: act.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : 'var(--warning-light)',
                      color: act.status === 'approved' ? '#10b981' : '#856404',
                      borderRadius: 20,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      <MdStar style={{ verticalAlign: 'middle', marginRight: 2 }} />
                      {act.status === 'approved' ? `${act.points} pts awarded` : `${act.points} pts claimed`}
                    </span>
                  </div>
                  <span className={`badge badge-${act.status || 'pending'}`}>{act.status || 'pending'}</span>
                </div>
                <p style={{ fontSize: '0.875rem', marginBottom: 10 }}>{act.description}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Student ID: {act.student_id} • Semester Claimed: <strong style={{ color: 'var(--primary)' }}>{act.semester || 'Semester 1'}</strong>
                </p>
                
                {act.proof_url && (
                  <a href={act.proof_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost mb-16" style={{ display: 'inline-flex', alignSelf: 'start' }}>
                    <MdOpenInNew /> View Proof
                  </a>
                )}

                {/* Show edit inputs only for pending items */}
                {(act.status || 'pending') === 'pending' ? (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 12, 
                    padding: '14px 16px', 
                    background: 'var(--surface-2)', 
                    borderRadius: 'var(--radius)', 
                    border: '1px solid var(--border)',
                    marginTop: 8
                  }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                      <div style={{ flex: '1 1 100px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Approve Points</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          max={100}
                          value={currentPoints}
                          onChange={(e) => setPointsState({ ...pointsState, [act.id]: e.target.value })}
                          style={{ height: '36px', fontSize: '0.875rem' }}
                        />
                      </div>
                      <div style={{ flex: '1 1 140px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Assign Semester</label>
                        <select
                          className="form-control"
                          value={currentSemester}
                          onChange={(e) => setSemesterState({ ...semesterState, [act.id]: e.target.value })}
                          style={{ height: '36px', fontSize: '0.875rem' }}
                        >
                          {SEMESTERS.map(sem => (
                            <option key={sem} value={sem}>{sem}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: '2 1 200px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Remarks / Feedback to Student</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Approved. Good job! or Proof is unclear."
                          value={currentRemark}
                          onChange={(e) => setRemarksState({ ...remarksState, [act.id]: e.target.value })}
                          style={{ height: '36px', fontSize: '0.875rem' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button className="btn btn-success btn-sm" onClick={() => handleAction(act, 'approved', currentPoints, currentRemark, currentSemester)}>
                        <MdCheck /> Approve
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleAction(act, 'rejected', currentPoints, currentRemark, currentSemester)}>
                        <MdClose /> Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display mode for Approved / Rejected items */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Assigned Semester: <strong>{act.semester || 'Semester 1'}</strong>
                    </div>
                    {act.remarks && (
                      <div style={{ 
                        padding: '10px 14px', 
                        background: act.status === 'approved' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', 
                        borderLeft: `3px solid ${act.status === 'approved' ? '#10b981' : '#ef4444'}`,
                        borderRadius: '0 var(--radius) var(--radius) 0',
                        fontSize: '0.82rem',
                        color: 'var(--text)',
                      }}>
                        <strong>💬 Feedback:</strong> "{act.remarks}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
