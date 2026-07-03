<img width="1002" height="550" alt="image" src="https://github.com/user-attachments/assets/79bf9ba8-6d1b-4370-b8d5-e8c26513c3c8" />

<img width="1584" height="873" alt="image" src="https://github.com/user-attachments/assets/c351c160-39de-45ae-a8e4-e840e003dfc4" />

# Castle Ravenloft 3D 🧛🏰

An atmospheric 3D digital tabletop adaptation of the cooperative board game **Dungeons & Dragons: Castle Ravenloft**. Command legendary heroes, explore the modular crypts of Barovia, defeat deadly monsters, and defeat Count Strahd von Zarovich in this responsive 3D web experience.

---

## 🎮 Key Features

*   **Modular Tile Exploration:** Reveal and place randomized crypt tiles dynamically as you explore edge connections.
*   **Turn Phase Loop:** Implements the official game flow: *Hero Phase* (move & attack) ➡️ *Exploration Phase* (reveal tiles) ➡️ *Villain Phase* (draw encounters & activate monsters).
*   **Tactical Enemy AI:** Monsters evaluate tactics, target nearest heroes, and execute melee/ranged combat. Villains (like Strahd) adapt their behaviors across multiple boss phases.
*   **18 Scenarios:** Play through all 13 official adventures and 5 custom scenarios with unique victory conditions.
*   **Power Cards Selection:** Customize your hero with At-Will, Utility, and Daily power cards matching rules limits.

---

## 🚀 How to Play Locally

### 1. Setup & Launch
First, clone the repository, install dependencies, and start the local development server:

```bash
# Install dependencies
npm install

# Start Vite development server (default port: 3000)
npm run dev
```

### 2. Assets & "Dummy Mode"
The game runs in two visual modes:
*   **Full 3D Mode:** Loads detailed `.glb` models for heroes, monsters, and tiles (located in `public/models`).
*   **Dummy Mode (Fast Fallback):** If you don't want to compile/load heavy assets, set `VITE_DUMMY_MODE=true` in your `.env` file. The engine will instantly render procedural fallbacks (cylinders, blocks, spheres), letting you test gameplay instantly.

---

## ⌨️ Controls & Interface

*   **Move Map:** Left-click and drag to rotate the camera; Right-click and drag (or use arrow keys) to pan.
*   **Interact / Select:** Click tiles to move, or select targets for power cards.
*   **Action Bar:** Located at the bottom of the HUD. Select your active Hero's powers (At-Will, Utility, Daily), use items, or end your phase.
*   **Dice Rolling:** Combat rolls automatically trigger a 3D animated physical `d20` physics roll on the board.

---

## 🌐 How to Deploy

The game is built using **Vite** and compiles into a static single-page app (SPA). You can host it on any free static provider (Vercel, Netlify, GitHub Pages).

### 1. Build the Production Bundle
Compile TypeScript and generate the optimized static assets:
```bash
npm run build
```

This generates all production assets inside the `/dist` directory.

### 2. Hosting Options
*   **Vercel:** Install the Vercel CLI and run `vercel` in the root folder, or link your GitHub repo for auto-deployments.
*   **Netlify:** Drag-and-drop the `/dist` folder directly onto Netlify, or configure the build command to `npm run build` and publish directory to `dist`.
*   **GitHub Pages:** Push the `/dist` folder content to a `gh-pages` branch, or configure GitHub Actions to compile and deploy automatically.

---

## 🧪 Testing the Engine
Verify rules, monster AI behaviors, scenarios, and movement logic via our headless integration testing suite:

```bash
npx tsx runTests.ts
```
