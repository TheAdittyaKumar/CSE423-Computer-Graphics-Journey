# CSE423 Computer Graphics: From Pixels to Paddles 🛶

A semester journey from OpenGL basics to **_Majhi Jaben?!_**, a 3D boat-rescue game set in a flooded Dhaka.

### 🎮 [Play Majhi Jaben?! Online](https://theadittyakumar.github.io/CSE423-Computer-Graphics-Journey/)

**No installation needed for the browser edition.** Play directly in your browser, or explore the original Python/PyOpenGL implementation in this repository.

**Course:** CSE423 · Computer Graphics · BRAC University  
**Section:** 16 · **Project Group:** 07  
**Team:** Adittya Kumar Chowdhury · Nafisa Lubaba · Usaeed Rahman Tibro  
**Technology:** Python · PyOpenGL · OpenGL/GLU/GLUT · JavaScript · WebGL

> We started with points, lines, and transforms in the lab—and ended up building a flooded-city rescue game with missions, landmarks, traffic, a minimap, and a very dramatic menu.

![Majhi Jaben Cinematic Edition gameplay at BRAC University](media/bracu-campus.jpg)

<p align="center"><em>Majhi Jaben?! — Cinematic Edition gameplay screenshot (original Python version).</em></p>

---

## 🛶 About the project

**Majhi Jaben?!** is a stylized rescue-and-delivery game inspired by Dhaka's monsoon flooding and our own experience of commuting through heavy rain during the semester. The roads are underwater, students are stranded, and the player becomes a **majhi** (boatman) who must carry passengers to safety at **BRAC University** before their deadlines expire.

The tone is intentionally playful. One of our favorite jokes is that **BRAC University is the only sunny, dry place in the flooded city**, inspired by the familiar “sunlight spotlight” meme. Even the main menu fights back: moving toward **Exit Game** makes the majhi aim a blinding flashlight at the player.

The project has two playable implementations:

- **Original Cinematic Edition:** a desktop game written in Python with PyOpenGL, including the original scenes, rendering, and gameplay logic.
- **Browser Edition:** a WebGL/JavaScript adaptation hosted on GitHub Pages so visitors can play without installing Python. It preserves the central gameplay and many source-derived visual elements, while some rendering and interaction details differ from the desktop edition.

## ✨ Gameplay highlights

### 1) The menu

Hovering over **Exit Game** triggers the giant flashlight toward *you*.

![The cinematic Majhi Jaben menu and flashlight gag](media/exit-searchlight.gif)

### 2) A few important gameplay systems

| Passenger pickup / rescue | Landmark photo challenge |
| :---: | :---: |
| ![Picking up a passenger from a flooded street](media/passenger-pickup.jpg) | ![Photographing Shaheed Minar](media/landmark-challenge.jpg) |
| Pick up stranded students from flooded streets and bring them to safety before their deadlines. | Photograph Dhaka landmarks such as **Shaheed Minar** to earn bonus points and learn their history. |

Other gameplay systems include:

- **Time-sensitive requests:** accept rescue calls, track each passenger's deadline, and carry up to three passengers at a time.
- **Flooded-city navigation:** steer a rowing boat around buildings, submerged cars, floating debris, and other hazards.
- **Changing conditions:** obey traffic signals, deal with power outages, and restore power to affected neighborhoods.
- **Cinematic weather:** animated water, rain and splashes, lighting effects, and a sunny area around BRAC University.
- **Multiple viewpoints:** switch between third-person and first-person perspectives, including a windshield-wiper effect.

### 3) Real-time minimap

<p align="center">
  <img src="media/minimap-view.jpg" alt="Original game's real-time minimap with destinations and player position" width="280">
</p>

<p align="center"><em>The minimap helps track the player's position, rescue pickups, and important destinations.</em></p>

---

## 🌐 Play the Browser Edition

**▶ [Launch Majhi Jaben?! — Play Online](https://theadittyakumar.github.io/CSE423-Computer-Graphics-Journey/)**

The web adaptation runs through GitHub Pages and uses JavaScript/WebGL. You do **not** need to download or install the original Python dependencies to try it. A desktop browser with WebGL support is recommended.

**Main controls:**

| Key | Action |
| --- | --- |
| **W / S** | Row forward / backward |
| **A / D** | Steer left / right |
| **Space** | Toggle paddle boost |
| **C** | Change camera |
| **V** | Activate windshield wiper |
| **Y / N** | Accept / reject rescue request |
| **F** | Repair power when near an affected repair box |
| **P** | Take a landmark photo when in range |
| **Esc** | Pause / help |

> **Note:** The Browser Edition is a port of the Cinematic Edition, not the graded Python submission. The source Python game remains available for anyone interested in the original OpenGL implementation.

---

## 📁 Repository structure

```text
CSE423-Computer-Graphics-Journey/
│
├── Lab 1/                                # Early OpenGL exercises
├── Lab 2/                                # Graphics assignments
├── Lab 3/                                # 3D graphics assignments
│
├── Project proposal document/            # Original and updated proposals
├── Project submitted/                    # Faculty-graded Python project
│   └── MajhiJaben_FinalVersion.py
│
├── Updated project after CSE423 ended/   # Enhanced Python Cinematic Edition
│   └── MajhiJaben_CinematicEdition_NoComments.py
│
├── docs/                                 # Browser Edition / GitHub Pages site
│   ├── index.html
│   ├── styles.css
│   ├── game.js
│   └── ...                               # Browser assets and supporting scripts
│
├── media/                                # Project screenshots and GIFs
│   ├── bracu-campus.jpg
│   ├── exit-searchlight.gif
│   ├── landmark-challenge.jpg
│   ├── passenger-pickup.jpg
│   └── minimap-view.jpg
│
├── tools/                                # Supporting development tools
└── README.md
```

This keeps the original graded submission separate from the post-course improved version and the browser adaptation.

## 🎓 What we learned in CSE423 and how it appears in the game

| Course component | What we learned | How it appears in *Majhi Jaben?!* |
| --- | --- | --- |
| Intro OpenGL templates | Points, lines, primitive drawing, coordinates, transforms | Buildings, roads, HUD elements, rain, and world objects |
| Lab 1 / Assignment 1 | Basic animation, interactive drawing, color control | Weather, screen effects, and general 2D scene building |
| Lab 2 / Assignment 2 | Line logic, interaction, collision-style thinking, game flow | Pickup systems, hazards, movement checks, and gameplay logic |
| Lab 3 / Assignment 3 | 3D transforms, perspective, camera control | 3D boat scene, third-person view, first-person view, and obstacle layout |
| Final project | Combining rendering, animation, input, and game logic | Flooded-city exploration, rescue missions, photo challenge, and minimap |

The browser port also gave us an opportunity to adapt desktop OpenGL concepts to **WebGL**, including moving scene geometry, camera views, animation, user input, and browser-based deployment.

---

## 📂 Project versions

### 1. Original faculty proposal

Located in [`Project proposal document/`](Project%20proposal%20document/). This contains the idea presented to faculty and its later update.

### 2. Actual graded submission

Located at [`Project submitted/MajhiJaben_FinalVersion.py`](Project%20submitted/MajhiJaben_FinalVersion.py). This is the version submitted for course evaluation.

### 3. Post-course improved Python version

Located at [`Updated project after CSE423 ended/MajhiJaben_CinematicEdition_NoComments.py`](Updated%20project%20after%20CSE423%20ended/MajhiJaben_CinematicEdition_NoComments.py). This is the enhanced Cinematic Edition with improved visuals, atmosphere, interactions, and additional refinements.

> Screenshots and GIFs in this README showcase the later improved **Python Cinematic Edition**.

### 4. Browser Edition — Play Online

Located in [`docs/`](docs/) and published through GitHub Pages:

**🎮 [Play the Browser Edition](https://theadittyakumar.github.io/CSE423-Computer-Graphics-Journey/)**

This is a separate, browser-compatible adaptation created to make the project easier to experience and share.

---

## 🛠️ How to run

### Option A: Play online (recommended for visitors)

Open **[Majhi Jaben?! — Play Online](https://theadittyakumar.github.io/CSE423-Computer-Graphics-Journey/)** in a WebGL-capable browser. No Python installation is needed.

### Option B: Run the original Python game

Install Python 3 and the PyOpenGL dependencies:

```bash
python -m pip install PyOpenGL PyOpenGL_accelerate
```

A working **GLUT/FreeGLUT** runtime is also required on your operating system.

Run the graded course submission:

```bash
python "Project submitted/MajhiJaben_FinalVersion.py"
```

Run the improved Cinematic Edition:

```bash
python "Updated project after CSE423 ended/MajhiJaben_CinematicEdition_NoComments.py"
```

*On Windows, you can use `py` in place of `python` if that's how Python is configured.*

---

## 🎥 Credits

**Adittya Kumar Chowdhury · Nafisa Lubaba · Usaeed Rahman Tibro**  
CSE423: Computer Graphics · BRAC University · Group 07 · Section 16

The game is inspired by real flooding experiences, but it remains a humorous student project—especially the idea that BRAC University is the one magically dry and sunny place in the city.

*From pixels to paddles: from lab templates to a full rescue game.*
