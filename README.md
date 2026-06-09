# Guardian AI Lite — Fall Detection & Alert System

A computer vision safety application designed to detect slip-and-fall incidents from CCTV footage. Built and shipped within a fast-paced **16-hour hackathon constraint**, this system processes video files to accurately evaluate pose estimation and trigger structural risk alerts.

---

## 🚀 Key Workflow

1. **Video Upload:** Users drop or select a video file (simulating a CCTV clip) into the web dashboard.
2. **Pose Tracking:** The system monitors key skeletal nodes frame-by-frame using advanced coordinate calculations.
3. **Fall Detection:** The pipeline analyzes rapid vertical displacement and posture orientation changes.
4. **Instant Alert:** When a fall is flagged, the app instantly updates the dashboard logs and triggers an emergency modal overlay.

---

## 🛠️ Tech Stack

* **Frontend:** React, Vite, Custom CSS (Minimalist Dark Theme)
* **ML Analytics & Logic:** TensorFlow.js / Pose-Detection Pipeline

---

## 📦 Project Structure

```text
buildwithai/
├── src/
│   ├── assets/             # Visual indicators & hero assets
│   ├── App.jsx             # App wrapper and core state layout
│   ├── PatientView.jsx     # Main video processing interface
│   ├── CaregiverView.jsx   # Live event logs panel
│   ├── index.css           # Custom dark UI variables & core themes
│   └── App.css             # Structural dashboard grid formatting
├── package.json            # Node environment dependencies
└── vite.config.js          # Bundler configurations