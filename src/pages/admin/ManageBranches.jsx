import React, { useEffect, useState } from 'react';
import './ManageBranches.css';
import Layout from '../../components/Layout';
import { getAll, addDocumentWithId, updateDocument, deleteDocument } from '../../appwrite/database';
import { toast } from 'react-hot-toast';
import { MdAdd, MdDelete, MdEdit, MdSettings, MdPerson, MdClose, MdToggleOff, MdToggleOn, MdViewModule, MdViewList } from 'react-icons/md';

export default function ManageBranches() {
  const [branches, setBranches] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newBranch, setNewBranch] = useState({ code: '', name: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [compactView, setCompactView] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [branchesData, adminsData] = await Promise.all([
        getAll('branches'),
        getAll('admins'),
      ]);
      setBranches(branchesData);
      setAdmins(adminsData);
    } catch (err) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newBranch.code || !newBranch.name) {
      return toast.error('Please fill in all fields');
    }
    const cleanCode = newBranch.code.toUpperCase().trim();
    if (branches.some(b => b.code === cleanCode || b.id === cleanCode)) {
      return toast.error('Branch code already exists');
    }

    setLoading(true);
    try {
      await addDocumentWithId('branches', cleanCode, {
        code: cleanCode,
        name: newBranch.name.trim(),
        maintenance_mode: false,
        maintenance_students: false,
        maintenance_teachers: false,
        maintenance_message: '',
        maintenance_eta: '',
        createdAt: new Date().toISOString()
      });
      toast.success('Branch created successfully!');
      setNewBranch({ code: '', name: '' });
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to create branch');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (branch) => {
    setEditing({ ...branch });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editing.name.trim()) return toast.error('Branch name is required');
    setLoading(true);
    try {
      await updateDocument('branches', editing.id, {
        name: editing.name.trim(),
        maintenance_message: editing.maintenance_message || '',
        maintenance_eta: editing.maintenance_eta || ''
      });
      toast.success('Branch updated successfully!');
      setEditing(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to update branch');
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenanceStudents = async (branch) => {
    try {
      const nextStatus = !branch.maintenance_students;
      const teachersAlso = !!branch.maintenance_teachers;
      await updateDocument('branches', branch.id, {
        maintenance_students: nextStatus,
        maintenance_mode: nextStatus || teachersAlso,
        maintenance_message: (nextStatus || teachersAlso) ? (branch.maintenance_message || 'Scheduled system upgrades are currently in progress.') : ''
      });
      toast.success(`Student access ${nextStatus ? 'blocked' : 'restored'} for ${branch.code}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to toggle student maintenance');
    }
  };

  const toggleMaintenanceTeachers = async (branch) => {
    try {
      const nextStatus = !branch.maintenance_teachers;
      const studentsAlso = !!branch.maintenance_students;
      await updateDocument('branches', branch.id, {
        maintenance_teachers: nextStatus,
        maintenance_mode: nextStatus || studentsAlso,
        maintenance_message: (nextStatus || studentsAlso) ? (branch.maintenance_message || 'Scheduled system upgrades are currently in progress.') : ''
      });
      toast.success(`Teacher access ${nextStatus ? 'blocked' : 'restored'} for ${branch.code}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to toggle teacher maintenance');
    }
  };

  const handleDelete = async (branchId) => {
    if (!window.confirm(`Are you sure you want to delete branch ${branchId}? All linked data might become orphaned.`)) return;
    setLoading(true);
    try {
      await deleteDocument('branches', branchId);
      // Remove this branch assignment from any admins
      const linkedAdmins = admins.filter(a => a.branch_id === branchId);
      for (const admin of linkedAdmins) {
        await updateDocument('admins', admin.id, { branch_id: '' });
      }
      toast.success('Branch deleted successfully');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete branch');
    } finally {
      setLoading(false);
    }
  };

  const assignAdmin = async (branchCode, adminId) => {
    setLoading(true);
    try {
      // First, clear any previous admin of this branch
      const currentBranchAdmin = admins.find(a => a.branch_id === branchCode);
      if (currentBranchAdmin) {
        await updateDocument('admins', currentBranchAdmin.id, { branch_id: '' });
      }
      // Set new admin
      if (adminId) {
        await updateDocument('admins', adminId, { branch_id: branchCode });
      }
      toast.success('Branch admin assigned successfully');
      fetchData();
    } catch (err) {
      toast.error('Failed to assign branch admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout pageTitle="Manage Branches">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Manage Branches</h1>
          <p className="page-subtitle">Configure college branches, departments, and system statuses</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <MdAdd style={{ marginRight: 8, fontSize: '1.2rem' }} /> Add Branch
        </button>
      <button className="btn btn-ghost" onClick={() => setCompactView(v => !v)} title="Toggle compact view">
        {compactView ? 'Standard View' : 'Compact View'}
      </button>
      </div>

      <div className={`branches-grid-2 ${compactView ? 'compact' : ''}`}>
        {branches.map((b) => {
          const assignedAdmin = admins.find(a => a.branch_id === b.code);
          const isEditing = editing && editing.id === b.id;

          return (
            <div key={b.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: (b.maintenance_students || b.maintenance_teachers) ? '1px solid var(--danger)' : '1px solid var(--border)' }}>
              {isEditing ? (
                <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Branch Code</label>
                    <input className="form-control" value={editing.code} disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Branch Name</label>
                    <input className="form-control" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Maintenance Msg</label>
                    <input className="form-control" value={editing.maintenance_message || ''} onChange={(e) => setEditing({ ...editing, maintenance_message: e.target.value })} placeholder="Custom message shown to users..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ETA Date/Time</label>
                    <input className="form-control" value={editing.maintenance_eta || ''} onChange={(e) => setEditing({ ...editing, maintenance_eta: e.target.value })} placeholder="e.g. 2 Hours, Tomorrow Morning" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="submit" className="btn btn-sm btn-primary" disabled={loading}>Save</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <span className="badge badge-primary" style={{ fontSize: '0.8rem', padding: '4px 8px', marginBottom: 4, display: 'inline-block' }}>{b.code}</span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</h3>
                    </div>
                  </div>

                  {/* Separate maintenance toggles */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button 
                      onClick={() => toggleMaintenanceStudents(b)}
                      style={{ 
                        flex: 1,
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        gap: 6,
                        background: b.maintenance_students ? 'rgba(220,53,69,0.08)' : 'var(--surface-2)', 
                        border: `1px solid ${b.maintenance_students ? 'var(--danger)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)',
                        padding: '8px 10px', 
                        cursor: 'pointer', 
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: b.maintenance_students ? 'var(--danger)' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease'
                      }}
                      title={b.maintenance_students ? "Restore student access" : "Block student access"}
                    >
                      <span>🎓 Students</span>
                      {b.maintenance_students ? <MdToggleOn style={{ fontSize: '1.5rem', color: 'var(--danger)' }} /> : <MdToggleOff style={{ fontSize: '1.5rem' }} />}
                    </button>
                    <button 
                      onClick={() => toggleMaintenanceTeachers(b)}
                      style={{ 
                        flex: 1,
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        gap: 6,
                        background: b.maintenance_teachers ? 'rgba(220,53,69,0.08)' : 'var(--surface-2)', 
                        border: `1px solid ${b.maintenance_teachers ? 'var(--danger)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)',
                        padding: '8px 10px', 
                        cursor: 'pointer', 
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: b.maintenance_teachers ? 'var(--danger)' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease'
                      }}
                      title={b.maintenance_teachers ? "Restore teacher access" : "Block teacher access"}
                    >
                      <span>👨‍🏫 Teachers</span>
                      {b.maintenance_teachers ? <MdToggleOn style={{ fontSize: '1.5rem', color: 'var(--danger)' }} /> : <MdToggleOff style={{ fontSize: '1.5rem' }} />}
                    </button>
                  </div>

                  <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--text-secondary)' }}>
                      <MdPerson style={{ fontSize: '1.1rem' }} /> <strong>Branch Admin:</strong>
                    </div>
                    <select 
                      className="form-control" 
                      style={{ padding: '4px 8px', height: 'auto', fontSize: '0.85rem' }}
                      value={assignedAdmin?.id || ''}
                      onChange={(e) => assignAdmin(b.code, e.target.value)}
                    >
                      <option value="">— Unassigned —</option>
                      {admins.filter(a => !a.is_super_admin).map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                      ))}
                    </select>
                  </div>

                  {(b.maintenance_students || b.maintenance_teachers) && (
                    <div style={{ borderLeft: '3px solid var(--danger)', paddingLeft: 10, marginBottom: 16, fontSize: '0.82rem', color: 'var(--danger)' }}>
                      <strong>⚠️ Maintenance Active</strong>
                      <div style={{ opacity: 0.9, marginTop: 2 }}>
                        {b.maintenance_students && b.maintenance_teachers 
                          ? 'All students & teachers blocked'
                          : b.maintenance_students 
                            ? 'All students blocked' 
                            : 'All teachers blocked'}
                      </div>
                      {b.maintenance_message && <div style={{ opacity: 0.8, marginTop: 2 }}>{b.maintenance_message}</div>}
                      {b.maintenance_eta && <div style={{ opacity: 0.8, fontSize: '0.75rem', marginTop: 2 }}>ETA: {b.maintenance_eta}</div>}
                    </div>
                  )}
                </div>
              )}

              {!isEditing && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => startEdit(b)}><MdEdit /> Edit</button>
                  <button className="btn btn-sm btn-danger" style={{ background: 'transparent', color: 'var(--danger)' }} onClick={() => handleDelete(b.id)}><MdDelete /> Delete</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 450, padding: 24, animation: 'slideUp 0.3s ease-out' }}>
            <div className="flex-between mb-20">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}><MdAdd /> Create New Branch</h3>
              <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setShowCreateModal(false)}><MdClose style={{ fontSize: '1.3rem' }} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Branch Code *</label>
                <input className="form-control" placeholder="e.g. CSE, AIML, ECE" value={newBranch.code} onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Branch Name *</label>
                <input className="form-control" placeholder="e.g. Computer Science & Engineering" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} required />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: 12 }}>
                {loading ? 'Creating...' : 'Create Branch'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
