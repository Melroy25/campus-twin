import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { addDocument, getAll, deleteDocument, updateDocument, addNotification } from '../../appwrite/database';
import { uploadFile } from '../../appwrite/storage';
import { toast } from 'react-hot-toast';
import { MdUpload, MdPictureAsPdf, MdImage, MdDelete, MdOpenInNew, MdListAlt, MdFilterList, MdSearch, MdClose, MdEdit, MdSchool } from 'react-icons/md';

export default function AdminUploadMarksCards() {
  const { userProfile } = useAuth();
  const [form, setForm] = useState({ student_id: '', semester: '' });
  const [students, setStudents] = useState([]);
  const [cards, setCards] = useState([]);
  const [classes, setClasses] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState('files'); // 'files' | 'history'

  // Exam History Form State
  const [formHistory, setFormHistory] = useState({
    student_id: '',
    semester: '',
    academic_year: '',
    sgpa: '',
    credits_registered: '',
    credits_earned: '',
    semester_status: 'Passed',
    total_credits_required: '160'
  });
  const [editingRecord, setEditingRecord] = useState(null); // ID of record being edited
  const [savingHistory, setSavingHistory] = useState(false);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [maxCgpa, setMaxCgpa] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsData, cardsData, classesData, historyData] = await Promise.all([
        getAll('students'),
        getAll('marksCards'),
        getAll('classes'),
        getAll('examHistory')
      ]);
      setStudents(studentsData);
      setCards(cardsData);
      setClasses(classesData);
      setExamHistory(historyData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.student_id || !form.semester || !file) {
      return toast.error('Please select student, semester, and a file');
    }

    // Check if card for this student and semester already exists
    const isDuplicate = cards.some(c => c.student_id === form.student_id && String(c.semester) === String(form.semester));
    if (isDuplicate) {
      if (!window.confirm('A marks card already exists for this student and semester. Do you want to upload another one?')) {
        return;
      }
    }

    setUploading(true);
    try {
      const fileUrl = await uploadFile(file);
      const isImg = file.type.startsWith('image/');

      await addDocument('marksCards', {
        student_id: form.student_id,
        semester: String(form.semester),
        exam_type: isImg ? 'image' : 'pdf',
        pdf_url: fileUrl,
        uploaded_at: new Date().toISOString(),
        uploaded_by: userProfile?.name || 'Admin',
        createdAt: new Date().toISOString()
      });

      // Send real-time notification to the student
      try {
        await addNotification(form.student_id, `Official Marks Card for Semester ${form.semester} has been uploaded and is available for viewing/download.`);
      } catch (notiErr) {
        console.warn('Failed to send upload notification:', notiErr.message);
      }

      toast.success('Marks card uploaded successfully!');
      setForm({ student_id: '', semester: '' });
      setFile(null);
      if (document.getElementById('marks-file')) {
        document.getElementById('marks-file').value = '';
      }
      loadData();
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('Are you sure you want to delete this marks card?')) return;
    try {
      await deleteDocument('marksCards', cardId);
      toast.success('Marks card deleted successfully');
      loadData();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  // Exam History Management handlers
  const handleHistorySubmit = async (e) => {
    e.preventDefault();
    if (!formHistory.student_id || !formHistory.semester || !formHistory.academic_year || !formHistory.sgpa || !formHistory.credits_registered || !formHistory.credits_earned || !formHistory.semester_status) {
      return toast.error('Please fill in all fields');
    }

    const parsedData = {
      student_id: formHistory.student_id,
      semester: parseInt(formHistory.semester, 10),
      academic_year: formHistory.academic_year,
      sgpa: parseFloat(formHistory.sgpa),
      credits_registered: parseInt(formHistory.credits_registered, 10),
      credits_earned: parseInt(formHistory.credits_earned, 10),
      semester_status: formHistory.semester_status,
      createdAt: new Date().toISOString()
    };

    if (isNaN(parsedData.sgpa) || parsedData.sgpa < 0 || parsedData.sgpa > 10) {
      return toast.error('SGPA must be a number between 0.0 and 10.0');
    }
    if (isNaN(parsedData.credits_registered) || parsedData.credits_registered < 0) {
      return toast.error('Credits registered must be a positive integer');
    }
    if (isNaN(parsedData.credits_earned) || parsedData.credits_earned < 0 || parsedData.credits_earned > parsedData.credits_registered) {
      return toast.error('Credits earned must be a positive integer, less than or equal to registered credits');
    }

    setSavingHistory(true);
    try {
      // Save total_credits_required to the student's profile
      const totalCreditsVal = parseInt(formHistory.total_credits_required, 10);
      if (!isNaN(totalCreditsVal) && totalCreditsVal > 0) {
        try {
          await updateDocument('students', parsedData.student_id, { total_credits_required: totalCreditsVal });
        } catch (credErr) {
          console.warn('Failed to update total_credits_required on student:', credErr.message);
        }
      }

      if (editingRecord) {
        await updateDocument('examHistory', editingRecord, parsedData);
        toast.success('Exam record updated successfully!');

        // Send notification
        try {
          await addNotification(parsedData.student_id, `Your Semester ${parsedData.semester} academic record has been updated. SGPA: ${parsedData.sgpa.toFixed(2)}, Earned Credits: ${parsedData.credits_earned}.`);
        } catch (notiErr) {
          console.warn('Failed to send notification:', notiErr);
        }
      } else {
        // Check if record already exists
        const exists = examHistory.some(h => h.student_id === parsedData.student_id && h.semester === parsedData.semester);
        if (exists) {
          if (!window.confirm(`An exam record already exists for this student in Semester ${parsedData.semester}. Do you want to replace it?`)) {
            setSavingHistory(false);
            return;
          }
          const oldRecord = examHistory.find(h => h.student_id === parsedData.student_id && h.semester === parsedData.semester);
          await updateDocument('examHistory', oldRecord.$id, parsedData);
          toast.success('Exam record updated successfully!');

          try {
            await addNotification(parsedData.student_id, `Your Semester ${parsedData.semester} grades have been updated. SGPA: ${parsedData.sgpa.toFixed(2)}.`);
          } catch (notiErr) {
            console.warn(notiErr);
          }
        } else {
          await addDocument('examHistory', parsedData);
          toast.success('Exam record added successfully!');

          try {
            await addNotification(parsedData.student_id, `Your Semester ${parsedData.semester} academic performance record is published. SGPA: ${parsedData.sgpa.toFixed(2)}, Earned Credits: ${parsedData.credits_earned}.`);
          } catch (notiErr) {
            console.warn(notiErr);
          }
        }
      }

      setFormHistory({
        student_id: '',
        semester: '',
        academic_year: '',
        sgpa: '',
        credits_registered: '',
        credits_earned: '',
        semester_status: 'Passed',
        total_credits_required: '160'
      });
      setEditingRecord(null);
      loadData();
    } catch (err) {
      toast.error('Failed to save exam record: ' + err.message);
    } finally {
      setSavingHistory(false);
    }
  };

  const handleEditHistory = (record) => {
    setEditingRecord(record.$id || record.id);
    // Find the student's current total_credits_required
    const student = students.find(s => s.id === record.student_id);
    setFormHistory({
      student_id: record.student_id,
      semester: String(record.semester),
      academic_year: record.academic_year,
      sgpa: String(record.sgpa),
      credits_registered: String(record.credits_registered),
      credits_earned: String(record.credits_earned),
      semester_status: record.semester_status || 'Passed',
      total_credits_required: String(student?.total_credits_required || 160)
    });
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleDeleteHistory = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this exam record?')) return;
    try {
      await deleteDocument('examHistory', recordId);
      toast.success('Exam history record deleted successfully');
      loadData();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  // Helper to compute CGPA dynamically for a student
  const getStudentCgpa = (studentId) => {
    const studentRecords = examHistory.filter(h => h.student_id === studentId);
    if (studentRecords.length === 0) return 0;
    const totalRegCredits = studentRecords.reduce((acc, curr) => acc + (Number(curr.credits_registered) || 0), 0);
    const weightedSgpa = studentRecords.reduce((acc, curr) => acc + ((Number(curr.sgpa) || 0) * (Number(curr.credits_registered) || 0)), 0);
    return totalRegCredits > 0 ? (weightedSgpa / totalRegCredits) : 0;
  };

  const getStudentLabel = (studentId) => {
    const s = students.find(x => x.id === studentId);
    return s ? `${s.name} (${s.usn || 'No USN'})` : studentId;
  };

  const getStudentClassInfo = (studentId) => {
    const s = students.find(x => x.id === studentId);
    if (!s) return { section: '–', year: '–' };
    const cls = classes.find(c => c.id === s.class_id);
    return cls ? { section: cls.section || '–', year: cls.year || '–' } : { section: '–', year: '–' };
  };

  // Dynamic filter lists
  const uniqueSections = [...new Set(classes.map(c => c.section).filter(Boolean))].sort();
  const uniqueYears = [...new Set(classes.map(c => c.year).filter(Boolean))].sort();

  // Filter students based on search and selected year/section/CGPA
  const filteredStudents = students.filter(s => {
    const matchSearch = searchQuery.trim() === '' || 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.usn && s.usn.toLowerCase().includes(searchQuery.toLowerCase()));

    const studentClass = classes.find(c => c.id === s.class_id);

    const matchSection = selectedSection === '' || 
      (studentClass && studentClass.section === selectedSection);

    const matchYear = selectedYear === '' || 
      (studentClass && studentClass.year === selectedYear);

    // CGPA range filtering
    const cgpa = getStudentCgpa(s.id);
    const matchMinCgpa = minCgpa === '' || cgpa >= parseFloat(minCgpa);
    const matchMaxCgpa = maxCgpa === '' || cgpa <= parseFloat(maxCgpa);

    return matchSearch && matchSection && matchYear && matchMinCgpa && matchMaxCgpa;
  });

  // Filter uploaded cards
  const filteredCards = cards.filter(c => {
    const student = students.find(s => s.id === c.student_id);
    if (!student) return false;

    const matchSearch = searchQuery.trim() === '' || 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.usn && student.usn.toLowerCase().includes(searchQuery.toLowerCase()));

    const studentClass = classes.find(cls => cls.id === student.class_id);

    const matchSection = selectedSection === '' || 
      (studentClass && studentClass.section === selectedSection);

    const matchYear = selectedYear === '' || 
      (studentClass && studentClass.year === selectedYear);

    const cgpa = getStudentCgpa(student.id);
    const matchMinCgpa = minCgpa === '' || cgpa >= parseFloat(minCgpa);
    const matchMaxCgpa = maxCgpa === '' || cgpa <= parseFloat(maxCgpa);

    return matchSearch && matchSection && matchYear && matchMinCgpa && matchMaxCgpa;
  });

  // Filter exam history list
  const filteredExamHistory = examHistory.filter(h => {
    const student = students.find(s => s.id === h.student_id);
    if (!student) return false;

    const matchSearch = searchQuery.trim() === '' || 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.usn && student.usn.toLowerCase().includes(searchQuery.toLowerCase()));

    const studentClass = classes.find(cls => cls.id === student.class_id);

    const matchSection = selectedSection === '' || 
      (studentClass && studentClass.section === selectedSection);

    const matchYear = selectedYear === '' || 
      (studentClass && studentClass.year === selectedYear);

    const cgpa = getStudentCgpa(student.id);
    const matchMinCgpa = minCgpa === '' || cgpa >= parseFloat(minCgpa);
    const matchMaxCgpa = maxCgpa === '' || cgpa <= parseFloat(maxCgpa);

    return matchSearch && matchSection && matchYear && matchMinCgpa && matchMaxCgpa;
  });

  // Auto-reset student selection if they get filtered out
  useEffect(() => {
    if (form.student_id) {
      const stillMatches = filteredStudents.some(s => s.id === form.student_id);
      if (!stillMatches) {
        setForm(f => ({ ...f, student_id: '' }));
      }
    }
    if (formHistory.student_id) {
      const stillMatches = filteredStudents.some(s => s.id === formHistory.student_id);
      if (!stillMatches) {
        setFormHistory(fh => ({ ...fh, student_id: '' }));
      }
    }
  }, [filteredStudents, form.student_id, formHistory.student_id]);

  return (
    <Layout pageTitle="Upload Marks Cards">
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Academic Marks & History</h1>
        <p className="page-subtitle">Publish official marks cards and manage semester exam history records for students</p>
      </div>

      {/* Tab Switchers */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('files')}
          className={`btn btn-sm ${activeTab === 'files' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <MdPictureAsPdf /> Upload Marks Cards
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <MdSchool /> Manage Exam History
        </button>
      </div>

      {/* Global Filter Bar */}
      <div className="card mb-24" style={{ border: '1px solid var(--border)', padding: '16px 20px', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdFilterList style={{ fontSize: '1.1rem' }} /> Search & Filter Students
          </h4>
          {(searchQuery || selectedYear || selectedSection || minCgpa || maxCgpa) && (
            <button 
              className="btn btn-sm btn-ghost" 
              onClick={() => {
                setSearchQuery('');
                setSelectedYear('');
                setSelectedSection('');
                setMinCgpa('');
                setMaxCgpa('');
              }}
              style={{ fontSize: '0.78rem', padding: '4px 10px', color: 'var(--danger)', height: 'auto', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <MdClose style={{ fontSize: '0.85rem' }} /> Clear All
            </button>
          )}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MdSearch style={{ fontSize: '0.9rem' }} /> Search Name / USN
            </label>
            <input 
              type="text" 
              className="form-control" 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              placeholder="Student name or USN..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Filter by Year</label>
            <select 
              className="form-control" 
              style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px' }}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">All Years</option>
              {uniqueYears.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Filter by Section</label>
            <select 
              className="form-control" 
              style={{ padding: '6px 12px', fontSize: '0.85rem', height: '36px' }}
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
            >
              <option value="">All Sections</option>
              {uniqueSections.map(sec => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Min CGPA</label>
            <input 
              type="number" 
              step="0.1" 
              min="0" 
              max="10"
              placeholder="0.0"
              className="form-control" 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              value={minCgpa}
              onChange={(e) => setMinCgpa(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>Max CGPA</label>
            <input 
              type="number" 
              step="0.1" 
              min="0" 
              max="10"
              placeholder="10.0"
              className="form-control" 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              value={maxCgpa}
              onChange={(e) => setMaxCgpa(e.target.value)}
            />
          </div>
        </div>

        {/* Active filter tags */}
        {(searchQuery || selectedYear || selectedSection || minCgpa || maxCgpa) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '24px' }}>Active:</span>
            {searchQuery && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.76rem', fontWeight: 600 }}>
                "{searchQuery}"
                <MdClose style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => setSearchQuery('')} />
              </span>
            )}
            {selectedYear && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: 'var(--success-light)', color: 'var(--success)', fontSize: '0.76rem', fontWeight: 600 }}>
                Year: {selectedYear}
                <MdClose style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => setSelectedYear('')} />
              </span>
            )}
            {selectedSection && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: 'var(--info-light)', color: 'var(--info)', fontSize: '0.76rem', fontWeight: 600 }}>
                Section {selectedSection}
                <MdClose style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => setSelectedSection('')} />
              </span>
            )}
            {(minCgpa || maxCgpa) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: 'var(--warning-light)', color: 'var(--warning)', fontSize: '0.76rem', fontWeight: 600 }}>
                CGPA: {minCgpa || '0'} - {maxCgpa || '10'}
                <MdClose style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => { setMinCgpa(''); setMaxCgpa(''); }} />
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '24px', marginLeft: 'auto' }}>
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} matched
            </span>
          </div>
        )}
      </div>

      {activeTab === 'files' ? (
        // TAB 1: UPLOAD MARKS CARDS
        <div>
          <div className="grid-2" style={{ alignItems: 'start', gap: '2rem', marginBottom: '2rem' }}>
            {/* Upload Form */}
            <div className="card card-lg" style={{ border: '1px solid var(--border)' }}>
              <h3 className="mb-16"><MdUpload style={{ verticalAlign: 'middle', marginRight: 8 }} /> Upload Result File</h3>
              <form onSubmit={handleUpload}>
                <div className="form-group">
                  <label className="form-label">
                    Select Student * 
                    {filteredStudents.length !== students.length && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 600, marginLeft: 8 }}>
                        ({filteredStudents.length} of {students.length} filtered)
                      </span>
                    )}
                  </label>
                  <select 
                    className="form-control" 
                    value={form.student_id} 
                    onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                    required
                  >
                    <option value="">— Select Student —</option>
                    {filteredStudents.map(s => {
                      const studentClass = classes.find(c => c.id === s.class_id);
                      const classLabel = studentClass ? ` [Class: ${studentClass.label}]` : '';
                      const cgpa = getStudentCgpa(s.id);
                      const cgpaLabel = cgpa > 0 ? ` | CGPA: ${cgpa.toFixed(2)}` : '';
                      return (
                        <option key={s.id} value={s.id}>{s.name} ({s.usn || 'No USN'})${classLabel}${cgpaLabel}</option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Semester *</label>
                  <select 
                    className="form-control" 
                    value={form.semester} 
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    required
                  >
                    <option value="">— Select Semester —</option>
                    {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Marks Card (PDF or Image) *</label>
                  <label className="file-upload-area" htmlFor="marks-file" style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', background: 'var(--surface-2)', transition: 'background 0.2s' }}>
                    <div className="upload-icon" style={{ marginBottom: 8 }}>
                      {file && file.type.startsWith('image/') ? (
                        <MdImage style={{ fontSize: '2.5rem', color: 'var(--info)' }} />
                      ) : (
                        <MdPictureAsPdf style={{ fontSize: '2.5rem', color: 'var(--danger)' }} />
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {file ? file.name : 'Click to select PDF or Image file'}
                    </p>
                    <input 
                      id="marks-file" 
                      type="file" 
                      accept=".pdf,image/*" 
                      style={{ display: 'none' }} 
                      onChange={(e) => setFile(e.target.files[0])} 
                      required
                    />
                  </label>
                </div>

                <button type="submit" className="btn btn-primary btn-block" disabled={uploading} style={{ marginTop: 12 }}>
                  {uploading ? 'Uploading...' : 'Upload Marks Card'}
                </button>
              </form>
            </div>

            {/* Info Card */}
            <div className="card" style={{ border: '1px solid var(--border)' }}>
              <h3 className="mb-16">📌 Guidelines</h3>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6 }}>
                <p className="text-muted">
                  Select the target student and their corresponding semester. The uploaded files will be instantly accessible within the student's dashboard.
                </p>
                <ul style={{ paddingLeft: 16, color: 'var(--text-secondary)' }}>
                  <li>Accepts **PDF documents** or **Images (PNG, JPG, JPEG)**</li>
                  <li>Files are hosted securely in Cloud Storage</li>
                  <li>Students receive immediate system notifications on upload</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Uploaded Cards Directory */}
          <div className="card" style={{ border: '1px solid var(--border)' }}>
            <h3 className="mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdListAlt /> Uploaded Marks Cards ({filteredCards.length})
              {filteredCards.length !== cards.length && (
                <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600, marginLeft: 8 }}>
                  ({filteredCards.length} of {cards.length} filtered)
                </span>
              )}
            </h3>
            {loading ? (
              <div className="loader-container" style={{ minHeight: 120 }}><div className="loader" /></div>
            ) : filteredCards.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>No matching marks cards found.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Section</th>
                      <th>Year</th>
                      <th>Semester</th>
                      <th>Format</th>
                      <th>Uploaded By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCards.map(c => {
                      const classInfo = getStudentClassInfo(c.student_id);
                      return (
                        <tr key={c.id}>
                          <td className="font-semibold">{getStudentLabel(c.student_id)}</td>
                          <td><span className="badge badge-ghost">{classInfo.section}</span></td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{classInfo.year}</td>
                          <td><span className="badge badge-primary">Sem {c.semester}</span></td>
                          <td>
                            <span className={`badge ${c.exam_type === 'image' ? 'badge-info' : 'badge-danger'}`}>
                              {c.exam_type === 'image' ? 'IMAGE' : 'PDF'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{c.uploaded_by || 'Admin'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <a href={c.pdf_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" title="Preview"><MdOpenInNew /></a>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCard(c.id)} title="Delete"><MdDelete /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        // TAB 2: MANAGE EXAM HISTORY
        <div>
          <div className="grid-2" style={{ alignItems: 'start', gap: '2rem', marginBottom: '2rem' }}>
            {/* Exam History Form */}
            <div className="card card-lg" style={{ border: '1px solid var(--border)' }}>
              <h3 className="mb-16">
                {editingRecord ? (
                  <>
                    <MdEdit style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--warning)' }} /> Edit Semester Exam Record
                  </>
                ) : (
                  <>
                    <MdSchool style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--primary)' }} /> Add Exam History Record
                  </>
                )}
              </h3>
              
              <form onSubmit={handleHistorySubmit}>
                <div className="form-group">
                  <label className="form-label">Select Student *</label>
                  <select 
                    className="form-control" 
                    value={formHistory.student_id} 
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedStudent = students.find(s => s.id === selectedId);
                      setFormHistory({ 
                        ...formHistory, 
                        student_id: selectedId,
                        total_credits_required: String(selectedStudent?.total_credits_required || 160)
                      });
                    }}
                    required
                    disabled={!!editingRecord}
                  >
                    <option value="">— Select Student —</option>
                    {filteredStudents.map(s => {
                      const studentClass = classes.find(c => c.id === s.class_id);
                      const classLabel = studentClass ? ` [Class: ${studentClass.label}]` : '';
                      return (
                        <option key={s.id} value={s.id}>{s.name} ({s.usn || 'No USN'}){classLabel}</option>
                      );
                    })}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Semester *</label>
                    <select 
                      className="form-control" 
                      value={formHistory.semester} 
                      onChange={(e) => setFormHistory({ ...formHistory, semester: e.target.value })}
                      required
                      disabled={!!editingRecord}
                    >
                      <option value="">— Semester —</option>
                      {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Academic Year *</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. 2024-2025"
                      value={formHistory.academic_year} 
                      onChange={(e) => setFormHistory({ ...formHistory, academic_year: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">SGPA *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max="10"
                      className="form-control" 
                      placeholder="0.00"
                      value={formHistory.sgpa}
                      onChange={(e) => setFormHistory({ ...formHistory, sgpa: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Credits Reg. *</label>
                    <input 
                      type="number" 
                      min="0"
                      className="form-control" 
                      placeholder="e.g. 20"
                      value={formHistory.credits_registered}
                      onChange={(e) => setFormHistory({ ...formHistory, credits_registered: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Credits Earned *</label>
                    <input 
                      type="number" 
                      min="0"
                      className="form-control" 
                      placeholder="e.g. 20"
                      value={formHistory.credits_earned}
                      onChange={(e) => setFormHistory({ ...formHistory, credits_earned: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Semester Status *</label>
                    <select 
                      className="form-control" 
                      value={formHistory.semester_status} 
                      onChange={(e) => setFormHistory({ ...formHistory, semester_status: e.target.value })}
                      required
                    >
                      <option value="Passed">Passed</option>
                      <option value="Arrear">Arrear</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Credits Required</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="500"
                      className="form-control" 
                      placeholder="e.g. 160"
                      value={formHistory.total_credits_required}
                      onChange={(e) => setFormHistory({ ...formHistory, total_credits_required: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={savingHistory}>
                    {savingHistory ? 'Saving...' : editingRecord ? 'Update Record' : 'Save Record'}
                  </button>
                  {editingRecord && (
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setEditingRecord(null);
                        setFormHistory({
                          student_id: '',
                          semester: '',
                          academic_year: '',
                          sgpa: '',
                          credits_registered: '',
                          credits_earned: '',
                          semester_status: 'Passed',
                          total_credits_required: '160'
                        });
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Guidelines Card */}
            <div className="card" style={{ border: '1px solid var(--border)' }}>
              <h3 className="mb-16">💡 SGPA/CGPA Management</h3>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6 }}>
                <p className="text-muted">
                  Creating or updating these records publishes numeric semester performance parameters. The student portal automatically aggregates these values to render:
                </p>
                <ul style={{ paddingLeft: 16, color: 'var(--text-secondary)' }}>
                  <li>**Cumulative CGPA**: Automatically calculated from SGPA weighted by semester credits.</li>
                  <li>**Credits completed progress**: Compares total earned credits against the 160-credit graduation baseline.</li>
                  <li>**Academic Timeline**: Displays semester progression, credits earned, and statuses.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Exam History Directory */}
          <div className="card" style={{ border: '1px solid var(--border)' }}>
            <h3 className="mb-16" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdListAlt /> Student Academic Records ({filteredExamHistory.length})
              {filteredExamHistory.length !== examHistory.length && (
                <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600, marginLeft: 8 }}>
                  ({filteredExamHistory.length} of {examHistory.length} filtered)
                </span>
              )}
            </h3>
            {loading ? (
              <div className="loader-container" style={{ minHeight: 120 }}><div className="loader" /></div>
            ) : filteredExamHistory.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>No academic records found.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Section</th>
                      <th>Sem</th>
                      <th>Academic Year</th>
                      <th>SGPA</th>
                      <th>Credits (Earned / Reg.)</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExamHistory.map(h => {
                      const classInfo = getStudentClassInfo(h.student_id);
                      
                      let badgeClass = 'badge-success';
                      if (h.semester_status?.toLowerCase() === 'arrear') {
                        badgeClass = 'badge-danger';
                      } else if (h.semester_status?.toLowerCase() === 'pending') {
                        badgeClass = 'badge-warning';
                      }

                      return (
                        <tr key={h.id}>
                          <td className="font-semibold">{getStudentLabel(h.student_id)}</td>
                          <td><span className="badge badge-ghost">{classInfo.section}</span></td>
                          <td><span className="badge badge-primary">Sem {h.semester}</span></td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{h.academic_year}</td>
                          <td className="font-semibold">{Number(h.sgpa).toFixed(2)}</td>
                          <td>{h.credits_earned} / {h.credits_registered}</td>
                          <td>
                            <span className={`badge ${badgeClass}`}>
                              {h.semester_status || 'Passed'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="btn btn-sm btn-ghost" onClick={() => handleEditHistory(h)} title="Edit"><MdEdit /></button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteHistory(h.id)} title="Delete"><MdDelete /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
