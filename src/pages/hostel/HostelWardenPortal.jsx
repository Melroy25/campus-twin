import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

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

export default function HostelWardenPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [wardenSession, setWardenSession] = useState(null);

  useEffect(() => {
    const sessionStr = localStorage.getItem('hostel_warden_session');
    if (!sessionStr) {
      toast.error('Session expired or access unauthorized. Please log in.');
      navigate('/hostel/login');
      return;
    }
    try {
      const parsed = JSON.parse(sessionStr);
      setWardenSession(parsed);
    } catch (e) {
      toast.error('Failed to authenticate warden session.');
      navigate('/hostel/login');
    }
  }, [navigate]);

  const handleTabNavigation = (tabName) => {
    setActiveTab(tabName);
  };

  if (!wardenSession) {
    return (
      <div className="loader-container" style={{ minHeight: '100vh' }}>
        <div className="loader" />
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Authenticating warden console...</p>
      </div>
    );
  }

  const hostelType = wardenSession.hostel_type || 'boys';

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <HostelDashboard hostelType={hostelType} role="warden" onNavigate={handleTabNavigation} />;
      case 'rooms':
        return <HostelRooms hostelType={hostelType} role="warden" />;
      case 'complaints':
        return <HostelComplaints hostelType={hostelType} role="warden" />;
      case 'leaves':
      case 'leave': // support alias
        return <HostelLeaves hostelType={hostelType} role="warden" />;
      case 'bills':
        return <HostelBills hostelType={hostelType} role="warden" />;
      case 'chat':
        return <HostelChat hostelType={hostelType} role="warden" />;
      case 'rules':
        return <HostelRules hostelType={hostelType} role="warden" />;
      case 'updates':
      case 'notices': // notices action redirects here
        return <HostelUpdates hostelType={hostelType} role="warden" />;
      default:
        return <HostelDashboard hostelType={hostelType} role="warden" onNavigate={handleTabNavigation} />;
    }
  };

  return (
    <HostelLayout
      activeTab={activeTab === 'leave' ? 'leaves' : activeTab === 'notices' ? 'updates' : activeTab}
      setActiveTab={setActiveTab}
      role="warden"
      hostelType={hostelType}
    >
      {renderTabContent()}
    </HostelLayout>
  );
}
