import { useState, useEffect } from 'react';
import { queryDocuments, addDocument, updateDocument } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  MdFlightTakeoff, MdAdd, MdClose, MdCheckCircle,
  MdAccessTime, MdCancel, MdFilterList, MdDateRange
} from 'react-icons/md';

export default function HostelLeaves({ hostelType, role }) {
  const { currentUser, userProfile } = useAuth();
  const accent = hostelType === 'girls' ? '#ec4899' : '#3b82f6';
  const accentLight = hostelType === 'girls' ? '#fce7f3' : '#dbeafe';
  const accentDark = hostelType === 'girls' ? '#be185d' : '#1e40af';

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form State for Student
  const [reason, setReason] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      let queries = [Query.equal('hostel_type', hostelType)];
      if (role === 'student') {
        const studentId = userProfile?.uid || currentUser?.$id || '';
        queries.push(Query.equal('student_id', studentId));
      }
      const data = await queryDocuments('hostelLeaveRequests', queries);
      // Sort by creation date descending
      const sorted = data.sort((a, b) => new Date(b.createdAt || b.$createdAt) - new Date(a.createdAt || a.$createdAt));
      setLeaves(sorted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [hostelType, role]);

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (!reason.trim() || !fromDate || !toDate) {
      return toast.error('All fields are required');
    }

    if (fromDate > toDate) {
      return toast.error('From date cannot be after To date');
    }

    setSubmitting(true);
    try {
      const studentId = userProfile?.uid || currentUser?.$id || 'unknown';
      const studentName = userProfile?.name || currentUser?.name || 'Student';

      await addDocument('hostelLeaveRequests', {
        leave_id: `leave_${Date.now()}`,
        student_id: studentId,
        student_name: studentName,
        reason: reason.trim(),
        from_date: fromDate,
        to_date: toDate,
        approval_status: 'pending',
        reply: '',
        hostel_type: hostelType,
        createdAt: new Date().toISOString()
      });

      toast.success('Leave request submitted!');
      setReason('');
      setFromDate('');
      setToDate('');
      setShowAddForm(false);
      fetchLeaves();
    } catch (err) {
      toast.error('Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (leaveItem, newStatus, reply = '') => {
    try {
      const id = leaveItem.$id || leaveItem.id;
      const updateData = { approval_status: newStatus };
      if (reply) {
        updateData.reply = reply;
      }
      await updateDocument('hostelLeaveRequests', id, updateData);
      toast.success(`Leave request marked as ${newStatus}`);
      setShowReplyModal(false);
      setSelectedLeave(null);
      setReplyMessage('');
      fetchLeaves();
    } catch (err) {
      toast.error('Failed to update leave request status');
    }
  };

  const openReply = (leaveItem, status) => {
    setSelectedLeave({ ...leaveItem, targetStatus: status });
    setReplyMessage('');
    setShowReplyModal(true);
  };

  const filteredLeaves = leaves.filter(l => {
    if (filterStatus !== 'all' && l.approval_status !== filterStatus) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    const map = {
      pending: { bg: '#fef3c7', color: '#92400e', icon: <MdAccessTime /> },
      approved: { bg: '#d1fae5', color: '#065f46', icon: <MdCheckCircle /> },
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
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
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
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Loading leaves dashboard...</p>
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
              <MdFlightTakeoff style={{ color: accent }} /> Leave Requests
            </h1>
            <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
              Request leave permissions and track warden approvals
            </p>
          </div>
          {!showAddForm && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddForm(true)}
              style={{ background: accent, borderColor: accent, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <MdAdd /> Request Outing/Leave
            </button>
          )}
        </div>

        {showAddForm && (
          <div style={glassCard({ marginBottom: 24, borderLeft: `4px solid ${accent}` })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Apply for Outstation/Outing Leave</h3>
              <button className="btn btn-ghost btn-sm" style={{ padding: 4, minWidth: 'auto' }} onClick={() => setShowAddForm(false)}>
                <MdClose style={{ fontSize: '1.2rem' }} />
              </button>
            </div>
            <form onSubmit={handleSubmitLeave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Departure Date *</label>
                  <input type="date" className="form-control" value={fromDate} onChange={e => setFromDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Arrival Date *</label>
                  <input type="date" className="form-control" value={toDate} onChange={e => setToDate(e.target.value)} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 18 }}>
                <label className="form-label">Reason / Destination Description *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Specify destination, family visits, or official reasons for outing permission..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ background: accent, borderColor: accent }} disabled={submitting}>
                  {submitting ? 'Submitting request...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: '0 0 16px 0' }}>Your Outing Log</h3>
        {filteredLeaves.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-icon" style={{ background: accentLight, color: accent }}><MdFlightTakeoff /></div>
            <h3>No Leaves Requested</h3>
            <p className="text-muted">You have not submitted any out-of-campus leave requests yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredLeaves.map((l) => (
              <div key={l.$id || l.leave_id} style={glassCard()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MdDateRange style={{ color: accent, fontSize: '1.1rem' }} />
                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text)' }}>
                      {formatDate(l.from_date)} → {formatDate(l.to_date)}
                    </span>
                  </div>
                  {getStatusBadge(l.approval_status)}
                </div>
                <p style={{ fontSize: '0.88rem', margin: '0 0 12px 0', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  <strong>Reason:</strong> {l.reason}
                </p>
                {l.reply && (
                  <div style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 10, borderLeft: `3px solid var(--success)`, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Warden Feedback Note:</div>
                    {l.reply}
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
  const pendingLeavesCount = leaves.filter(l => l.approval_status === 'pending').length;
  const approvedLeavesCount = leaves.filter(l => l.approval_status === 'approved').length;

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1050, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdFlightTakeoff style={{ color: accent }} /> Leave Approvals
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Review, approve, or reject student leave outstation requests for the {hostelType} block
          </p>
        </div>
      </div>

      {/* Stats Board */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--surface-1)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Pending Approvals</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>{pendingLeavesCount}</div>
        </div>
        <div style={{ background: 'var(--surface-1)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Approved (This month)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', marginTop: 4 }}>{approvedLeavesCount}</div>
        </div>
        <div style={{ background: 'var(--surface-1)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Outings</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: accent, marginTop: 4 }}>{leaves.length}</div>
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
          <option value="all">All Request Files</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Showing {filteredLeaves.length} Requests
        </span>
      </div>

      {filteredLeaves.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-icon"><MdFlightTakeoff /></div>
          <h3>List is Empty</h3>
          <p className="text-muted">No outings are currently matching your selection.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredLeaves.map((l) => (
            <div key={l.$id || l.leave_id} style={glassCard({ borderLeft: `4px solid ${l.approval_status === 'pending' ? '#f59e0b' : l.approval_status === 'approved' ? '#10b981' : '#ef4444'}` })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)' }}>
                    {l.student_name}
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MdDateRange style={{ color: accent }} /> Leave Window: <strong>{formatDate(l.from_date)} → {formatDate(l.to_date)}</strong>
                  </span>
                </div>
                {getStatusBadge(l.approval_status)}
              </div>
              <p style={{ fontSize: '0.86rem', margin: '0 0 16px 0', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                <strong>Reason:</strong> {l.reason}
              </p>

              {l.reply && (
                <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                  <strong>Response Note:</strong> {l.reply}
                </div>
              )}

              {/* Actions */}
              {l.approval_status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--success)', borderColor: 'var(--success)', fontSize: '0.78rem' }}
                    onClick={() => openReply(l, 'approved')}
                  >
                    Approve Request
                  </button>
                  <button
                    className="btn btn-outline btn-sm btn-danger"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => openReply(l, 'rejected')}
                  >
                    Reject Request
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply modal */}
      {showReplyModal && selectedLeave && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => { setShowReplyModal(false); setSelectedLeave(null); }}>
          <div style={{ background: 'var(--surface-1)', borderRadius: 16, padding: 24, maxWidth: 450, width: '100%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowReplyModal(false); setSelectedLeave(null); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-muted)', cursor: 'pointer' }}><MdClose /></button>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 800 }}>Outing Authorization Response</h2>
            <p className="text-muted" style={{ margin: '0 0 16px 0', fontSize: '0.8rem' }}>Enter any rules or comments accompanying this outing authorization for {selectedLeave.student_name}.</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateStatus(selectedLeave, selectedLeave.targetStatus, replyMessage);
            }}>
              <div className="form-group" style={{ marginBottom: 18 }}>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Enter remarks, e.g. 'Carry ID card', 'Permitted to travel', 'Curfew curfew stands'..."
                  value={replyMessage}
                  onChange={e => setReplyMessage(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setShowReplyModal(false); setSelectedLeave(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ background: selectedLeave.targetStatus === 'rejected' ? 'var(--danger)' : 'var(--success)', borderColor: selectedLeave.targetStatus === 'rejected' ? 'var(--danger)' : 'var(--success)' }}>
                  Submit & {selectedLeave.targetStatus === 'rejected' ? 'Reject' : 'Approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
