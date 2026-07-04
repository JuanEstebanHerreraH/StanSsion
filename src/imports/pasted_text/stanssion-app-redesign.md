You are redesigning and completing a dark ambient audio + personal workspace web app. The app is currently called "Atmos" but must be renamed throughout to "StanSsion". The app is inspired by someone named Evelin Standke — the name and the soul of the app carry that inspiration: calm, personal, atmospheric, intimate.
The existing stack is React + TypeScript with inline styles, glassmorphism design tokens already defined. Do not change the design system — extend it.

RENAME
Replace every instance of "Atmos" with "StanSsion" including the sidebar logo, the download button text, the canvas default name, and any page titles.

FEATURE 1 — ES / EN Language Toggle
Add a language toggle button in the sidebar below the navigation items, before the download CTA. Two states: ES and EN. A small pill toggle, not a dropdown. When toggled, all UI labels switch language simultaneously. No page reload.
All labels that need translation:
Audio / Audio
Workspace / Área de trabajo
Settings / Ajustes
Ambiente / Ambiente
Intensity / Intensidad
Speed / Velocidad
Density / Densidad
Radio / Radio
Change station / Cambiar emisora
Visualizer / Visualizador
Pomodoro / Pomodoro
Sleep / Sueño
Focus / Concentración
Start / Iniciar
Pause / Pausar
Reset / Reiniciar
Search stations / Buscar emisoras
Now Playing / Reproduciendo
Add to Mixer / Agregar al mezclador
Favorites / Favoritos
Get the full experience / Descarga la experiencia completa
Download / Descargar
Appearance / Apariencia
Performance / Rendimiento
Data / Datos
Coming soon / Próximamente
Share / Compartir

FEATURE 2 — Events System (replaces Presets)
Remove the simple preset buttons below the visualizer. Replace with an Events panel — a mini calendar-based scheduling system for audio environments.
Concept: an "Event" is a named audio configuration (ambiente type + parameters + radio on/off + timer mode) attached to a time slot or a label. Think of it as "scheduled moods".
Event card structure:
┌──────────────────────────────────────┐
│ 🌧 Morning Focus          [tag: work]│
│ Rain · Intensity 70% · Pomodoro 25m  │
│ Mon–Fri  ·  07:00 – 09:00            │
│ ──────────────────────────────  [▶]  │
└──────────────────────────────────────┘
Events panel layout:

Header: "Events" label + "+ New event" button (small, accent colored)
Two tabs: Scheduled and Saved

Scheduled: events with day/time attached, shown in chronological order
Saved: events with no schedule, just named configurations


Each event card shows: emoji icon (user picks), name, key ambient params summarized in one line, optional schedule, custom color tag, and a ▶ Play button to activate immediately
Tags are fully custom: user types any label and picks a color from 6 accent options. Tags appear as small colored pills on the card
Active event has a subtle glow border in its tag color
Empty state: "No events yet — save your current mix as an event" with a ghost button

New Event creation (inline, not modal):

Clicking "+ New event" expands an inline form below the header
Fields: Name (text input), Icon (emoji picker, 6 options), Tag (text + color picker), Schedule toggle (on/off), if on: day selector (checkboxes Mon–Sun) + time range picker
"Save" button in accent color, "Cancel" as ghost text


FEATURE 3 — Visual Improvements
Visualizer:

Add a subtle radial glow behind the bars — a dark bloom in accent blue that pulses with the average amplitude
Add a reflection below the bars: mirrored bars at 20% opacity, flipped vertically, fading out
Add a thin horizontal baseline that glows accent color
Label the X axis with frequency ranges in the bottom corners: 20Hz left, 20kHz right, in mono font at 9px

Ambient card:

Add a subtle animated background when active: very slow moving noise/grain texture at 3% opacity
The active ambient type in the dropdown shows a small emoji prefix: Rain 🌧, Storm ⛈, Forest 🌿, Ocean 🌊, Wind 💨, Café ☕, Cave 🕳, Space 🌌

Radio card (in AudioDashboard):

The mini waveform bars animate more organically — use sine waves with different phases per bar, not CSS scaleY
Add a "Live" pill badge next to the station name: small red dot + "LIVE" text in 9px mono

Sidebar:

Add a very subtle vertical gradient on the logo icon background that slowly shifts hue from accent blue to purple over 4 seconds, looping. CSS animation only, no JS
Add a thin active indicator line on the left edge of active nav items: 2px wide, accent color, rounded

Canvas:

The dot grid background gets a faint radial vignette — darker at edges, lighter at center
The connection arrow between elements gets an animated traveling dot that moves along the path on loop

PlayerBar:

Add a 1px progress bar at the very top edge of the player bar, accent color, animating left to right for the current timer session
Ambient and radio indicator pills get a small pulsing dot on the left: green when playing, grey when off


FEATURE 4 — Complete missing Settings sections
Audio settings (currently "Coming soon"):
Ambient synthesis quality: Low / Medium / High
Radio stream buffer: Small (2s) / Medium (5s) / Large (10s)
Crossfade duration: slider 0–5 seconds
Enable spatial audio: toggle (disabled on web, 🖥 desktop tooltip)
Master volume normalization: toggle
Data settings (currently "Coming soon"):
Export all data: button → downloads JSON
Import backup: button → opens file picker
Clear events: button (destructive, red)
Clear canvas data: button (destructive, red)
Clear favorites: button
Storage used: mono font readout "Events: 2.1 KB · Canvas: 8.4 KB · Total: 10.5 KB"

FEATURE 5 — Empty states
Add empty states for:

No events: "No events yet — save your current mix" with ghost CTA
No canvas elements: "Your canvas is empty — click a tool to start" with faint CSS geometric shapes as illustration
No radio favorites: "No favorites yet — heart a station to save it"

All empty states: centered, textSecondary color, 13px, ghost button if applicable.

WEB LIMITATION PHILOSOPHY
Never block. Never modal. Never aggressive.
Limitations appear only as greyed control + 🖥 icon + tooltip on hover, and one quiet sidebar card at the bottom.
Download CTA reads: "Download StanSsion v1.0"

Apply all changes maintaining existing design tokens exactly. No new colors unless specified. Keep glassmorphism, dark theme, Inter + JetBrains Mono. StanSsion should feel premium, intimate, and calm — worthy of the person who inspired it.