import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import {
  getTodayTimetable, getTimetableByClass, getCommentsByTimetable,
  addDocument, getPendingComments, updateDocument
} from '../../firebase/firestore';
import { toast } from 'react-hot-toast';
import {
  MdSchedule, MdRoom, MdPerson, MdFlag,
  MdComment, MdClose, MdCalendarToday
} from 'react-icons/md';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function StudentTimetable() {
  const { userProfile, currentUser } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay()]);
  const [allEntries, setAllEntries] = useState([]);

  // Report issue modal
  const [reportModal, setReportModal] = useState(false);
  const [reportEntry, setReportEntry] = useState(null);
  const [reportText, setReportText] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Comments modal
  const [commentsModal, setCommentsModal] = useState(false);
  const [comments, setComments] = useState([]);

  const classId = userProfile?.class_id;

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
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

  const sortedEntries = [...entries].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  return (
    <Layout pageTitle="Timetable">
      <h1 className="page-title">Timetable</h1>
      <p className="page-subtitle">View your class schedule and report issues</p>

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
              <span className="modal-title">Timetable Comments</span>
              <button className="modal-close" onClick={() => setCommentsModal(false)}><MdClose /></button>
            </div>
            {comments.length === 0 ? (
              <div className="empty-state"><p>No comments yet for this entry.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {comments.map((c) => (
                  <div key={c.id} style={{
                    background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)',
                    padding: '12px', fontSize: '0.875rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="font-semibold">Issue Reported</span>
                      <span className={`badge badge-${c.status}`}>{c.status}</span>
                    </div>
                    <p>{c.comment_text}</p>
                    {c.suggested_change && (
                      <p style={{ marginTop: 6, color: 'var(--primary)' }}>
                        💡 Suggestion: {c.suggested_change}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
