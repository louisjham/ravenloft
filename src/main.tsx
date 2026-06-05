import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useGameStore } from './store/gameStore'
import { preloadModels } from './utils/modelLoader'
import { isDev } from './utils/devEnv'

// Preload all GLTF models so they're cached before the game starts
preloadModels();

if (isDev()) {
  console.log('[DEBUG] main.tsx: App starting...');
  console.log('[DEBUG] main.tsx: Current gameState:', useGameStore.getState().gameState);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
