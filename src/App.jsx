import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PatientView from './PatientView';
import CaregiverView from './CaregiverView';
import './index.css';

export default function App() {
  return (
    <Router>
      <nav className="global-nav">
        <Link to="/" className="nav-link">Patient Dashboard</Link>
        <Link to="/caregiver" className="nav-link">Caregiver Portal</Link>
      </nav>
      
      <Routes>
        <Route path="/" element={<PatientView />} />
        <Route path="/caregiver" element={<CaregiverView />} />
      </Routes>
    </Router>
  );
}
