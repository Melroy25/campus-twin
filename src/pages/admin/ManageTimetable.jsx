import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import {
  getTimetableByClass, addDocument, updateDocument, deleteDocument,
  getPendingComments, addChangeLog, addNotification
} from '../../firebase/firestore';
import { toast } from 'react-hot-toast';
import { MdAdd, MdEdit, MdDelete, MdCheck, MdClose, MdFlag } from 'react-icons/md';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const EMPTY_FORM = { class_id: '', subject: '', teacher: '', room: '', time: '', day: 'Monday', status: 'normal' };

export default function AdminManageTimetable() {
  const [classId, setClassId] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState('timetable');

  const fetchTimetable = async () => {
    if (!classId.trim()) return;
    setLoading(true);
    const data = await getTimetableByClass(classId.trim());
    setEntries(data);
    setLoading(false);
  };

  const fetchIssues = async () => {
    const data = await getPendingComments();
    setIssues(data);
  };

  useEffect(() => { fetchIssues(); }, []);

  const openAdd = () => { setEditEntry(null); setForm({ ...EMPTY_FORM, class_id: classId }); setShowForm(true); };
  const openEdit = (entry) => { setEditEntry(entry); setForm({ ...entry }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.subject || !form.day || !form.time) return toast.error('Fill required fields');
    setSaving(true);
    try {
      if (editEntry) {
        await updateDocument('timetable', editEntry.id, { ...form, status: 'modified' });
        toast.success('Entry updated');
      } else {
        await addDocument('timetable', form);
        toast.success('Entry added');
      }
      setShowForm(false);
      fetchTimetable();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this timetable entry?')) return;
    await deleteDocument('timetable', id);
    toast.success('Entry deleted');
    fetchTimetable();
  };

  const handleApproveIssue = async (issue) => {
    await updateDocument('comments', issue.id, { status: 'approved' });
    await addChangeLog(issue.timetable_id, 'Issue raised', issue.suggested_change || 'Approved', 'admin');
    await addNotification(issue.student_id, '✅ Your timetable issue has been approved and noted.');
    toast.success('Issue approved');
    fetchIssues();
  };

  const handleRejectIssue = async (issue) => {
    await updateDocument('comments', issue.id, { status: 'rejected' });
    await addNotification(issue.student_id, '❌ Your timetable issue has been reviewed and rejected.');
    toast.success('Issue rejected');
    fetchIssues();
  };

  return (
    <Layout pageTitle="Manage Timetable">
      <h1 className="page-title">Manage Timetable</h1>
      <p className="page-subtitle">Add, edit, delete timetable entries and review student issues</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button className={`btn ${tab === 'timetable' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('timetable')}>Timetable CRUD</button>
        <button className={`btn ${tab === 'issues' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('issues')}>
          Issues {issues.length > 0 && <span className="notif-badge" style={{ position: 'static', marginLeft: 4 }}>{issues.length}</span>}
        </button>
      </div>

      {/* === Timetable Tab === */}
      {tab === 'timetable' && (
        <>
          <div className="card mb-24">
            <div className="flex-between mb-16">
              <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                <input className="form-control" style={{ maxWidth: 240 }} placeholder="Class ID e.g. CS-A-2024" value={classId} onChange={(e) => setClassId(e.target.value)} />
                <button className="btn btn-primary" onClick={fetchTimetable}>Load</button>
              </div>
              <button className="btn btn-primary" onClick={openAdd} disabled={!classId}>
                <MdAdd /> Add Entry
              </button>
            </div>

            {loading ? (
              <div className="loader-container" style={{ minHeight: 100 }}><div className="loader" /></div>
            ) : entries.length === 0 ? (
              <div className="empty-state"><p>No entries. Load a class first or add entries.</p></div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {entries.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day)).map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.day}</td>
                        <td>{entry.time}</td>
                        <td className="font-semibold">{entry.subject}</td>
                        <td>{entry.teacher}</td>
                        <td>{entry.room}</td>
                        <td><span className={`badge badge-${entry.status}`}>{entry.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm btn-ghost" onClick={() => openEdit(entry)}><MdEdit /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(entry.id)}><MdDelete /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* === Issues Tab === */}
      {tab === 'issues' && (
        <div className="card">
          {issues.length === 0 ? (
            <div className="empty-state"><p>No pending timetable issues.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {issues.map((issue) => (
                <div key={issue.id} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
                  <div className="flex-between mb-8">
                    <span className="font-semibold"><MdFlag style={{ color: 'var(--warning)', verticalAlign: 'middle', marginRight: 4 }} />Timetable Issue</span>
                    <span className="badge badge-pending">pending</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginBottom: 6 }}><strong>Issue:</strong> {issue.comment_text}</p>
                  {issue.suggested_change && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--primary)', marginBottom: 10 }}>💡 Suggestion: {issue.suggested_change}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-success btn-sm" onClick={() => handleApproveIssue(issue)}><MdCheck /> Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleRejectIssue(issue)}><MdClose /> Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editEntry ? 'Edit Entry' : 'Add Timetable Entry'}</span>
              <button className="modal-close" onClick={() => setShowForm(false)}><MdClose /></button>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Class ID *</label>
                <input className="form-control" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Day *</label>
                <select className="form-control" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                  {DAYS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Time *</label>
                <input className="form-control" placeholder="e.g. 09:00 - 10:00" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Subject *</label>
                <input className="form-control" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Teacher</label>
                <input className="form-control" value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Room</label>
                <input className="form-control" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
