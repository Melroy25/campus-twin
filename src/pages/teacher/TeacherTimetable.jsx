import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import TimetableGrid from '../../components/TimetableGrid';
import CalendarOfEvents from '../../components/CalendarOfEvents';
import { useAuth } from '../../context/AuthContext';
import {
  getAll, addDocument, deleteDocument
} from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import {
  MdSchedule, MdRoom, MdPerson, MdClose, MdSend, MdDelete, MdEdit
} from 'react-icons/md';

export default function TeacherTimetable() {
  const { userProfile, currentUser } = useAuth();
  const [allEntries, setAllEntries] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('grid');
  const [showMyOnly, setShowMyOnly] = useState(false);

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

  const teacherName = userProfile?.name || '';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const allTT = await getAll('timetable');
        // Keep the FULL timetable list so that we can show the entire class timetable, not just teacher's slots
        setAllEntries(allTT);

        // Gather all assigned class IDs for this teacher:
        const assignedClassIds = new Set();
        
        // 1. From official class_assignments in user profile (if any exist)
        if (userProfile?.class_assignments && Array.isArray(userProfile.class_assignments)) {
          userProfile.class_assignments.forEach(assignment => {
            if (assignment && typeof assignment === 'object' && assignment.class_id) {
              assignedClassIds.add(assignment.class_id);
            } else if (typeof assignment === 'string') {
              assignedClassIds.add(assignment);
            }
          });
        }

        // 2. Also check if the teacher has any timetable entries and add those classes too as fallback/supplement
        allTT.forEach(e => {
          if (e.teacher && e.teacher.toLowerCase().includes(teacherName.toLowerCase())) {
            assignedClassIds.add(e.class_id);
          }
        });

        const classIds = [...assignedClassIds];
        const allClasses = await getAll('classes');
        const teacherClasses = allClasses.filter(c => classIds.includes(c.id));
        setClasses(teacherClasses);

        if (teacherClasses.length > 0 && !classId) {
          setClassId(teacherClasses[0].id);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load timetable');
      } finally {
        setLoading(false);
      }
    };
    if (teacherName) loadData();
  }, [teacherName, userProfile?.class_assignments]);

  useEffect(() => {
    if (classId) {
      let filtered = allEntries.filter(e => e.class_id === classId);
      if (showMyOnly && teacherName) {
        filtered = filtered.filter(e => 
          e.teacher && e.teacher.toLowerCase().includes(teacherName.toLowerCase())
        );
      }
      setEntries(filtered);
    } else {
      setEntries([]);
    }
  }, [classId, allEntries, showMyOnly, teacherName]);

  // Fetch updates
  const fetchUpdates = async () => {
    if (!classId) return;
    setUpdatesLoading(true);
    try {
      const allUpdates = await getAll('timetable_updates');
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

  const postUpdate = async () => {
    if (!updateText.trim()) return toast.error('Write something first');
    if (!classId) return toast.error('Select a class first');
    setPosting(true);
    try {
      await addDocument('timetable_updates', {
        class_id: classId,
        message: updateText.trim(),
        author_id: currentUser?.uid || '',
        author_name: userProfile?.name || 'Teacher',
        author_role: 'teacher',
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

  const deleteUpdate = async (update) => {
    if (!window.confirm('Delete this update?')) return;
    try {
      await deleteDocument('timetable_updates', update.id || update.$id);
      toast.success('Deleted');
      fetchUpdates();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <Layout pageTitle="Timetable">
      <h1 className="page-title">My Timetable</h1>
      <p className="page-subtitle">View your teaching schedule and post updates</p>

      {classes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>No classes assigned to you. Ask the admin to assign classes or allocate subjects to your name.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Class Selector */}
          <div className="card mb-24">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 'bold' }}>Select Class Section:</span>
              <select className="form-control" style={{ maxWidth: 260 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', marginLeft: 'auto' }}>
                <button
                  onClick={() => setShowMyOnly(false)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: !showMyOnly ? 'var(--primary)' : 'var(--surface-2)',
                    color: !showMyOnly ? 'white' : 'var(--text-muted)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  All Classes
                </button>
                <button
                  onClick={() => setShowMyOnly(true)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: 'none',
                    borderLeft: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: showMyOnly ? 'var(--primary)' : 'var(--surface-2)',
                    color: showMyOnly ? 'white' : 'var(--text-muted)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  My Classes
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button className={`btn ${tab === 'grid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('grid')}>📊 Weekly Grid</button>
            <button className={`btn ${tab === 'coe' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('coe')}>📅 Calendar of Events</button>
            <button className={`btn ${tab === 'updates' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('updates')}>
              📝 Updates {unreadCount > 0 && <span className="notif-badge" style={{ position: 'static', marginLeft: 4 }}>{unreadCount}</span>}
            </button>
          </div>

          {tab === 'grid' && (
            <>
              {loading ? (
                <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
              ) : entries.length === 0 ? (
                <div className="card"><div className="empty-state"><p>No timetable entries found for this class section.</p></div></div>
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
            Updates from students, teachers & admins — visible to everyone.
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
                        <span className={`update-role-dot ${u.author_role || 'teacher'}`} />
                        <strong>{u.author_name || 'Unknown'}</strong>
                        <span className="update-role-badge">{u.author_role || 'teacher'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="tt-header-btn tt-header-btn-danger" title="Delete" onClick={() => deleteUpdate(u)}>
                          <MdDelete size={14} />
                        </button>
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
              placeholder="e.g., I won't be available for DMS class..."
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

      {/* === Calendar of Events Tab === */}
      {tab === 'coe' && (
        <CalendarOfEvents 
          isAdmin={false} 
          defaultSemester={classes.find(c => c.id === classId)?.semester || "1st Semester"} 
          teacherClasses={classes.map(c => ({ id: c.id, label: c.label }))}
        />
      )}
        </>
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
