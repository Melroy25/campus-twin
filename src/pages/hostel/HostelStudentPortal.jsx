import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { getById } from '../../appwrite/database';
import { MdWarning } from 'react-icons/md';

// Layout & Sub-pages
import HostelLayout from '../../components/hostel/HostelLayout';
import HostelDashboard from './HostelDashboard';
import HostelRooms from './HostelRooms';
import HostelComplaints from './HostelComplaints';
import HostelLeaves from './HostelLeaves';
import HostelBills from './HostelBills';
import HostelChat from './HostelChat';
import HostelRules from './HostelRules';
import HostelUpdates from './HostelUpdates';

export default function HostelStudentPortal() {
  const { userProfile, currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [hostelMaintenance, setHostelMaintenance] = useState(false);

  const hostelType = searchParams.get('type') || 'boys'; // Default fallback

  // Fetch hostel maintenance status
  useEffect(() => {
    const checkHostelMaintenance = async () => {
      try {
        const doc = await getById('hostelNotices', `hostel_settings_${hostelType}`);
        if (doc && doc.content) {
          const parsed = JSON.parse(doc.content);
          if (parsed && parsed.maintenance_mode) {
            setHostelMaintenance(true);
            if (!['chat', 'updates', 'rules'].includes(activeTab)) {
              setActiveTab('chat');
            }
          } else {
            setHostelMaintenance(false);
          }
        } else {
          setHostelMaintenance(false);
        }
      } catch (e) {
        console.warn("Failed to check hostel maintenance in portal:", e);
      }
    };
    checkHostelMaintenance();
  }, [hostelType, activeTab]);

  // Safety double-check gender & eligibility for students
  useEffect(() => {
    if (userProfile?.role === 'student') {
      const isHostelite = !!userProfile?.isHostelite || !!userProfile?.is_hostelite;
      if (!isHostelite) {
        toast.error('Hostel access is not enabled for your student account.');
        navigate('/');
        return;
      }

      const assignedType = userProfile?.hostel_type || '';
      if (assignedType && assignedType !== hostelType) {
        toast.error(`Redirected: You are assigned to the ${assignedType.toUpperCase()} hostel.`);
        navigate(`/hostel/student?type=${assignedType}`);
      }
    }
  }, [hostelType, userProfile, navigate]);

  const handleTabNavigation = (tabName) => {
    setActiveTab(tabName);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <HostelDashboard hostelType={hostelType} role="student" onNavigate={handleTabNavigation} />;
      case 'rooms':
        return <HostelRooms hostelType={hostelType} role="student" />;
      case 'complaints':
        return <HostelComplaints hostelType={hostelType} role="student" />;
      case 'leaves':
      case 'leave': // support alias
        return <HostelLeaves hostelType={hostelType} role="student" />;
      case 'bills':
        return <HostelBills hostelType={hostelType} role="student" />;
      case 'chat':
        return <HostelChat hostelType={hostelType} role="student" />;
      case 'rules':
        return <HostelRules hostelType={hostelType} role="student" />;
      case 'updates':
        return <HostelUpdates hostelType={hostelType} role="student" />;
      default:
        return <HostelDashboard hostelType={hostelType} role="student" onNavigate={handleTabNavigation} />;
    }
  };

  return (
    <HostelLayout
      activeTab={activeTab === 'leave' ? 'leaves' : activeTab}
      setActiveTab={setActiveTab}
      role="student"
      hostelType={hostelType}
    >
      {hostelMaintenance && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.15)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 16,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          color: '#d97706',
          boxShadow: 'var(--shadow-sm)',
          animation: 'fadeIn 0.5s ease-out',
        }}>
          <div style={{
            background: '#f59e0b',
            color: 'white',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            flexShrink: 0,
          }}>
            <MdWarning />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 2px 0', fontSize: '0.88rem', fontWeight: 700 }}>
              Hostel Portal Maintenance Active
            </h4>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#b45309', opacity: 0.95, lineHeight: 1.4 }}>
              The warden has enabled maintenance mode for this block. All services are temporarily locked except the **Hostel Chat**, **Hostel Updates**, and **Hostel Rules** tabs.
            </p>
          </div>
        </div>
      )}
      {renderTabContent()}
    </HostelLayout>
  );
}
