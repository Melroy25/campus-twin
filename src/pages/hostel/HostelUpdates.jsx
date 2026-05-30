import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { queryDocuments, addDocument, updateDocument, deleteDocument } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { 
  MdCampaign, MdWarning, MdPoll, MdAdd, MdDelete, 
  MdCheckCircle, MdInfo, MdOutlineHowToVote, MdCalendarToday,
  MdClose, MdLock, MdLockOpen
} from 'react-icons/md';

export default function HostelUpdates({ hostelType, role }) {
  const { currentUser } = useAuth();
  const accent = hostelType === 'girls' ? '#ec4899' : '#3b82f6';
  const accentLight = hostelType === 'girls' ? '#fce7f3' : '#dbeafe';
  const accentDark = hostelType === 'girls' ? '#be185d' : '#1e40af';

  const [activeSubTab, setActiveSubTab] = useState('notices'); // 'notices' | 'polls'
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState([]);
  const [polls, setPolls] = useState([]);

  // Forms states
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [selectedVotes, setSelectedVotes] = useState({}); // { pollId: optionIndex }

  const fetchData = async () => {
    try {
      setLoading(true);
      const noticesData = await queryDocuments('hostelNotices', [
        Query.equal('hostel_type', hostelType)
      ]);
      const pollsData = await queryDocuments('hostelPolls', [
        Query.equal('hostel_type', hostelType)
      ]);

      // Filter out system account settings entries
      const bulletinsData = noticesData.filter(n => n.title && !n.title.startsWith('account_settings_'));

      // Sort notices: emergency first, then latest
      const sortedNotices = bulletinsData.sort((a, b) => {
        if (a.is_emergency && !b.is_emergency) return -1;
        if (!a.is_emergency && b.is_emergency) return 1;
        return new Date(b.createdAt || b.$createdAt) - new Date(a.createdAt || a.$createdAt);
      });

      // Sort polls by latest
      const sortedPolls = pollsData.sort((a, b) => new Date(b.createdAt || b.$createdAt) - new Date(a.createdAt || a.$createdAt));

      setNotices(sortedNotices);
      setPolls(sortedPolls);
    } catch (err) {
      console.warn("Error fetching updates/polls:", err);
      toast.error("Failed to sync updates and polls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hostelType]);

  const handlePostNotice = async (e) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      toast.error("Please fill in both title and content.");
      return;
    }

    try {
      const notice_id = `notice_${Date.now()}`;
      await addDocument('hostelNotices', {
        notice_id,
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        is_emergency: isEmergency,
        hostel_type: hostelType,
        pdf_url: '',
        createdAt: new Date().toISOString()
      });

      toast.success("Notice posted successfully!");
      setNoticeTitle('');
      setNoticeContent('');
      setIsEmergency(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to post notice.");
    }
  };

  const handleOptionChange = (index, value) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  };

  const addOptionField = () => {
    if (pollOptions.length >= 4) {
      toast.error("Maximum 4 options allowed.");
      return;
    }
    setPollOptions([...pollOptions, '']);
  };

  const removeOptionField = (index) => {
    if (pollOptions.length <= 2) {
      toast.error("Minimum 2 options required.");
      return;
    }
    const updated = pollOptions.filter((_, i) => i !== index);
    setPollOptions(updated);
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (!pollQuestion.trim()) {
      toast.error("Please enter a question.");
      return;
    }

    const filteredOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      toast.error("Please provide at least 2 non-empty options.");
      return;
    }

    try {
      const poll_id = `poll_${Date.now()}`;
      const initialVotes = {};
      filteredOptions.forEach((_, idx) => {
        initialVotes[idx] = 0;
      });

      await addDocument('hostelPolls', {
        poll_id,
        question: pollQuestion.trim(),
        options: JSON.stringify(filteredOptions),
        votes: JSON.stringify(initialVotes),
        voted_users: JSON.stringify([]),
        hostel_type: hostelType,
        is_active: true,
        createdAt: new Date().toISOString()
      });

      toast.success("Poll published!");
      setPollQuestion('');
      setPollOptions(['', '']);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to publish poll.");
    }
  };

  const handleVoteSubmit = async (poll) => {
    const pollId = poll.$id || poll.poll_id;
    const selectedIdx = selectedVotes[pollId];

    if (selectedIdx === undefined || selectedIdx === null) {
      toast.error("Please select an option to vote.");
      return;
    }

    const userId = currentUser?.uid || currentUser?.$id;
    if (!userId) {
      toast.error("Authentication required.");
      return;
    }

    try {
      const votedUsers = JSON.parse(poll.voted_users || '[]');
      const alreadyVoted = votedUsers.some(v => typeof v === 'object' && v !== null ? v.uid === userId : v === userId);
      if (alreadyVoted) {
        toast.error("You have already voted in this poll.");
        return;
      }

      const votesMap = JSON.parse(poll.votes || '{}');
      votesMap[selectedIdx] = (votesMap[selectedIdx] || 0) + 1;
      votedUsers.push({ uid: userId, opt: selectedIdx });

      await updateDocument('hostelPolls', poll.$id, {
        votes: JSON.stringify(votesMap),
        voted_users: JSON.stringify(votedUsers)
      });

      toast.success("Vote registered!");
      // Clear selection
      setSelectedVotes(prev => {
        const copy = { ...prev };
        delete copy[pollId];
        return copy;
      });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit vote.");
    }
  };

  const handleTogglePollStatus = async (poll) => {
    try {
      await updateDocument('hostelPolls', poll.$id, {
        is_active: !poll.is_active
      });
      toast.success(`Poll ${!poll.is_active ? 'opened' : 'closed'} successfully.`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to toggle poll status.");
    }
  };

  const handleDeleteNotice = async (id) => {
    if (!window.confirm("Are you sure you want to delete this notice?")) return;
    try {
      await deleteDocument('hostelNotices', id);
      toast.success("Notice deleted.");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete notice.");
    }
  };

  const handleDeletePoll = async (id) => {
    if (!window.confirm("Are you sure you want to delete this poll?")) return;
    try {
      await deleteDocument('hostelPolls', id);
      toast.success("Poll deleted.");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete poll.");
    }
  };

  const glassCard = (extra = {}) => ({
    background: 'var(--surface-1)',
    borderRadius: 16,
    padding: 24,
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
    transition: 'all 0.3s ease',
    ...extra
  });

  const getFormatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderNoticeSection = () => {
    const isWarden = role === 'warden';
    return (
      <div style={{ display: 'grid', gridTemplateColumns: isWarden ? '1fr 1.2fr' : '1fr', gap: 24 }}>
        {/* Warden Posting form */}
        {isWarden && (
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
              Publish Announcement
            </h3>
            <form onSubmit={handlePostNotice} style={glassCard()}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)' }}>
                  Notice Title
                </label>
                <input
                  type="text"
                  placeholder="e.g., Curfew Timing Alteration"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)' }}>
                  Detailed Announcement
                </label>
                <textarea
                  placeholder="Explain the changes, timing updates, or instructions..."
                  rows={5}
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <input
                  type="checkbox"
                  id="isEmergency"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
                <label htmlFor="isEmergency" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                  Mark as Emergency Notice
                </label>
              </div>

              <button
                type="submit"
                className="btn"
                style={{
                  background: accent,
                  color: 'white',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.86rem'
                }}
              >
                <MdCampaign style={{ fontSize: '1.2rem' }} /> Post Notice
              </button>
            </form>
          </div>
        )}

        {/* Announcements list */}
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
            Active Bulletin
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {notices.length === 0 ? (
              <div style={glassCard({ textAlign: 'center', padding: '40px 20px' })}>
                <MdCampaign style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: 8, opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  No notice board entries published yet.
                </p>
              </div>
            ) : (
              notices.map((n) => {
                const isEmergencyNotice = n.is_emergency;
                return (
                  <div 
                    key={n.$id} 
                    style={glassCard({
                      borderLeft: isEmergencyNotice ? '4px solid #ef4444' : `4px solid ${accent}`,
                      background: isEmergencyNotice 
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, rgba(239, 68, 68, 0.02) 100%)' 
                        : 'var(--surface-1)',
                      position: 'relative'
                    })}
                  >
                    {isWarden && (
                      <button
                        onClick={() => handleDeleteNotice(n.$id)}
                        style={{
                          position: 'absolute',
                          top: 16,
                          right: 16,
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          opacity: 0.7,
                          padding: 4
                        }}
                        title="Delete Notice"
                      >
                        <MdDelete style={{ fontSize: '1.1rem' }} />
                      </button>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {isEmergencyNotice ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: '#fef2f2',
                          color: '#ef4444',
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontSize: '0.7rem',
                          fontWeight: 800
                        }}>
                          <MdWarning /> EMERGENCY
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: accentLight,
                          color: accentDark,
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontSize: '0.7rem',
                          fontWeight: 800
                        }}>
                          <MdInfo /> UPDATE
                        </span>
                      )}

                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MdCalendarToday style={{ fontSize: '0.8rem' }} /> {getFormatDate(n.createdAt)}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.94rem', fontWeight: 800, color: 'var(--text)', paddingRight: 24 }}>
                      {n.title}
                    </h4>

                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                      {n.content}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPollSection = () => {
    const isWarden = role === 'warden';
    const userId = currentUser?.uid || currentUser?.$id;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: isWarden ? '1fr 1.2fr' : '1fr', gap: 24 }}>
        {/* Warden Poll Creator Form */}
        {isWarden && (
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
              Create New Poll
            </h3>
            <form onSubmit={handleCreatePoll} style={glassCard()}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)' }}>
                  Poll Question
                </label>
                <input
                  type="text"
                  placeholder="e.g., Should we install a table tennis table?"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Poll Choices
                  </label>
                  {pollOptions.length < 4 && (
                    <button
                      type="button"
                      onClick={addOptionField}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: accent,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2
                      }}
                    >
                      <MdAdd /> Add Option
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pollOptions.map((opt, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text"
                        placeholder={`Option ${index + 1}`}
                        value={opt}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--surface-2)',
                          color: 'var(--text)',
                          fontSize: '0.8rem'
                        }}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOptionField(index)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: 4
                          }}
                        >
                          <MdClose />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn"
                style={{
                  background: accent,
                  color: 'white',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  marginTop: 12
                }}
              >
                <MdPoll style={{ fontSize: '1.2rem' }} /> Publish Poll
              </button>
            </form>
          </div>
        )}

        {/* Poll List */}
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
            Opinion Polls
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {polls.length === 0 ? (
              <div style={glassCard({ textAlign: 'center', padding: '40px 20px' })}>
                <MdPoll style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: 8, opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  No opinion polls created yet.
                </p>
              </div>
            ) : (
              polls.map((p) => {
                const options = JSON.parse(p.options || '[]');
                const votesMap = JSON.parse(p.votes || '{}');
                const votedUsers = JSON.parse(p.voted_users || '[]');
                const hasVoted = votedUsers.includes(userId);
                
                // Calculate total votes
                const totalVotes = Object.values(votesMap).reduce((sum, v) => sum + v, 0);

                // Option index selected by user
                const userVoteIndex = hasVoted ? votedUsers.indexOf(userId) % options.length : null; 
                // Wait, votedUsers maps to the user, but we don't store which user voted for what option.
                // Ah, to display which option the user voted for, we need to know their choice.
                // Wait! If the database doesn't map voter ID -> option index, how do we know what they selected?
                // Let's look at the database. `voted_users` is a list of user IDs. `votes` is option index to count.
                // If we want to show which option they voted for, we should store it in `voted_users` as a mapping or array of objects, e.g. `[{"uid": "student1", "idx": 0}]`.
                // Let's check how we parsed it: `votedUsers` array. If we store objects or mapping in `voted_users`, we can check:
                // Let's make `voted_users` flexible! It can support an array of strings (backwards/simple) OR an array of objects/voter objects.
                // Let's inspect the seed file: it seeds `voted_users` as JSON.stringify([]).
                // Let's design the vote data format in `voted_users`:
                // If we store `voted_users` as JSON.stringify(votedUsers), where votedUsers is an array of objects: `[{"uid":"student_uid","opt":1}]`
                // That is perfect! It tells us exactly who voted and what option index they chose!
                // Let's handle this in the parsing:
                let userChoiceIdx = null;
                let parsedVoters = [];
                try {
                  const rawVoters = JSON.parse(p.voted_users || '[]');
                  if (rawVoters.length > 0 && typeof rawVoters[0] === 'object') {
                    // It's the object format
                    parsedVoters = rawVoters.map(item => item.uid);
                    const userRecord = rawVoters.find(item => item.uid === userId);
                    if (userRecord) userChoiceIdx = userRecord.opt;
                  } else {
                    // It's the simple array of strings format
                    parsedVoters = rawVoters;
                  }
                } catch (e) {
                  console.warn("Voter parse error:", e);
                }

                const userVoted = parsedVoters.includes(userId);

                // Warden actions: toggle status (is_active), delete poll
                return (
                  <div key={p.$id} style={glassCard({ position: 'relative', opacity: p.is_active ? 1 : 0.8 })}>
                    {isWarden && (
                      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleTogglePollStatus(p)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: p.is_active ? '#10b981' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 4
                          }}
                          title={p.is_active ? "Close Poll" : "Open Poll"}
                        >
                          {p.is_active ? <MdLockOpen style={{ fontSize: '1.1rem' }} /> : <MdLock style={{ fontSize: '1.1rem' }} />}
                        </button>
                        <button
                          onClick={() => handleDeletePoll(p.$id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: 4
                          }}
                          title="Delete Poll"
                        >
                          <MdDelete style={{ fontSize: '1.1rem' }} />
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: p.is_active ? accentLight : 'var(--surface-2)',
                        color: p.is_active ? accentDark : 'var(--text-muted)',
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: '0.7rem',
                        fontWeight: 800
                      }}>
                        <MdOutlineHowToVote /> {p.is_active ? 'ACTIVE POLL' : 'CLOSED'}
                      </span>

                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Published {getFormatDate(p.createdAt)}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 16px 0', fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)', paddingRight: 48, lineHeight: 1.35 }}>
                      {p.question}
                    </h4>

                    {/* Poll voting/results list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                      {options.map((opt, idx) => {
                        const optVotesCount = votesMap[idx] || 0;
                        const percentage = totalVotes > 0 ? Math.round((optVotesCount / totalVotes) * 100) : 0;
                        const isUserChoice = userChoiceIdx === idx;

                        // Case 1: Student has not voted yet and poll is active
                        if (!userVoted && p.is_active && !isWarden) {
                          const isSelected = selectedVotes[p.$id || p.poll_id] === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedVotes(prev => ({ ...prev, [p.$id || p.poll_id]: idx }))}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: 10,
                                border: isSelected ? `2px solid ${accent}` : '1px solid var(--border)',
                                background: isSelected ? accentLight : 'var(--surface-2)',
                                color: isSelected ? accentDark : 'var(--text)',
                                textAlign: 'left',
                                fontSize: '0.82rem',
                                fontWeight: isSelected ? 700 : 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                border: `2px solid ${isSelected ? accent : 'var(--text-muted)'}`,
                                background: isSelected ? accent : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                              </div>
                              {opt}
                            </button>
                          );
                        }

                        // Case 2: Student has voted, OR poll is closed, OR user is Warden -> show results!
                        return (
                          <div 
                            key={idx} 
                            style={{ 
                              position: 'relative', 
                              borderRadius: 10, 
                              border: isUserChoice ? `1px solid ${accent}` : '1px solid var(--border)', 
                              background: 'var(--surface-2)',
                              overflow: 'hidden',
                              padding: '12px 16px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              zIndex: 1
                            }}
                          >
                            {/* Animated Background Progress Bar */}
                            <div 
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                width: `${percentage}%`,
                                background: isUserChoice ? accentLight : 'var(--border)',
                                opacity: isUserChoice ? 0.8 : 0.4,
                                zIndex: -1,
                                transition: 'width 0.6s cubic-bezier(0.1, 0.8, 0.3, 1)'
                              }}
                            />

                            <span style={{ 
                              fontSize: '0.82rem', 
                              fontWeight: isUserChoice ? 700 : 500, 
                              color: isUserChoice ? accentDark : 'var(--text)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}>
                              {opt}
                              {isUserChoice && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 2,
                                  fontSize: '0.68rem',
                                  color: accentDark,
                                  background: 'white',
                                  padding: '1px 6px',
                                  borderRadius: 8,
                                  border: `1px solid ${accent}`
                                }}>
                                  <MdCheckCircle /> Your Choice
                                </span>
                              )}
                            </span>

                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
                              {optVotesCount} votes ({percentage}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Status bar / submit button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Total Votes Cast: <strong>{totalVotes}</strong>
                      </span>

                      {!userVoted && p.is_active && !isWarden && (
                        <button
                          onClick={() => handleVoteSubmit(p)}
                          style={{
                            background: accent,
                            color: 'white',
                            border: 'none',
                            padding: '8px 20px',
                            borderRadius: 20,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Cast Vote
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const activeTabStyle = {
    background: accent,
    color: 'white',
    border: 'none',
    borderRadius: 20,
    padding: '8px 18px',
    fontSize: '0.84rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.2s ease'
  };

  const inactiveTabStyle = {
    background: 'var(--surface-1)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '8px 18px',
    fontSize: '0.84rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s ease'
  };

  if (loading) {
    return (
      <div className="loader-container" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
        <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: 12 }}>Syncing notices and polls...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdCampaign style={{ color: accent }} /> {role === 'warden' ? 'Updates & Polls Console' : 'Hostel Updates'}
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            {role === 'warden' 
              ? 'Post announcements, change timings, and publish student opinion polls.' 
              : 'Stay updated with announcements and participate in opinion polls.'
            }
          </p>
        </div>

        {/* Subtab selection toggles */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            style={activeSubTab === 'notices' ? activeTabStyle : inactiveTabStyle}
            onClick={() => setActiveSubTab('notices')}
          >
            <MdCampaign /> Notice Board
          </button>
          <button 
            style={activeSubTab === 'polls' ? activeTabStyle : inactiveTabStyle}
            onClick={() => setActiveSubTab('polls')}
          >
            <MdPoll /> Opinion Polls
          </button>
        </div>
      </div>

      {/* Main tab panel body */}
      <div style={{ marginTop: 8 }}>
        {activeSubTab === 'notices' ? renderNoticeSection() : renderPollSection()}
      </div>
    </div>
  );
}
