import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HostelPrivateRoute({ children, role }) {
  const { currentUser, userProfile } = useAuth();

  if (role === 'warden') {
    const wardenSession = localStorage.getItem('hostel_warden_session');
    if (!wardenSession) {
      return <Navigate to="/hostel/login" replace />;
    }
    return children;
  }

  // Student flow
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const isHostelite = !!userProfile?.isHostelite || !!userProfile?.is_hostelite;
  if (!isHostelite) {
    return <Navigate to="/hostel" replace />;
  }

  return children;
}
