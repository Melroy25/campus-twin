import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import {
  getAll, addDocument, addDocumentWithId, updateDocument, deleteDocument, queryDocuments
} from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import {
  MdAdd, MdBook, MdListAlt, MdClose, MdSave, MdDelete, MdSchool, MdEdit, MdSwapHoriz
} from 'react-icons/md';
import { Query } from 'appwrite';

const SEMESTERS = ['1st Semester', '2nd Semester', '3rd Semester', '4th Semester', '5th Semester', '6th Semester', '7th Semester', '8th Semester'];

export default function ManageSubjects() {
  const { userProfile, branches: authBranches } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create' | 'allocate' | 'allocations-list'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Subject Form State
  const [subjectForm, setSubjectForm] = useState({
    courseCode: '',
    courseName: '',
    courseShortName: '',
    credits: 3,
    branch_id: '',
    is_lab_integrated: false
  });
  
  // Allocation Form State
  const [allocationForm, setAllocationForm] = useState({
    class_id: '',
    subject_id: '',
    semester: '1st Semester'
  });

  const [editingSubject, setEditingSubject] = useState(null);
  const [editingAllocation, setEditingAllocation] = useState(null);
  const [editAllocationTeachers, setEditAllocationTeachers] = useState([]);
  const [editTeacherSearch, setEditTeacherSearch] = useState('');

  // Fetch branches, classes, and subjects
  const loadData = async () => {
    setLoading(true);
    try {
      const isSuper = userProfile?.is_super_admin === true;
      const adminBranch = userProfile?.branch_id;

      const [branchesData, classesData, subjectsData, allocationsData, teachersData] = await Promise.all([
        getAll('branches'),
        getAll('classes'),
        getAll('subjects'),
        getAll('subjectAllocations'),
        getAll('teachers')
      ]);

      setBranches(branchesData);

      // Filter classes by branch if not super admin
      const filteredClasses = isSuper
        ? classesData
        : classesData.filter(c => c.branch === adminBranch || c.branch_id === adminBranch);
      setClasses(filteredClasses);

      // Filter subjects by branch if not super admin
      const filteredSubjects = isSuper
        ? subjectsData
        : subjectsData.filter(s => s.branch_id === adminBranch);
      setSubjects(filteredSubjects);

      // Filter allocations by branch if not super admin
      const filteredAllocations = isSuper
        ? allocationsData
        : allocationsData.filter(a => {
            const cls = classesData.find(c => c.id === a.class_id);
            return cls && (cls.branch === adminBranch || cls.branch_id === adminBranch);
          });
      setAllocations(filteredAllocations);

      // Process teachers
      const parsedTeachers = (teachersData || []).map((u) => {
        let class_assignments = [];
        if (u.class_assignments) {
          if (typeof u.class_assignments === 'string') {
            try {
              class_assignments = JSON.parse(u.class_assignments);
            } catch (e) {
              class_assignments = [];
            }
          } else if (Array.isArray(u.class_assignments)) {
            class_assignments = u.class_assignments;
          }
        }
        return {
          ...u,
          class_assignments,
        };
      });

      const filteredTeachers = isSuper
        ? parsedTeachers
        : parsedTeachers.filter(t => t.branch_id === adminBranch || t.department === adminBranch);
      setTeachers(filteredTeachers);

      // Pre-fill default branch
      if (!isSuper && adminBranch) {
        setSubjectForm(prev => ({ ...prev, branch_id: adminBranch }));
      } else if (branchesData.length > 0) {
        setSubjectForm(prev => ({ ...prev, branch_id: branchesData[0].code }));
      }

    } catch (err) {
      toast.error('Failed to load subjects data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userProfile]);

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!subjectForm.courseCode || !subjectForm.courseName || subjectForm.credits === '' || subjectForm.credits === null || subjectForm.credits === undefined) {
      return toast.error('Please fill all required fields');
    }

    setSaving(true);
    try {
      const codeClean = subjectForm.courseCode.toUpperCase().trim();
      const nameClean = subjectForm.courseName.trim();
      const creditsNum = parseInt(subjectForm.credits);

      if (subjects.some(s => s.courseCode === codeClean)) {
        throw new Error('Course code already exists in your branch');
      }

      await addDocument('subjects', {
        courseCode: codeClean,
        courseName: nameClean,
        courseShortName: (subjectForm.courseShortName || '').toUpperCase().trim(),
        credits: creditsNum,
        branch_id: subjectForm.branch_id,
        is_lab_integrated: subjectForm.is_lab_integrated === true,
        createdAt: new Date().toISOString()
      });

      toast.success('Subject created successfully!');
      setSubjectForm(prev => ({
        ...prev,
        courseCode: '',
        courseName: '',
        courseShortName: '',
        credits: 3,
        is_lab_integrated: false
      }));
      setActiveTab('list');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to create subject');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubject = (subject) => {
    setEditingSubject({
      ...subject,
      courseShortName: subject.courseShortName || '',
      is_lab_integrated: subject.is_lab_integrated === true
    });
  };

  const handleUpdateSubject = async (e) => {
    e.preventDefault();
    if (!editingSubject.courseName || editingSubject.credits === '' || editingSubject.credits === null || editingSubject.credits === undefined) {
      return toast.error('Name and credits are required');
    }

    setSaving(true);
    try {
      await updateDocument('subjects', editingSubject.id, {
        courseName: editingSubject.courseName.trim(),
        courseShortName: (editingSubject.courseShortName || '').toUpperCase().trim(),
        credits: parseInt(editingSubject.credits),
        is_lab_integrated: editingSubject.is_lab_integrated === true
      });
      toast.success('Subject updated!');
      setEditingSubject(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update subject');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm('Are you sure you want to delete this subject? All linked allocations will be removed.')) return;
    setLoading(true);
    try {
      // Find subject name
      const subDoc = subjects.find(s => s.id === subjectId || s.$id === subjectId);
      if (subDoc) {
        const subjectName = subDoc.courseName;
        // Sync teachers: remove assignment
        for (const teacher of teachers) {
          let assignments = teacher.class_assignments || [];
          const hasAssignment = assignments.some(a => 
            a.subject && a.subject.trim().toLowerCase() === subjectName.trim().toLowerCase()
          );
          if (hasAssignment) {
            const updated = assignments.filter(a => !(
              a.subject && a.subject.trim().toLowerCase() === subjectName.trim().toLowerCase()
            ));
            await updateDocument('teachers', teacher.id || teacher.$id, {
              class_assignments: JSON.stringify(updated)
            });
          }
        }
      }

      // 1. Delete allocations linked to this subject
      const linkedAllocations = allocations.filter(a => a.subject_id === subjectId);
      for (const alloc of linkedAllocations) {
        await deleteDocument('subjectAllocations', alloc.id);

        // Remove from class subject_ids array as well
        const targetClass = classes.find(c => c.id === alloc.class_id);
        if (targetClass) {
          let currentSubjectIds = [];
          try {
            currentSubjectIds = targetClass.subject_ids ? JSON.parse(targetClass.subject_ids) : [];
          } catch {
            currentSubjectIds = [];
          }
          const updated = currentSubjectIds.filter(id => id !== subjectId);
          await updateDocument('classes', targetClass.id, {
            subject_ids: JSON.stringify(updated)
          });
        }
      }
      // 2. Delete subject
      await deleteDocument('subjects', subjectId);
      toast.success('Subject deleted successfully');
      loadData();
    } catch (err) {
      toast.error('Failed to delete subject');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateSubject = async (e) => {
    e.preventDefault();
    if (selectedClassIds.length === 0 || !allocationForm.subject_id || !allocationForm.semester) {
      return toast.error('Please select at least one class section and fill all fields for allocation');
    }

    setSaving(true);
    try {
      const subDoc = subjects.find(s => s.id === allocationForm.subject_id || s.$id === allocationForm.subject_id);
      if (!subDoc) throw new Error('Selected subject not found');

      let allocatedCount = 0;
      let skippedCount = 0;

      for (const classId of selectedClassIds) {
        // Avoid duplicate allocation
        const isDuplicate = allocations.some(a => 
          a.class_id === classId && 
          a.subject_id === allocationForm.subject_id && 
          a.semester === allocationForm.semester
        );

        if (isDuplicate) {
          skippedCount++;
          continue;
        }

        // Add allocation doc
        await addDocument('subjectAllocations', {
          class_id: classId,
          subject_id: allocationForm.subject_id,
          semester: allocationForm.semester,
          createdAt: new Date().toISOString()
        });

        // Update the class document's subject_ids field for backward compatibility
        const targetClass = classes.find(c => c.id === classId);
        if (targetClass) {
          let currentSubjectIds = [];
          try {
            currentSubjectIds = targetClass.subject_ids ? JSON.parse(targetClass.subject_ids) : [];
          } catch {
            currentSubjectIds = [];
          }
          if (!currentSubjectIds.includes(allocationForm.subject_id)) {
            currentSubjectIds.push(allocationForm.subject_id);
            await updateDocument('classes', targetClass.id, {
              subject_ids: JSON.stringify(currentSubjectIds)
            });
          }
        }

        // Sync teachers' assignments
        for (const teacher of teachers) {
          const isAssigned = selectedTeacherIds.includes(teacher.id || teacher.uid || teacher.$id);
          let assignments = teacher.class_assignments || [];
          const hasAssignment = assignments.some(a => 
            a.class_id === classId && 
            a.subject && a.subject.trim().toLowerCase() === subDoc.courseName.trim().toLowerCase()
          );

          if (isAssigned && !hasAssignment) {
            // Add assignment
            const updated = [...assignments, { class_id: classId, subject: subDoc.courseName }];
            await updateDocument('teachers', teacher.id || teacher.$id, {
              class_assignments: JSON.stringify(updated)
            });
          } else if (!isAssigned && hasAssignment) {
            // Remove assignment
            const updated = assignments.filter(a => !(
              a.class_id === classId &&
              a.subject && a.subject.trim().toLowerCase() === subDoc.courseName.trim().toLowerCase()
            ));
            await updateDocument('teachers', teacher.id || teacher.$id, {
              class_assignments: JSON.stringify(updated)
            });
          }
        }
        allocatedCount++;
      }

      if (allocatedCount > 0) {
        toast.success(`Successfully allocated subject to ${allocatedCount} class section(s)!`);
      }
      if (skippedCount > 0) {
        toast.error(`${skippedCount} class section(s) skipped (already allocated).`);
      }

      setAllocationForm(prev => ({
        ...prev,
        subject_id: ''
      }));
      setSelectedClassIds([]);
      setSelectedTeacherIds([]);
      setActiveTab('allocations-list');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to allocate subject');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllocation = async (allocation) => {
    if (!window.confirm('Remove this subject allocation?')) return;
    setLoading(true);
    try {
      // Find subject name
      const subDoc = subjects.find(s => s.id === allocation.subject_id || s.$id === allocation.subject_id);
      if (subDoc) {
        const subjectName = subDoc.courseName;
        // Sync teachers: remove assignment
        for (const teacher of teachers) {
          let assignments = teacher.class_assignments || [];
          const hasAssignment = assignments.some(a => 
            a.class_id === allocation.class_id && 
            a.subject && a.subject.trim().toLowerCase() === subjectName.trim().toLowerCase()
          );
          if (hasAssignment) {
            const updated = assignments.filter(a => !(
              a.class_id === allocation.class_id &&
              a.subject && a.subject.trim().toLowerCase() === subjectName.trim().toLowerCase()
            ));
            await updateDocument('teachers', teacher.id || teacher.$id, {
              class_assignments: JSON.stringify(updated)
            });
          }
        }
      }

      // Delete allocation document
      await deleteDocument('subjectAllocations', allocation.id);

      // Update class document's subject_ids field
      const targetClass = classes.find(c => c.id === allocation.class_id);
      if (targetClass) {
        let currentSubjectIds = [];
        try {
          currentSubjectIds = targetClass.subject_ids ? JSON.parse(targetClass.subject_ids) : [];
        } catch {
          currentSubjectIds = [];
        }
        const updated = currentSubjectIds.filter(id => id !== allocation.subject_id);
        await updateDocument('classes', targetClass.id, {
          subject_ids: JSON.stringify(updated)
        });
        // Optimistically update local classes state
        setClasses(prev =>
          prev.map(c =>
            c.id === targetClass.id ? { ...c, subject_ids: JSON.stringify(updated) } : c
          )
        );
      }

      // Optimistically remove allocation from local state
      setAllocations(prev => prev.filter(a => a.id !== allocation.id));

      toast.success('Allocation removed and teacher assignments synchronized.');
      loadData();
    } catch (err) {
      toast.error('Failed to delete allocation');
    } finally {
      setLoading(false);
    }
  };

  const openEditAllocation = (alloc) => {
    setEditingAllocation(alloc);
    const subDoc = subjects.find(s => s.id === alloc.subject_id || s.$id === alloc.subject_id);
    if (!subDoc) return;
    const currentAssigned = teachers.filter(t => {
      const assignments = t.class_assignments || [];
      return assignments.some(a => 
        a.class_id === alloc.class_id && 
        a.subject && a.subject.trim().toLowerCase() === subDoc.courseName.trim().toLowerCase()
      );
    }).map(t => t.id || t.uid || t.$id);
    setEditAllocationTeachers(currentAssigned);
    setEditTeacherSearch('');
  };

  const handleUpdateAllocationTeachers = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const subDoc = subjects.find(s => s.id === editingAllocation.subject_id || s.$id === editingAllocation.subject_id);
      if (!subDoc) throw new Error('Subject not found');

      const classId = editingAllocation.class_id;

      // Sync teachers' assignments
      for (const teacher of teachers) {
        const isAssigned = editAllocationTeachers.includes(teacher.id || teacher.uid || teacher.$id);
        let assignments = teacher.class_assignments || [];
        const hasAssignment = assignments.some(a => 
          a.class_id === classId && 
          a.subject && a.subject.trim().toLowerCase() === subDoc.courseName.trim().toLowerCase()
        );

        if (isAssigned && !hasAssignment) {
          // Add assignment
          const updated = [...assignments, { class_id: classId, subject: subDoc.courseName }];
          await updateDocument('teachers', teacher.id || teacher.$id, {
            class_assignments: JSON.stringify(updated)
          });
        } else if (!isAssigned && hasAssignment) {
          // Remove assignment
          const updated = assignments.filter(a => !(
            a.class_id === classId &&
            a.subject && a.subject.trim().toLowerCase() === subDoc.courseName.trim().toLowerCase()
          ));
          await updateDocument('teachers', teacher.id || teacher.$id, {
            class_assignments: JSON.stringify(updated)
          });
        }
      }

      toast.success('Assigned teachers updated successfully!');
      setEditingAllocation(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update teachers: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getSubjectDetails = (subId) => {
    const s = subjects.find(sub => sub.id === subId || sub.$id === subId);
    return s ? `${s.courseName} (${s.courseCode})` : 'Unknown Subject';
  };

  const getClassLabel = (classId) => {
    const c = classes.find(cls => cls.id === classId);
    return c ? c.label : 'Unknown Class';
  };

  const getAssignedTeachersForAllocation = (classId, subjectId) => {
    const subDoc = subjects.find(s => s.id === subjectId || s.$id === subjectId);
    if (!subDoc) return 'None';
    const matches = teachers.filter(t => {
      const assignments = t.class_assignments || [];
      return assignments.some(a => 
        a.class_id === classId && 
        a.subject && a.subject.trim().toLowerCase() === subDoc.courseName.trim().toLowerCase()
      );
    });
    return matches.length > 0 ? matches.map(m => m.name).join(', ') : 'None';
  };

  return (
    <Layout pageTitle="Manage Subjects">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Manage Subjects</h1>
          <p className="page-subtitle">Configure college course listings and allocate them to class semesters</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'list', label: '📖 Subjects List' },
          { id: 'create', label: '➕ Create Subject' },
          { id: 'allocate', label: '🔗 Allocate Subject' },
          { id: 'allocations-list', label: '📋 View Allocations' }
        ].map(t => (
          <button 
            key={t.id}
            className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : (
        <>
          {/* List Tab */}
          {activeTab === 'list' && (
            <div className="card">
              <h3 className="mb-16"><MdBook style={{ verticalAlign: 'middle', marginRight: 6 }} /> Active Subjects ({subjects.length})</h3>
              {subjects.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><MdBook /></div>
                  <p>No subjects added yet. Add some subjects to start allocations.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Course Code</th>
                        <th>Course Name</th>
                        <th>Credits</th>
                        <th>Type</th>
                        <th>Branch</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.courseCode}</td>
                          <td>
                            <span className="font-semibold">{s.courseName}</span>
                            {s.courseShortName && (
                              <span style={{ marginLeft: 8, fontSize: '0.76rem', padding: '2px 8px', borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700 }}>
                                {s.courseShortName}
                              </span>
                            )}
                          </td>
                          <td><span className="badge badge-primary">{s.credits} Credits</span></td>
                          <td>
                            {s.is_lab_integrated ? (
                              <span className="badge badge-info">Lab Integrated</span>
                            ) : (
                              <span className="badge badge-ghost">Theory Only</span>
                            )}
                          </td>
                          <td><span className="badge badge-ghost">{s.branch_id}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="btn btn-sm btn-ghost" onClick={() => handleEditSubject(s)}><MdEdit /></button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSubject(s.id)}><MdDelete /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Create Subject Tab */}
          {activeTab === 'create' && (
            <div className="grid-2" style={{ alignItems: 'start' }}>
              <div className="card card-lg">
                <h3 className="mb-16">➕ Add Subject to Curriculum</h3>
                <form onSubmit={handleCreateSubject}>
                  <div className="form-group">
                    <label className="form-label">Course Code *</label>
                    <input 
                      className="form-control" 
                      placeholder="e.g. 21CS41" 
                      value={subjectForm.courseCode} 
                      onChange={(e) => setSubjectForm(prev => ({ ...prev, courseCode: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Course Name *</label>
                    <input 
                      className="form-control" 
                      placeholder="e.g. Database Management System" 
                      value={subjectForm.courseName} 
                      onChange={(e) => setSubjectForm(prev => ({ ...prev, courseName: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Course Short Name</label>
                    <input 
                      className="form-control" 
                      placeholder="e.g. DBMS" 
                      value={subjectForm.courseShortName} 
                      onChange={(e) => setSubjectForm(prev => ({ ...prev, courseShortName: e.target.value }))}
                      style={{ textTransform: 'uppercase' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      Optional abbreviation displayed alongside the full name
                    </span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credits *</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      min={0} 
                      max={6}
                      value={subjectForm.credits} 
                      onChange={(e) => setSubjectForm(prev => ({ ...prev, credits: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 16 }}>
                    <input 
                      type="checkbox" 
                      id="is_lab_integrated"
                      checked={subjectForm.is_lab_integrated || false} 
                      onChange={(e) => setSubjectForm(prev => ({ ...prev, is_lab_integrated: e.target.checked }))}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <label htmlFor="is_lab_integrated" style={{ fontWeight: 600, cursor: 'pointer', margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      Lab Integrated Subject
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Branch *</label>
                    <select 
                      className="form-control" 
                      value={subjectForm.branch_id} 
                      onChange={(e) => setSubjectForm(prev => ({ ...prev, branch_id: e.target.value }))}
                      disabled={!userProfile?.is_super_admin}
                    >
                      {userProfile?.is_super_admin ? (
                        branches.map(b => <option key={b.id} value={b.code}>{b.name} ({b.code})</option>)
                      ) : (
                        <option value={userProfile?.branch_id}>{userProfile?.branch_id}</option>
                      )}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary btn-block" disabled={saving} style={{ marginTop: 12 }}>
                    {saving ? 'Creating...' : 'Create Subject'}
                  </button>
                </form>
              </div>

              <div className="card">
                <h3>📖 Subjects Standards</h3>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 10, lineHeight: 1.6 }}>
                  Course codes should reflect the official curriculum schemas. Course names will appear directly on marks entry screens, timetables, and student report screens.
                </p>
                <div style={{ marginTop: 16, borderLeft: '3px solid var(--primary)', paddingLeft: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <strong>Tip:</strong> Subject creations are locked to your assigned branch. They cannot be assigned across branches to enforce structural cleanliness.
                </div>
              </div>
            </div>
          )}

          {/* Allocate Subjects Tab */}
          {activeTab === 'allocate' && (
            <div className="grid-2" style={{ alignItems: 'start' }}>
              <div className="card card-lg">
                <h3 className="mb-16"><MdSchool style={{ verticalAlign: 'middle', marginRight: 6 }} /> Allocate Subject to Class Section</h3>
                {subjects.length === 0 || classes.length === 0 ? (
                  <div className="empty-state">
                    <p>You must have at least one Class Section and one Subject in your branch to make allocations.</p>
                  </div>
                ) : (
                  <form onSubmit={handleAllocateSubject}>
                    <div className="form-group">
                      <label className="form-label">Select Class Section(s) *</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Search section by label..." 
                        value={classSearch}
                        onChange={(e) => setClassSearch(e.target.value)}
                        style={{ marginBottom: 8, padding: '6px 12px', fontSize: '0.85rem' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', background: 'var(--surface)' }}>
                        {classes.length === 0 ? (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No class sections found.</span>
                        ) : (() => {
                          const filtered = classes.filter(c => 
                            classSearch.trim() === '' || c.label.toLowerCase().includes(classSearch.toLowerCase())
                          );
                          return filtered.length === 0 ? (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No sections match "{classSearch}"</span>
                          ) : (
                            <>
                              <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 4 }}>
                                <button 
                                  type="button" 
                                  className="btn btn-xs btn-ghost" 
                                  onClick={() => setSelectedClassIds(filtered.map(c => c.id))}
                                  style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                                >
                                  Select All
                                </button>
                                <button 
                                  type="button" 
                                  className="btn btn-xs btn-ghost" 
                                  onClick={() => setSelectedClassIds(prev => prev.filter(id => !filtered.some(f => f.id === id)))}
                                  style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                                >
                                  Deselect All
                                </button>
                              </div>
                              {filtered.map(c => {
                                const id = c.id;
                                return (
                                  <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', margin: 0, padding: '2px 0', color: 'var(--text-primary)' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={selectedClassIds.includes(id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedClassIds(prev => [...prev, id]);
                                        } else {
                                          setSelectedClassIds(prev => prev.filter(x => x !== id));
                                        }
                                      }}
                                    />
                                    <span>{c.label}</span>
                                  </label>
                                );
                              })}
                            </>
                          );
                        })()}
                      </div>
                      {selectedClassIds.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: 4, display: 'block', fontWeight: 600 }}>
                          {selectedClassIds.length} section{selectedClassIds.length !== 1 ? 's' : ''} selected
                        </span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Select Subject *</label>
                      <select 
                        className="form-control" 
                        value={allocationForm.subject_id}
                        onChange={(e) => setAllocationForm(prev => ({ ...prev, subject_id: e.target.value }))}
                        required
                      >
                        <option value="">— Select Subject —</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.courseName} ({s.courseCode})</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Select Semester *</label>
                      <select 
                        className="form-control" 
                        value={allocationForm.semester}
                        onChange={(e) => setAllocationForm(prev => ({ ...prev, semester: e.target.value }))}
                        required
                      >
                        {SEMESTERS.map(sem => <option key={sem} value={sem}>{sem}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Assign Teacher(s)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Search teacher by name..." 
                        value={teacherSearch}
                        onChange={(e) => setTeacherSearch(e.target.value)}
                        style={{ marginBottom: 8, padding: '6px 12px', fontSize: '0.85rem' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', background: 'var(--surface)' }}>
                        {teachers.length === 0 ? (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No teachers found.</span>
                        ) : (() => {
                          const filtered = teachers.filter(t => 
                            teacherSearch.trim() === '' || t.name.toLowerCase().includes(teacherSearch.toLowerCase())
                          );
                          return filtered.length === 0 ? (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No teachers match "{teacherSearch}"</span>
                          ) : (
                            filtered.map(t => {
                              const id = t.id || t.uid || t.$id;
                              return (
                                <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', margin: 0, padding: '2px 0', color: 'var(--text-primary)' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedTeacherIds.includes(id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedTeacherIds(prev => [...prev, id]);
                                      } else {
                                        setSelectedTeacherIds(prev => prev.filter(x => x !== id));
                                      }
                                    }}
                                  />
                                  <span>{t.name}</span>
                                  {t.department && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>[{t.department}]</span>}
                                </label>
                              );
                            })
                          );
                        })()}
                      </div>
                      {selectedTeacherIds.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: 4, display: 'block', fontWeight: 600 }}>
                          {selectedTeacherIds.length} teacher{selectedTeacherIds.length !== 1 ? 's' : ''} selected
                        </span>
                      )}
                    </div>

                    <button type="submit" className="btn btn-primary btn-block" disabled={saving} style={{ marginTop: 12 }}>
                      {saving ? 'Allocating...' : 'Allocate Subject'}
                    </button>
                  </form>
                )}
              </div>

              <div className="card">
                <h3>❓ Why allocate subjects?</h3>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 10, lineHeight: 1.6 }}>
                  Allocation maps subjects directly to specific sections. This enables:
                </p>
                <ul style={{ fontSize: '0.82rem', paddingLeft: 20, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  <li>Teachers to record attendance for that specific subject in that section.</li>
                  <li>Teachers to assign marks for the curriculum in the selected semester.</li>
                  <li>Students to view academic records in their student dashboard.</li>
                </ul>
              </div>
            </div>
          )}

          {/* View Allocations Tab */}
          {activeTab === 'allocations-list' && (
            <div className="card">
              <h3 className="mb-16"><MdListAlt style={{ verticalAlign: 'middle', marginRight: 6 }} /> Active Subject Allocations ({allocations.length})</h3>
              {allocations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><MdListAlt /></div>
                  <p>No subject allocations recorded yet. Allocate your first subject using the 'Allocate Subject' tab.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Class Section</th>
                        <th>Subject Name</th>
                        <th>Semester</th>
                        <th>Assigned Teacher(s)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map(a => (
                        <tr key={a.id}>
                          <td className="font-semibold">{getClassLabel(a.class_id)}</td>
                          <td>{getSubjectDetails(a.subject_id)}</td>
                          <td><span className="badge badge-pending">{a.semester}</span></td>
                          <td>
                            <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                              {getAssignedTeachersForAllocation(a.class_id, a.subject_id)}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="btn btn-sm btn-ghost" onClick={() => openEditAllocation(a)} title="Edit Assigned Teachers"><MdEdit /></button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteAllocation(a)} title="Delete Allocation"><MdDelete /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 450, animation: 'slideUp 0.3s ease-out' }}>
            <div className="flex-between mb-20">
              <h3><MdEdit /> Edit Subject</h3>
              <button className="btn btn-ghost" onClick={() => setEditingSubject(null)}><MdClose /></button>
            </div>
            <form onSubmit={handleUpdateSubject}>
              <div className="form-group">
                <label className="form-label">Course Code (Cannot change)</label>
                <input className="form-control" value={editingSubject.courseCode} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Course Name</label>
                <input 
                  className="form-control" 
                  value={editingSubject.courseName} 
                  onChange={(e) => setEditingSubject(prev => ({ ...prev, courseName: e.target.value }))}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Course Short Name</label>
                <input 
                  className="form-control" 
                  placeholder="e.g. DBMS" 
                  value={editingSubject.courseShortName || ''} 
                  onChange={(e) => setEditingSubject(prev => ({ ...prev, courseShortName: e.target.value }))}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Credits</label>
                <input 
                  type="number" 
                  className="form-control" 
                  min={0} 
                  max={6}
                  value={editingSubject.credits} 
                  onChange={(e) => setEditingSubject(prev => ({ ...prev, credits: e.target.value }))}
                  required 
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 16 }}>
                <input 
                  type="checkbox" 
                  id="edit_is_lab_integrated"
                  checked={editingSubject.is_lab_integrated || false} 
                  onChange={(e) => setEditingSubject(prev => ({ ...prev, is_lab_integrated: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="edit_is_lab_integrated" style={{ fontWeight: 600, cursor: 'pointer', margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Lab Integrated Subject
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setEditingSubject(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={saving}><MdSave /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Allocation Modal */}
      {editingAllocation && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 450, animation: 'slideUp 0.3s ease-out' }}>
            <div className="flex-between mb-20">
              <h3><MdEdit /> Edit Assigned Teachers</h3>
              <button className="btn btn-ghost" onClick={() => setEditingAllocation(null)}><MdClose /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Subject: <strong>{getSubjectDetails(editingAllocation.subject_id)}</strong><br />
              Class Section: <strong>{getClassLabel(editingAllocation.class_id)}</strong>
            </p>
            <form onSubmit={handleUpdateAllocationTeachers}>
              <div className="form-group">
                <label className="form-label">Search Teachers</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Filter by name..." 
                  value={editTeacherSearch}
                  onChange={(e) => setEditTeacherSearch(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', background: 'var(--surface)' }}>
                  {teachers.length === 0 ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No teachers found.</span>
                  ) : (() => {
                    const filtered = teachers.filter(t => 
                      editTeacherSearch.trim() === '' || t.name.toLowerCase().includes(editTeacherSearch.toLowerCase())
                    );
                    return filtered.length === 0 ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No teachers match "{editTeacherSearch}"</span>
                    ) : (
                      filtered.map(t => {
                        const id = t.id || t.uid || t.$id;
                        return (
                          <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', margin: 0, padding: '2px 0', color: 'var(--text-primary)' }}>
                            <input 
                              type="checkbox" 
                              checked={editAllocationTeachers.includes(id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditAllocationTeachers(prev => [...prev, id]);
                                } else {
                                  setEditAllocationTeachers(prev => prev.filter(x => x !== id));
                                }
                              }}
                            />
                            <span>{t.name}</span>
                            {t.department && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>[{t.department}]</span>}
                          </label>
                        );
                      })
                    );
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setEditingAllocation(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={saving}><MdSave /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
