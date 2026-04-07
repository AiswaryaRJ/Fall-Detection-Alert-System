# Guardian AI Lite: Setup & Execution Guide

To transition this application from a local sandbox to a fully operational system, there are a few manual configuration steps that must be completed regarding third-party vendor integrations (Firebase and Google Gemini) and browser permissions.

## 1. Firebase & Cloud Firestore Setup
Currently, `src/firebase.js` uses dummy placeholders. To connect to a live back-end:

1. **Create a Firebase Project:** Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. **Register a Web App:** Click the Web (`</>`) icon in the project overview to register Guardian AI.
3. **Copy Configuration Details:** Firebase will provide a `firebaseConfig` object containing your `apiKey`, `projectId`, etc. Provide these exact values in your `src/firebase.js` replacing the `DUMMY_KEY_REPLACE_ME` payload.
4. **Initialize Cloud Firestore:**
   - On the left navigation bar, go to **Firestore Database** and slick **Create Database**.
   - Start in **Test Mode** (This allows local reads/writes without needing complex authentication rules immediately).
5. **No Schema creation necessary:** Our React app is structurally designed to dynamically construct the `system_status/demo_user_1/logs` collections the moment it runs. 
   
*(Note: Before launching in a real-world production environment, you must secure your Firestore rules by validating read/write payloads over specific Elder ID bounds).*

## 2. Gemini Generative AI Setup
To power the Caregiver's "Daily Pulse" feature, our app requests the `gemini-1.5-flash` model.

1. **Get an API Key:** Navigate to Google AI Studio and generate a free API key.
2. **Setup the Environment:** Create a `.env` file at the exact root of your project (`c:\Users\aiswa\Desktop\buildwithai\.env`). Add your key:
   ```env
   VITE_GEMINI_API_KEY=AIzaSy...YourKeyHere
   ```
   *Tip: If you choose not to set `.env`, the Caregiver dashboard will safely prompt the user manually for the key using a browser popup upon clicking.*

## 3. Browser Permissions & Audio API Policies
Modern web browsers (Chrome, Safari, Edge) block autonomous multimedia processes to prevent spam. 

1. **Interact First:** For the Patient voice alerts (`speechSynthesis`) and the Caregiver Emergency klaxon (`AudioContext`) to fire without being muted by the browser, **you must ensure you interact with the page (click anywhere or click a button)** prior to the autonomous triggers kicking in.
2. **Microphone/Camera Consent:** The first time the AI triggers a fall simulation, or when you explicitly hit "Start Camera AI", the browser will prompt for `getUserMedia` permissions. Ensure you **Allow** video and audio access.
3. **Localhost Requirement:** Standard browsers explicitly block Camera or Microphone access over basic HTTP protocols. Because you are testing on `http://localhost:5173/`, Chrome will trust the bridge. However, if deployed remotely, you **must use HTTPS**.

## 4. Execution Sandbox Walkthrough
If the above is satisfied:
1. Open terminal and ensure the Vite server is running via `npm run dev`. Navigate to `http://localhost:5173`
2. Open a second browser window and navigate to `http://localhost:5173/caregiver`.
3. In Window 1 (Patient), click **Start Camera AI** and intentionally lean backwards to trip the Body Angle threshold, or rapidly lower the camera for the Nose-point drop threshold.
4. Watch Window 1 loudly announce an anomaly and open up the microphone. Simultaneously watch Window 2 (Caregiver) instantly turn red and screech a loud alarm.
5. In Window 1, verbally say "I am fine" to the microphone—watching the entire network gracefully reset back to Monitoring instantly!
