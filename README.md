# 🌌 Math Adventure Hub

**Created by Teacher Quan Nguyen** 🧑‍🏫

Welcome to the **Math Adventure Hub**! This project is a growing collection of highly interactive, visual, and engaging web-based educational games. Designed specifically for elementary and middle school students, this hub transforms fundamental mathematical concepts—like spatial reasoning, arithmetic fluency, and logic—into playful, competitive, and rewarding challenges.

---

## 🎮 The Games

The hub is divided into core learning modules, each featuring completely custom-built, responsive web games:

### 🪞 Symmetry & Spatial Reasoning
*   **Symmetry Defense (Local & Online):** A strategic 4x4 grid game where players place and slide coins to build lines of symmetry while blocking their opponent. Features real-time Firebase multiplayer.
*   **Carronade (Solo & Online):** A reflective symmetry cannon-firing game. Students must use spatial estimation to reflect their shots across a fold-line to sink enemy pirate ships. 
*   **Symmetry Folding:** A digital canvas tool where students can doodle a wacky shape, place a mirror line, and trigger a 3D paper-fold animation to see if their shapes match perfectly.

### 🧩 Logic & Number Puzzles
*   **Ultimate Gomoku (Mega Tic-Tac-Toe):** A strategic 5-in-a-row game featuring dynamic grid sizes (up to 20x20). Includes Pass & Play, a smart heuristic AI opponent, and Online Multiplayer.
*   **Sudoku (6x6 & 9x9):** A classic logic puzzle featuring dynamic difficulty scaling, instant cell validation, and visual mistake tracking.
*   **Operation 24:** A fast-paced mental math game. Students are dealt 4 number cards and must use addition, subtraction, multiplication, and division to hit a target of exactly 24. 

### 🔺 Strategy & Planning
*   **Chess:** A fully playable drag-and-drop chess board featuring a medieval UI, valid move highlighting, and inline SVG pieces. 

---

## 🛠️ Tech Stack & Architecture

This project is built with an emphasis on speed, accessibility, and zero external dependencies (no breaking image links or heavy libraries).

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+).
*   **Multiplayer Backend:** Firebase Realtime Database (BaaS) for instant room creation and state synchronization.
*   **Graphics:** 100% Inline SVGs and CSS3 Animations (floating ambient blobs, 3D paper folds, popping particles).
*   **Responsiveness:** Fluid CSS grids and flexbox ensure every game is perfectly playable on desktop monitors, tablets, and mobile touch screens.

---

## 🎨 Design System & UI Guidelines

To maintain a friendly, calm, and educational aesthetic, the Math Adventure Hub strictly adheres to the following design rules:

*   **Typography:** 
    *   Headings: `'Baloo 2'` (Playful, rounded, highly legible)
    *   Body/UI: `'Quicksand'` (Clean, modern geometric sans-serif)
*   **Global Color Palette:**
    *   🔴 **Coral:** `#FF6B6B` | Deep: `#E14E56`
    *   🟢 **Teal:** `#4ECDC4` | Deep: `#2FA79E`
    *   🟣 **Purple:** `#A78BFA`| Deep: `#7C5CE0`
    *   🌿 **Green:** `#6BCB77` | Deep: `#48A857`
    *   🟡 **Yellow:** `#FFD93D`
    *   🖋️ **Ink (Dark Text):** `#2D3142`
    *   🌫️ **Muted (Subtext):** `#667085`
*   **Backgrounds:** A soft gradient flowing from Top (`#EAF6FF`) to Bottom (`#F5F0FF`), accented by blurred, glowing ambient color blobs.
*   **Components:** Soft rounded corners (`border-radius`), custom in-game modals (strictly replacing abrasive `alert()` or `confirm()` prompts), and tactile drop shadows that react to hovering and clicking.

---

## 🚀 How to Run

Because this project uses Vanilla JavaScript and HTML, no build tools or package managers (like npm) are required to run it locally.

1. Clone or download this repository.
2. Open `index.html` in any modern web browser (Chrome, Firefox, Safari, Edge).
3. To play the online multiplayer games, simply share the auto-generated Room Code links with a friend!

*Live deployment is hosted seamlessly via GitHub Pages.*

---

*“Games, puzzles, and tools to make math click!”*
