/*
  # Employee Attendance System Schema

  ## Tables Created
  
  ### 1. users
  Extended user profile information for employees and managers:
  - `id` (uuid, primary key) - Links to auth.users
  - `email` (text) - User email
  - `name` (text) - Full name
  - `role` (text) - Either 'employee' or 'manager'
  - `employee_id` (text, unique) - Employee identifier (e.g., EMP001)
  - `department` (text) - Department name
  - `created_at` (timestamptz) - Account creation timestamp
  
  ### 2. attendance
  Daily attendance records:
  - `id` (uuid, primary key) - Unique record identifier
  - `user_id` (uuid, foreign key) - References users table
  - `date` (date) - Attendance date
  - `check_in_time` (timestamptz) - Check-in timestamp
  - `check_out_time` (timestamptz) - Check-out timestamp (nullable)
  - `status` (text) - Attendance status: 'present', 'absent', 'late', 'half-day'
  - `total_hours` (numeric) - Total hours worked (nullable)
  - `created_at` (timestamptz) - Record creation timestamp
  
  ## Security
  
  ### Row Level Security (RLS)
  - All tables have RLS enabled
  - Users can only access their own data
  - Managers can view all attendance data
  - Employees can only view their own attendance
  
  ## Indexes
  - Index on user_id for fast user lookups
  - Index on date for date range queries
  - Composite index on user_id and date for efficient attendance queries
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('employee', 'manager')),
  employee_id text UNIQUE NOT NULL,
  department text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in_time timestamptz NOT NULL,
  check_out_time timestamptz,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half-day')),
  total_hours numeric(4, 2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Employees can read own attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'manager'
    )
  );

CREATE POLICY "Employees can insert own attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Employees can update own attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'manager'
    )
  );
