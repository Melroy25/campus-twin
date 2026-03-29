import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { listenEvents, addDocument, deleteDocument } from '../../firebase/firestore';
import { uploadEventImage } from '../../firebase/storage';
import { toast } from 'react-hot-toast';
import { MdAdd, MdDelete, MdUpload, MdEvent } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';

export default function AdminPostEvents() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', date: '' });
  const [image, setImage] = useState(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const unsub = listenEvents(setEvents);
    return unsub;
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!form.title || !form.date) return toast.error('Title and date are required');
    setPosting(true);
    try {
      let imageUrl = '';
      if (image) imageUrl = await uploadEventImage(image);
      await addDocument('events', {
        ...form,
        image: imageUrl,
        posted_by: currentUser?.uid || 'admin',
      });
      toast.success('Event posted!');
      setForm({ title: '', description: '', date: '' });
      setImage(null);
    } catch { toast.error('Failed to post event'); }
    finally { setPosting(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    await deleteDocument('events', id);
    toast.success('Event deleted');
  };

  const formatDate = (val) => {
    if (!val) return '';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Layout pageTitle="Post Events">
      <h1 className="page-title">Post Events</h1>
      <p className="page-subtitle">Create and manage campus announcements and events</p>

      <div className="grid-2 mb-24" style={{ alignItems: 'start' }}>
        {/* Create form */}
        <div className="card card-lg">
          <h3 className="mb-16"><MdAdd style={{ verticalAlign: 'middle' }} /> Create Event</h3>
          <form onSubmit={handlePost}>
            <div className="form-group">
              <label className="form-label">Event Title *</label>
              <input className="form-control" placeholder="e.g. Annual Tech Fest 2025" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-control" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows={3} placeholder="Event details, venue, time, etc." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Event Image (optional)</label>
              <label className="file-upload-area" htmlFor="event-img">
                <div className="upload-icon"><MdUpload /></div>
                <p>{image ? image.name : 'Click to upload image'}</p>
                <input id="event-img" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setImage(e.target.files[0])} />
              </label>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={posting}>
              {posting ? 'Posting...' : 'Post Event'}
            </button>
          </form>
        </div>

        {/* Posted events */}
        <div className="card" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <h3 className="mb-16">Posted Events</h3>
          {events.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><MdEvent /></div><p>No events posted yet.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map((ev) => (
                <div key={ev.id} style={{
                  display: 'flex', gap: 12, padding: '12px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary-light)', overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                  }}>
                    {ev.image ? <img src={ev.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎉'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-semibold" style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(ev.date)}</div>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(ev.id)}><MdDelete /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
