import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Attendance } from '../lib/supabase';
import { Clock, Calendar, TrendingUp, LogOut, CheckCircle, XCircle } from 'lucide-react';

type DashboardStats = {
  todayStatus: 'checked-in' | 'checked-out' | 'not-checked-in';
  todayAttendance: Attendance | null;
  monthlyPresent: number;
  monthlyAbsent: number;
  monthlyLate: number;
  totalHoursThisMonth: number;
  recentAttendance: (Attendance & { hours?: string })[];
};

export default function EmployeeDashboard() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const { data: todayData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      const { data: monthlyData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', firstDayOfMonth)
        .order('date', { ascending: false });

      const { data: recentData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(7);

      const monthlyPresent = monthlyData?.filter((a) => a.status === 'present').length || 0;
      const monthlyAbsent = monthlyData?.filter((a) => a.status === 'absent').length || 0;
      const monthlyLate = monthlyData?.filter((a) => a.status === 'late').length || 0;
      const totalHoursThisMonth = monthlyData?.reduce((sum, a) => sum + (a.total_hours || 0), 0) || 0;

      let todayStatus: 'checked-in' | 'checked-out' | 'not-checked-in' = 'not-checked-in';
      if (todayData) {
        todayStatus = todayData.check_out_time ? 'checked-out' : 'checked-in';
      }

      const recentWithHours = recentData?.map((att) => ({
        ...att,
        hours: att.total_hours ? `${att.total_hours.toFixed(2)}h` : '-',
      })) || [];

      setStats({
        todayStatus,
        todayAttendance: todayData,
        monthlyPresent,
        monthlyAbsent,
        monthlyLate,
        totalHoursThisMonth,
        recentAttendance: recentWithHours,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setActionLoading(true);

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const checkInTime = now.toISOString();

      const workStartTime = new Date(now);
      workStartTime.setHours(9, 0, 0, 0);
      const isLate = now > workStartTime;

      const { error } = await supabase.from('attendance').insert({
        user_id: user.id,
        date: today,
        check_in_time: checkInTime,
        status: isLate ? 'late' : 'present',
      });

      if (error) throw error;
      await loadDashboardData();
    } catch (error) {
      console.error('Error checking in:', error);
      alert('Failed to check in. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || !stats?.todayAttendance) return;
    setActionLoading(true);

    try {
      const now = new Date();
      const checkOutTime = now.toISOString();
      const checkInTime = new Date(stats.todayAttendance.check_in_time);
      const hoursWorked = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      const { error } = await supabase
        .from('attendance')
        .update({
          check_out_time: checkOutTime,
          total_hours: parseFloat(hoursWorked.toFixed(2)),
        })
        .eq('id', stats.todayAttendance.id);

      if (error) throw error;
      await loadDashboardData();
    } catch (error) {
      console.error('Error checking out:', error);
      alert('Failed to check out. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-800">Attendance System</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-800">{user?.name}</div>
                <div className="text-xs text-gray-500">{user?.employee_id}</div>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Employee Dashboard</h2>
          <p className="text-gray-600">Track your attendance and view your records</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Today's Status</h3>
              <p className="text-gray-600">
                {stats?.todayStatus === 'checked-in' && 'You are currently checked in'}
                {stats?.todayStatus === 'checked-out' && 'You have checked out for today'}
                {stats?.todayStatus === 'not-checked-in' && 'You have not checked in yet'}
              </p>
              {stats?.todayAttendance && (
                <div className="mt-2 text-sm text-gray-500">
                  Check-in: {new Date(stats.todayAttendance.check_in_time).toLocaleTimeString()}
                  {stats.todayAttendance.check_out_time && (
                    <> | Check-out: {new Date(stats.todayAttendance.check_out_time).toLocaleTimeString()}</>
                  )}
                </div>
              )}
            </div>
            <div>
              {stats?.todayStatus === 'not-checked-in' && (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-green-300 flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Check In
                </button>
              )}
              {stats?.todayStatus === 'checked-in' && (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:bg-red-300 flex items-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Check Out
                </button>
              )}
              {stats?.todayStatus === 'checked-out' && (
                <div className="text-green-600 font-semibold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Completed
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Present Days</p>
                <p className="text-3xl font-bold text-green-600">{stats?.monthlyPresent}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Absent Days</p>
                <p className="text-3xl font-bold text-red-600">{stats?.monthlyAbsent}</p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Late Days</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.monthlyLate}</p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Hours</p>
                <p className="text-3xl font-bold text-blue-600">{stats?.totalHoursThisMonth.toFixed(1)}h</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-800">Recent Attendance (Last 7 Days)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Check In</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Check Out</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hours</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentAttendance.map((att) => (
                  <tr key={att.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-800">
                      {new Date(att.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(att.check_in_time).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {att.check_out_time ? new Date(att.check_out_time).toLocaleTimeString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{att.hours}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                          att.status === 'present'
                            ? 'bg-green-100 text-green-700'
                            : att.status === 'late'
                            ? 'bg-orange-100 text-orange-700'
                            : att.status === 'absent'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {att.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
