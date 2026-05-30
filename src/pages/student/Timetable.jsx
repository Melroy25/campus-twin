import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import TimetableGrid from '../../components/TimetableGrid';
import CalendarOfEvents from '../../components/CalendarOfEvents';
import { useAuth } from '../../context/AuthContext';
import {
  getTimetableByClass, getAll, addDocument, deleteDocument
} from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import {
  MdSchedule, MdRoom, MdPerson, MdClose, MdDownload,
  MdSend, MdDelete, MdEdit
} from 'react-icons/md';
import { supabase } from '../../supabase/config';

export default function StudentTimetable() {
  const { userProfile, currentUser } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState('');
  const [tab, setTab] = useState('grid');

  // Update text box
  const [updateText, setUpdateText] = useState('');
  const [posting, setPosting] = useState(false);

  // Updates feed
  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);

  // Cell detail popover
  const [selectedEntry, setSelectedEntry] = useState(null);
  
  // Update Modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  
  // Unread badge count
  const [unreadCount, setUnreadCount] = useState(0);

  const classId = userProfile?.class_id;

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    
    supabase.from('class_timetables').select('pdf_url').eq('class_id', classId).maybeSingle()
      .then(({ data }) => setPdfUrl(data?.pdf_url || ''))
      .catch(() => setPdfUrl(''));

    getTimetableByClass(classId).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [classId]);

  // Fetch updates for this class
  const fetchUpdates = async () => {
    setUpdatesLoading(true);
    try {
      const allUpdates = await getAll('timetable_updates');
      // Filter to this class
      const classUpdates = allUpdates
        .filter(u => u.class_id === classId)
        .sort((a, b) => new Date(b.createdAt || b.$createdAt) - new Date(a.createdAt || a.$createdAt));
      setUpdates(classUpdates);

      // Calculate unread count
      if (tab === 'updates') {
        localStorage.setItem(`last_seen_updates_time_${classId}`, new Date().toISOString());
        setUnreadCount(0);
      } else {
        const lastSeen = localStorage.getItem(`last_seen_updates_time_${classId}`);
        if (!lastSeen) {
          setUnreadCount(classUpdates.length);
        } else {
          const lastSeenDate = new Date(lastSeen);
          const newUpdates = classUpdates.filter(u => new Date(u.createdAt || u.$createdAt) > lastSeenDate);
          setUnreadCount(newUpdates.length);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatesLoading(false);
    }
  };

  useEffect(() => {
    if (classId) {
      fetchUpdates();
      if (tab === 'updates') {
        localStorage.setItem(`last_seen_updates_time_${classId}`, new Date().toISOString());
        setUnreadCount(0);
      }
    }
  }, [classId, tab]);

  const handleCellClick = (entry) => {
    if (entry) setSelectedEntry(entry);
  };

  // Post an update
  const postUpdate = async () => {
    if (!updateText.trim()) return toast.error('Write something first');
    if (!classId) return toast.error('No class assigned');
    setPosting(true);
    try {
      await addDocument('timetable_updates', {
        class_id: classId,
        message: updateText.trim(),
        author_id: currentUser?.uid || '',
        author_name: userProfile?.name || 'Student',
        author_role: 'student',
        createdAt: new Date().toISOString(),
      });
      toast.success('Update posted!');
      setUpdateText('');
      fetchUpdates();
    } catch (err) {
      console.error('Post error:', err);
      toast.error('Failed to post: ' + (err.message || 'Unknown error'));
    } finally {
      setPosting(false);
    }
  };

  // Delete own update
  const deleteUpdate = async (update) => {
    if (!window.confirm('Delete this update?')) return;
    try {
      await deleteDocument('timetable_updates', update.id || update.$id);
      toast.success('Deleted');
      fetchUpdates();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  return (
    <Layout pageTitle="Timetable">
      <h1 className="page-title">Timetable</h1>
      <p className="page-subtitle">Your weekly class schedule</p>

      {/* PDF Download Bar */}
      {pdfUrl && (
        <div style={{
          background: 'linear-gradient(135deg, #1e212b 0%, #2a2d3a 100%)',
          borderRadius: 'var(--radius)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'white',
          marginBottom: 20,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'white' }}>Official Timetable PDF</h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>Download the official version</p>
          </div>
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MdDownload size={16} /> PDF
          </a>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn ${tab === 'grid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('grid')}>📊 Weekly Grid</button>
        <button className={`btn ${tab === 'coe' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('coe')}>📅 Calendar of Events</button>
        <button className={`btn ${tab === 'updates' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('updates')}>
          📝 Updates {unreadCount > 0 && <span className="notif-badge" style={{ position: 'static', marginLeft: 4 }}>{unreadCount}</span>}
        </button>
      </div>

      {/* === Grid View === */}
      {tab === 'grid' && (
        <>
          {loading ? (
            <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
          ) : !classId ? (
            <div className="card"><div className="empty-state"><p>No class assigned. Contact admin.</p></div></div>
          ) : entries.length === 0 ? (
            <div className="card"><div className="empty-state"><p>No timetable entries found for your class.</p></div></div>
          ) : (
            <TimetableGrid entries={entries} editable={false} onCellClick={handleCellClick} />
          )}

          {/* Removed standalone update text box per user request */}
        </>
      )}

      {/* === Updates Feed === */}
      {tab === 'updates' && (
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>📝 All Updates</h3>
          <p className="text-muted mb-16" style={{ fontSize: '0.82rem' }}>
            Updates from students, teachers & admins — visible to everyone in this class.
          </p>

          {updatesLoading ? (
            <div className="loader-container" style={{ minHeight: 100 }}><div className="loader" /></div>
          ) : updates.length === 0 ? (
            <div className="empty-state"><p>No updates yet. Be the first to post!</p></div>
          ) : (
            <div className="updates-feed">
              {updates.map((u) => {
                const isOwn = u.author_id === currentUser?.uid;
                const timeAgo = formatTimeAgo(u.createdAt || u.$createdAt);
                return (
                  <div key={u.id || u.$id} className="update-card">
                    <div className="update-card-header">
                      <div className="update-card-author">
                        <span className={`update-role-dot ${u.author_role || 'student'}`} />
                        <strong>{u.author_name || 'Unknown'}</strong>
                        <span className="update-role-badge">{u.author_role || 'student'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isOwn && (
                          <button className="tt-header-btn tt-header-btn-danger" title="Delete" onClick={() => deleteUpdate(u)}>
                            <MdDelete size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="update-card-message">{u.message}</p>
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatUpdateDate(u.createdAt || u.$createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === Calendar of Events Tab === */}
      {tab === 'coe' && (
        <CalendarOfEvents 
          isAdmin={false} 
          defaultSemester={userProfile?.class_semester || '1st Semester'} 
        />
      )}

      {/* Cell Detail Popover */}
      {selectedEntry && (
        <div className="modal-overlay" onClick={() => setSelectedEntry(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">{selectedEntry.subject}</span>
              <button className="modal-close" onClick={() => setSelectedEntry(null)}><MdClose /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdSchedule style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.9rem' }}>{selectedEntry.day} • {selectedEntry.time}</span>
              </div>
              {selectedEntry.teacher && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdPerson style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.9rem' }}>{selectedEntry.teacher}</span>
                </div>
              )}
              {selectedEntry.room && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdRoom style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.9rem' }}>{selectedEntry.room}</span>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-start' }}>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setUpdateText(`Regarding ${selectedEntry.subject} (${selectedEntry.time}): `);
                  setUpdateModalOpen(true);
                  setSelectedEntry(null);
                }}
              >
                <MdEdit /> Update It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Post Modal */}
      {updateModalOpen && (
        <div className="modal-overlay" onClick={() => setUpdateModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <span className="modal-title">Post Timetable Update</span>
              <button className="modal-close" onClick={() => setUpdateModalOpen(false)}><MdClose /></button>
            </div>
            <textarea
              className="form-control mb-16"
              rows={4}
              placeholder="e.g., Today no DMS class..."
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
              autoFocus
            />
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setUpdateModalOpen(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={async () => {
                  await postUpdate();
                  setUpdateModalOpen(false);
                }}
                disabled={posting || !updateText.trim()}
              >
                <MdSend style={{ marginRight: 6 }} /> {posting ? 'Posting...' : 'Post Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function formatUpdateDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  
  const relative = formatTimeAgo(dateStr);
  return `${day} ${month} ${year} at ${hours}:${minutes} ${ampm} (${relative})`;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
