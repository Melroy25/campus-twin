import { useState, useEffect, useRef } from 'react';
import { queryDocuments, addDocument, updateDocument, deleteDocument, addNotification } from '../../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  MdChat, MdSend, MdAnnouncement, MdCampaign,
  MdRefresh, MdPerson, MdSecurity, MdPeople, MdLock,
  MdClose, MdEmail, MdPhone, MdContentCopy, MdAdd, MdEdit, MdDelete, MdSearch,
  MdPushPin
} from 'react-icons/md';


export default function HostelChat({ hostelType, role }) {
  const { currentUser, userProfile } = useAuth();
  const accent = hostelType === 'girls' ? '#ec4899' : '#3b82f6';
  const accentLight = hostelType === 'girls' ? 'var(--accent-light-girls)' : 'var(--accent-light-boys)';
  const accentDark = hostelType === 'girls' ? '#be185d' : '#1e40af';

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [isAdminOnly, setIsAdminOnly] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [members, setMembers] = useState([]);
  
  // Student CRUD states inside the members modal
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [studentUsn, setStudentUsn] = useState('');
  const [studentRoom, setStudentRoom] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentSemester, setStudentSemester] = useState('1st Semester');
  const [savingStudent, setSavingStudent] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');


  // Warden Session parser
  const wardenSession = role === 'warden'
    ? (() => { try { return JSON.parse(localStorage.getItem('hostel_warden_session')); } catch { return null; } })()
    : null;

  const senderId = role === 'warden' ? wardenSession?.id || 'warden' : userProfile?.uid || currentUser?.$id || 'student';
  const senderName = role === 'warden' ? `Warden (${wardenSession?.username || 'Admin'})` : userProfile?.name || currentUser?.name || 'Student';

  const fetchMessages = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await queryDocuments('hostelMessages', [
        Query.equal('hostel_type', hostelType)
      ]);
      // Sort messages chronologically by timestamp
      const sorted = data.sort((a, b) => new Date(a.timestamp || a.$createdAt) - new Date(b.timestamp || b.$createdAt));
      setMessages(sorted);
      scrollToBottom();
    } catch (err) {
      console.warn("Failed to load chat:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchChatSettings = async () => {
    try {
      const data = await queryDocuments('hostelNotices', [
        Query.equal('title', `chat_settings_${hostelType}`),
        Query.equal('hostel_type', hostelType)
      ]);
      if (data && data.length > 0) {
        setIsAdminOnly(data[0].content === 'admin_only');
      } else {
        setIsAdminOnly(false);
      }
    } catch (err) {
      console.warn("Failed to fetch chat settings:", err);
    }
  };

  const fetchMemberCount = async () => {
    try {
      const data = await queryDocuments('students', [
        Query.equal('hostel_type', hostelType)
      ]);
      setTotalMembers(data.length);
    } catch (err) {
      console.warn("Failed to load member count:", err);
    }
  };

  const handleToggleAdminOnly = async (e) => {
    const checked = e.target.checked;
    setIsAdminOnly(checked);
    try {
      const existing = await queryDocuments('hostelNotices', [
        Query.equal('title', `chat_settings_${hostelType}`),
        Query.equal('hostel_type', hostelType)
      ]);
      const settingVal = checked ? 'admin_only' : 'anyone';
      if (existing && existing.length > 0) {
        await updateDocument('hostelNotices', existing[0].$id || existing[0].id, {
          content: settingVal
        });
      } else {
        await addDocument('hostelNotices', {
          notice_id: `chat_settings_${Date.now()}`,
          title: `chat_settings_${hostelType}`,
          content: settingVal,
          is_emergency: false,
          hostel_type: hostelType,
          pdf_url: '',
          createdAt: new Date().toISOString()
        });
      }
      toast.success(checked ? 'Chat channel locked to Admin Only' : 'Chat channel opened for everyone');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update chat settings');
      setIsAdminOnly(!checked);
    }
  };

  const handleShowMembers = async () => {
    setShowMembersModal(true);
    setLoadingMembers(true);
    try {
      const data = await queryDocuments('students', [
        Query.equal('hostel_type', hostelType)
      ]);
      setMembers(data);
    } catch (err) {
      console.warn("Failed to load hostel members:", err);
      toast.error("Failed to load members list");
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleEditStudent = (member) => {
    setEditingStudent(member);
    setStudentName(member.name || '');
    setStudentUsn(member.usn || '');
    setStudentRoom(member.room_number || '');
    setStudentPhone(member.phone || '');
    setStudentEmail(member.email || '');
    setStudentSemester(member.semester || member.sem || '1st Semester');
    setShowAddEditModal(true);
  };

  const handleRemoveStudent = async (member) => {
    if (!window.confirm(`Are you sure you want to remove "${member.name}" from the hostel block?`)) return;
    try {
      await deleteDocument('students', member.$id || member.id);
      toast.success("Student removed successfully");
      // refresh members
      handleShowMembers();
      fetchMemberCount();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove student");
    }
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!studentName.trim() || !studentUsn.trim()) {
      return toast.error("Name and USN are required");
    }
    setSavingStudent(true);
    try {
      const studentData = {
        name: studentName.trim(),
        usn: studentUsn.trim().toUpperCase(),
        room_number: studentRoom.trim(),
        phone: studentPhone.trim(),
        email: studentEmail.trim(),
        semester: studentSemester,
        hostel_type: hostelType,
        gender: hostelType === 'girls' ? 'female' : 'male',
        is_hostelite: true
      };

      if (editingStudent) {
        await updateDocument('students', editingStudent.$id || editingStudent.id, studentData);
        toast.success("Student updated successfully");
      } else {
        // Generate a student uid and save
        const uid = `stud_${Date.now()}`;
        await addDocument('students', {
          ...studentData,
          uid
        });
        toast.success("Student added successfully");
      }
      setShowAddEditModal(false);
      setEditingStudent(null);
      // reset forms
      setStudentName('');
      setStudentUsn('');
      setStudentRoom('');
      setStudentPhone('');
      setStudentEmail('');
      setStudentSemester('1st Semester');
      
      // refresh members
      handleShowMembers();
      fetchMemberCount();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save student");
    } finally {
      setSavingStudent(false);
    }
  };

  const filteredMembers = members.filter(member => {
    const term = memberSearch.toLowerCase().trim();
    if (!term) return true;
    return (
      (member.name || '').toLowerCase().includes(term) ||
      (member.usn || '').toLowerCase().includes(term) ||
      (member.room_number || '').toLowerCase().includes(term) ||
      (member.phone || '').toLowerCase().includes(term) ||
      (member.email || '').toLowerCase().includes(term)
    );
  });


  useEffect(() => {
    fetchMessages();
    fetchChatSettings();
    fetchMemberCount();
    
    // Polling for new messages every 30 seconds – avoids scroll-lock & typing disruptions
    const interval = setInterval(() => {
      fetchMessages(true);
      fetchChatSettings();
    }, 30000);

    return () => clearInterval(interval);
  }, [hostelType, role]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleScrollToMessage = (msgId) => {
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const bubble = element.querySelector('.chat-speech-bubble');
      if (bubble) {
        const originalBg = bubble.style.background;
        bubble.style.transition = 'all 0.3s ease';
        bubble.style.background = '#eab308';
        bubble.style.boxShadow = '0 0 15px rgba(234, 179, 8, 0.4)';
        bubble.style.transform = 'scale(1.03)';
        setTimeout(() => {
          bubble.style.background = originalBg;
          bubble.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)';
          bubble.style.transform = 'scale(1)';
        }, 1200);
      }
    } else {
      toast.error("Message not found in chat history");
    }
  };


  const handleDeleteMessage = async (id) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteDocument('hostelMessages', id);
      toast.success("Message deleted");
      fetchMessages(true);
    } catch (err) {
      console.error("Failed to delete message", err);
      toast.error("Failed to delete message");
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bulletin?")) return;
    try {
      await deleteDocument('hostelMessages', id);
      toast.success("Bulletin deleted");
      fetchMessages(true); // announcements are fetched in fetchMessages
    } catch (err) {
      console.error("Failed to delete bulletin", err);
      toast.error("Failed to delete bulletin");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (isAdminOnly && role !== 'warden') {
      return toast.error('This channel is restricted to wardens only.');
    }

    setSending(true);
    try {
      const newMsg = {
        message_id: `msg_${Date.now()}`,
        sender_id: senderId,
        sender_name: senderName,
        sender_role: role,
        message: inputText.trim(),
        timestamp: new Date().toISOString(),
        hostel_type: hostelType,
        is_announcement: role === 'warden' ? isAnnouncement : false
      };

      await addDocument('hostelMessages', newMsg);
      try {
        const excerpt = inputText.trim().substring(0, 50) + (inputText.trim().length > 50 ? '...' : '');
        await addNotification({
          user_id: 'all_hostel',
          message: `💬 Hostel Chat: ${senderName}: "${excerpt}"`,
          category: 'hostel'
        });
      } catch (notifErr) {
        console.warn("Failed to notify hostel of chat message:", notifErr);
      }
      setInputText('');
      setIsAnnouncement(false);
      // Optimistic rendering or direct refetch
      await fetchMessages(true);
      scrollToBottom();
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      return new Date(timeStr).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch { return ''; }
  };

  const getDayLabel = (timeStr) => {
    if (!timeStr) return '';
    try {
      return new Date(timeStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch { return ''; }
  };

  const glassCard = (extra = {}) => ({
    background: 'var(--surface-1)',
    borderRadius: 16,
    padding: 16,
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
    ...extra
  });

  if (loading) {
    return (
      <div className="loader-container" style={{ minHeight: '60vh' }}>
        <div className="loader" style={{ borderTopColor: accent }} />
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Opening hostel channel...</p>
      </div>
    );
  }

  // Segment announcements and standard messages
  const announcements = messages.filter(m => m.is_announcement);
  const chatFlowMessages = messages;

  return (
    <div className="hostel-chat-container" style={{ padding: '0 8px', maxWidth: 950, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* Main Chat Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid var(--border)', background: 'var(--surface-1)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Header */}
        <div className="hostel-chat-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-1)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: accentLight, color: accentDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
            <MdChat />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: '0.94rem', fontWeight: 800, margin: 0, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Hostel Channel
            </h2>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Real-time block messaging & announcement feed
            </div>
          </div>
          
          {/* Total Members Badge */}
          <div 
            onClick={handleShowMembers}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.78rem',
              fontWeight: 700,
              color: accentDark,
              background: accentLight,
              padding: '6px 12px',
              borderRadius: 20,
              border: `1px solid ${accent}22`,
              marginLeft: 'auto',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
            onMouseLeave={e => e.currentTarget.style.opacity = 1}
          >
            <MdPeople style={{ fontSize: '1rem', color: accentDark }} />
            <span>{totalMembers} Members</span>
          </div>
        </div>

        {/* Pinned Announcement Banner */}
        {announcements.length > 0 && (() => {
          const latestAnnouncement = announcements[announcements.length - 1];
          return (
            <div 
              onClick={() => handleScrollToMessage(latestAnnouncement.$id || latestAnnouncement.message_id)}
              style={{
                padding: '10px 16px',
                background: accentLight,
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                gap: 12,
                userSelect: 'none'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `${accentLight}dd`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = accentLight}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <MdPushPin style={{ color: accentDark, fontSize: '1.1rem', flexShrink: 0, transform: 'rotate(45deg)' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: accentDark, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                    Pinned Announcement (Click to view)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {latestAnnouncement.message}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.7rem', color: accentDark, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {getDayLabel(latestAnnouncement.timestamp)}
              </div>
            </div>
          );
        })()}

        {/* Messages Scroll Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--surface-2)' }}>
          {chatFlowMessages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', opacity: 0.8 }}>
              <MdChat style={{ fontSize: '2.5rem', color: accent, marginBottom: 12, opacity: 0.6 }} />
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Start a conversation</h3>
              <p style={{ fontSize: '0.78rem', margin: '4px 0 0' }}>Say hello to your fellow block mates and warden.</p>
            </div>
          ) : (
            chatFlowMessages.map((msg, i) => {
              const isOwn = msg.sender_id === senderId;
              const isWarden = msg.sender_role === 'warden';
              const bubbleColor = isOwn
                ? accent
                : isWarden
                ? '#10b981'
                : 'var(--surface-1)';
              const textColor = isOwn || isWarden ? 'white' : 'var(--text)';
              
              return (
                <div 
                  key={msg.$id || msg.message_id || i} 
                  id={`msg-${msg.$id || msg.message_id}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', maxWidth: '85%', alignSelf: isOwn ? 'flex-end' : 'flex-start' }}
                >
                  {/* Sender Label */}
                  {!isOwn && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 0 3px 6px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {isWarden ? <MdSecurity style={{ color: '#10b981' }} /> : <MdPerson />}
                      {msg.sender_name}
                      {isWarden && (
                        <span style={{ fontSize: '0.62rem', background: '#d1fae5', color: '#065f46', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', marginLeft: 4 }}>
                          Warden
                        </span>
                      )}
                    </div>
                  )}

                  {/* Speech Bubble */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                    <div 
                      className="chat-speech-bubble"
                      style={{
                        padding: '10px 14px',
                        borderRadius: 16,
                        borderTopRightRadius: isOwn ? 4 : 16,
                        borderTopLeftRadius: !isOwn ? 4 : 16,
                        background: bubbleColor,
                        color: textColor,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        fontSize: '0.86rem',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                        border: !isOwn && !isWarden ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      {msg.message}
                    </div>
                    {(isOwn || role === 'warden' || role === 'admin') && (
                      <button
                        onClick={() => handleDeleteMessage(msg.$id || msg.message_id)}
                        style={{
                          background: 'none', border: 'none', 
                          color: 'var(--text-muted)', cursor: 'pointer',
                          padding: 4, opacity: 0.6, display: 'flex', alignItems: 'center'
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                        title="Delete Message"
                      >
                        <MdDelete style={{ fontSize: '1.1rem' }} />
                      </button>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', margin: '3px 6px 0', opacity: 0.8 }}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-1)' }}>
          {role === 'warden' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', color: accentDark }}>
                <input
                  type="checkbox"
                  checked={isAnnouncement}
                  onChange={e => setIsAnnouncement(e.target.checked)}
                  style={{ accentColor: '#10b981' }}
                />
                <MdAnnouncement style={{ verticalAlign: 'middle' }} /> Broadcast as Emergency Notice / Announcement
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', color: '#dc2626' }}>
                <input
                  type="checkbox"
                  checked={isAdminOnly}
                  onChange={handleToggleAdminOnly}
                  style={{ accentColor: '#dc2626' }}
                />
                <MdLock style={{ verticalAlign: 'middle' }} /> Admin Only Chat (Mute Students)
              </label>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            {isAdminOnly && role !== 'warden' ? (
              <div style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: '#dc2626',
                fontSize: '0.86rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}>
                <MdLock style={{ fontSize: '1.05rem' }} /> This channel is currently muted by the warden (Admin Only mode).
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="form-control"
                  placeholder={isAnnouncement ? "Write a broad announcement message..." : "Type your message here..."}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  style={{ borderRadius: 10 }}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ background: isAnnouncement ? '#10b981' : accent, borderColor: isAnnouncement ? '#10b981' : accent, borderRadius: 10, minWidth: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={sending}>
                  <MdSend />
                </button>
              </>
            )}
          </div>
        </form>
      </div>


      {/* Members List Modal */}
      {showMembersModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          backdropFilter: 'blur(4px)',
        }} onClick={() => setShowMembersModal(false)}>
          <div style={{
            background: 'var(--surface-1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            position: 'relative',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdPeople style={{ fontSize: '1.25rem', color: accent }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Hostel Members — {hostelType === 'girls' ? "Girls Block" : "Boys Block"}
                </h3>
              </div>
              <button 
                onClick={() => setShowMembersModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}
              >
                <MdClose />
              </button>
            </div>

            {/* Actions & Search */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  <MdSearch style={{ fontSize: '1rem' }} />
                </span>
                <input
                  type="text"
                  placeholder="Search by name, USN, room..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: 32, borderRadius: 8, fontSize: '0.82rem', height: 36 }}
                />
              </div>
              {role === 'warden' && (
                <button
                  onClick={() => {
                    setEditingStudent(null);
                    setStudentName('');
                    setStudentUsn('');
                    setStudentRoom('');
                    setStudentPhone('');
                    setStudentEmail('');
                    setStudentSemester('1st Semester');
                    setShowAddEditModal(true);
                  }}
                  className="btn btn-primary"
                  style={{ background: accent, borderColor: accent, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', fontSize: '0.82rem', height: 36, whiteSpace: 'nowrap' }}
                >
                  <MdAdd /> Add Student
                </button>
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Warden / Admin Section */}
              {!memberSearch.trim() && (
                <div>
                  <h4 style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
                    Warden / Admin Office
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#d1fae5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                      <MdSecurity />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065f46' }}>
                        Block Warden ({hostelType === 'girls' ? "Girls Block" : "Boys Block"})
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Official Admin Account
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Students Section */}
              <div>
                <h4 style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
                  Registered Residents ({filteredMembers.length})
                </h4>
                
                {loadingMembers ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Loading residents list...
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                    {members.length === 0 ? 'No students registered in this hostel block yet.' : 'No matching residents found.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredMembers.map((member) => (
                      <div key={member.$id || member.uid || member.usn} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: accentLight, color: accentDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 700, flexShrink: 0 }}>
                          {member.name ? member.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {member.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.68rem', background: accentLight, color: accentDark, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                Room {member.room_number || 'N/A'}
                              </span>
                              {role === 'warden' && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    onClick={() => handleEditStudent(member)}
                                    style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                                    title="Edit details"
                                  >
                                    <MdEdit style={{ fontSize: '0.9rem' }} />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveStudent(member)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                                    title="Remove from block"
                                  >
                                    <MdDelete style={{ fontSize: '0.9rem' }} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowMembersModal(false)}
                className="btn btn-secondary" 
                style={{ borderRadius: 8, padding: '8px 16px', fontSize: '0.82rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Student Modal */}
      {showAddEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          backdropFilter: 'blur(4px)',
        }} onClick={() => { setShowAddEditModal(false); setEditingStudent(null); }}>
          <div style={{
            background: 'var(--surface-1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '450px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                {editingStudent ? '✏️ Edit Student Details' : '👤 Add Student to Block'}
              </h3>
              <button 
                onClick={() => { setShowAddEditModal(false); setEditingStudent(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}
              >
                <MdClose />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveStudent} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Student Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>USN / ID *</label>
                <input
                  type="text"
                  placeholder="e.g. 4SO24CS128"
                  value={studentUsn}
                  onChange={e => setStudentUsn(e.target.value)}
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: '0.85rem' }}
                  required
                  disabled={!!editingStudent}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Room Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 102"
                    value={studentRoom}
                    onChange={e => setStudentRoom(e.target.value)}
                    className="form-control"
                    style={{ borderRadius: 8, fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Semester</label>
                  <select
                    value={studentSemester}
                    onChange={e => setStudentSemester(e.target.value)}
                    className="form-control"
                    style={{ borderRadius: 8, fontSize: '0.85rem' }}
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="3rd Semester">3rd Semester</option>
                    <option value="4th Semester">4th Semester</option>
                    <option value="5th Semester">5th Semester</option>
                    <option value="6th Semester">6th Semester</option>
                    <option value="7th Semester">7th Semester</option>
                    <option value="8th Semester">8th Semester</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={studentPhone}
                  onChange={e => setStudentPhone(e.target.value)}
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. student@college.edu"
                  value={studentEmail}
                  onChange={e => setStudentEmail(e.target.value)}
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowAddEditModal(false); setEditingStudent(null); }}
                  style={{ borderRadius: 8, padding: '8px 16px', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: accent, borderColor: accent, borderRadius: 8, padding: '8px 16px', fontSize: '0.82rem' }}
                  disabled={savingStudent}
                >
                  {savingStudent ? 'Saving...' : editingStudent ? 'Update Details' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
