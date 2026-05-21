import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import {
  getTodayTimetable, getTimetableByClass, getCommentsByTimetable,
  addDocument, getPendingComments, updateDocument, getAll
} from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import {
  MdSchedule, MdRoom, MdPerson, MdFlag,
  MdComment, MdClose, MdCalendarToday, MdDownload
} from 'react-icons/md';
import { supabase } from '../../supabase/config';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function StudentTimetable() {
  const { userProfile, currentUser } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay()]);
  const [allEntries, setAllEntries] = useState([]);
  const [pdfUrl, setPdfUrl] = useState('');

  // Report issue modal
  const [reportModal, setReportModal] = useState(false);
  const [reportEntry, setReportEntry] = useState(null);
  const [reportText, setReportText] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Comments modal
  const [commentsModal, setCommentsModal] = useState(false);
  const [comments, setComments] = useState([]);
  const [activeEntry, setActiveEntry] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Version History states
  const [showHistory, setShowHistory] = useState(false);
  const [changelogs, setChangelogs] = useState([]);

  const classId = userProfile?.class_id;

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    
    // Fetch PDF timetable URL from Supabase
    supabase.from('class_timetables').select('pdf_url').eq('class_id', classId).maybeSingle()
      .then(({ data }) => setPdfUrl(data?.pdf_url || ''))
      .catch(() => setPdfUrl(''));

    // Fetch individual entries
    getTimetableByClass(classId).then((data) => {
      setAllEntries(data);
      setLoading(false);
    });
  }, [classId]);

  useEffect(() => {
    setEntries(allEntries.filter((e) => e.day === selectedDay));
  }, [selectedDay, allEntries]);

  const openReport = (entry) => { setReportEntry(entry); setReportModal(true); };
  const closeReport = () => { setReportEntry(null); setReportText(''); setSuggestion(''); setReportModal(false); };

  const openComments = async (entry) => {
    setActiveEntry(entry);
    const c = await getCommentsByTimetable(entry.id);
    setComments(c);
    setCommentsModal(true);
  };

  const submitReport = async () => {
    if (!reportText.trim()) return toast.error('Please describe the issue');
    setSubmitting(true);
    try {
      await addDocument('comments', {
        student_id: currentUser.uid,
        timetable_id: reportEntry.id,
        comment_text: reportText,
        suggested_change: suggestion,
        status: 'pending',
      });
      toast.success('Issue reported successfully!');
      closeReport();
    } catch {
      toast.error('Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostComment = async () => {
    if (!newCommentText.trim()) return;
    try {
      const isIssue = newCommentText.includes('⚠️') || newCommentText.toLowerCase().includes('issue') || newCommentText.toLowerCase().includes('wrong');
      await addDocument('comments', {
        student_id: currentUser.uid,
        timetable_id: activeEntry.id,
        comment_text: newCommentText,
        suggested_change: '',
        status: isIssue ? 'pending' : 'general',
      });
      setNewCommentText('');
      toast.success('Comment posted!');
      const c = await getCommentsByTimetable(activeEntry.id);
      setComments(c);
    } catch {
      toast.error('Failed to post comment');
    }
  };

  const handleQuickComment = async (templateText) => {
    if (!activeEntry) return;
    try {
      const isIssue = templateText.includes('⚠️');
      await addDocument('comments', {
        student_id: currentUser.uid,
        timetable_id: activeEntry.id,
        comment_text: templateText,
        suggested_change: '',
        status: isIssue ? 'pending' : 'general',
      });
      toast.success('Comment posted!');
      const c = await getCommentsByTimetable(activeEntry.id);
      setComments(c);
    } catch {
      toast.error('Failed to post comment');
    }
  };

  const fetchAndShowHistory = async () => {
    if (!showHistory) {
      setLoading(true);
      try {
        const logs = await getAll('changelogs');
        const classTimetableIds = allEntries.map(e => e.id);
        const filteredLogs = logs.filter(log => classTimetableIds.includes(log.timetable_id));
        setChangelogs(filteredLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } catch (err) {
        console.error(err);
        toast.error('Failed to load history');
      } finally {
        setLoading(false);
      }
    }
    setShowHistory(!showHistory);
  };

  const sortedEntries = [...entries].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  return (
    <Layout pageTitle="Timetable">
      <h1 className="page-title">Timetable</h1>
      <p className="page-subtitle">View your class schedule and report issues</p>

      {/* Official PDF Timetable Button & Version History Toggle */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {pdfUrl && (
          <div style={{
            background: 'linear-gradient(135deg, #1e212b 0%, #2a2d3a 100%)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white',
            flex: 1,
            minWidth: 280
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'white' }}>Official Class Timetable</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Download or view the official PDF version</p>
            </div>
            <a 
              href={pdfUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <MdDownload size={18} /> View PDF
            </a>
          </div>
        )}
        
        <div style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flex: 1,
          minWidth: 280
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Update History</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>View recent schedule modifications</p>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={fetchAndShowHistory}
          >
            {showHistory ? 'View Schedule' : 'View History'}
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: 20 }}>Timetable Change Logs</h2>
          {changelogs.length === 0 ? (
            <div className="empty-state"><p>No changes recorded yet.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderLeft: '2px solid var(--border)', paddingLeft: 16, marginLeft: 8 }}>
              {changelogs.map((log) => (
                <div key={log.id || log.$id} style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: -25,
                    top: 4,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    border: '3px solid var(--background)'
                  }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="font-semibold" style={{ fontSize: '0.95rem' }}>{log.action}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>{log.details}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', fontStyle: 'italic' }}>Changed by: {log.changed_by}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Day selector */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24, paddingBottom: 4 }}>
            {DAYS.filter((d) => d !== 'Sunday').map((day) => (
              <button
                key={day}
                className={`btn ${selectedDay === day ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedDay(day)}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loader-container" style={{ minHeight: 200 }}>
              <div className="loader" />
            </div>
          ) : !classId ? (
            <div className="empty-state"><p>No class assigned. Contact admin.</p></div>
          ) : sortedEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><MdCalendarToday /></div>
              <p>No classes scheduled for {selectedDay}.</p>
            </div>
          ) : (
            <div className="timetable-grid">
              {sortedEntries.map((entry) => (
                <div key={entry.id} className={`timetable-card ${entry.status === 'modified' ? 'modified' : ''}`}>
                  <div className="tc-time">
                    <MdSchedule style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {entry.time || 'N/A'}
                  </div>
                  <div className="tc-subject">{entry.subject}</div>
                  <div className="tc-meta">
                    <span className="tc-meta-item"><MdPerson />{entry.teacher || '—'}</span>
                    <span className="tc-meta-item"><MdRoom />{entry.room || '—'}</span>
                    {entry.status === 'modified' && (
                      <span className="badge badge-modified">Modified</span>
                    )}
                  </div>
                  <div className="tc-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => openReport(entry)}>
                      <MdFlag /> Report
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => openComments(entry)}>
                      <MdComment /> Comments
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Report Issue Modal */}
      {reportModal && (
        <div className="modal-overlay" onClick={closeReport}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Report Timetable Issue</span>
              <button className="modal-close" onClick={closeReport}><MdClose /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Subject: <strong>{reportEntry?.subject}</strong> — {reportEntry?.time}
            </p>
            <div className="form-group">
              <label className="form-label">Describe the Issue *</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="What's wrong with this timetable entry?"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Suggested Change (optional)</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="What do you think it should be?"
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeReport}>Cancel</button>
              <button className="btn btn-primary" onClick={submitReport} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {commentsModal && (
        <div className="modal-overlay" onClick={() => setCommentsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Timetable Comments - {activeEntry?.subject}</span>
              <button className="modal-close" onClick={() => setCommentsModal(false)}><MdClose /></button>
            </div>
            {comments.length === 0 ? (
              <div className="empty-state"><p>No comments yet for this entry.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 220, overflowY: 'auto', paddingRight: 4, marginBottom: 16 }}>
                {comments.map((c) => (
                  <div key={c.id || c.$id} style={{
                    background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)',
                    padding: '12px', fontSize: '0.875rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Student ID: {c.student_id ? `${c.student_id.slice(0, 6)}...` : 'Anonymous'}</span>
                      <span className={`badge badge-${c.status || 'general'}`} style={{
                        background: c.status === 'pending' ? 'var(--warning-light)' : c.status === 'approved' ? 'var(--success-light)' : 'var(--surface-3)',
                        color: c.status === 'pending' ? 'var(--warning)' : c.status === 'approved' ? 'var(--success)' : 'var(--text-muted)',
                        padding: '2px 8px', borderRadius: '4px', textTransform: 'capitalize'
                      }}>{c.status || 'general'}</span>
                    </div>
                    <p style={{ margin: 0 }}>{c.comment_text}</p>
                    {c.suggested_change && (
                      <p style={{ marginTop: 6, color: 'var(--primary)', margin: '6px 0 0 0' }}>
                        💡 Suggestion: {c.suggested_change}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Post comment form */}
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-ghost" style={{ border: '1px solid var(--border)' }} onClick={() => handleQuickComment("👍 Okay")}>👍 Okay</button>
                <button className="btn btn-sm btn-ghost" style={{ border: '1px solid var(--border)' }} onClick={() => handleQuickComment("✅ Correct")}>✅ Correct</button>
                <button className="btn btn-sm btn-ghost" style={{ border: '1px solid var(--border)' }} onClick={() => handleQuickComment("⚠️ There is an issue")}>⚠️ There is an issue</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Type a comment..." 
                  value={newCommentText} 
                  onChange={(e) => setNewCommentText(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                />
                <button className="btn btn-primary" onClick={handlePostComment}>Post</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
