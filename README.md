**Employee Attendance System**

A full-stack attendance tracking system with two roles:

Employee – Mark attendance, view history & stats

Manager – View team attendance, filter, export reports, view summary dashboards

Tech Stack:

Frontend: React + Vite + Redux Toolkit / Zustand

Backend: Node.js + Express

Database: MongoDB (Mongoose)

📦 Project Structure
attendance_system/
  frontend/     → React/Vite client
  backend/      → Express API + MongoDB
  README.md

🛠 Setup Instructions
1. Prerequisites

Make sure the following are installed:

Node.js v18+

npm or yarn

MongoDB (local or Atlas cloud instance)

⚙️ Environment Variables
Frontend (/frontend/.env)

Copy .env.example → .env

VITE_API_URL=http://localhost:5000/api

Backend (/backend/.env)

Copy .env.example → .env

PORT=5000
MONGO_URI=mongodb://localhost:27017/attendance
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

▶️ How to Run
Backend
cd backend
npm install
cp .env.example .env   # edit values
npm run dev            # start development server


Backend runs at:

http://localhost:5000/api


(Optional) Seed sample users + attendance:

node seed.js

Frontend
cd frontend
npm install
cp .env.example .env
npm run start


App runs at:

http://localhost:5173
