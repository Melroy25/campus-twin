import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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

export default function HostelStudentPortal() {
  const { userProfile, currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard');

  const hostelType = searchParams.get('type') || 'boys'; // Default fallback

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
      {renderTabContent()}
    </HostelLayout>
  );
}
