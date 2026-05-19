import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import {
  getTimetableByClass, addDocument, updateDocument, deleteDocument,
  getPendingComments, addChangeLog, addNotification
} from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdAdd, MdEdit, MdDelete, MdCheck, MdClose, MdFlag } from 'react-icons/md';
import { uploadFile } from '../../appwrite/storage';
import { supabase } from '../../supabase/config';

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

  // PDF Timetable states
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchClassPdf = async (cid) => {
    if (!cid.trim()) return;
    setPdfLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_timetables')
        .select('pdf_url')
        .eq('class_id', cid.trim())
        .maybeSingle();
      if (data && !error) {
        setUploadedPdfUrl(data.pdf_url);
      } else {
        setUploadedPdfUrl('');
      }
    } catch (err) {
      console.error(err);
      setUploadedPdfUrl('');
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'pdf' && classId.trim()) {
      fetchClassPdf(classId);
    }
  }, [tab, classId]);

  const handlePdfUpload = async () => {
    if (!classId.trim()) return toast.error('Please enter a Class ID');
    if (!pdfFile) return toast.error('Please select a PDF file');
    
    setPdfLoading(true);
    try {
      const fileUrl = await uploadFile(pdfFile);
      if (!fileUrl) throw new Error('Storage upload failed');

      const { error } = await supabase
        .from('class_timetables')
        .upsert({
          class_id: classId.trim(),
          pdf_url: fileUrl,
          uploaded_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Timetable PDF uploaded successfully!');
      setUploadedPdfUrl(fileUrl);
      setPdfFile(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload PDF: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePdfDelete = async () => {
    if (!classId.trim()) return;
    if (!window.confirm('Are you sure you want to remove the PDF timetable for this class?')) return;
    
    setPdfLoading(true);
    try {
      const { error } = await supabase
        .from('class_timetables')
        .delete()
        .eq('class_id', classId.trim());

      if (error) throw error;

      toast.success('Timetable PDF removed!');
      setUploadedPdfUrl('');
    } catch (err) {
      toast.error('Failed to remove PDF');
    } finally {
      setPdfLoading(false);
    }
  };

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
        <button className={`btn ${tab === 'pdf' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('pdf')}>PDF Timetable</button>
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

      {/* === PDF Tab === */}
      {tab === 'pdf' && (
        <div className="card">
          <h3 className="mb-16">📄 Upload Class Timetable PDF</h3>
          <p className="text-muted mb-24" style={{ fontSize: '0.88rem' }}>
            Upload an official timetable PDF for a class section. Students in this class will see a download button on their timetable screen.
          </p>

          <div style={{ maxWidth: 480 }}>
            <div className="form-group mb-16">
              <label className="form-label">Class ID *</label>
              <input 
                className="form-control" 
                placeholder="e.g. CS-A-2024" 
                value={classId} 
                onChange={(e) => setClassId(e.target.value)} 
              />
            </div>

            {classId.trim() && (
              <>
                {pdfLoading ? (
                  <div className="loader-container" style={{ minHeight: 80 }}><div className="loader" /></div>
                ) : uploadedPdfUrl ? (
                  <div className="mb-24" style={{ 
                    padding: 16, 
                    background: 'rgba(40, 167, 69, 0.1)', 
                    border: '1px solid #28a745', 
                    borderRadius: 'var(--radius)',
                    color: '#28a745' 
                  }}>
                    <p style={{ margin: '0 0 12px 0', fontWeight: 600 }}>✅ PDF Timetable exists for this class</p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <a 
                        href={uploadedPdfUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="btn btn-sm btn-ghost"
                        style={{ background: 'var(--surface-1)' }}
                      >
                        View Existing PDF
                      </a>
                      <button className="btn btn-sm btn-danger" onClick={handlePdfDelete}>
                        Remove PDF
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-24" style={{ padding: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No PDF timetable uploaded yet for this class.</p>
                  </div>
                )}

                <div className="form-group mb-24">
                  <label className="form-label">Select Timetable PDF File *</label>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    className="form-control" 
                    onChange={(e) => setPdfFile(e.target.files[0])} 
                  />
                </div>

                <button 
                  className="btn btn-primary" 
                  onClick={handlePdfUpload} 
                  disabled={pdfLoading || !pdfFile}
                  style={{ width: '100%' }}
                >
                  {pdfLoading ? 'Uploading...' : 'Upload & Link to Class'}
                </button>
              </>
            )}
          </div>
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
