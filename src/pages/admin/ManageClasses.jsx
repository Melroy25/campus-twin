import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import {
  getClasses, addClass, deleteClass, getAll, listenClasses, updateDocument
} from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import {
  MdAdd, MdDelete, MdSchool, MdPeople, MdClose, MdContentCopy, MdEdit
} from 'react-icons/md';

const BRANCHES = ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'CE', 'AIDS', 'AIML'];

export default function AdminManageClasses() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({ branch: 'CSE', year: new Date().getFullYear(), section: 'A', mentor_id: '', advisor_id: '' });
  const [creating, setCreating] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [editMentorId, setEditMentorId] = useState('');
  const [editAdvisorId, setEditAdvisorId] = useState('');
  const [editTeacherIds, setEditTeacherIds] = useState([]);
  const [studentCounts, setStudentCounts] = useState({});
  const [createDeptFilter, setCreateDeptFilter] = useState('');
  const [editDeptFilter, setEditDeptFilter] = useState('');

  const filteredTeachersForCreate = teachers.filter((t) => {
    const isEligible = t.role === 'teacher' || t.role === 'mentor';
    if (!isEligible) return false;
    if (createDeptFilter) {
      return t.department === createDeptFilter;
    }
    return true;
  });

  const filteredTeachersForEdit = teachers.filter((t) => {
    const isEligible = t.role === 'teacher' || t.role === 'mentor';
    if (!isEligible) return false;
    if (editDeptFilter) {
      return t.department === editDeptFilter;
    }
    return true;
  });


  // Helper functions for class edit modal
  // Load teachers with roles and listen for class updates
  useEffect(() => {
    const unsub = listenClasses(setClasses);
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
  }, []);

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
      
      // Update local state teachers list
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
    // initialize teacher selection (not persisted)
    setEditTeacherIds([]);
    setEditModalOpen(true);
  };

  const closeEdit = () => {
    setEditModalOpen(false);
    setEditClass(null);
    setEditMentorId('');
    setEditAdvisorId('');
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
        advisor_id: editAdvisorId || ''
      });

      // Handle mentor change sync
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

      // Update local state
      setClasses((prev) =>
        prev.map((c) =>
          c.id === editClass.id ? { ...c, mentor_id: editMentorId, advisor_id: editAdvisorId } : c
        )
      );
      toast.success('Class updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update class');
    }
    closeEdit();
  };

  // Fetch student count per class for display
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
      await addClass({
        branch: form.branch,
        year: String(form.year),
        section: form.section.toUpperCase(),
        mentor_id: form.mentor_id || '',
        advisor_id: form.advisor_id || '',
        label: `${form.branch} ${form.year} - Sec ${form.section.toUpperCase()}`,
      });
      // Sync mentor class assignments if mentor selected
      if (form.mentor_id) {
        // Fetch the newly created class ID (assuming addClass returns the created class)
        const newClass = await getAll('classes').then(clsList => clsList.find(c => c.label === `${form.branch} ${form.year} - Sec ${form.section.toUpperCase()}`));
        if (newClass) {
          await updateMentorClassAssignments(form.mentor_id, newClass.id, 'add');
        }
      }
      toast.success('Class created!');
      setForm({ branch: 'CSE', year: new Date().getFullYear(), section: 'A', mentor_id: '', advisor_id: '' });
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
              <select className="form-control" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
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
                <label className="form-label">Filter Teachers by Department</label>
                <select className="form-control" style={{ marginBottom: 12 }} value={createDeptFilter} onChange={(e) => setCreateDeptFilter(e.target.value)}>
                  <option value="">All Departments</option>
                  {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>

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
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={creating}>
              {creating ? 'Creating...' : 'Create Class'}
            </button>
          </form>
        </div>

        {/* Class List */}
        <div className="card" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <h3 className="mb-16"><MdSchool style={{ verticalAlign: 'middle' }} /> All Classes ({classes.length})</h3>
          {classes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><MdSchool /></div>
              <p>No classes created yet. Create your first class section above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classes.map((cls) => (
                <div key={cls.id} style={{
                  padding: '14px 16px',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  {/* Color dot by branch */}
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.76rem', flexShrink: 0,
                  }}>{cls.branch}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-semibold" style={{ fontSize: '0.92rem' }}>{cls.label}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span><MdPeople style={{ verticalAlign: 'middle', marginRight: 3 }} />{studentCounts[cls.id] ?? '…'} students</span>
                      <span>Mentor: {mentorName(cls.mentor_id)}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                      ID: {cls.id}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
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
              ))}
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
               <label className="form-label">Filter Teachers by Department</label>
               <select
                 className="form-control"
                 style={{ marginBottom: 12 }}
                 value={editDeptFilter}
                 onChange={(e) => setEditDeptFilter(e.target.value)}
               >
                 <option value="">All Departments</option>
                 {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
               </select>

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
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Assign Teachers (optional)</label>
              <div className="flex flex-col max-h-48 overflow-y-auto">
                {teachers.filter((t) => t.role === 'teacher').map((t) => (
                  <label key={t.id} className="inline-flex items-center mb-1">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={editTeacherIds.includes(t.id)}
                      onChange={(e) => {
                        const newIds = e.target.checked
                          ? [...editTeacherIds, t.id]
                          : editTeacherIds.filter((id) => id !== t.id);
                        setEditTeacherIds(newIds);
                      }}
                    />
                    <span className="ml-2">{t.name} ({t.usn})</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-sm btn-ghost" onClick={closeEdit}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
      {/* End Edit Modal */}

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
