Pokemon Centering Mobile Web App

Files:
- index.html
- styles.css
- app.js

What it is:
A self-contained mobile web app for iPhone/Safari that lets you load front and back Pokemon card scans or photos, manually align outer and inner border boxes, and measure centering.

Main features:
- Front/back tabs
- Pinch zoom
- One-finger pan when not dragging an anchor
- Small crosshair anchors for precision
- Grid settings menu (color, opacity, density, anchor size)
- Hard image boundaries
- Inner box constrained inside outer box
- Fit, rotate, contrast toggle
- CSV summary export
- JSON session save/load

How to use on iPhone:
Option 1: Put the folder on any simple web host and open index.html in Safari.
Option 2: Serve it locally from a computer on the same network.
Option 3: Use a phone app that can open local HTML projects.

Simple local hosting from a PC or Mac:
1. Put the files in one folder.
2. Open a terminal in that folder.
3. Run one of these:
   - Python: python -m http.server 8000
   - Node: npx serve
4. On your iPhone, open Safari and go to:
   http://YOUR-COMPUTER-IP:8000

Notes:
- This is a manual precision tool, not auto edge detection.
- The current centering measurement uses border thickness between the outer and inner boxes.
- The grading hint is only a rough pre-screening hint.

Suggested next upgrades:
- Auto border detection for Pokemon fronts and backs
- Loupe/magnifier while dragging
- Synchronized front/back zoom regions
- Perspective correction from angled photos
- Dedicated iPhone install packaging later if desired
