<img width="1002" height="550" alt="image" src="https://github.com/user-attachments/assets/79bf9ba8-6d1b-4370-b8d5-e8c26513c3c8" />

<img width="1667" height="913" alt="image" src="https://github.com/user-attachments/assets/18436eba-19b8-4c48-9a31-38e32cf64b82" />


# Castle Ravenloft 3D & WebXR 🧛🏰

An atmospheric, responsive 3D and WebXR digital tabletop adaptation of the cooperative board game **Dungeons & Dragons: Castle Ravenloft**. Built with **React 18, Vite, Three.js (React Three Fiber), `@react-three/xr`, `@react-three/cannon`**, and **Zustand**.

Command legendary heroes, explore the modular crypts of Barovia in full 3D desktop mode or immersive 6DoF WebXR Passthrough/VR, defeat deadly monsters, and conquer Count Strahd von Zarovich!

<img width="1243" height="584" alt="image" src="https://github.com/user-attachments/assets/4f8f754b-d85a-410e-831e-756b56ce6333" />

> 🎬 *Note: Updated WebXR 6DoF interaction gameplay videos and screenshots coming soon!*

---

## ⚡ Recent Architecture & WebXR Conversion

The codebase has undergone a comprehensive refactor to transform the experience into a modern, high-performance WebXR spatial tabletop game while strictly adhering to official board game rules:

### 🥽 WebXR & 6DoF Spatial Interaction System
* **Unified World Playspace (`XRTabletopRig`):** Supports single-grip "Grasp & Pull" locomotion, dual-grip midpoint translation, hand-twist rotation, pinch-to-scale, 360° thumbstick camera orbit, elevation controls, and mixed-reality Passthrough alignment.
* **6DoF Hero Grab-and-Drop (`Hero3D`):** Pick up heroes in 6DoF using VR motion controllers or mouse drag. Legal reachable tiles glow with vibrant runic highlights. Dropping onto an enemy triggers combat, while illegal drops play error haptic feedback and spring back.
* **Automatic Dungeon Exploration (`ExplorationLayer`):** Moving or dropping heroes on unexplored tile edges automatically draws, validates, places, and rotates adjacent crypt tiles, triggering monster spawns and scenario rules seamlessly.
* **In-Hand Miniature & Card Scaling (`PhysicalCard3D`, `GrabbablePiece3D`):** 6DoF dual-sided physical cards and held miniatures can be magnified up to 6.5x in-hand using thumbstick Y-axis or mouse wheel. Includes 3D spatial card hand docks (`CardHandDock3D`).
* **Spatial Audio & 3D HUD:** Dynamic spatial audio soundscapes and 3D spatial UI overlays (`XRTabletopHUD3D`, `XRMainMenu3D`, `XRSetupStage3D`).

### 🏗️ Pure Engine & State Slice Modularization
* **Decoupled Engine Core:** Engine rules logic (`CombatSystem`, `CardResolutionSystem`, `EncounterSystem`, `PowerSelectionSystem`, `TokenSystem`, `ConditionSystem`, `ExplorationStateMachine`, `villainPhaseLogic`) decoupled into pure TypeScript modules in `src/game/engine/`.
* **State Slice Architecture:** Store refactored into focused Zustand slices (`coreSlice`, `cardSlice`, `combatSlice`, `tokenSlice`, `conditionSlice`, `powerSlice`) ensuring single atomic `set()` updates and clean performance profiles.

---

## 🎮 Core Gameplay Features

* **Modular Tile Exploration:** Reveal and place randomized crypt tiles dynamically as you explore edge connections.
* **Official Turn Phase Loop:** Implements official game flow: *Hero Phase* (move & attack) ➡️ *Exploration Phase* (reveal tiles) ➡️ *Villain Phase* (draw encounters & activate monsters).
* **Tactical Enemy AI:** Monsters evaluate tactics, target nearest heroes, and execute melee/ranged combat. Villains (like Strahd) adapt their behaviors across multiple boss phases.
* **18 Scenarios:** Includes all 13 official campaign adventures, the *Tome of Strahd* adventure, and 5 custom scenarios with unique objectives and victory conditions.
* **Power Cards & Hero Customization:** Customize heroes (Alissa, Arjhan, Immeril, Kat, Thorgrim) with At-Will, Utility, and Daily power cards matching rules limits.
* **3D Physical Physics Dice:** Real-time `@react-three/cannon` rigid-body `d20` physics dice rolls on the 3D board.

---

<img width="500" height="524" alt="image" src="https://github.com/user-attachments/assets/99ed9c6c-f60e-4f2f-b696-310e5f02bc2a" />

## 🚀 How to Play Locally

### 1. Setup & Launch
First, clone the repository, install dependencies, and start the local development server:

```bash
# Install dependencies
npm install

# Start Vite development server (default port: 3000)
npm run dev
```

### 2. WebXR & VR Mode
To launch in WebXR (Meta Quest / Horizon OS Browser, WebXR Simulators, or WebXR-compatible VR headsets):
- Connect your WebXR device or enable WebXR emulation in browser dev tools.
- Click the **Enter VR / WebXR** button on the main menu or HUD to activate the spatial tabletop environment.

### 3. Assets & "Dummy Mode"
The game runs in two visual modes:
* **Full 3D Mode:** Loads detailed `.glb` models for heroes, monsters, and tiles (located in `public/models`).
* **Dummy Mode (Fast Fallback):** Set `VITE_DUMMY_MODE=true` in your `.env` file to render procedural fallbacks (cylinders, blocks, spheres) for instant zero-asset testing.

---

<img width="1665" height="913" alt="image" src="https://github.com/user-attachments/assets/c6332610-c60e-4991-b80d-800c6d339ef0" />

## ⌨️ Controls & Interface

### Desktop Mode
* **Camera Orbit & Pan:** Left-click drag to rotate camera; Right-click drag (or Arrow Keys) to pan.
* **Interact / Select:** Click tiles to move, or click enemies to target with power cards.
* **Action Bar:** Bottom HUD panel to select powers (At-Will, Utility, Daily), items, or end turn.
* **3D Dice Rolling:** Automatic rigid-body physical 3D `d20` rolls on combat actions.

### WebXR / VR Mode
* **Grasp & Pull Locomotion:** Single-grip drag in empty air to translate the world 1:1.
* **Dual-Grip Scale & Rotate:** Dual-grip to rotate table around hand axis or pinch-to-scale.
* **Thumbstick Controls:** Right thumbstick X (360° orbit), Right thumbstick Y (table height), Left thumbstick (planar translation).
* **6DoF Grab-and-Drop:** Pick up heroes/pieces with controller middle grip; inspect cards in-hand; drop onto highlighted runes to complete movement or attacks.

---

<img width="214" height="145" alt="image" src="https://github.com/user-attachments/assets/1f4f6f3b-7913-4044-991b-1b64d0225abf" />

## 🌐 How to Deploy

The game is built using **Vite** and compiles into a static single-page app (SPA) or PWA compatible with Meta Quest Browser and desktop browsers.

### 1. Build Production Bundle
Compile TypeScript and generate optimized static assets:
```bash
npm run build
```

Assets are generated in the `/dist` directory.

### 2. Hosting Options
* **Vercel / Netlify / GitHub Pages:** Host static files from `/dist` with HTTPS enabled (required for WebXR sessions).

---

<img width="691" height="901" alt="image" src="https://github.com/user-attachments/assets/fb112772-585f-4d2c-b940-774716d3275a" />

## 🧪 Headless Engine Verification & Testing
Verify rule integrity, monster AI behaviors, scenario logic, and state transitions via our automated test suite:

```bash
npx tsx runTests.ts
```
