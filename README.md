# Numi — AI-Powered Learning Platform

## 🚀 Quick Start

### 1. Start the Backend Server
```bash
cd numi-project/backend
npm install   # first time only
node server.js
```

### 2. Access the Platform
- **Student Platform:** http://localhost:5000
- **Admin Dashboard:** http://localhost:5000/admin.html
- **API:** http://localhost:5000/api

### 3. Default Demo Login
- **Phone:** 01012345678
- **Password:** 12345

---

## 📁 Project Structure

```
Numi/
├── admin.html                 # Admin CMS Dashboard
├── numi-project/
│   ├── index.html             # Student Platform (main)
│   ├── css/
│   │   └── style.css          # Premium Design System
│   ├── js/
│   │   ├── numi-app.js        # Main Application Logic
│   │   ├── auth.js            # (legacy) Auth module
│   │   ├── ui.js              # (legacy) UI module
│   │   ├── lessons.js         # (legacy) Lessons module
│   │   ├── games.js           # (legacy) Games module
│   │   └── storage.js         # (legacy) Storage helper
│   └── backend/
│       ├── server.js          # Express + MongoDB API + Static Server
│       ├── package.json       # Dependencies
│       └── .env               # Environment variables
```

## 🎯 Features

### Student Platform
- **Premium Dark Theme** — Glassmorphism, gradients, micro-animations
- **Dashboard** — Welcome banner, stats, continue learning, AI suggestions, daily goals
- **Sequential Lesson Flow** — Video → AI Explanation → MindScape → Practice → Game → Quiz
- **Step-by-Step Unlocking** — Each step unlocks the next one
- **Built-in Practice** — Interactive math questions with instant feedback
- **Numi AI Chat** — Floating assistant with math keyboard
- **Gamification** — XP points, streaks, 8 achievement badges
- **Progress Tracking** — Visual ring chart, unit breakdown
- **Achievements Page** — Badge collection with unlock status
- **Settings** — Profile info and preferences
- **Notifications** — Panel with alerts
- **Fully Responsive** — Works on mobile, tablet, desktop

### Admin Dashboard
- Manage Classes, Groups, Courses, Units, Lessons
- Content zones: Video, Podcast, MindScape, Game, Quiz
- Student management with activation/deactivation
- Statistics overview

### Backend
- Node.js + Express
- MongoDB Atlas
- RESTful API
- Role-based access (student/admin)
- Progress tracking with XP rewards

## 🛠 Tech Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Node.js, Express
- **Database:** MongoDB Atlas
- **Fonts:** Google Fonts (Cairo)
- **Icons:** Font Awesome 6.5
