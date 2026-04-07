import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, setDoc, addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Tensorflow and Pose Detection
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs-core';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tfjsWasm from '@tensorflow/tfjs-backend-wasm';

export default function PatientView() {
  const [status, setStatus] = useState('Monitoring');
  const [motionData, setMotionData] = useState(null);
  const [dbConnected, setDbConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  
  // Pose Detection State
  const [modelReady, setModelReady] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);

  const lastActiveRef = useRef(Date.now());
  const ELDER_ID = 'demo_user_1';

  const detectorRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef();

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  
  const updateFirebaseState = async (newState, reason = "System Trigger") => {
    if (!dbConnected || !db) return;
    const docRef = doc(db, "system_status", ELDER_ID);
    const logsRef = collection(db, "system_status", ELDER_ID, "logs");
    try {
      await setDoc(docRef, { state: newState, timestamp: serverTimestamp(), elderID: ELDER_ID }, { merge: true });
      await addDoc(logsRef, { state: newState, reason: reason, timestamp: serverTimestamp() });
    } catch (e) {
      console.error("Failed to sync state", e);
    }
  };

  // Voice output and Speech Recognition
  useEffect(() => {
    let timeoutId;
    let recognition;

    if (status === 'Check Required' || status === 'Emergency') {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance('I detected a fall. Are you okay? Please say Yes or press the button.');
        
        msg.onend = () => {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onresult = async (event) => {
              const transcript = event.results[0][0].transcript.toLowerCase();
              console.log("Heard:", transcript);
              if (transcript.includes('yes') || transcript.includes('i am fine') || transcript.includes("i'm fine") || transcript.includes('yeah') || transcript.includes('okay')) {
                clearTimeout(timeoutId);
                
                setStatus('Monitoring');
                lastActiveRef.current = Date.now();
                updateFirebaseState('Monitoring', 'User verbally confirmed OK');
              }
            };
            
            recognition.onerror = (e) => console.log("Recognition error:", e);
            try { recognition.start(); } catch (e) { console.error(e); }
          }

          timeoutId = setTimeout(async () => {
            if (recognition) {
              try { recognition.stop(); } catch(e){}
            }
            
            setStatus('Alert Active');
            lastActiveRef.current = Date.now();
            updateFirebaseState('Alert Active', 'Voice prompt timed out');
          }, 5000);
        };
        
        window.speechSynthesis.speak(msg);
      } else {
        timeoutId = setTimeout(async () => {
          setStatus('Alert Active');
          lastActiveRef.current = Date.now();
          updateFirebaseState('Alert Active', 'Fallback voice timed out');
        }, 5000);
      }
    }

    return () => {
      clearTimeout(timeoutId);
      if (recognition) {
        try { recognition.stop(); } catch(e){}
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [status, dbConnected, db]);
  
  const noseHistoryRef = useRef({ y: 0, time: 0 });

  useEffect(() => {
    if (!db) {
      console.warn("Firebase not configured. Running in UI-only mode.");
    } else {
      const docRef = doc(db, "system_status", ELDER_ID);
      const initDb = async () => {
        try {
          await setDoc(docRef, { state: 'Monitoring', timestamp: null, elderID: ELDER_ID }, { merge: true });
          setDbConnected(true);
        } catch (err) {
          console.error("Firebase write error: ", err);
        }
      };
      initDb();

      const unsub = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const remoteState = docSnap.data().state;
          if (remoteState !== statusRef.current) {
               setStatus(remoteState);
          }
        }
      }, (error) => {
        console.error("Firestore listen error: ", error);
      });

      return () => unsub();
    }
  }, []);

  // Initialize TFJS and Pose Detection
  useEffect(() => {
    const initModel = async () => {
      try {
        await tf.ready();
        const detectorConfig = {
          runtime: 'tfjs',
          modelType: 'lightning'
        };
        await tf.setBackend('webgl');
        detectorRef.current = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet, 
          detectorConfig
        );
        setModelReady(true);
        console.log("MoveNet loaded successfully");
      } catch (e) {
        console.error("Error loading MoveNet:", e);
      }
    };
    initModel();
  }, []);

  // Pose Estimation Loop
  const detectPose = async () => {
    if (detectorRef.current && videoRef.current && webcamActive) {
      const video = videoRef.current;
      if (video.readyState === 4 && video.videoWidth > 0 && video.videoHeight > 0) {
        const poses = await detectorRef.current.estimatePoses(video);
        analyzePose(poses, video.videoHeight);
        drawSkeleton(poses);
      }
    }
    requestRef.current = requestAnimationFrame(detectPose);
  };

  useEffect(() => {
    if (webcamActive && modelReady) {
      requestRef.current = requestAnimationFrame(detectPose);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [webcamActive, modelReady]);

  const triggerEmergency = async (reason) => {
    if (statusRef.current === 'Emergency') return;
    
    console.warn(`Emergency Triggered: ${reason}`);
    setStatus('Emergency');
    lastActiveRef.current = Date.now();
    updateFirebaseState('Emergency', reason);
  };

  const analyzePose = (poses, videoHeight) => {
    if (!poses || poses.length === 0) return;
    const keypoints = poses[0].keypoints;
    
    const nose = keypoints.find(k => k.name === 'nose');
    const now = Date.now();
    
    if (nose && nose.score > 0.5) {
      const history = noseHistoryRef.current;
      if (history.time > 0) {
        const dt = now - history.time;
        if (dt > 50 && dt < 2000) {
          const dy = nose.y - history.y;
          const velocity = dy / dt;
          
          if (videoHeight > 0) {
            const threshold = (0.4 * videoHeight) / 1000; 
            if (velocity > threshold) {
              triggerEmergency('Fall Detected: Rapid nose drop');
            }
          }
        }
      }
      noseHistoryRef.current = { y: nose.y, time: now };
    }
    
    const l_shoulder = keypoints.find(k => k.name === 'left_shoulder');
    const r_shoulder = keypoints.find(k => k.name === 'right_shoulder');
    const l_hip = keypoints.find(k => k.name === 'left_hip');
    const r_hip = keypoints.find(k => k.name === 'right_hip');
    
    if (
      l_shoulder && l_shoulder.score > 0.4 &&
      r_shoulder && r_shoulder.score > 0.4 &&
      l_hip && l_hip.score > 0.4 &&
      r_hip && r_hip.score > 0.4
    ) {
      const shoulderMidX = (l_shoulder.x + r_shoulder.x) / 2;
      const shoulderMidY = (l_shoulder.y + r_shoulder.y) / 2;
      
      const hipMidX = (l_hip.x + r_hip.x) / 2;
      const hipMidY = (l_hip.y + r_hip.y) / 2;
      
      const dx = Math.abs(hipMidX - shoulderMidX);
      const dy = Math.abs(hipMidY - shoulderMidY);
      
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      
      if (angle < 30) {
        triggerEmergency('Fall Detected: Horizontal body angle');
      }
    }
  };

  const drawSkeleton = (poses) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (poses.length > 0) {
      const keypoints = poses[0].keypoints;
      
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;
      const scale = Math.min(scaleX, scaleY);
      
      const offsetX = (canvas.width - video.videoWidth * scale) / 2;
      const offsetY = (canvas.height - video.videoHeight * scale) / 2;

      keypoints.forEach((keypoint) => {
        if (keypoint.score > 0.3) {
          ctx.beginPath();
          const x = keypoint.x * scale + offsetX;
          const y = keypoint.y * scale + offsetY;
          ctx.arc(x, y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = '#00ffcc';
          ctx.fill();
        }
      });

      const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
      adjacentKeyPoints.forEach(([i, j]) => {
        const kp1 = keypoints[i];
        const kp2 = keypoints[j];
        
        const score1 = kp1.score != null ? kp1.score : 1;
        const score2 = kp2.score != null ? kp2.score : 1;

        if (score1 >= 0.3 && score2 >= 0.3) {
          ctx.beginPath();
          ctx.moveTo(kp1.x * scale + offsetX, kp1.y * scale + offsetY);
          ctx.lineTo(kp2.x * scale + offsetX, kp2.y * scale + offsetY);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#00ffcc';
          ctx.stroke();
        }
      });
    }
  };

  const startWebcam = async () => {
    if (webcamActive) {
      const stream = videoRef.current.srcObject;
      if (stream) stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setWebcamActive(false);
      return;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setWebcamActive(true);
          };
        }
      } catch (err) {
        console.error("Webcam error:", err);
      }
    } else {
      alert("Webcam not supported or accessible.");
    }
  };

  // Motion Detection
  useEffect(() => {
    if (!recording) return;

    const handleMotion = (event) => {
      const acc = event.acceleration || event.accelerationIncludingGravity;
      if (!acc) return;
      
      const totalAccel = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      setMotionData(totalAccel.toFixed(2));

      if (totalAccel > 0.2) lastActiveRef.current = Date.now();

      const inactiveTime = Date.now() - lastActiveRef.current;
      if (inactiveTime >= 3000) triggerInactivity();
    };

    const requestDeviceMotion = async () => {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
          const permissionState = await DeviceMotionEvent.requestPermission();
          if (permissionState === 'granted') {
            window.addEventListener('devicemotion', handleMotion);
            lastActiveRef.current = Date.now();
          } else {
            alert('Permission to access device motion was denied.');
            setRecording(false);
          }
        } catch (error) {
          console.error(error);
          setRecording(false);
        }
      } else {
        window.addEventListener('devicemotion', handleMotion);
        lastActiveRef.current = Date.now();
      }
    };

    requestDeviceMotion();

    const interval = setInterval(() => {
      const inactiveTime = Date.now() - lastActiveRef.current;
      if (inactiveTime >= 3000) triggerInactivity();
    }, 1000); 

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      clearInterval(interval);
    };
  }, [recording, status]);

  const triggerInactivity = async () => {
    if (status === 'Check Required' || status === 'Alert Active' || status === 'Emergency') return;
    
    console.log("Inactivity Detected!");
    setStatus('Check Required');
    lastActiveRef.current = Date.now();
    updateFirebaseState('Check Required', '3 Seconds Device Inactivity');
  };

  const resetStatus = async () => {
    setStatus('Monitoring');
    lastActiveRef.current = Date.now();
    updateFirebaseState('Monitoring', 'Manual Reset');
  };

  const toggleAlert = async () => {
    const newState = status === 'Alert Active' ? 'Monitoring' : 'Alert Active';
    setStatus(newState);
    lastActiveRef.current = Date.now();
    updateFirebaseState(newState, 'Manual Toggle');
  }

  const statusColors = {
    'Monitoring': 'var(--green)',
    'Check Required': 'var(--orange)',
    'Alert Active': 'var(--red)',
    'Emergency': 'var(--red)'
  };
  
  const color = statusColors[status] || 'var(--green)';

  return (
    <div className="dashboard">
      <header className="header">
        <h1>Guardian AI Lite <span className="subtitle">Elder Safety Utility</span></h1>
        <div className="status-badge" title="Displays current connection status to Firebase Firestore">
          <div className="dot" style={{ backgroundColor: dbConnected ? 'var(--green)' : 'var(--red)' }}></div>
          {dbConnected ? 'Firebase Connected' : 'Local Mock Mode'}
        </div>
      </header>

      <main className="main-content">
        <div className="circle-container" onClick={toggleAlert} style={{ cursor: 'pointer' }} title="Click to simulate Alert Active">
          <div className="status-circle" style={{ borderColor: color, boxShadow: `0 0 40px ${color}40`, '--glow': color }}>
            <div className="inner-circle" style={{ backgroundColor: `${color}15` }}>
              <span className="status-text" style={{ color: color }}>{status}</span>
            </div>
          </div>
        </div>

        <div className="controls">
          <div className="motion-info">
            <h3>Motion Sensor</h3>
            <p className="accel-data">Acc: {motionData ? `${motionData} m/s²` : '---'}</p>
            <p className="desc">3-sec window &lt; 0.2 m/s² = Inactivity</p>
          </div>
          
          <div className="actions">
            <button 
              className={`primary-btn ${recording ? 'recording' : ''}`}
              onClick={() => {
                setRecording(!recording);
                if (!recording) lastActiveRef.current = Date.now();
              }}
            >
              {recording ? 'Stop Motion Sensor' : 'Start Motion Sensor'}
            </button>
            <button className="secondary-btn" onClick={resetStatus}>
              Reset Status
            </button>
          </div>
        </div>
      </main>

      <section className="webcam-section">
        <h3>Live AI Pose Tracking</h3>
        <p className="desc">Powered by TensorFlow.js (MoveNet)</p>
        
        <div className="webcam-container">
          <video ref={videoRef} className="webcam-video" playsInline muted />
          <canvas ref={canvasRef} className="webcam-canvas" />
        </div>
        
        <button 
          className="secondary-btn" 
          onClick={startWebcam}
          disabled={!modelReady}
          style={{ width: '100%', maxWidth: '300px', marginTop: '1rem' }}
        >
          {webcamActive ? 'Stop Camera' : (modelReady ? 'Start Camera AI' : 'Loading AI Model...')}
        </button>
      </section>
    </div>
  );
}
