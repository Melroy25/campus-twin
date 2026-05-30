import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import {
  getClasses, addClass, deleteClass, getAll, listenClasses, updateDocument
} from '../../appwrite/database';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  MdAdd, MdDelete, MdSchool, MdPeople, MdClose, MdContentCopy, MdEdit
} from 'react-icons/md';

const SEMESTERS = ['1st Semester', '2nd Semester', '3rd Semester', '4th Semester', '5th Semester', '6th Semester', '7th Semester', '8th Semester'];

export default function AdminManageClasses() {
  const { userProfile, branches: authBranches } = useAuth();
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [branches, setBranches] = useState([]);
  
  const [form, setForm] = useState({ 
    branch: '', 
    year: new Date().getFullYear(), 
    section: 'A', 
    mentor_id: '', 
    advisor_id: '',
    max_credits: 24,
    semester: '1st Semester'
  });
  
  const [creating, setCreating] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [editMentorId, setEditMentorId] = useState('');
  const [editAdvisorId, setEditAdvisorId] = useState('');
  const [editSemester, setEditSemester] = useState('1st Semester');
  const [editMaxCredits, setEditMaxCredits] = useState(24);
  const [editTeacherIds, setEditTeacherIds] = useState([]);
  const [studentCounts, setStudentCounts] = useState({});
  const [createDeptFilter, setCreateDeptFilter] = useState('');
  const [editDeptFilter, setEditDeptFilter] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [bulkSemester, setBulkSemester] = useState('1st Semester');
  const [updatingBulk, setUpdatingBulk] = useState(false);

  // Fetch branches dynamically
  useEffect(() => {
    getAll('branches').then((data) => {
      setBranches(data);
      // Pre-select first branch or branch admin's branch
      if (userProfile?.is_super_admin) {
        if (data.length > 0) setForm(f => ({ ...f, branch: data[0].code }));
      } else {
        setForm(f => ({ ...f, branch: userProfile?.branch_id || '' }));
      }
    });
  }, [userProfile]);

  const filteredTeachersForCreate = teachers.filter((t) => {
    const isEligible = t.role === 'teacher' || t.role === 'mentor';
    if (!isEligible) return false;
    
    // Branch Admin can only see teachers in their branch/department
    if (!userProfile?.is_super_admin) {
      return t.branch_id === userProfile?.branch_id || t.department === userProfile?.branch_id;
    }
    
    if (createDeptFilter) {
      return t.branch_id === createDeptFilter || t.department === createDeptFilter;
    }
    return true;
  });

  const filteredTeachersForEdit = teachers.filter((t) => {
    const isEligible = t.role === 'teacher' || t.role === 'mentor';
    if (!isEligible) return false;
    
    // Branch Admin can only see teachers in their branch/department
    if (!userProfile?.is_super_admin) {
      return t.branch_id === userProfile?.branch_id || t.department === userProfile?.branch_id;
    }

    if (editDeptFilter) {
      return t.branch_id === editDeptFilter || t.department === editDeptFilter;
    }
    return true;
  });

  // Load teachers and classes
  useEffect(() => {
    const unsub = listenClasses((allClasses) => {
      if (userProfile?.is_super_admin) {
        setClasses(allClasses);
      } else {
        const filtered = allClasses.filter(c => c.branch === userProfile?.branch_id || c.branch_id === userProfile?.branch_id);
        setClasses(filtered);
      }
    });

    Promise.all([getAll('teachers'), getAll('userRoles')])
      .then(([teachersList, rolesList]) => {
        const roleMap = {};
        rolesList.forEach((r) => {
          roleMap[r.uid] = r.role;
        });
        setTeachers(
          teachersList.map((t) => {
            let class_assignments = [];
            if (t.class_assignments) {
              if (typeof t.class_assignments === 'string') {
                try {
                  class_assignments = JSON.parse(t.class_assignments);
                } catch (e) {
                  class_assignments = [];
                }
              } else if (Array.isArray(t.class_assignments)) {
                class_assignments = t.class_assignments;
              }
            }
            return {
              ...t,
              class_assignments,
              role: roleMap[t.uid] || 'teacher',
            };
          })
        );
      })
      .catch((err) => console.error(err));
    return unsub;
  }, [userProfile]);

  const updateMentorClassAssignments = async (mentorId, classId, action) => {
    if (!mentorId) return;
    try {
      const mentor = teachers.find(t => t.id === mentorId || t.uid === mentorId);
      if (!mentor) return;
      
      let assignments = [...(mentor.class_assignments || [])];
      if (action === 'add') {
        if (!assignments.find(a => a.class_id === classId)) {
          assignments.push({ class_id: classId });
        }
      } else if (action === 'remove') {
        assignments = assignments.filter(a => a.class_id !== classId);
      }
      
      await updateDocument('teachers', mentor.id, {
        class_assignments: JSON.stringify(assignments)
      });
      
      setTeachers(prev => prev.map(t => 
        (t.id === mentor.id) ? { ...t, class_assignments: assignments } : t
      ));
    } catch (err) {
      console.error(`Failed to update mentor assignments for ${mentorId}:`, err);
    }
  };

  const openEdit = (cls) => {
    setEditClass(cls);
    setEditMentorId(cls.mentor_id || '');
    setEditAdvisorId(cls.advisor_id || '');
    setEditSemester(cls.semester || '1st Semester');
    setEditMaxCredits(cls.max_credits !== undefined ? cls.max_credits : 24);
    setEditTeacherIds([]);
    setEditModalOpen(true);
  };

  const closeEdit = () => {
    setEditModalOpen(false);
    setEditClass(null);
    setEditMentorId('');
    setEditAdvisorId('');
    setEditSemester('1st Semester');
    setEditMaxCredits(24);
    setEditTeacherIds([]);
  };

  const saveEdit = async () => {
    if (!editClass) return;
    if (editMentorId && editAdvisorId && editMentorId === editAdvisorId) {
      return toast.error('A teacher cannot be both the mentor and class advisor for the same class.');
    }
    try {
      await updateDocument('classes', editClass.id, {
        mentor_id: editMentorId || '',
        advisor_id: editAdvisorId || '',
        semester: editSemester,
        max_credits: Number(editMaxCredits)
      });

      const oldMentorId = editClass.mentor_id;
      const newMentorId = editMentorId;
      if (oldMentorId !== newMentorId) {
        if (oldMentorId) {
          await updateMentorClassAssignments(oldMentorId, editClass.id, 'remove');
        }
        if (newMentorId) {
          await updateMentorClassAssignments(newMentorId, editClass.id, 'add');
        }
      }

      setClasses((prev) =>
        prev.map((c) =>
          c.id === editClass.id ? { ...c, mentor_id: editMentorId, advisor_id: editAdvisorId, semester: editSemester, max_credits: Number(editMaxCredits) } : c
        )
      );
      toast.success('Class updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update class');
    }
    closeEdit();
  };

  useEffect(() => {
    if (classes.length === 0) return;
    getAll('students').then((allStudents) => {
      const counts = {};
      classes.forEach((cls) => {
        counts[cls.id] = allStudents.filter((s) => s.class_id === cls.id).length;
      });
      setStudentCounts(counts);
    });
  }, [classes]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.branch || !form.year || !form.section) return toast.error('Fill all required fields');
    if (form.mentor_id && form.advisor_id && form.mentor_id === form.advisor_id) {
      return toast.error('A teacher cannot be both the mentor and class advisor for the same class.');
    }
    setCreating(true);
    try {
      const createdLabel = `${form.branch} ${form.year} - Sec ${form.section.toUpperCase()}`;
      await addClass({
        branch: form.branch,
        year: String(form.year),
        section: form.section.toUpperCase(),
        mentor_id: form.mentor_id || '',
        advisor_id: form.advisor_id || '',
        semester: form.semester || '1st Semester',
        max_credits: Number(form.max_credits || 24),
        label: createdLabel,
      });
      
      if (form.mentor_id) {
        const newClass = await getAll('classes').then(clsList => clsList.find(c => c.label === createdLabel));
        if (newClass) {
          await updateMentorClassAssignments(form.mentor_id, newClass.id, 'add');
        }
      }
      toast.success('Class created!');
      setForm(prev => ({ 
        ...prev, 
        year: new Date().getFullYear(), 
        section: 'A', 
        mentor_id: '', 
        advisor_id: '',
        max_credits: 24,
        semester: '1st Semester'
      }));
    } catch (err) {
      toast.error(err.message || 'Failed to create class');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (cls) => {
    if (!window.confirm(`Delete class "${cls.label}"? All students in this class will lose their class assignment.`)) return;
    await deleteClass(cls.id);
    toast.success('Class deleted');
  };

  const mentorName = (mentorId) => {
    const t = teachers.find((t) => t.id === mentorId || t.uid === mentorId);
    return t ? t.name : mentorId || '–';
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    toast.success('Class ID copied!');
  };

  const toggleClassSelection = (classId) => {
    setSelectedClassIds(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId) 
        : [...prev, classId]
    );
  };

  const handleSelectAllClasses = () => {
    if (selectedClassIds.length === classes.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map(c => c.id));
    }
  };

  const handleBulkUpdateSemester = async () => {
    if (selectedClassIds.length === 0) {
      return toast.error('Please select at least one class first');
    }
    if (!window.confirm(`Update semester to "${bulkSemester}" for all ${selectedClassIds.length} selected classes?`)) {
      return;
    }
    setUpdatingBulk(true);
    try {
      for (const classId of selectedClassIds) {
        await updateDocument('classes', classId, {
          semester: bulkSemester
        });
      }
      
      setClasses(prev => prev.map(c => 
        selectedClassIds.includes(c.id) ? { ...c, semester: bulkSemester } : c
      ));
      
      toast.success(`Updated semester for ${selectedClassIds.length} classes successfully!`);
      setSelectedClassIds([]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update semester for some classes');
    } finally {
      setUpdatingBulk(false);
    }
  };

  return (
    <Layout pageTitle="Manage Classes">
      <h1 className="page-title">Manage Classes</h1>
      <p className="page-subtitle">Create sections and assign mentors — teachers and students will be linked to these classes</p>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Create Form */}
        <div className="card card-lg">
          <h3 className="mb-16"><MdAdd style={{ verticalAlign: 'middle' }} /> Create New Class Section</h3>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Branch *</label>
              <select 
                className="form-control" 
                value={form.branch} 
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                disabled={!userProfile?.is_super_admin}
              >
                {userProfile?.is_super_admin ? (
                  branches.map((b) => <option key={b.id} value={b.code}>{b.name} ({b.code})</option>)
                ) : (
                  <option value={userProfile?.branch_id}>{userProfile?.branch_id}</option>
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Year (Batch) *</label>
              <input
                type="text" className="form-control"
                placeholder="e.g. 2024 or 2nd Year"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Section *</label>
              <input
                className="form-control"
                placeholder="e.g. A, B, C"
                maxLength={3}
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Semester *</label>
              <select 
                className="form-control"
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
                required
              >
                {SEMESTERS.map(sem => <option key={sem} value={sem}>{sem}</option>)}
              </select>
            </div>
            <div className="form-group">
                {userProfile?.is_super_admin && (
                  <>
                    <label className="form-label">Filter Teachers by Department</label>
                    <select className="form-control" style={{ marginBottom: 12 }} value={createDeptFilter} onChange={(e) => setCreateDeptFilter(e.target.value)}>
                      <option value="">All Departments</option>
                      {branches.map((b) => <option key={b.id} value={b.code}>{b.code}</option>)}
                    </select>
                  </>
                )}

                <label className="form-label">Assign Mentor (optional)</label>
                <select className="form-control" value={form.mentor_id} onChange={(e) => setForm({ ...form, mentor_id: e.target.value })}>
                  <option value="">— Select Mentor —</option>
                  {filteredTeachersForCreate.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.usn}) {t.department ? `[${t.department}]` : ''}</option>
                  ))}
                </select>
                <label className="form-label" style={{ marginTop: '12px' }}>Assign Class Advisor (optional)</label>
                <select className="form-control" value={form.advisor_id} onChange={(e) => setForm({ ...form, advisor_id: e.target.value })}>
                  <option value="">— Select Advisor —</option>
                  {filteredTeachersForCreate.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.usn}) {t.department ? `[${t.department}]` : ''}</option>
                  ))}
                </select>
                <label className="form-label" style={{ marginTop: '12px' }}>Max Credits Limit *</label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  max="100"
                  value={form.max_credits}
                  onChange={(e) => setForm({ ...form, max_credits: parseInt(e.target.value) || 0 })}
                  required
                />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={creating || !form.branch}>
              {creating ? 'Creating...' : 'Create Class'}
            </button>
          </form>
        </div>

        {/* Class List */}
        <div className="card" style={{ maxHeight: 600, overflowY: 'auto' }}>
          <h3 className="mb-16" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span><MdSchool style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--primary)' }} /> All Classes ({classes.length})</span>
          </h3>

          {classes.length > 0 && (
            <div style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox" 
                    id="selectAllClasses"
                    checked={classes.length > 0 && selectedClassIds.length === classes.length}
                    onChange={handleSelectAllClasses}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="selectAllClasses" style={{ fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)' }}>
                    Select All Classes ({selectedClassIds.length} chosen)
                  </label>
                </div>
                
                {selectedClassIds.length > 0 && (
                  <button 
                    className="btn btn-sm btn-ghost" 
                    style={{ color: 'var(--danger)', fontSize: '0.78rem', padding: '2px 8px' }}
                    onClick={() => setSelectedClassIds([])}
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              {selectedClassIds.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 10, 
                  flexWrap: 'wrap', 
                  borderTop: '1px solid var(--border)', 
                  paddingTop: 12 
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Bulk Update Semester:
                  </span>
                  <select 
                    className="form-control" 
                    style={{ width: 160, padding: '4px 8px', fontSize: '0.82rem', height: 'auto' }}
                    value={bulkSemester}
                    onChange={(e) => setBulkSemester(e.target.value)}
                  >
                    {SEMESTERS.map(sem => <option key={sem} value={sem}>{sem}</option>)}
                  </select>
                  <button 
                    className="btn btn-sm btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.8rem', minHeight: 'auto' }}
                    onClick={handleBulkUpdateSemester}
                    disabled={updatingBulk}
                  >
                    {updatingBulk ? 'Updating...' : 'Apply changes'}
                  </button>
                </div>
              )}
            </div>
          )}

          {classes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><MdSchool /></div>
              <p>No classes created yet. Create your first class section above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classes.map((cls) => {
                const isSelected = selectedClassIds.includes(cls.id);
                return (
                  <div key={cls.id} style={{
                    padding: '14px 16px',
                    border: isSelected ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                    background: isSelected ? 'var(--primary-light)' : 'transparent',
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? 'var(--shadow-md)' : 'none'
                  }}>
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleClassSelection(cls.id)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--primary)', flexShrink: 0 }}
                    />
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: isSelected ? 'var(--primary)' : 'var(--primary-light)', 
                      color: isSelected ? 'white' : 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.76rem', flexShrink: 0,
                      transition: 'all 0.2s ease'
                    }}>{cls.branch}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="font-semibold" style={{ fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{cls.label}</span>
                        <span style={{ fontSize: '0.7rem', background: 'var(--warning-light)', color: 'var(--warning-dark)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          {cls.semester || '1st Semester'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span><MdPeople style={{ verticalAlign: 'middle', marginRight: 3 }} />{studentCounts[cls.id] ?? '…'} students</span>
                        <span>Mentor: {mentorName(cls.mentor_id)}</span>
                        <span>Credits: {cls.max_credits ?? 24} cr</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                        ID: {cls.id}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleCopyId(cls.id)} title="Copy Class ID">
                        <MdContentCopy />
                      </button>
                      <button className="btn btn-sm btn-primary" onClick={() => openEdit(cls)} title="Edit class">
                        <MdEdit />
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(cls)} title="Delete class">
                        <MdDelete />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModalOpen && editClass && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Edit Class – {editClass.label}</h3>
            <div className="form-group mb-3">
               {userProfile?.is_super_admin && (
                 <>
                   <label className="form-label">Filter Teachers by Department</label>
                   <select
                     className="form-control"
                     style={{ marginBottom: 12 }}
                     value={editDeptFilter}
                     onChange={(e) => setEditDeptFilter(e.target.value)}
                   >
                     <option value="">All Departments</option>
                     {branches.map((b) => <option key={b.id} value={b.code}>{b.code}</option>)}
                   </select>
                 </>
               )}

               <label className="form-label">Assign Mentor</label>
               <select
                 className="form-control"
                 value={editMentorId}
                 onChange={(e) => setEditMentorId(e.target.value)}
               >
                 <option value="">— No Mentor —</option>
                 {filteredTeachersForEdit.map((t) => (
                   <option key={t.id} value={t.id}>
                     {t.name} ({t.usn}) {t.department ? `[${t.department}]` : ''}
                   </option>
                 ))}
               </select>
               <label className="form-label" style={{ marginTop: '12px' }}>Assign Advisor</label>
               <select
                 className="form-control"
                 value={editAdvisorId}
                 onChange={(e) => setEditAdvisorId(e.target.value)}
               >
                 <option value="">— No Advisor —</option>
                 {filteredTeachersForEdit.map((t) => (
                   <option key={t.id} value={t.id}>
                     {t.name} ({t.usn}) {t.department ? `[${t.department}]` : ''}
                   </option>
                 ))}
               </select>
               <label className="form-label" style={{ marginTop: '12px' }}>Semester *</label>
               <select
                 className="form-control"
                 value={editSemester}
                 onChange={(e) => setEditSemester(e.target.value)}
                 required
               >
                 {SEMESTERS.map(sem => <option key={sem} value={sem}>{sem}</option>)}
               </select>
               <label className="form-label" style={{ marginTop: '12px' }}>Max Credits Limit *</label>
               <input
                 type="number"
                 className="form-control"
                 min="0"
                 max="100"
                 value={editMaxCredits}
                 onChange={(e) => setEditMaxCredits(parseInt(e.target.value) || 0)}
                 required
               />
            </div>
            <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
              <button className="btn btn-sm btn-ghost" onClick={closeEdit}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="card" style={{ marginTop: 24, background: 'var(--info-light)', borderColor: 'var(--info)' }}>
        <h4 style={{ marginBottom: 8, color: 'var(--info)' }}>ℹ️ How Classes Work</h4>
        <ul style={{ fontSize: '0.85rem', paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Each class has a unique <strong>Class ID</strong> (shown above) — copy it when assigning students and teachers.</li>
          <li>When creating a <strong>student</strong>, select their class from the dropdown — which uses these Class IDs.</li>
          <li>When creating a <strong>teacher</strong>, assign them to one or more classes from this list.</li>
          <li><strong>Class Advisor</strong>: The teacher in charge of enabling and moderating the class's official chat room, and overseeing general class activities.</li>
          <li><strong>Class Mentor</strong>: The teacher assigned to guide the students individually, approve AICTE points, and support their academic journey.</li>
          <li><strong>Role Constraint</strong>: A teacher can be assigned as a Mentor for one class and an Advisor for another, but <strong>cannot hold both roles for the same class section</strong>.</li>
        </ul>
      </div>
    </Layout>
  );
}
