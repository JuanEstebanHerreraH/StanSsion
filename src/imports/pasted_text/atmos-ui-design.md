You are a senior UI/UX designer creating Atmos, a dark ambient audio player and personal workspace web app. Design the complete web interface following these specifications exactly.

VISUAL IDENTITY

Aesthetic: dark, minimal, atmospheric. Think Linear meets Notion meets a music visualizer
Background: deep dark (#0a0a0f base) with subtle noise texture
Accent color: soft electric blue (#4f8ef7) with occasional purple (#7c5cbf) gradient moments
Typography: Inter for UI, JetBrains Mono for values and numbers
Glassmorphism panels: dark frosted glass (rgba white 4-6%, blur 12px, border rgba white 8%)
No sharp whites. Everything uses off-white (#e8e8f0) for text
Micro-shadows everywhere, nothing feels flat


LAYOUT STRUCTURE — Desktop Web (1440px)
┌──────────────────────────────────────────────────────┐
│ SIDEBAR (220px fixed)  │  MAIN AREA (fluid)          │
│                        │                             │
│  Logo: Atmos           │  Changes per section        │
│                        │                             │
│  🎵 Audio              │                             │
│  🧠 Workspace          │                             │
│  ⚙️ Settings           │                             │
│                        │                             │
│  ─────────────────     │                             │
│  [Download App]        │                             │
│  subtle, bottom        │                             │
└────────────────────────┴─────────────────────────────┘
│         PLAYER BAR — fixed bottom (72px)             │
└──────────────────────────────────────────────────────┘

SCREEN 1 — Audio Dashboard (default view)
Main area split in two columns:
Left column — Active mixer:

"Ambiente" card: dropdown to select type (rain, storm, forest, ocean, wind, cafe, cave, space) + 3 sliders: Intensity, Speed, Density. Sliders are thin, accent-colored, with live value display
"Radio" card below it: shows currently playing station name, country flag, genre tag, waveform animation. Button "Change station"
Both cards are glassmorphism panels with subtle glow when active

Right column — Audio visualizer:

Large FFT waveform visualization, reactive bars in accent blue fading to purple
Below it: preset slots (4 visible, named by user, "+ New preset" button)
Timer widget: three modes as tabs (Pomodoro / Sleep / Focus), countdown display, minimal controls


SCREEN 2 — Radio Panel
Full panel replacing main area:

Top: search bar + country selector dropdown + genre filter chips
Subtle banner (not blocking): "Location detected: Colombia — showing local stations first" with small X to dismiss. If no location: "Allow location for local stations" as ghost text, not a modal
Station list: rows with station logo, name, country flag, genre, bitrate, heart icon to favorite, play button
Right side panel: currently playing card with larger info, waveform, volume, and "Add to mixer" button
Favorites section: horizontal scroll strip at top of list


SCREEN 3 — Workspace Canvas
Full canvas area:

Infinite canvas (dark background with subtle dot grid)
Floating toolbar on left: cursor, note, task card, image, connector, folder
Sample elements already placed: one text note (yellow tint glass), one task list card (blue tint glass), one idea card connected to another with an arrow
Mini-map in bottom right corner
Zoom controls bottom right
Top bar shows canvas name (editable) + share button (disabled on web with tooltip "Available in desktop app")

One element selected state: shows resize handles, a small context menu floating above it (Edit / Connect / Color / Delete)

PLAYER BAR — Fixed bottom
[🌧 Rain — Intensity 60%]  [📻 Radio Nacional CO]  [⏱ 18:42]  [🔊 ──●──]  [⚙]

Glassmorphism bar, slight blur of content behind it
Ambient layer indicator + radio indicator as separate pills
Timer countdown visible always
Master volume slider
Quick settings gear


WEB LIMITATIONS — Subtle, never annoying
These limitations appear as:

Greyed out controls with a small 🖥 desktop icon tooltip ("Works automatically in the app")
Never a modal, never a paywall screen, never a blocked action
The sidebar bottom shows one quiet card: "Get the full experience → Download Atmos" with version number. Small, non-intrusive, always visible but never aggressive

Specific limited features on web:

Local file access: shows "Open file" button manually (works but requires user action each time). Tooltip: "App loads your library automatically"
Canvas export: available but shows "App exports in higher resolution"
Notifications: browser permission prompt, tooltip: "App sends native system notifications"
System tray: not shown on web at all


SETTINGS SCREEN
Three-column layout: category list left, options center, live preview right
Categories: Appearance / Audio / Performance / Data
Appearance options visible:

Theme toggle: Dark / Light / System (Dark selected, others dimmed)
Accent color: 6 presets + custom picker
Font: Inter / Mono / Serif selector
Density: Compact / Normal / Spacious as segmented control
Animation toggle

Performance options:

Visualizer FPS: 30 / 60 / Off
Audio quality: Low / Medium / High
Low power mode toggle


DESIGN TOKENS TO USE THROUGHOUT
Background:     #0a0a0f
Surface:        rgba(255,255,255,0.04)
Border:         rgba(255,255,255,0.08)
Text primary:   #e8e8f0
Text secondary: #8888a0
Accent blue:    #4f8ef7
Accent purple:  #7c5cbf
Success:        #3ecf8e
Warning:        #f5a623
Radius:         12px cards, 8px inputs, 6px buttons

Generate these screens: Audio Dashboard, Radio Panel, Workspace Canvas, Settings. Show desktop (1440px) versions. Apply consistent glassmorphism, dark theme, and the subtle web limitation indicators throughout. The app should feel premium, calm, and focused — not flashy.