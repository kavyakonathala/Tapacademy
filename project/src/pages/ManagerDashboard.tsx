import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Attendance, User } from '../lib/supabase';
import { Users, Clock, TrendingUp, LogOut, Download, Calendar } from 'lucide-react';

type ManagerStats = {
  totalEmployees: number;
  todayPresent: number;
  todayAbsent: number;
  todayLate: number;
  absentEmployeesToday: User[];
  weeklyAttendance: { day: string; present: number; absent: number }[];
  departmentStats: { department: string; present: number; total: number }[];
};

type AttendanceWithUser = Attendance & {
  users: User;
};

export default function ManagerDashboard() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [allAttendance, setAllAttendance] = useState<AttendanceWithUser[]>([]);
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [employees, setEmployees] = useState<User[]>([]);

  useEffect(() => {
    loadManagerData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filterEmployee, filterDate, filterStatus, allAttendance]);

  const loadManagerData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weekAgoDate = oneWeekAgo.toISOString().split('T')[0];

      const { data: allEmployees } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'employee');

      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('*, users(*)')
        .eq('date', today);

      const { data: weeklyData } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', weekAgoDate)
        .order('date', { ascending: true });

      const { data: allAttendanceData } = await supabase
        .from('attendance')
        .select('*, users(*)')
        .order('date', { ascending: false })
        .limit(100);

      const totalEmployees = allEmployees?.length || 0;
      const todayPresent = todayAttendance?.filter((a) => a.status === 'present').length || 0;
      const todayLate = todayAttendance?.filter((a) => a.status === 'late').length || 0;
      const todayAbsent = totalEmployees - todayPresent - todayLate;

      const todayAttendanceIds = new Set(todayAttendance?.map((a) => a.user_id));
      const absentEmployeesToday = allEmployees?.filter((emp) => !todayAttendanceIds.has(emp.id)) || [];

      const weeklyMap = new Map<string, { present: number; absent: number }>();
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push(dateStr);
        weeklyMap.set(dateStr, { present: 0, absent: 0 });
      }

      weeklyData?.forEach((att) => {
        const stats = weeklyMap.get(att.date);
        if (stats) {
          if (att.status === 'present' || att.status === 'late') {
            stats.present++;
          } else {
            stats.absent++;
          }
        }
      });

      const weeklyAttendance = last7Days.map((date) => {
        const stats = weeklyMap.get(date) || { present: 0, absent: 0 };
        return {
          day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          present: stats.present,
          absent: stats.absent,
        };
      });

      const deptMap = new Map<string, { present: number; total: number }>();
      allEmployees?.forEach((emp) => {
        if (!deptMap.has(emp.department)) {
          deptMap.set(emp.department, { present: 0, total: 0 });
        }
        const stats = deptMap.get(emp.department)!;
        stats.total++;

        const empAttendance = todayAttendance?.find((a) => a.user_id === emp.id);
        if (empAttendance && (empAttendance.status === 'present' || empAttendance.status === 'late')) {
          stats.present++;
        }
      });

      const departmentStats = Array.from(deptMap.entries()).map(([department, stats]) => ({
        department,
        present: stats.present,
        total: stats.total,
      }));

      setStats({
        totalEmployees,
        todayPresent,
        todayAbsent,
        todayLate,
        absentEmployeesToday,
        weeklyAttendance,
        departmentStats,
      });

      setEmployees(allEmployees || []);
      setAllAttendance(allAttendanceData as AttendanceWithUser[] || []);
      setFilteredAttendance(allAttendanceData as AttendanceWithUser[] || []);
    } catch (error) {
      console.error('Error loading manager data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allAttendance];

    if (filterEmployee) {
      filtered = filtered.filter((att) => att.user_id === filterEmployee);
    }

    if (filterDate) {
      filtered = filtered.filter((att) => att.date === filterDate);
    }

    if (filterStatus) {
      filtered = filtered.filter((att) => att.status === filterStatus);
    }

    setFilteredAttendance(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Employee ID', 'Employee Name', 'Department', 'Check In', 'Check Out', 'Hours', 'Status'];
    const rows = filteredAttendance.map((att) => [
      att.date,
      att.users.employee_id,
      att.users.name,
      att.users.department,
      new Date(att.check_in_time).toLocaleString(),
      att.check_out_time ? new Date(att.check_out_time).toLocaleString() : '-',
      att.total_hours || '-',
      att.status,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
                <div className="text-xs text-gray-500">Manager</div>
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Manager Dashboard</h2>
          <p className="text-gray-600">Monitor team attendance and performance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Employees</p>
                <p className="text-3xl font-bold text-gray-800">{stats?.totalEmployees}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Present Today</p>
                <p className="text-3xl font-bold text-green-600">{stats?.todayPresent}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Absent Today</p>
                <p className="text-3xl font-bold text-red-600">{stats?.todayAbsent}</p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <Users className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Late Today</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.todayLate}</p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-800">Weekly Attendance Trend</h3>
            </div>
            <div className="space-y-3">
              {stats?.weeklyAttendance.map((day, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{day.day}</span>
                    <span className="text-gray-800 font-medium">
                      {day.present} present, {day.absent} absent
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${(day.present / (day.present + day.absent || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-800">Department-wise Attendance</h3>
            </div>
            <div className="space-y-3">
              {stats?.departmentStats.map((dept, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{dept.department}</span>
                    <span className="text-gray-800 font-medium">
                      {dept.present}/{dept.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${(dept.present / dept.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {stats?.absentEmployeesToday && stats.absentEmployeesToday.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Absent Today</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.absentEmployeesToday.map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                  <div className="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center">
                    <span className="text-red-700 font-semibold">{emp.name.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{emp.name}</div>
                    <div className="text-xs text-gray-600">{emp.employee_id}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">All Employee Attendance</h3>
            <button
              onClick={exportToCSV}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employee_id})
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="half-day">Half Day</option>
            </select>

            <button
              onClick={() => {
                setFilterEmployee('');
                setFilterDate('');
                setFilterStatus('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Employee</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Department</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Check In</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Check Out</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hours</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map((att) => (
                  <tr key={att.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-800">
                      {new Date(att.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div className="font-medium text-gray-800">{att.users.name}</div>
                      <div className="text-xs text-gray-500">{att.users.employee_id}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{att.users.department}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(att.check_in_time).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {att.check_out_time ? new Date(att.check_out_time).toLocaleTimeString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {att.total_hours ? `${att.total_hours}h` : '-'}
                    </td>
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
