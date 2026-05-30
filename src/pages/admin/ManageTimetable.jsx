import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import TimetableGrid, { DAYS, DEFAULT_SLOTS, formatTime } from '../../components/TimetableGrid';
import CalendarOfEvents from '../../components/CalendarOfEvents';
import {
  getTimetableByClass, addDocument, updateDocument, deleteDocument,
  getPendingComments, addChangeLog, addNotification, getAll, getStudentsByClass
} from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdAdd, MdEdit, MdDelete, MdClose, MdFlag, MdCheck, MdSend } from 'react-icons/md';
import { uploadFile } from '../../appwrite/storage';
import { supabase } from '../../supabase/config';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';

const EMPTY_FORM = { class_id: '', subject: '', teacher: '', room: '', time: '', day: 'Monday', status: 'normal', start_time: '', end_time: '' };

// Allowed fields that the Appwrite 'timetable' collection accepts
const TIMETABLE_FIELDS = ['class_id', 'subject', 'teacher', 'room', 'time', 'day', 'status'];

function sanitizeForm(form) {
  const clean = {};
  TIMETABLE_FIELDS.forEach(f => {
    if (form[f] !== undefined && form[f] !== null) clean[f] = form[f];
  });
  // Always build the time string from start/end if available
  if (form.start_time && form.end_time) {
    clean.time = `${form.start_time} - ${form.end_time}`;
  }
  return clean;
}

const PRESET_SLOTS = [
  { label: '9:00 - 9:55 (1hr)', start: '09:00', end: '09:55' },
  { label: '9:55 - 10:50 (1hr)', start: '09:55', end: '10:50' },
  { label: '9:00 - 10:50 (2hr)', start: '09:00', end: '10:50' },
  { label: '11:10 - 12:05 (1hr)', start: '11:10', end: '12:05' },
  { label: '12:05 - 1:00 (1hr)', start: '12:05', end: '13:00' },
  { label: '11:10 - 1:00 (2hr)', start: '11:10', end: '13:00' },
  { label: '2:00 - 3:00 (1hr)', start: '14:00', end: '15:00' },
  { label: '3:00 - 4:00 (1hr)', start: '15:00', end: '16:00' },
  { label: '4:00 - 5:00 (1hr)', start: '16:00', end: '17:00' },
  { label: '2:00 - 5:00 (3hr)', start: '14:00', end: '17:00' },
  { label: 'Custom', start: '', end: '' },
];

export default function AdminManageTimetable() {
  const { userProfile } = useAuth();
  const isSuperAdmin = !!userProfile?.is_super_admin;
  const location = useLocation();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('tab') || 'timetable');

  const activeTab = isSuperAdmin 
    ? (['coe', 'pdf', 'aicte'].includes(tab) ? tab : 'coe') 
    : tab;

  useEffect(() => {
    const qTab = new URLSearchParams(location.search).get('tab');
    if (qTab) {
      setTab(qTab);
    }
  }, [location.search]);

  const [changelogs, setChangelogs] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  // Custom time slots per class (stored in localStorage for now)
  const [timeSlots, setTimeSlots] = useState(DEFAULT_SLOTS);

  // Updates feed
  const [updates, setUpdates] = useState([]);
  const [updateText, setUpdateText] = useState('');
  const [postingUpdate, setPostingUpdate] = useState(false);

  // AICTE Guideline PDF states
  const [aictePdfs, setAictePdfs] = useState([]);
  const [aictePdfFile, setAictePdfFile] = useState(null);
  const [aictePdfTitle, setAictePdfTitle] = useState('');
  const [aicteLoading, setAicteLoading] = useState(false);

  const fetchAictePdfs = async () => {
    setAicteLoading(true);
    try {
      const data = await getAll('aictePdfs');
      setAictePdfs(data || []);
    } catch (err) {
      console.error('Failed to load AICTE PDFs:', err);
    } finally {
      setAicteLoading(false);
    }
  };

  const handleAicteUpload = async () => {
    if (!aictePdfTitle.trim()) return toast.error('Please enter a title');
    if (!aictePdfFile) return toast.error('Please select a PDF file');
    if (aictePdfs.length >= 2) {
      return toast.error('Maximum of 2 AICTE Guideline documents allowed. Please delete one to upload a new one.');
    }
    
    setAicteLoading(true);
    try {
      const fileUrl = await uploadFile(aictePdfFile);
      if (!fileUrl) throw new Error('File upload failed');

      await addDocument('aictePdfs', {
        title: aictePdfTitle.trim(),
        pdf_url: fileUrl,
        uploaded_at: new Date().toISOString()
      });

      toast.success('AICTE Guideline PDF uploaded successfully!');
      setAictePdfTitle('');
      setAictePdfFile(null);
      fetchAictePdfs();
    } catch (err) {
      console.error(err);
      toast.error('Upload failed: ' + err.message);
    } finally {
      setAicteLoading(false);
    }
  };

  const handleAicteDelete = async (id) => {
    if (!window.confirm('Delete this AICTE Guideline PDF?')) return;
    setAicteLoading(true);
    try {
      await deleteDocument('aictePdfs', id);
      toast.success('Document deleted!');
      fetchAictePdfs();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete');
    } finally {
      setAicteLoading(false);
    }
  };

  useEffect(() => {
    getAll('classes').then((allClasses) => {
      if (userProfile?.is_super_admin) {
        setClasses(allClasses);
      } else {
        const filtered = allClasses.filter(c => c.branch === userProfile?.branch_id || c.branch_id === userProfile?.branch_id);
        setClasses(filtered);
      }
    });
  }, [userProfile]);

  // Load/save custom slots per class
  useEffect(() => {
    if (classId) {
      try {
        const saved = localStorage.getItem(`tt-slots-${classId}`);
        if (saved) setTimeSlots(JSON.parse(saved));
        else setTimeSlots(DEFAULT_SLOTS);
      } catch {
        setTimeSlots(DEFAULT_SLOTS);
      }
    }
  }, [classId]);

  const handleSlotsChange = (newSlots) => {
    setTimeSlots(newSlots);
    if (classId) {
      localStorage.setItem(`tt-slots-${classId}`, JSON.stringify(newSlots));
    }
  };

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

  const fetchUpdates = async () => {
    if (!classId.trim()) return;
    setLoading(true);
    try {
      const allUpdates = await getAll('timetable_updates');
      const classUpdates = allUpdates
        .filter(u => u.class_id === classId.trim())
        .sort((a, b) => new Date(b.createdAt || b.$createdAt) - new Date(a.createdAt || a.$createdAt));
      setUpdates(classUpdates);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load updates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pdf' && classId.trim()) {
      fetchClassPdf(classId);
    } else if (activeTab === 'updates') {
      fetchUpdates();
    } else if (activeTab === 'aicte') {
      fetchAictePdfs();
    }
  }, [activeTab, classId]);

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

      await addChangeLog({
        timetable_id: classId.trim(),
        action: 'Uploaded PDF',
        details: `Uploaded new timetable PDF for class ${classId.trim()}`,
        changed_by: 'admin',
        changed_by_name: userProfile?.name || 'Admin',
        changed_by_role: 'admin'
      });
      
      try {
        const students = await getStudentsByClass(classId.trim());
        for (const student of students) {
          await addNotification(student.uid, `A new official PDF timetable has been uploaded for your class ${classId.trim()}.`);
        }
      } catch (notifErr) {
        console.error('Failed to notify students:', notifErr);
      }

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

      await addChangeLog({
        timetable_id: classId.trim(),
        action: 'Removed PDF',
        details: `Removed timetable PDF for class ${classId.trim()}`,
        changed_by: 'admin',
        changed_by_name: userProfile?.name || 'Admin',
        changed_by_role: 'admin'
      });

      try {
        const students = await getStudentsByClass(classId.trim());
        for (const student of students) {
          await addNotification(student.uid, `The official PDF timetable has been removed for your class ${classId.trim()}.`);
        }
      } catch (notifErr) {
        console.error('Failed to notify students:', notifErr);
      }

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
    const isSuper = userProfile?.is_super_admin === true;
    if (isSuper) {
      setIssues(data);
    } else {
      try {
        const ttEntries = await getAll('timetable');
        const branchClassIds = classes.map(c => c.id);
        const allowedTtIds = ttEntries.filter(t => branchClassIds.includes(t.class_id)).map(t => t.id || t.$id);
        const filteredIssues = data.filter(issue => allowedTtIds.includes(issue.timetable_id));
        setIssues(filteredIssues);
      } catch (err) {
        console.error(err);
        setIssues([]);
      }
    }
  };

  useEffect(() => {
    if (classes.length > 0 || userProfile?.is_super_admin) {
      fetchIssues();
    }
  }, [classes, userProfile]);

  useEffect(() => {
    if (classId.trim()) {
      fetchTimetable();
    } else {
      setEntries([]);
    }
  }, [classId]);

  const handleCellClick = (entry, day, slot) => {
    if (entry) {
      // Edit — only extract the fields we need, NOT the Appwrite system fields
      setEditEntry(entry);
      setForm({
        class_id: entry.class_id || classId,
        subject: entry.subject || '',
        teacher: entry.teacher || '',
        room: entry.room || '',
        time: entry.time || '',
        day: entry.day || 'Monday',
        status: entry.status || 'normal',
        start_time: entry.start_time || '',
        end_time: entry.end_time || '',
      });
      // Try to match a preset
      const match = PRESET_SLOTS.find(p => p.start === (entry.start_time || '') && p.end === (entry.end_time || ''));
      setSelectedPreset(match ? match.label : '');
    } else {
      // Add new entry
      setEditEntry(null);
      setForm({
        ...EMPTY_FORM,
        class_id: classId,
        day: day,
        start_time: slot.start,
        end_time: slot.end,
        time: `${formatTime(slot.start)} - ${formatTime(slot.end)}`,
      });
      const match = PRESET_SLOTS.find(p => p.start === slot.start && p.end === slot.end);
      setSelectedPreset(match ? match.label : 'Custom');
    }
    setShowForm(true);
  };

  const handlePresetChange = (label) => {
    setSelectedPreset(label);
    const preset = PRESET_SLOTS.find(p => p.label === label);
    if (preset && preset.start) {
      setForm(f => ({
        ...f,
        start_time: preset.start,
        end_time: preset.end,
        time: `${formatTime(preset.start)} - ${formatTime(preset.end)}`
      }));
    }
  };

  const handleSave = async () => {
    if (!form.subject || !form.day) return toast.error('Fill required fields');
    if (!form.start_time && !form.time) return toast.error('Select a time slot');
    setSaving(true);
    try {
      // Build clean form with only allowed fields
      const cleanForm = sanitizeForm({
        ...form,
        class_id: form.class_id || classId,
        time: form.time || `${formatTime(form.start_time)} - ${formatTime(form.end_time)}`,
      });

      if (editEntry) {
        const oldValues = JSON.stringify({ subject: editEntry.subject, teacher: editEntry.teacher, room: editEntry.room, time: editEntry.time, day: editEntry.day });
        await updateDocument('timetable', editEntry.id || editEntry.$id, { ...cleanForm, status: 'modified' });
        await addChangeLog({
          timetable_id: editEntry.id || editEntry.$id,
          action: 'Modified entry',
          details: `Modified ${cleanForm.subject} on ${cleanForm.day} at ${cleanForm.time} (Room: ${cleanForm.room || '—'})`,
          changed_by: 'admin',
          changed_by_name: userProfile?.name || 'Admin',
          changed_by_role: 'admin',
          old_values: oldValues,
          new_values: JSON.stringify({ subject: cleanForm.subject, teacher: cleanForm.teacher, room: cleanForm.room, time: cleanForm.time, day: cleanForm.day })
        });
        
        try {
          const students = await getStudentsByClass(cleanForm.class_id);
          for (const student of students) {
            await addNotification(student.uid, `Timetable modified: ${cleanForm.subject} on ${cleanForm.day} at ${cleanForm.time}.`);
          }
        } catch (notifErr) {
          console.error(notifErr);
        }

        toast.success('Entry updated');
      } else {
        const newDoc = await addDocument('timetable', cleanForm);
        await addChangeLog({
          timetable_id: newDoc.$id || newDoc.id,
          action: 'Added entry',
          details: `Added ${cleanForm.subject} on ${cleanForm.day} at ${cleanForm.time} (Room: ${cleanForm.room || '—'})`,
          changed_by: 'admin',
          changed_by_name: userProfile?.name || 'Admin',
          changed_by_role: 'admin',
          new_values: JSON.stringify({ subject: cleanForm.subject, teacher: cleanForm.teacher, room: cleanForm.room, time: cleanForm.time, day: cleanForm.day })
        });
        
        try {
          const students = await getStudentsByClass(cleanForm.class_id);
          for (const student of students) {
            await addNotification(student.uid, `A new timetable entry has been added: ${cleanForm.subject} on ${cleanForm.day} at ${cleanForm.time}.`);
          }
        } catch (notifErr) {
          console.error(notifErr);
        }

        toast.success('Entry added');
      }
      setShowForm(false);
      fetchTimetable();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Save failed: ' + (err.message || 'Unknown error'));
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this timetable entry?')) return;
    const entryToDelete = entries.find(e => (e.id || e.$id) === id);
    await deleteDocument('timetable', id);
    if (entryToDelete) {
      await addChangeLog({
        timetable_id: id,
        action: 'Deleted entry',
        details: `Deleted ${entryToDelete.subject} on ${entryToDelete.day} at ${entryToDelete.time}`,
        changed_by: 'admin',
        changed_by_name: userProfile?.name || 'Admin',
        changed_by_role: 'admin',
        old_values: JSON.stringify({ subject: entryToDelete.subject, teacher: entryToDelete.teacher, room: entryToDelete.room, time: entryToDelete.time, day: entryToDelete.day })
      });
      
      try {
        const students = await getStudentsByClass(entryToDelete.class_id);
        for (const student of students) {
          await addNotification(student.uid, `Timetable entry deleted: ${entryToDelete.subject} on ${entryToDelete.day} at ${entryToDelete.time}.`);
        }
      } catch (notifErr) {
        console.error(notifErr);
      }
    }
    toast.success('Entry deleted');
    fetchTimetable();
  };

  const handleApproveIssue = async (issue) => {
    await updateDocument('comments', issue.id, { status: 'approved' });
    await addChangeLog({
      timetable_id: issue.timetable_id,
      action: 'Approved issue',
      details: issue.suggested_change || issue.comment_text || 'Approved',
      changed_by: 'admin',
      changed_by_name: userProfile?.name || 'Admin',
      changed_by_role: 'admin'
    });
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

  const handlePostUpdate = async () => {
    if (!classId.trim()) return toast.error('Please select a class first');
    if (!updateText.trim()) return toast.error('Write something first');
    setPostingUpdate(true);
    try {
      await addDocument('timetable_updates', {
        class_id: classId.trim(),
        message: updateText.trim(),
        author_id: 'admin',
        author_name: userProfile?.name || 'Admin',
        author_role: 'admin',
        createdAt: new Date().toISOString(),
      });

      try {
        const students = await getStudentsByClass(classId.trim());
        for (const student of students) {
          await addNotification(student.uid, `📢 Timetable update: ${updateText.trim()}`);
        }
      } catch (notifErr) {
        console.error(notifErr);
      }

      toast.success('Update posted!');
      setUpdateText('');
      fetchUpdates();
    } catch (err) {
      console.error(err);
      toast.error('Failed to post update');
    } finally {
      setPostingUpdate(false);
    }
  };

  const handleDeleteUpdate = async (update) => {
    if (!window.confirm('Delete this update?')) return;
    try {
      await deleteDocument('timetable_updates', update.id || update.$id);
      toast.success('Deleted');
      fetchUpdates();
    } catch {
      toast.error('Failed to delete');
    }
  };

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

  const selectedClassName = classes.find(c => c.id === classId)?.label || classId;

  return (
    <Layout pageTitle={isSuperAdmin ? "Manage Calendar & PDFs" : "Manage Timetable"}>
      <h1 className="page-title">{isSuperAdmin ? "Manage Calendar & PDFs" : "Manage Timetable"}</h1>
      <p className="page-subtitle">
        {isSuperAdmin 
          ? "Configure Calendar of Events and upload AICTE guideline documents" 
          : "Visual grid editor — click cells to add/edit entries"}
      </p>

      {/* Class Selector */}
      {!isSuperAdmin && (
        <div className="card mb-24">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-control" style={{ maxWidth: 260 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— Select Class —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            {classId && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {entries.length} entries loaded • {timeSlots.length} columns
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      {isSuperAdmin ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto' }}>
          <button className={`btn ${tab === 'coe' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('coe')}>📅 Calendar of Events</button>
          <button className={`btn ${tab === 'aicte' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('aicte')}>📑 AICTE Guidelines</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto' }}>
          <button className={`btn ${tab === 'timetable' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('timetable')}>📊 Grid View</button>
          <button className={`btn ${tab === 'pdf' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('pdf')}>📄 PDF</button>
          <button className={`btn ${tab === 'coe' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('coe')}>📅 Calendar of Events</button>
          <button className={`btn ${tab === 'updates' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('updates')}>📝 Updates</button>
        </div>
      )}

      {/* === Grid View Tab === */}
      {activeTab === 'timetable' && (
        <>
          {loading ? (
            <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
          ) : !classId ? (
            <div className="card"><div className="empty-state"><p>Select a class to view its timetable grid.</p></div></div>
          ) : (
            <TimetableGrid
              entries={entries}
              timeSlots={timeSlots}
              editable={true}
              showSlotControls={true}
              onCellClick={handleCellClick}
              onSlotsChange={handleSlotsChange}
            />
          )}
        </>
      )}

      {/* === PDF Tab === */}
      {activeTab === 'pdf' && (
        <div className="card">
          <h3 className="mb-16">📄 Upload Class Timetable PDF</h3>
          <p className="text-muted mb-24" style={{ fontSize: '0.88rem' }}>
            Upload an official timetable PDF for a class section. Students in this class will see a download button on their timetable screen.
          </p>

          <div style={{ maxWidth: 480 }}>
            <div className="form-group mb-16">
              <label className="form-label">Class ID *</label>
              <select 
                className="form-control" 
                value={classId} 
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">— Select Class —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
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

      {/* === Updates Tab === */}
      {activeTab === 'updates' && (
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>📝 All Updates</h3>
          <p className="text-muted mb-16" style={{ fontSize: '0.82rem' }}>
            Updates from students, teachers & admins. Admin can delete any update.
          </p>

          {/* Post box */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Post an announcement..."
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              style={{ flex: 1, resize: 'vertical' }}
            />
            <button
              className="btn btn-primary"
              onClick={handlePostUpdate}
              disabled={postingUpdate || !updateText.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 5, height: 'fit-content', whiteSpace: 'nowrap' }}
            >
              <MdSend size={16} /> {postingUpdate ? 'Posting...' : 'Post'}
            </button>
          </div>

          {loading ? (
            <div className="loader-container" style={{ minHeight: 100 }}><div className="loader" /></div>
          ) : updates.length === 0 ? (
            <div className="empty-state"><p>No updates yet.</p></div>
          ) : (
            <div className="updates-feed">
               {updates.map((u) => {
                const formattedDate = formatUpdateDate(u.createdAt || u.$createdAt);
                return (
                  <div key={u.id || u.$id} className="update-card">
                    <div className="update-card-header">
                      <div className="update-card-author">
                        <span className={`update-role-dot ${u.author_role || 'student'}`} />
                        <strong>{u.author_name || 'Unknown'}</strong>
                        <span className="update-role-badge">{u.author_role || 'student'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="tt-header-btn tt-header-btn-danger" title="Delete" onClick={() => handleDeleteUpdate(u)}>
                          <MdDelete size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="update-card-message">{u.message}</p>
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formattedDate}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === Calendar of Events Tab === */}
      {activeTab === 'coe' && (
        <CalendarOfEvents 
          isAdmin={true} 
          defaultSemester="1st Semester" 
        />
      )}

      {/* === AICTE Guidelines PDF Tab (Super Admin only) === */}
      {activeTab === 'aicte' && (
        <div className="card">
          <h3 className="mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>📑 AICTE Guideline Documents</h3>
          <p className="text-muted mb-24" style={{ fontSize: '0.88rem' }}>
            Upload up to 2 official AICTE guideline PDF documents. These will be visible to all students on their AICTE Points page.
          </p>

          {/* Existing PDFs */}
          {aicteLoading ? (
            <div className="loader-container" style={{ minHeight: 80 }}><div className="loader" /></div>
          ) : aictePdfs.length > 0 ? (
            <div style={{ marginBottom: 24 }}>
              {aictePdfs.map(pdf => (
                <div key={pdf.id || pdf.$id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: 'rgba(59, 130, 246, 0.04)',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  borderRadius: 'var(--radius)',
                  marginBottom: 10,
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
                      📄 {pdf.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Uploaded: {pdf.uploaded_at ? new Date(pdf.uploaded_at).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <a
                      href={pdf.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-ghost"
                      style={{ background: 'var(--surface-1)' }}
                    >
                      View PDF
                    </a>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleAicteDelete(pdf.id || pdf.$id)}
                    >
                      <MdDelete size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '20px 16px',
              background: 'var(--surface-2)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius)',
              textAlign: 'center',
              marginBottom: 24,
              fontSize: '0.85rem',
              color: 'var(--text-muted)'
            }}>
              No AICTE guideline documents uploaded yet.
            </div>
          )}

          {/* Upload Form */}
          {aictePdfs.length < 2 && (
            <div style={{
              padding: 20,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)'
            }}>
              <h4 style={{ marginBottom: 16, fontSize: '0.9rem' }}>Upload New AICTE Guideline</h4>
              <div className="form-group mb-16">
                <label className="form-label">Document Title *</label>
                <input
                  className="form-control"
                  placeholder="e.g. AICTE Activity Points Guidelines 2024-25"
                  value={aictePdfTitle}
                  onChange={(e) => setAictePdfTitle(e.target.value)}
                />
              </div>
              <div className="form-group mb-16">
                <label className="form-label">Select PDF File *</label>
                <input
                  type="file"
                  accept=".pdf"
                  className="form-control"
                  onChange={(e) => setAictePdfFile(e.target.files[0])}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleAicteUpload}
                disabled={aicteLoading || !aictePdfFile || !aictePdfTitle.trim()}
                style={{ width: '100%' }}
              >
                {aicteLoading ? 'Uploading...' : 'Upload AICTE Guideline PDF'}
              </button>
            </div>
          )}

          {aictePdfs.length >= 2 && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: 'var(--radius)',
              fontSize: '0.82rem',
              color: '#b45309',
              fontWeight: 600
            }}>
              ⚠️ Maximum of 2 documents reached. Delete an existing one to upload a new one.
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
                <label className="form-label">Class *</label>
                <input className="form-control" value={selectedClassName} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Day *</label>
                <select className="form-control" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                  {DAYS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Time Slot *</label>
                <select className="form-control" value={selectedPreset} onChange={(e) => handlePresetChange(e.target.value)}>
                  <option value="">— Select Preset —</option>
                  {PRESET_SLOTS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subject *</label>
                <input className="form-control" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>

              {/* Custom time inputs — show when preset is Custom OR when start/end times are set */}
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input type="time" className="form-control" value={form.start_time} onChange={(e) => setForm(f => ({
                  ...f, start_time: e.target.value,
                  time: `${formatTime(e.target.value)} - ${formatTime(f.end_time)}`
                }))} />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <input type="time" className="form-control" value={form.end_time} onChange={(e) => setForm(f => ({
                  ...f, end_time: e.target.value,
                  time: `${formatTime(f.start_time)} - ${formatTime(e.target.value)}`
                }))} />
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

            {/* Quick delete for existing entry */}
            {editEntry && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-danger btn-sm" onClick={() => { setShowForm(false); handleDelete(editEntry.id || editEntry.$id); }}>
                  <MdDelete /> Delete This Entry
                </button>
              </div>
            )}

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
