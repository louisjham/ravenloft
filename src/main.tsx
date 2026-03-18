import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useGameStore } from './store/gameStore'

// DEBUG: Check if we should initialize dummy state
console.log('[DEBUG] main.tsx: App starting...');
console.log('[DEBUG] main.tsx: Current gameState:', useGameStore.getState().gameState);

// Commented out: This was preventing MainMenu from showing
// useGameStore.getState().initializeDummyState()
console.log('[DEBUG] main.tsx: Skipping initializeDummyState() to allow MainMenu to show');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
