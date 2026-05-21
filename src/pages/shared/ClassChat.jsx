import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { client, DATABASE_ID } from '../../appwrite/config';
import { queryDocuments, getById, addDocument, updateDocument, getAll, where } from '../../appwrite/database';
import { uploadFile } from '../../appwrite/storage';
import { toast } from 'react-hot-toast';
import {
  MdSend, MdPeople, MdClose, MdAdd, MdDelete, MdChat, MdSettings, MdPerson, MdSecurity,
  MdAttachFile, MdInsertDriveFile
} from 'react-icons/md';

export default function ClassChat() {
  const { currentUser, userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const classIdParam = searchParams.get('class_id');

  const [loading, setLoading] = useState(true);
  const [accessibleClasses, setAccessibleClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);

  // Member management states
  const [allStudents, setAllStudents] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [allAdmins, setAllAdmins] = useState([]);
  const [inviteType, setInviteType] = useState('student'); // 'student' | 'teacher'
  const [selectedInviteUid, setSelectedInviteUid] = useState('');
  const [savingMember, setSavingMember] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Load classes and filter based on user permissions
  useEffect(() => {
    if (!currentUser || !userProfile) return;

    const loadData = async () => {
      try {
        setLoading(true);
        // Load all classes
        const classesList = await getAll('classes');
        const activeChats = classesList.filter(c => c.chat_enabled === true);

        // Filter based on role
        let filtered = [];
        const role = userProfile.role || 'student';
        const uid = currentUser.uid;

        if (role === 'admin') {
          // Admin only has the Teacher & Admin staff chat, not the class section chats
          filtered = [];
        } else if (role === 'mentor' || role === 'teacher') {
          // Mentor/Teacher: access to classes they mentor OR advise OR teach OR where they are invited
          const classAssignments = userProfile.class_assignments || [];
          filtered = activeChats.filter(c => {
            const isMentor = c.mentor_id === uid;
            const isAdvisor = c.advisor_id === uid;
            const isAssigned = classAssignments.some(a => a.class_id === c.id);
            const additionalList = c.chat_additional_members || [];
            const isInvited = additionalList.includes(uid);
            return isMentor || isAdvisor || isAssigned || isInvited;
          });
        } else {
          // Student: access to their own class OR classes where they are invited
          filtered = activeChats.filter(c => {
            const isOwnClass = c.id === userProfile.class_id;
            const additionalList = c.chat_additional_members || [];
            const isInvited = additionalList.includes(uid);
            return isOwnClass || isInvited;
          });
        }

        // Add a virtual Teacher-Admin staff lounge chat for all admins, teachers, and mentors
        const isStaff = ['admin', 'teacher', 'mentor'].includes(role);
        if (isStaff) {
          filtered = [
            {
              id: 'staff-chat',
              label: 'Teacher & Admin Chat',
              is_staff_chat: true,
              chat_enabled: true
            },
            ...filtered
          ];
        }

        setAccessibleClasses(filtered);

        // Determine default selected class
        let defaultClass = null;
        if (classIdParam) {
          defaultClass = filtered.find(c => c.id === classIdParam);
        }
        if (!defaultClass && filtered.length > 0) {
          defaultClass = filtered[0];
        }
        setSelectedClass(defaultClass);

        // Fetch all students, teachers, and admins for member invitation and name lookups
        const [studs, techs, adms] = await Promise.all([
          getAll('students'),
          getAll('teachers'),
          getAll('admins')
        ]);
        setAllStudents(studs);
        setAllTeachers(techs);
        setAllAdmins(adms);

        setLoading(false);
      } catch (err) {
        console.error("Error loading chat classes:", err);
        toast.error("Failed to load chat classes");
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, userProfile, classIdParam]);

  // Load messages and subscribe to real-time updates for selected class
  useEffect(() => {
    if (!selectedClass) {
      setMessages([]);
      return;
    }

    let isSubscribed = true;

    const loadMessages = async () => {
      try {
        const msgs = await queryDocuments('class_messages', [
          where('class_id', '==', selectedClass.id)
        ]);
        if (isSubscribed) {
          // Sort messages by timestamp ascending
          const sorted = msgs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          setMessages(sorted);
        }
      } catch (err) {
        console.error("Error loading messages:", err);
      }
    };

    loadMessages();

    // Subscribe to real-time updates
    const channel = `databases.${DATABASE_ID}.collections.class_messages.documents`;
    const unsubscribe = client.subscribe(channel, (response) => {
      if (response.events.some(e => e.includes('create'))) {
        const newMsg = response.payload;
        if (newMsg.class_id === selectedClass.id) {
          setMessages(prev => {
            if (prev.some(m => m.$id === newMsg.$id)) return prev;
            return [...prev, newMsg].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          });
        }
      } else if (response.events.some(e => e.includes('delete'))) {
        const deletedMsg = response.payload;
        setMessages(prev => prev.filter(m => m.$id !== deletedMsg.$id));
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [selectedClass]);

  const handleDeleteMessage = async (msgId) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteDocument('class_messages', msgId);
      toast.success("Message deleted");
      setMessages(prev => prev.filter(m => m.$id !== msgId));
    } catch (err) {
      toast.error("Failed to delete message");
      console.error(err);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!typedMessage.trim() && !selectedFile) || !selectedClass || uploading) return;

    const messageText = typedMessage.trim();
    const fileToSend = selectedFile;

    setTypedMessage('');
    setSelectedFile(null);
    if (document.getElementById('chat-file-input')) {
      document.getElementById('chat-file-input').value = '';
    }

    setUploading(true);

    try {
      let fileUrl = null;
      let fileType = null;
      let fileName = null;

      if (fileToSend) {
        toast.loading("Uploading file...", { id: 'upload-toast' });
        fileUrl = await uploadFile(fileToSend);
        fileName = fileToSend.name;
        fileType = fileToSend.type.startsWith('image/') ? 'image' : 'pdf';
        toast.dismiss('upload-toast');
      }

      await addDocument('class_messages', {
        class_id: selectedClass.id,
        sender_id: currentUser.uid,
        sender_name: userProfile.name || 'Anonymous',
        sender_role: userProfile.role || 'student',
        message: messageText,
        timestamp: new Date().toISOString(),
        file_url: fileUrl,
        file_type: fileType,
        file_name: fileName
      });
    } catch (err) {
      toast.dismiss('upload-toast');
      toast.error("Failed to send message");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedInviteUid || !selectedClass) return;
    setSavingMember(true);

    try {
      const currentList = selectedClass.chat_additional_members || [];
      if (currentList.includes(selectedInviteUid)) {
        toast.error("User is already a member of this chat!");
        setSavingMember(false);
        return;
      }

      const updatedList = [...currentList, selectedInviteUid];
      await updateDocument('classes', selectedClass.id, {
        chat_additional_members: updatedList
      });

      // Update local state
      const updatedClass = { ...selectedClass, chat_additional_members: updatedList };
      setSelectedClass(updatedClass);
      setAccessibleClasses(prev => prev.map(c => c.id === selectedClass.id ? updatedClass : c));

      toast.success("Member added successfully!");
      setSelectedInviteUid('');
    } catch (err) {
      toast.error("Failed to add member");
      console.error(err);
    } finally {
      setSavingMember(false);
    }
  };

  const handleRemoveMember = async (uidToRemove) => {
    if (!selectedClass) return;
    if (!confirm("Are you sure you want to remove this member from the chat?")) return;

    try {
      const currentList = selectedClass.chat_additional_members || [];
      const updatedList = currentList.filter(uid => uid !== uidToRemove);

      await updateDocument('classes', selectedClass.id, {
        chat_additional_members: updatedList
      });

      // Update local state
      const updatedClass = { ...selectedClass, chat_additional_members: updatedList };
      setSelectedClass(updatedClass);
      setAccessibleClasses(prev => prev.map(c => c.id === selectedClass.id ? updatedClass : c));

      toast.success("Member removed from chat");
    } catch (err) {
      toast.error("Failed to remove member");
      console.error(err);
    }
  };

  const formatMessageTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Helper to find a user's name by UID
  const advisorName = (advisorId) => {
    const t = allTeachers.find((t) => t.id === advisorId || t.uid === advisorId);
    return t ? t.name : advisorId || '–';
  };

  const getUserNameByUid = (uid) => {
    const s = allStudents.find(st => st.uid === uid || st.id === uid);
    if (s) return `${s.name} (Student - ${s.class_id})`;
    const t = allTeachers.find(th => th.uid === uid || th.id === uid);
    if (t) return `${t.name} (${t.role === 'mentor' ? 'Mentor' : 'Teacher'})`;
    const a = allAdmins.find(ad => ad.uid === uid || ad.id === uid);
    if (a) return `${a.name} (Admin)`;
    return uid;
  };

  const isClassMentor = selectedClass?.mentor_id === currentUser?.uid;
  const isClassAdvisor = selectedClass?.advisor_id === currentUser?.uid;
  const isAdmin = userProfile?.role === 'admin';
  const canManageMembers = !selectedClass?.is_staff_chat && (isClassAdvisor || isAdmin);

  // Filter list of inviteable users
  const getInviteableUsers = () => {
    const currentAdditional = selectedClass?.chat_additional_members || [];
    if (inviteType === 'student') {
      // Exclude students who are naturally in the class
      return allStudents.filter(s => 
        s.class_id !== selectedClass?.id && 
        !currentAdditional.includes(s.uid) &&
        !currentAdditional.includes(s.id)
      );
    } else {
      // Exclude class mentor
      return allTeachers.filter(t => 
        t.uid !== selectedClass?.mentor_id && 
        t.id !== selectedClass?.mentor_id &&
        !currentAdditional.includes(t.uid) &&
        !currentAdditional.includes(t.id)
      );
    }
  };

  return (
    <Layout pageTitle="Class Chat">
      {loading ? (
        <div className="loader-container" style={{ minHeight: 300 }}><div className="loader" /></div>
      ) : accessibleClasses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MdChat /></div>
          <h3>No Chats Available</h3>
          <p style={{ maxWidth: 450, margin: '8px auto 0 auto' }}>
            Class chats are managed by class mentors. You do not belong to any active chat rooms yet.
          </p>
        </div>
      ) : (
        <div className="chat-layout" style={{
          display: 'flex',
          height: 'calc(100vh - 150px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {/* Chat Sidebar (Rooms List) */}
          {accessibleClasses.length > 1 && (
            <div className="chat-sidebar" style={{
              width: 260,
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface-2)',
              flexShrink: 0
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.95rem' }}>
                Chat Rooms
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {accessibleClasses.map(c => {
                  const isSelected = selectedClass?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClass(c)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--primary-light)' : 'transparent',
                        color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <MdChat style={{ fontSize: '1.2rem', flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.88rem', fontWeight: isSelected ? 600 : 500 }}>
                        {c.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Chat Area */}
          {selectedClass ? (
            <div className="chat-main" style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)'
            }}>
              {/* Chat Header */}
              <div className="chat-header" style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--surface-2)'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                    {selectedClass.is_staff_chat ? selectedClass.label : `${selectedClass.label} Chat Group`}
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {selectedClass.is_staff_chat ? 'Teacher & Admin Staff Lounge' : 'Official Class Chat Room'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    style={{ background: 'white', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setShowMembersModal(true)}
                  >
                    <MdPeople /> Members
                  </button>
                </div>
              </div>

              {/* Message Feed */}
              <div className="chat-messages" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                background: 'var(--background)'
              }}>
                {messages.length === 0 ? (
                  <div className="empty-state" style={{ minHeight: '100%', justifyContent: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      No messages yet. Say hello to start the conversation!
                    </p>
                  </div>
                ) :                   messages.map((m, idx) => {
                    const isOwn = m.sender_id === currentUser.uid;
                    const isMentor = m.sender_role === 'mentor';
                    const isAdminMsg = m.sender_role === 'admin';
                    const isAdvisorMsg = selectedClass && (m.sender_id === selectedClass.advisor_id);
                    const canDelete = isOwn || isClassAdvisor || isAdmin;
                    
                    return (
                      <div
                        key={m.$id || idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isOwn ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          alignSelf: isOwn ? 'flex-end' : 'flex-start'
                        }}
                      >
                        {/* Sender Info (only for others) */}
                        {!isOwn && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 4,
                            marginLeft: 4,
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            color: isAdvisorMsg ? '#4f46e5' : 'var(--text-secondary)'
                          }}>
                            {m.sender_name}
                            {isAdvisorMsg && (
                              <span style={{
                                padding: '2px 6px', fontSize: '0.62rem', margin: 0, fontWeight: 700,
                                background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', border: '1px solid rgba(79, 70, 229, 0.2)',
                                borderRadius: '4px'
                              }}>👑 Class Advisor</span>
                            )}
                            {!isAdvisorMsg && isMentor && (
                              <span className="badge badge-approved" style={{
                                padding: '1px 6px', fontSize: '0.62rem', margin: 0, fontWeight: 700
                              }}>Mentor</span>
                            )}
                            {isAdminMsg && (
                              <span className="badge badge-pending" style={{
                                padding: '1px 6px', fontSize: '0.62rem', margin: 0, fontWeight: 700,
                                background: 'var(--info-light)', color: 'var(--info)', border: 'none'
                              }}>Admin</span>
                            )}
                          </div>
                        )}

                        {/* Message Bubble Container with deletion button */}
                        <div style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'center', width: '100%', gap: 8 }}>
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: isOwn 
                              ? (isAdvisorMsg 
                                  ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' 
                                  : 'linear-gradient(135deg, var(--primary) 0%, #1781e3 100%)')
                              : (isAdvisorMsg 
                                  ? 'rgba(79, 70, 229, 0.05)' 
                                  : 'var(--surface)'),
                            color: isOwn ? 'white' : 'var(--text-primary)',
                            border: isOwn 
                              ? 'none' 
                              : (isAdvisorMsg 
                                  ? '1.5px solid rgba(79, 70, 229, 0.3)' 
                                  : '1.5px solid var(--border)'),
                            fontSize: '0.88rem',
                            lineHeight: '1.4',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            boxShadow: isAdvisorMsg 
                              ? (isOwn 
                                  ? '0 0 14px rgba(79, 70, 229, 0.35)' 
                                  : '0 0 10px rgba(79, 70, 229, 0.15)')
                              : 'var(--shadow-sm)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                          }}>
                            {m.file_url && (
                              <div style={{
                                borderRadius: '8px',
                                overflow: 'hidden',
                                marginBottom: m.message ? '4px' : '0',
                                maxWidth: '100%'
                              }}>
                                {m.file_type === 'image' ? (
                                  <a href={m.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                    <img
                                      src={m.file_url}
                                      alt={m.file_name || "Attachment"}
                                      style={{
                                        maxWidth: '100%',
                                        maxHeight: '200px',
                                        display: 'block',
                                        borderRadius: '6px',
                                        cursor: 'zoom-in',
                                        border: isOwn ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)'
                                      }}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={m.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '8px 12px',
                                      background: isOwn ? 'rgba(255, 255, 255, 0.15)' : 'var(--surface-2)',
                                      border: isOwn ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--border)',
                                      borderRadius: '6px',
                                      textDecoration: 'none',
                                      color: isOwn ? 'white' : 'var(--text-primary)',
                                      transition: 'background 0.2s',
                                      wordBreak: 'break-all'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = isOwn ? 'rgba(255, 255, 255, 0.25)' : 'var(--border)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = isOwn ? 'rgba(255, 255, 255, 0.15)' : 'var(--surface-2)';
                                    }}
                                  >
                                    <MdInsertDriveFile style={{ fontSize: '1.6rem', flexShrink: 0, color: isOwn ? 'white' : 'var(--primary)' }} />
                                    <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
                                      <div style={{ fontWeight: 600, fontSize: '0.8rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        {m.file_name || "Attachment.pdf"}
                                      </div>
                                      <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                                        PDF Document
                                      </div>
                                    </div>
                                  </a>
                                )}
                              </div>
                            )}
                            {m.message && <div>{m.message}</div>}
                          </div>

                          {/* Delete Button */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(m.$id || m.id)}
                              title="Delete Message"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--danger)',
                                opacity: 0.5,
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                alignSelf: 'center',
                                transition: 'opacity 0.2s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = 0.5}
                            >
                              <MdDelete style={{ fontSize: '0.95rem' }} />
                            </button>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                          marginTop: 4,
                          marginRight: isOwn ? 4 : 0,
                          marginLeft: isOwn ? 0 : 4
                        }}>
                          {formatMessageTime(m.timestamp)}
                        </div>
                      </div>
                    );
                  })
                }
                <div ref={messagesEndRef} />
              </div>

              {/* Selected File Preview Indicator */}
              {selectedFile && (
                <div style={{
                  padding: '8px 16px',
                  background: 'var(--surface)',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <MdInsertDriveFile style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {selectedFile.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (document.getElementById('chat-file-input')) {
                        document.getElementById('chat-file-input').value = '';
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4
                    }}
                  >
                    <MdClose style={{ fontSize: '1.1rem' }} />
                  </button>
                </div>
              )}

              {/* Input Bar */}
              <form onSubmit={handleSendMessage} style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface-2)',
                display: 'flex',
                gap: 10,
                alignItems: 'center'
              }}>
                <input
                  type="file"
                  id="chat-file-input"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setSelectedFile(file);
                    }
                  }}
                  accept="image/*,application/pdf"
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('chat-file-input').click()}
                  className="btn btn-ghost"
                  disabled={uploading}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: selectedFile ? 'var(--primary-light)' : 'transparent',
                    color: selectedFile ? 'var(--primary)' : 'var(--text-secondary)'
                  }}
                  title="Attach file (image or PDF)"
                >
                  <MdAttachFile style={{ fontSize: '1.3rem' }} />
                </button>
                <input
                  type="text"
                  className="form-control"
                  placeholder={uploading ? "Uploading attachment..." : "Type a message..."}
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  disabled={uploading}
                  style={{
                    borderRadius: 20,
                    padding: '10px 16px',
                    border: '1.5px solid var(--border)',
                    background: 'white',
                    fontSize: '0.88rem'
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={(!typedMessage.trim() && !selectedFile) || uploading}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <MdSend style={{ fontSize: '1.2rem' }} />
                </button>
              </form>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Select a chat room to start messaging
            </div>
          )}
        </div>
      )}

      {/* Members Management Modal */}
      {showMembersModal && selectedClass && (
        <div className="modal-overlay" onClick={() => setShowMembersModal(false)}>
          <div className="modal" style={{ maxWidth: 550 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Room Members — {selectedClass.label}</span>
              <button className="modal-close" onClick={() => setShowMembersModal(false)}><MdClose /></button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto', padding: '16px 20px' }}>
              
              {/* Add Member Form (Mentors and Admins only) */}
              {canManageMembers && (
                <div style={{
                  padding: 14,
                  background: 'var(--primary-light)',
                  borderRadius: 'var(--radius)',
                  marginBottom: 20,
                  border: '1px solid var(--border)'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--primary)' }}>
                    Invite Additional Members
                  </h4>
                  
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="inviteType"
                        checked={inviteType === 'student'}
                        onChange={() => { setInviteType('student'); setSelectedInviteUid(''); }}
                      />
                      Add Student
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="inviteType"
                        checked={inviteType === 'teacher'}
                        onChange={() => { setInviteType('teacher'); setSelectedInviteUid(''); }}
                      />
                      Add Teacher
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      className="form-control"
                      value={selectedInviteUid}
                      onChange={(e) => setSelectedInviteUid(e.target.value)}
                      style={{ fontSize: '0.82rem', flex: 1 }}
                    >
                      <option value="">-- Select {inviteType === 'student' ? 'Student' : 'Teacher'} --</option>
                      {getInviteableUsers().map(user => (
                        <option key={user.uid || user.id} value={user.uid || user.id}>
                          {user.name} {user.usn ? `(${user.usn})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-primary"
                      onClick={handleAddMember}
                      disabled={savingMember || !selectedInviteUid}
                      style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <MdAdd /> Add
                    </button>
                  </div>
                </div>
              )}

              {/* Members List */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  Current Members
                </h4>
                
                {/* Mentor Section */}
                {!selectedClass.is_staff_chat && (
                  <div style={{
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--surface-2)',
                    borderRadius: '6px',
                    marginBottom: 12,
                    fontSize: '0.85rem'
                  }}>
                    <MdSecurity style={{ color: 'var(--success)' }} />
                    <span style={{ fontWeight: 600 }}>Mentor: {getUserNameByUid(selectedClass.mentor_id)}</span>
                    <span style={{ marginLeft: '12px' }}>Advisor: {advisorName(selectedClass.advisor_id)}</span>
                  </div>
                )}

                {selectedClass.is_staff_chat ? (
                  <div style={{ marginBottom: 16 }}>
                    <h5 style={{ margin: '12px 0 6px 0', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Staff Members (Official Members)
                    </h5>
                    {allAdmins.length === 0 && allTeachers.length === 0 ? (
                      <div style={{ padding: '6px 10px', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No staff members found.
                      </div>
                    ) : (
                      <>
                        {allAdmins.map(a => (
                          <div key={a.id || a.uid} style={{
                            padding: '6px 10px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.82rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <MdSecurity style={{ color: 'var(--primary)' }} />
                              <span>{a.name} (Admin)</span>
                            </div>
                          </div>
                        ))}
                        {allTeachers.map(t => (
                          <div key={t.id || t.uid} style={{
                            padding: '6px 10px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.82rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <MdPerson style={{ color: 'var(--success)' }} />
                              <span>{t.name} ({t.role === 'mentor' ? 'Mentor' : 'Teacher'})</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Class Students Section */}
                    <div style={{ marginBottom: 16 }}>
                      <h5 style={{ margin: '12px 0 6px 0', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Class Students (Official Members)
                      </h5>
                      {allStudents.filter(s => s.class_id === selectedClass.id).length === 0 ? (
                        <div style={{ padding: '6px 10px', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No students in this class section yet.
                        </div>
                      ) : (
                        allStudents.filter(s => s.class_id === selectedClass.id).map(s => (
                          <div key={s.id || s.uid} style={{
                            padding: '6px 10px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.82rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <MdPerson style={{ color: 'var(--success)' }} />
                              <span>{s.name} {s.usn ? `(${s.usn})` : ''}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Additional Members List */}
                    {(selectedClass.chat_additional_members || []).length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <h5 style={{ margin: '12px 0 6px 0', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Invited Members
                        </h5>
                        {(selectedClass.chat_additional_members || []).map(uid => (
                          <div key={uid} style={{
                            padding: '6px 10px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.82rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <MdPerson style={{ color: 'var(--primary)' }} />
                              <span>{getUserNameByUid(uid)}</span>
                            </div>
                            {canManageMembers && (
                              <button
                                onClick={() => handleRemoveMember(uid)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--danger)',
                                  cursor: 'pointer',
                                  padding: 4
                                }}
                              >
                                <MdDelete style={{ fontSize: '1rem' }} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Notice for Class Students */}
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  marginTop: 14
                }}>
                  {selectedClass.is_staff_chat ? (
                    <span>ℹ️ All teachers, mentors, and administrators are automatically members of this chat room and can read and send messages.</span>
                  ) : (
                    <span>ℹ️ All official students of <strong>{selectedClass.label}</strong> are automatically members of this chat room and can read and send messages.</span>
                  )}
                </div>

              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMembersModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
