import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'employee' | 'manager';
  employee_id: string;
  department: string;
  created_at: string;
};

export type Attendance = {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string;
  check_out_time: string | null;
  status: 'present' | 'absent' | 'late' | 'half-day';
  total_hours: number | null;
  created_at: string;
};
