import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerDashboard from './pages/ManagerDashboard';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (user.role === 'manager') {
    return <ManagerDashboard />;
  }

  return <EmployeeDashboard />;
}

export default App;
