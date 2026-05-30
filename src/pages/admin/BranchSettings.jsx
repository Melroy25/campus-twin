import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { getAll, updateDocument, listenComplaints } from '../../appwrite/database';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { MdSettings, MdToggleOff, MdToggleOn, MdPeople, MdSchool, MdInbox, MdWarning, MdChatBubbleOutline, MdOutlineAnalytics } from 'react-icons/md';

export default function BranchSettings() {
  const { userProfile } = useAuth();
  const [branch, setBranch] = useState(null);
  const [stats, setStats] = useState({ students: 0, teachers: 0, classes: 0, complaints: 0 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [eta, setEta] = useState('');

  const fetchData = async () => {
    if (!userProfile?.branch_id) return;
    setLoading(true);
    try {
      const [branchesAll, students, teachers, classes, complaints] = await Promise.all([
        getAll('branches'),
        getAll('students'),
        getAll('teachers'),
        getAll('classes'),
        getAll('complaints'),
      ]);

      const myBranch = branchesAll.find((b) => b.code === userProfile.branch_id);
      setBranch(myBranch);
      if (myBranch) {
        setMessage(myBranch.maintenance_message || '');
        setEta(myBranch.maintenance_eta || '');
      }

      // Filter statistics by this branch ID
      const myStudents = students.filter(s => s.branch_id === userProfile.branch_id);
      // Teachers don't always have one branch assigned but might be linked via department code
      const myTeachers = teachers.filter(t => t.branch_id === userProfile.branch_id || t.department === userProfile.branch_id);
      // Classes linked to this branch
      const myClasses = classes.filter(c => c.branch === userProfile.branch_id || c.class_id?.startsWith(userProfile.branch_id));
      // Complaints from students/teachers of this branch
      const myComplaints = complaints.filter(c => c.branch_id === userProfile.branch_id || c.category === userProfile.branch_id);

      setStats({
        students: myStudents.length,
        teachers: myTeachers.length,
        classes: myClasses.length,
        complaints: myComplaints.length,
      });

    } catch (err) {
      console.error(err);
      toast.error('Failed to load branch settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userProfile]);

  const handleUpdateMaintenance = async (e) => {
    e.preventDefault();
    if (!branch) return;
    setLoading(true);
    try {
      await updateDocument('branches', branch.id, {
        maintenance_message: message.trim(),
        maintenance_eta: eta.trim(),
      });
      toast.success('Maintenance settings updated!');
      fetchData();
    } catch (err) {
      toast.error('Failed to update maintenance settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenanceStudents = async () => {
    if (!branch) return;
    setLoading(true);
    try {
      const nextStatus = !branch.maintenance_students;
      const teachersAlso = !!branch.maintenance_teachers;
      await updateDocument('branches', branch.id, {
        maintenance_students: nextStatus,
        // Keep legacy maintenance_mode in sync: true if either is on
        maintenance_mode: nextStatus || teachersAlso,
        maintenance_message: (nextStatus || teachersAlso) ? (message.trim() || 'System upgrades in progress.') : '',
        maintenance_eta: (nextStatus || teachersAlso) ? eta.trim() : ''
      });
      toast.success(`Student access ${nextStatus ? 'blocked' : 'restored'} for ${branch.code}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to toggle student maintenance');
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenanceTeachers = async () => {
    if (!branch) return;
    setLoading(true);
    try {
      const nextStatus = !branch.maintenance_teachers;
      const studentsAlso = !!branch.maintenance_students;
      await updateDocument('branches', branch.id, {
        maintenance_teachers: nextStatus,
        // Keep legacy maintenance_mode in sync: true if either is on
        maintenance_mode: nextStatus || studentsAlso,
        maintenance_message: (nextStatus || studentsAlso) ? (message.trim() || 'System upgrades in progress.') : '',
        maintenance_eta: (nextStatus || studentsAlso) ? eta.trim() : ''
      });
      toast.success(`Teacher access ${nextStatus ? 'blocked' : 'restored'} for ${branch.code}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to toggle teacher maintenance');
    } finally {
      setLoading(false);
    }
  };

  const isAnyMaintenance = branch?.maintenance_students || branch?.maintenance_teachers;

  if (!userProfile?.branch_id) {
    return (
      <Layout pageTitle="Branch Settings">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>⚠️ Unauthorized</h3>
          <p style={{ marginTop: 8 }}>Only Branch Administrators assigned to a specific branch can access this page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle="Branch Settings">
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">{branch ? `${branch.name} Settings` : 'Branch Settings'}</h1>
        <p className="page-subtitle">Configure branch maintenance mode and view branch insights</p>
      </div>

      {branch && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Maintenance Settings */}
          <div className="card card-lg" style={{ border: isAnyMaintenance ? '1px solid var(--danger)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdSettings /> Maintenance Mode
              </h3>
              {isAnyMaintenance && (
                <span style={{
                  background: 'rgba(220,53,69,0.1)',
                  color: 'var(--danger)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  textTransform: 'uppercase'
                }}>
                  Active
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Block access for specific user types. Students and/or teachers of your branch will see a maintenance page.
            </p>

            {/* Toggle: All Students */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              borderRadius: 'var(--radius)',
              border: `1px solid ${branch.maintenance_students ? 'var(--danger)' : 'var(--border)'}`,
              background: branch.maintenance_students ? 'rgba(220,53,69,0.05)' : 'var(--surface-2)',
              marginBottom: 12,
              transition: 'all 0.2s ease'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🎓 All Students
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {branch.maintenance_students ? 'Students are blocked from accessing the platform' : 'Students can access the platform normally'}
                </div>
              </div>
              <button
                onClick={toggleMaintenanceStudents}
                disabled={loading}
                style={{ background: 'transparent', border: 'none', cursor: loading ? 'wait' : 'pointer', fontSize: '2.4rem', color: branch.maintenance_students ? 'var(--danger)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                title={branch.maintenance_students ? "Restore student access" : "Block student access"}
              >
                {branch.maintenance_students ? <MdToggleOn style={{ color: 'var(--danger)' }} /> : <MdToggleOff />}
              </button>
            </div>

            {/* Toggle: All Teachers */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              borderRadius: 'var(--radius)',
              border: `1px solid ${branch.maintenance_teachers ? 'var(--danger)' : 'var(--border)'}`,
              background: branch.maintenance_teachers ? 'rgba(220,53,69,0.05)' : 'var(--surface-2)',
              marginBottom: 20,
              transition: 'all 0.2s ease'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  👨‍🏫 All Teachers
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {branch.maintenance_teachers ? 'Teachers are blocked from accessing the platform' : 'Teachers can access the platform normally'}
                </div>
              </div>
              <button
                onClick={toggleMaintenanceTeachers}
                disabled={loading}
                style={{ background: 'transparent', border: 'none', cursor: loading ? 'wait' : 'pointer', fontSize: '2.4rem', color: branch.maintenance_teachers ? 'var(--danger)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                title={branch.maintenance_teachers ? "Restore teacher access" : "Block teacher access"}
              >
                {branch.maintenance_teachers ? <MdToggleOn style={{ color: 'var(--danger)' }} /> : <MdToggleOff />}
              </button>
            </div>

            <form onSubmit={handleUpdateMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Custom Maintenance Message</label>
                <textarea 
                  className="form-control" 
                  style={{ height: 100, resize: 'none' }}
                  placeholder="e.g. Scheduled database migrations are currently being run."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!isAnyMaintenance}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Estimated Completion / ETA</label>
                <input 
                  className="form-control" 
                  placeholder="e.g. 2 Hours, 6:00 PM today"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                  disabled={!isAnyMaintenance}
                />
              </div>

              {isAnyMaintenance && (
                <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                  {loading ? 'Saving...' : 'Update Maintenance Details'}
                </button>
              )}
            </form>
          </div>

          {/* Analytics & Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdOutlineAnalytics style={{ fontSize: '1.25rem' }} /> Branch Overview
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🎓</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{stats.students}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Students</div>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🏫</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{stats.classes}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Class Sections</div>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>👨‍🏫</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{stats.teachers}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Teachers</div>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📬</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{stats.complaints}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Complaints</div>
                </div>
              </div>
            </div>

            {isAnyMaintenance && (
              <div className="card" style={{ background: 'rgba(220,53,69,0.1)', border: '1px solid rgba(220,53,69,0.2)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <MdWarning style={{ color: 'var(--danger)', fontSize: '1.6rem', flexShrink: 0 }} />
                <div>
                  <h4 style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.92rem', marginBottom: 4 }}>Maintenance Mode Active</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                    {branch.maintenance_students && branch.maintenance_teachers
                      ? <>Both <strong>students</strong> and <strong>teachers</strong> of the <strong>{branch.code}</strong> department are blocked from accessing the platform.</>
                      : branch.maintenance_students
                        ? <>All <strong>students</strong> of the <strong>{branch.code}</strong> department are blocked. Teachers can still access the platform.</>
                        : <>All <strong>teachers</strong> of the <strong>{branch.code}</strong> department are blocked. Students can still access the platform.</>
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
