# Fall Detection & Alert System (CCTV-based)

A real-time safety monitoring application designed to detect slip-and-fall incidents from live CCTV footage using computer vision and trigger instant automated alerts. This project was built and shipped during a fast-paced **Build with AI Hackathon**.

---

## 🚀 Features

* **Real-Time Video Analytics:** Streamlines video frames to monitor body positions continuously.
* **Intelligent Fall Detection:** Utilizes advanced pose estimation models to calculate rapid vertical acceleration and structural anomalies in human posture.
* **Automated Alert Pipeline:** Instantly dispatches notifications or logs events when a fall event is triggered.
* **Modern Dashboard:** A sleek, minimal web interface built for real-time tracking and video monitoring logs.

## 🛠️ Tech Stack

* **Frontend:** React, Vite, Tailwind CSS (Custom Minimalist UI)
* **Backend & ML Pipeline:** Python, OpenCV, MediaPipe (Pose Detection)

---

## 📦 Project Structure

```text
buildwithai/
├── src/               # React frontend source files (Dashboard, Video Stream Component)
├── public/            # Static assets
├── .gitignore         # Configured for both Node and Python environments
├── package.json       # Frontend dependencies
└── vite.config.js     # Vite builder configuration