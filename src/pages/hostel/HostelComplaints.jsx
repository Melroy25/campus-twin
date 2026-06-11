import { useState, useEffect } from 'react';
import { queryDocuments, addDocument, updateDocument, addNotification } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  MdReportProblem, MdAdd, MdClose, MdCheckCircle,
  MdAccessTime, MdCancel, MdQuestionAnswer, MdFilterList
} from 'react-icons/md';

export default function HostelComplaints({ hostelType, role }) {
  const { currentUser, userProfile } = useAuth();
  const accent = hostelType === 'girls' ? '#ec4899' : '#3b82f6';
  const accentLight = hostelType === 'girls' ? 'var(--accent-light-girls)' : 'var(--accent-light-boys)';
  const accentDark = hostelType === 'girls' ? '#be185d' : '#1e40af';

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form State for Student
  const [category, setCategory] = useState('Plumbing');
  const [message, setMessage] = useState('');

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      let queries = [Query.equal('hostel_type', hostelType)];
      if (role === 'student') {
        const studentId = userProfile?.uid || currentUser?.$id || '';
        queries.push(Query.equal('student_id', studentId));
      }
      const data = await queryDocuments('hostelComplaints', queries);
      // Sort by creation date descending
      const sorted = data.sort((a, b) => new Date(b.createdAt || b.$createdAt) - new Date(a.createdAt || a.$createdAt));
      setComplaints(sorted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [hostelType, role]);

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      return toast.error('Please describe your issue');
    }
    setSubmitting(true);
    try {
      const studentId = userProfile?.uid || currentUser?.$id || 'unknown';
      const studentName = userProfile?.name || currentUser?.name || 'Student';

      await addDocument('hostelComplaints', {
        complaint_id: `complaint_${Date.now()}`,
        student_id: studentId,
        student_name: studentName,
        category,
        message: message.trim(),
        status: 'pending',
        reply_message: '',
        hostel_type: hostelType,
        createdAt: new Date().toISOString()
      });

      toast.success('Complaint filed successfully!');
      try {
        await addNotification({
          user_id: 'warden',
          message: `🛠️ New Complaint filed by ${studentName} under category: ${category}`,
          category: 'hostel'
        });
      } catch (notifErr) {
        console.warn("Failed to notify warden of complaint:", notifErr);
      }
      setMessage('');
      setShowAddForm(false);
      fetchComplaints();
    } catch (err) {
      toast.error('Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (complaint, newStatus, reply = '') => {
    try {
      const id = complaint.$id || complaint.id;
      const updateData = { status: newStatus };
      if (reply) {
        updateData.reply_message = reply;
      }
      await updateDocument('hostelComplaints', id, updateData);
      try {
        await addNotification({
          user_id: complaint.student_id,
          message: `🛠️ Your complaint regarding "${complaint.category}" is now ${newStatus.toUpperCase()}.${reply ? ` Reply: "${reply}"` : ''}`,
          category: 'hostel'
        });
      } catch (notifErr) {
        console.warn("Failed to notify student of complaint status:", notifErr);
      }
      toast.success(`Complaint status marked as ${newStatus}`);
      setShowReplyModal(false);
      setSelectedComplaint(null);
      setReplyMessage('');
      fetchComplaints();
    } catch (err) {
      toast.error('Failed to update complaint status');
    }
  };

  const openReply = (complaint, status) => {
    setSelectedComplaint({ ...complaint, targetStatus: status });
    setReplyMessage('');
    setShowReplyModal(true);
  };

  const filteredComplaints = complaints.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    const map = {
      pending: { bg: '#fef3c7', color: '#92400e', icon: <MdAccessTime /> },
      'in-progress': { bg: '#dbeafe', color: '#1e40af', icon: <MdQuestionAnswer /> },
      resolved: { bg: '#d1fae5', color: '#065f46', icon: <MdCheckCircle /> },
      rejected: { bg: '#fee2e2', color: '#991b1b', icon: <MdCancel /> }
    };
    const info = map[s] || { bg: '#e5e7eb', color: '#374151', icon: <MdAccessTime /> };
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: '0.74rem',
        fontWeight: 600,
        background: info.bg,
        color: info.color,
        textTransform: 'capitalize'
      }}>
        {info.icon} {status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const glassCard = (extra = {}) => ({
    background: 'var(--surface-1)',
    borderRadius: 16,
    padding: 20,
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
    transition: 'all 0.3s ease',
    ...extra
  });

  if (loading) {
    return (
      <div className="loader-container" style={{ minHeight: '60vh' }}>
        <div className="loader" style={{ borderTopColor: accent }} />
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Loading complaints list...</p>
      </div>
    );
  }

  // =================== STUDENT VIEW ===================
  if (role === 'student') {
    return (
      <div style={{ padding: '24px 16px', maxWidth: 900, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <div>
            <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <MdReportProblem style={{ color: accent }} /> Complaint Box
            </h1>
            <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
              File maintenance requests or general hostel complaints
            </p>
          </div>
          {!showAddForm && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddForm(true)}
              style={{ background: accent, borderColor: accent, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <MdAdd /> New Complaint
            </button>
          )}
        </div>

        {showAddForm && (
          <div style={glassCard({ marginBottom: 24, borderLeft: `4px solid ${accent}` })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Submit Maintenance Request</h3>
              <button className="btn btn-ghost btn-sm" style={{ padding: 4, minWidth: 'auto' }} onClick={() => setShowAddForm(false)}>
                <MdClose style={{ fontSize: '1.2rem' }} />
              </button>
            </div>
            <form onSubmit={handleSubmitComplaint}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Category *</label>
                <select className="form-control" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="Plumbing">Plumbing (Tap, Leakage, Flush)</option>
                  <option value="Electrical">Electrical (Fan, Light, Switch, Socket)</option>
                  <option value="Furniture">Furniture (Bed, Study Table, Wardrobe)</option>
                  <option value="Cleaning">Cleaning & Housekeeping</option>
                  <option value="Pest Control">Pest Control</option>
                  <option value="Internet">Internet & Wi-Fi Connectivity</option>
                  <option value="Other">Other / Miscellaneous</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 18 }}>
                <label className="form-label">Description & Issue Details *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Describe your issue in detail. If applicable, specify room corners or extension details..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ background: accent, borderColor: accent }} disabled={submitting}>
                  {submitting ? 'Filing Complaint...' : 'File Complaint'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* past complaints */}
        <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: '0 0 16px 0' }}>Your Past Complaints</h3>
        {filteredComplaints.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-icon" style={{ background: accentLight, color: accent }}><MdReportProblem /></div>
            <h3>Clean Slate!</h3>
            <p className="text-muted">You have not submitted any complaints or maintenance queries yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredComplaints.map((c) => (
              <div key={c.$id || c.complaint_id} style={glassCard()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, background: accentLight, color: accentDark, padding: '2px 8px', borderRadius: 4, marginRight: 8 }}>
                      {c.category}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Filed on {formatDate(c.createdAt || c.$createdAt)}
                    </span>
                  </div>
                  {getStatusBadge(c.status)}
                </div>
                <p style={{ fontSize: '0.88rem', margin: '0 0 12px 0', color: 'var(--text)', lineHeight: 1.4 }}>
                  {c.message}
                </p>
                {c.reply_message && (
                  <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 10, borderLeft: `3px solid var(--success)`, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Warden Action Response:</div>
                    {c.reply_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =================== WARDEN VIEW ===================
  return (
    <div style={{ padding: '24px 16px', maxWidth: 1050, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdReportProblem style={{ color: accent }} /> Complaints Dashboard
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Manage and resolve student maintenance tickets in the {hostelType} block
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 24,
        padding: '12px 16px',
        borderRadius: 12,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)'
      }}>
        <MdFilterList style={{ color: accent, fontSize: '1.2rem' }} />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
        >
          <option value="all">All Complaints</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In-Progress</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Total Issues: {filteredComplaints.length}
        </span>
      </div>

      {filteredComplaints.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-icon"><MdReportProblem /></div>
          <h3>All Cleared!</h3>
          <p className="text-muted">No pending issues match the dashboard status selection.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredComplaints.map((c) => (
            <div key={c.$id || c.complaint_id} style={glassCard({ borderLeft: `4px solid ${c.status === 'pending' ? '#f59e0b' : c.status === 'in-progress' ? '#3b82f6' : '#10b981'}` })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)' }}>
                    {c.student_name}
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Filed on {formatDate(c.createdAt || c.$createdAt)} • Category: <strong>{c.category}</strong>
                  </span>
                </div>
                {getStatusBadge(c.status)}
              </div>
              <p style={{ fontSize: '0.86rem', margin: '0 0 16px 0', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {c.message}
              </p>

              {c.reply_message && (
                <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                  <strong>Response Note:</strong> {c.reply_message}
                </div>
              )}

              {/* Action Toolbar for Warden */}
              {c.status !== 'resolved' && c.status !== 'rejected' && (
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14, justifyContent: 'flex-end' }}>
                  {c.status === 'pending' && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleUpdateStatus(c, 'in-progress')}
                      style={{ fontSize: '0.78rem' }}
                    >
                      Mark In-Progress
                    </button>
                  )}
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--success)', borderColor: 'var(--success)', fontSize: '0.78rem' }}
                    onClick={() => openReply(c, 'resolved')}
                  >
                    Resolve Ticket
                  </button>
                  <button
                    className="btn btn-outline btn-sm btn-danger"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => openReply(c, 'rejected')}
                  >
                    Reject Ticket
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      {showReplyModal && selectedComplaint && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => { setShowReplyModal(false); setSelectedComplaint(null); }}>
          <div style={{ background: 'var(--surface-1)', borderRadius: 16, padding: 24, maxWidth: 450, width: '100%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowReplyModal(false); setSelectedComplaint(null); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-muted)', cursor: 'pointer' }}><MdClose /></button>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 800 }}>Warden Resolution Note</h2>
            <p className="text-muted" style={{ margin: '0 0 16px 0', fontSize: '0.8rem' }}>Add a resolution or feedback description for {selectedComplaint.student_name}'s ticket.</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateStatus(selectedComplaint, selectedComplaint.targetStatus, replyMessage);
            }}>
              <div className="form-group" style={{ marginBottom: 18 }}>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Enter response, resolution details, or reason for rejection here..."
                  value={replyMessage}
                  onChange={e => setReplyMessage(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setShowReplyModal(false); setSelectedComplaint(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ background: selectedComplaint.targetStatus === 'rejected' ? 'var(--danger)' : 'var(--success)', borderColor: selectedComplaint.targetStatus === 'rejected' ? 'var(--danger)' : 'var(--success)' }}>
                  Submit & {selectedComplaint.targetStatus === 'rejected' ? 'Reject' : 'Resolve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
