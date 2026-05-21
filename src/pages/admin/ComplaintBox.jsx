import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { listenComplaints, resolveComplaint, deleteComplaint, updateDocument, addNotification } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdInbox, MdCheckCircle, MdDelete, MdImage, MdClose, MdThumbUp } from 'react-icons/md';

export default function AdminComplaintBox() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'open' | 'approved' | 'resolved' | 'rejected'
  const [lightboxImg, setLightboxImg] = useState(null);
  const [replyInputs, setReplyInputs] = useState({});

  useEffect(() => {
    const unsub = listenComplaints((data) => {
      setComplaints(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleAction = async (complaint, status) => {
    const replyText = replyInputs[complaint.id] !== undefined ? replyInputs[complaint.id] : (complaint.admin_reply || '');
    try {
      await updateDocument('complaints', complaint.id, {
        status,
        admin_reply: replyText.trim()
      });
      
      if (complaint.user_id) {
        await addNotification({
          user_id: complaint.user_id,
          message: `Your complaint regarding "${complaint.message.slice(0, 30)}..." has been marked as "${status}". Admin reply: "${replyText.trim() || 'No custom comment.'}"`,
        });
      }
      toast.success(`Complaint status updated to ${status}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update complaint status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this complaint permanently?')) return;
    await deleteComplaint(id);
    toast.success('Complaint deleted');
  };

  const formatDate = (val) => {
    if (!val) return '';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filtered = complaints.filter((c) => filter === 'all' ? true : c.status === filter);
  const openCount = complaints.filter((c) => c.status === 'open').length;
  const approvedCount = complaints.filter((c) => c.status === 'approved').length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;
  const rejectedCount = complaints.filter((c) => c.status === 'rejected').length;

  const getCardBorderColor = (status) => {
    switch (status) {
      case 'open': return 'rgb(239, 68, 68)';
      case 'approved': return 'rgb(245, 158, 11)';
      case 'resolved': return 'rgb(16, 185, 129)';
      case 'rejected': return 'rgb(107, 114, 128)';
      default: return 'var(--border)';
    }
  };

  const getBadgeStyles = (status) => {
    switch (status) {
      case 'open': return { background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)' };
      case 'approved': return { background: 'rgba(245, 158, 11, 0.1)', color: 'rgb(245, 158, 11)' };
      case 'resolved': return { background: 'rgba(16, 185, 129, 0.1)', color: 'rgb(16, 185, 129)' };
      case 'rejected': return { background: 'rgba(107, 114, 128, 0.1)', color: 'rgb(107, 114, 128)' };
      default: return { background: 'var(--surface-2)', color: 'var(--text-secondary)' };
    }
  };

  return (
    <Layout pageTitle="Complaint Box">
      <h1 className="page-title">Complaint Box</h1>
      <p className="page-subtitle">Anonymous complaints submitted by students, teachers, and mentors</p>

      {/* Stats row */}
      <div className="stat-grid mb-24" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        {[
          { label: 'Total', value: complaints.length, icon: '📬', color: 'var(--primary-light)', iconColor: 'var(--primary)' },
          { label: 'Open', value: openCount, icon: '🔴', color: 'rgba(239, 68, 68, 0.1)', iconColor: 'rgb(239, 68, 68)' },
          { label: 'Approved', value: approvedCount, icon: '🟡', color: 'rgba(245, 158, 11, 0.1)', iconColor: 'rgb(245, 158, 11)' },
          { label: 'Resolved', value: resolvedCount, icon: '🟢', color: 'rgba(16, 185, 129, 0.1)', iconColor: 'rgb(16, 185, 129)' },
          { label: 'Rejected', value: rejectedCount, icon: '❌', color: 'rgba(107, 114, 128, 0.1)', iconColor: 'rgb(107, 114, 128)' },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="stat-icon" style={{ background: s.color, color: s.iconColor, fontSize: '1.2rem', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: '1.2rem', marginTop: 4 }}>{s.value}</div>
            <div className="stat-label" style={{ fontSize: '0.7rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'open', 'approved', 'resolved', 'rejected'].map((f) => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              border: 'none',
              background: filter === f ? 'var(--primary)' : 'var(--surface-2)',
              color: filter === f ? '#fff' : 'var(--text-secondary)'
            }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MdInbox /></div>
          <p>{filter === 'all' ? 'No complaints submitted yet.' : `No ${filter} complaints.`}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((c) => {
            const currentReplyVal = replyInputs[c.id] !== undefined ? replyInputs[c.id] : (c.admin_reply || '');
            return (
              <div key={c.id} className="card" style={{
                borderLeft: `4px solid ${getCardBorderColor(c.status)}`,
                padding: '20px',
                transition: 'all 0.2s ease',
              }}>
                <div className="flex-between mb-12">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Anonymous — no name shown */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '1.1rem',
                    }}>🕵️</div>
                    <div>
                      <div className="font-semibold" style={{ fontSize: '0.85rem' }}>Anonymous</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(c.createdAt)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {c.category && (
                      <span style={{
                        padding: '2px 8px',
                        background: 'var(--surface-2)',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 500
                      }}>
                        {c.category}
                      </span>
                    )}
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      ...getBadgeStyles(c.status)
                    }}>
                      {c.status}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: c.image_url ? 12 : 0, color: 'var(--text-primary)' }}>
                  {c.message}
                </p>

                {c.image_url && (
                  <div
                    style={{ marginTop: 10, cursor: 'pointer' }}
                    onClick={() => setLightboxImg(c.image_url)}
                  >
                    <img
                      src={c.image_url}
                      alt="Complaint attachment"
                      style={{
                        maxWidth: '100%', maxHeight: 200, borderRadius: 'var(--radius-sm)',
                        objectFit: 'cover', border: '1px solid var(--border)',
                      }}
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: 4 }}>
                      <MdImage style={{ verticalAlign: 'middle' }} /> Click to expand
                    </div>
                  </div>
                )}

                {/* Reply & Actions Panel */}
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>
                    Reply & Status Actions
                  </label>
                  
                  {/* Quick templates */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {["We will look into this.", "Issue resolved.", "Will try to fix it soon.", "Approved and forwarded."].map((tmpl) => (
                      <button
                        key={tmpl}
                        type="button"
                        className="btn btn-xs btn-ghost"
                        style={{ border: '1px solid var(--border)', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px' }}
                        onClick={() => setReplyInputs(prev => ({ ...prev, [c.id]: tmpl }))}
                      >
                        {tmpl}
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="form-control"
                    placeholder="Type a custom reply message to the submitter..."
                    value={currentReplyVal}
                    onChange={(e) => setReplyInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                    rows={2}
                    style={{ resize: 'vertical', width: '100%', marginBottom: 12, fontSize: '0.85rem' }}
                  />

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleAction(c, 'approved')}
                      disabled={c.status === 'approved' && c.admin_reply === currentReplyVal}
                    >
                      <MdThumbUp /> Approve
                    </button>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleAction(c, 'resolved')}
                      disabled={c.status === 'resolved' && c.admin_reply === currentReplyVal}
                    >
                      <MdCheckCircle /> Mark Resolved
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ border: '1px solid rgb(239, 68, 68)', color: 'rgb(239, 68, 68)' }}
                      onClick={() => handleAction(c, 'rejected')}
                      disabled={c.status === 'rejected' && c.admin_reply === currentReplyVal}
                    >
                      Reject
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => handleDelete(c.id)}
                    >
                      <MdDelete /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out', padding: 24,
          }}
        >
          <button
            onClick={() => setLightboxImg(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', cursor: 'pointer', borderRadius: '50%',
              width: 40, height: 40, fontSize: '1.2rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><MdClose /></button>
          <img
            src={lightboxImg}
            alt="Full size complaint attachment"
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Layout>
  );
}
