import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { listenEvents, getAttendanceByStudent, getAttendanceSummary, getAICTEByStudent } from '../../appwrite/database';
import { supabase } from '../../supabase/config';
import { MdCheckCircle, MdStar, MdEvent, MdPerson, MdDelete, MdAdd, MdCalendarToday, MdCheckBox, MdCheckBoxOutlineBlank } from 'react-icons/md';
import { toast } from 'react-hot-toast';

export default function StudentHome() {
  const { userProfile, currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [aicteTotal, setAicteTotal] = useState(0);
  
  // To-Do list states
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [todoLoading, setTodoLoading] = useState(false);

  useEffect(() => {
    const unsub = listenEvents(setEvents);
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    getAttendanceByStudent(currentUser.uid).then((records) => {
      setAttendance(getAttendanceSummary(records));
    });
    getAICTEByStudent(currentUser.uid).then((items) => {
      const total = items
        .filter((i) => i.status === 'approved')
        .reduce((sum, i) => sum + (Number(i.points) || 0), 0);
      setAicteTotal(Math.min(total, 25));
    });
    
    // Fetch SQL Todos
    fetchTodos();
  }, [currentUser]);

  const checkDeadlines = (todoList) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const activeTodos = todoList.filter(t => !t.is_completed);
    
    const overdueCount = activeTodos.filter(t => t.due_date && t.due_date < todayStr).length;
    const dueTodayCount = activeTodos.filter(t => t.due_date === todayStr).length;
    
    if (dueTodayCount > 0 || overdueCount > 0) {
      let message = 'Reminder: ';
      if (dueTodayCount > 0 && overdueCount > 0) {
        message += `You have ${dueTodayCount} task(s) due today and ${overdueCount} overdue!`;
      } else if (dueTodayCount > 0) {
        message += `You have ${dueTodayCount} task(s) due today!`;
      } else {
        message += `You have ${overdueCount} overdue task(s)!`;
      }
      
      toast(message, {
        icon: '⏰',
        duration: 5000,
        id: 'todo-deadline-alert',
        style: {
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }
      });
    }
  };

  const fetchTodos = async () => {
    if (!currentUser?.uid) return;
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('student_id', currentUser.uid)
      .order('is_completed', { ascending: true })
      .order('due_date', { ascending: true });
    
    if (error) {
      console.error('Error fetching todos:', error);
    } else {
      const list = data || [];
      setTodos(list);
      checkDeadlines(list);
    }
  };

  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setTodoLoading(true);

    try {
      const { data, error } = await supabase
        .from('todos')
        .insert([{
          student_id: currentUser.uid,
          title: newTodo.trim(),
          due_date: dueDate || null,
          is_completed: false
        }])
        .select();

      if (error) throw error;
      
      toast.success('Task added!');
      setNewTodo('');
      setDueDate('');
      fetchTodos();
    } catch (err) {
      toast.error('Failed to add task: ' + err.message);
    } finally {
      setTodoLoading(false);
    }
  };

  const handleToggleTodo = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ is_completed: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchTodos();
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTodo = async (id) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Task deleted');
      fetchTodos();
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  const avgAttendance = attendance.length
    ? Math.round(attendance.reduce((s, a) => s + a.percentage, 0) / attendance.length)
    : null;

  const formatDate = (val) => {
    if (!val) return '';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTodoDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (dateStr, isCompleted) => {
    if (!dateStr || isCompleted) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dateStr) < today;
  };

  return (
    <Layout pageTitle="Home">
      <div>
        {/* Greeting */}
        <div className="mb-24">
          <h1 className="page-title">👋 Hello, {userProfile?.name?.split(' ')[0] || 'Student'}!</h1>
          <p className="page-subtitle">Here's what's happening at your campus today.</p>
        </div>

        {/* Stat Cards */}
        <div className="stat-grid mb-24">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <MdCheckCircle />
            </div>
            <div className="stat-value">
              {avgAttendance !== null ? `${avgAttendance}%` : '—'}
            </div>
            <div className="stat-label">Avg. Attendance</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--warning-light)', color: '#856404' }}>
              <MdStar />
            </div>
            <div className="stat-value">{aicteTotal}/25</div>
            <div className="stat-label">AICTE Points</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <MdPerson />
            </div>
            <div className="stat-value">{userProfile?.class_id || '—'}</div>
            <div className="stat-label">Class</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
              <MdEvent />
            </div>
            <div className="stat-value">{events.length}</div>
            <div className="stat-label">Upcoming Events</div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid-2 mb-24" style={{ alignItems: 'start', gap: 24 }}>
          {/* Left Column: Events / Announcements */}
          <div className="card">
            <div className="flex-between mb-16">
              <h3>📢 Announcements & Events</h3>
              <a href="/student/events" style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 500 }}>
                View all →
              </a>
            </div>

            {events.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <p>No upcoming events posted yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {events.slice(0, 5).map((ev) => (
                  <div key={ev.id} style={{
                    display: 'flex', gap: 16, alignItems: 'flex-start',
                    padding: '12px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 'var(--radius-sm)',
                      background: 'var(--primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem', flexShrink: 0,
                    }}>
                      {ev.image ? <img src={ev.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : '🎉'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ev.title}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(ev.date)}</span>
                      </div>
                      <p style={{ fontSize: '0.82rem' }}>{ev.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: To-Do list */}
          <div className="card">
            <div className="flex-between mb-16">
              <h3>📋 Personal Tasks & Reminders</h3>
              <span className="badge badge-primary">{todos.filter(t => !t.is_completed).length} active</span>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleAddTodo} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input 
                className="form-control"
                style={{ flex: 3 }}
                placeholder="New task..."
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
              />
              <input 
                type="date"
                className="form-control"
                style={{ flex: 2, minWidth: 110 }}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <button 
                type="submit" 
                className="btn btn-primary btn-sm"
                disabled={todoLoading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 42 }}
              >
                <MdAdd size={20} />
              </button>
            </form>

            {/* Tasks List */}
            {todos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <p>No tasks yet. Add one above!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                {todos.map((todo) => {
                  const overdue = isOverdue(todo.due_date, todo.is_completed);
                  return (
                    <div 
                      key={todo.id} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        background: todo.is_completed ? 'var(--surface-2)' : 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'opacity 0.2s',
                        opacity: todo.is_completed ? 0.6 : 1
                      }}
                    >
                      <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: todo.is_completed ? 'var(--success)' : 'var(--text-muted)' }}
                        onClick={() => handleToggleTodo(todo.id, todo.is_completed)}
                      >
                        {todo.is_completed ? <MdCheckBox size={20} /> : <MdCheckBoxOutlineBlank size={20} />}
                      </button>
                      <div style={{ flex: 1 }}>
                        <span style={{ 
                          fontSize: '0.88rem', 
                          fontWeight: 500,
                          textDecoration: todo.is_completed ? 'line-through' : 'none',
                          color: todo.is_completed ? 'var(--text-muted)' : 'var(--text)'
                        }}>
                          {todo.title}
                        </span>
                        {todo.due_date && (
                          <div style={{ 
                            fontSize: '0.72rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            marginTop: 2,
                            color: overdue ? 'var(--danger)' : 'var(--text-muted)'
                          }}>
                            <MdCalendarToday size={12} />
                            <span>{formatTodoDate(todo.due_date)} {overdue && '(Overdue)'}</span>
                          </div>
                        )}
                      </div>
                      <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--danger)', opacity: 0.7 }}
                        onClick={() => handleDeleteTodo(todo.id)}
                      >
                        <MdDelete size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: userProfile?.isHostelite ? '1fr 1fr' : '1fr', gap: 16 }}>
          <div className="card" style={{ 
            background: 'linear-gradient(135deg, #1e212b 0%, #2a2d3a 100%)', 
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            cursor: 'pointer',
            border: 'none'
          }} onClick={() => window.location.href = '/student/complaints'}>
            <div style={{ 
              width: 50, height: 50, borderRadius: '12px', background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
            }}>🚨</div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, color: 'white', fontSize: '1rem' }}>Have an Issue?</h4>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Submit an anonymous complaint to Admin</p>
            </div>
            <div style={{ fontSize: '1.2rem', opacity: 0.5 }}>→</div>
          </div>

          {userProfile?.isHostelite && (
            <div className="card" style={{ 
              background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              cursor: 'pointer',
              border: 'none'
            }} onClick={() => window.open(import.meta.env.VITE_HOSTEL_APP_URL || 'https://hostel-management.netlify.app', '_blank')}>
              <div style={{ 
                width: 50, height: 50, borderRadius: '12px', background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
              }}>🏢</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, color: 'white', fontSize: '1rem' }}>Hostel Portal</h4>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Manage bookings, complaints & mess cards</p>
              </div>
              <div style={{ fontSize: '1.2rem', opacity: 0.5 }}>↗</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
