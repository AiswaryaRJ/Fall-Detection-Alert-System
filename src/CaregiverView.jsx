import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { db } from './firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function CaregiverView() {
  const [logs, setLogs] = useState([]);
  const [currentStatus, setCurrentStatus] = useState('Monitoring');
  const [dbConnected, setDbConnected] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [geminiSummary, setGeminiSummary] = useState('');
  const [generating, setGenerating] = useState(false);
  
  const ELDER_ID = 'demo_user_1';

  // Modal Emergency Audio Playback
  const audioContext = useRef(null);

  const playLoudBeep = () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const oscillator = audioContext.current.createOscillator();
      const gainNode = audioContext.current.createGain();
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, audioContext.current.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.current.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioContext.current.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, audioContext.current.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.current.currentTime + 1.5);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.current.destination);
      
      oscillator.start();
      oscillator.stop(audioContext.current.currentTime + 1.5);
    } catch(e) { console.error("Audio error", e) }
  };

  useEffect(() => {
    if (!db) {
       console.warn("DB not connected for caregiver view.");
       return;
    }

    setDbConnected(true);

    // Track Logs
    const q = query(
      collection(db, "system_status", ELDER_ID, "logs"), 
      orderBy("timestamp", "desc"), 
      limit(10)
    );
    
    const unsubLogs = onSnapshot(q, (querySnapshot) => {
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setLogs(data);
    });

    // Track Main Status for Popups
    const docRef = doc(db, "system_status", ELDER_ID);
    const unsubStatus = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const status = docSnap.data().state;
        setCurrentStatus(status);
        if (status === 'Alert Active' || status === 'Emergency') {
          if (!showModal) {
            setShowModal(true);
            playLoudBeep();
          }
        } else {
          setShowModal(false);
        }
      }
    });

    return () => {
      unsubLogs();
      unsubStatus();
    }
  }, [showModal]);

  const getGeminiSummary = async () => {
    setGenerating(true);
    try {
      const apiKey = process.env.VITE_GEMINI_API_KEY || window.prompt("Please enter your Gemini API Key directly:");
      if (!apiKey) {
        setGeminiSummary("Error: No API key provided.");
        setGenerating(false);
        return;
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const logsText = logs.map(l => `${l.timestamp ? new Date(l.timestamp.toDate()).toLocaleTimeString() : 'Recent'}: ${l.state} - ${l.reason}`).join('\n');
      
      const prompt = `Act as a professional health aide. Summarize these technical logs into a 3-sentence empathetic wellness update for a family member. Mention that Guardian AI is currently keeping watch.\n\nHISTORY:\n${logsText}`;

      const result = await model.generateContent(prompt);
      setGeminiSummary(result.response.text());
    } catch (e) {
      setGeminiSummary("Failed to generate summary: " + e.message);
    }
    setGenerating(false);
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'Monitoring') return 'badge-green';
    if (status === 'Check Required') return 'badge-orange';
    return 'badge-red';
  };

  return (
    <div className="dashboard caregiver-dash">
      <header className="header">
        <h1>Guardian Center <span className="subtitle">Remote Monitoring View</span></h1>
        <div className="status-badge">
          <div className="dot" style={{ backgroundColor: dbConnected ? 'var(--green)' : 'var(--red)' }}></div>
          {currentStatus}
        </div>
      </header>

      <div className="caregiver-grid">
        <section className="logs-panel">
          <h3>Recent History <span className="log-count">({logs.length})</span></h3>
          <ul className="log-list">
            {logs.map((log) => (
              <li key={log.id} className="log-item">
                <span className="log-time">
                  {log.timestamp ? new Date(log.timestamp.toDate()).toLocaleTimeString() : 'Just now'}
                </span>
                <span className={`log-state ${getStatusBadgeClass(log.state)}`}>
                  {log.state}
                </span>
                <span className="log-reason">{log.reason}</span>
              </li>
            ))}
            {logs.length === 0 && <p className="desc">Waiting for activity logs...</p>}
          </ul>
        </section>

        <section className="gemini-panel">
          <h3>AI Daily Pulse</h3>
          <p className="desc" style={{ marginBottom: '1.5rem' }}>Generate an empathetic daily wellness summary of recent activities using Gemini.</p>
          
          <button 
            className="primary-btn gemini-btn" 
            onClick={getGeminiSummary}
            disabled={generating || logs.length === 0}
          >
            {generating ? 'Consulting Gemini...' : 'Generate Daily Summary'}
          </button>

          {geminiSummary && (
            <div className="gemini-report">
               <p>{geminiSummary}</p>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
             <div className="modal-icon">⚠️</div>
             <h2>EMERGENCY ALERT</h2>
             <p>A critical event has escalated for Demo User 1.</p>
             <p className="modal-timestamp">{new Date().toLocaleTimeString()}</p>
             <button className="secondary-btn" onClick={() => setShowModal(false)}>Acknowledge</button>
          </div>
        </div>
      )}
    </div>
  );
}
