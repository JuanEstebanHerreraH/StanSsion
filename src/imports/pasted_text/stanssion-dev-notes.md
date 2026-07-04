You are continuing development of StanSsion, a dark ambient audio + personal workspace web app built in React + TypeScript with inline styles and glassmorphism design tokens. Do not change any existing design tokens or visual system — only extend.

BUG FIXES (fix these first)
BUG 1 — Event params don't translate

Event cards show params like "Rain · Intensity 70% · Pomodoro 25m" hardcoded in English. These must use the tr translation object so they render correctly in both EN and ES. Create translation keys for ambient type names, timer mode names, and the param summary format.
BUG 2 — Timer not synced

The PlayerBar timer and the AudioDashboard timer are two independent countdowns. They must share a single timer state lifted to the App level. When the user starts/pauses/resets the timer in AudioDashboard, the PlayerBar reflects the exact same countdown in real time.
BUG 3 — Waveform uses Math.random() on every render

In RadioPanel, the waveform bar heights use Math.random() inline in JSX causing new values on every re-render and making bars jump instead of flow. Fix by computing heights once with useMemo or useRef and animating them with CSS keyframes only.
BUG 4 — Radio panel has no back navigation

When the user navigates from AudioDashboard into the RadioPanel via "Change station", there is no back button to return to AudioDashboard without switching to a different section entirely and coming back. Add a visible back button ← Back to Audio at the top left of the RadioPanel that returns to the audio screen while keeping the currently playing station active.
BUG 5 — kbps label is confusing

Replace the raw 128kbps / 320kbps bitrate labels in station rows with a cleaner quality indicator: a small colored dot + text. 320kbps = green dot + "HD", 128kbps = grey dot + "SD", anything in between = blue dot + "HQ". Keep the actual bitrate value accessible in a tooltip on hover for technical users.
BUG 6 — Canvas elements are not editable

Canvas elements (notes, task cards, idea cards) can be dragged and selected but the content cannot be edited. Notes and idea cards must allow double-click to enter edit mode, showing a textarea that fills the card body. Task cards must allow adding new tasks inline via a small + Add task button at the bottom of the task list, with an input that confirms on Enter and cancels on Escape. Editing must save to state on blur or Enter.

FEATURE 1 — Delete Events

Each event card gets a delete button: a small × icon in the top right corner, visible on card hover only. Clicking it shows an inline confirmation inside the card: "Delete this event? [Confirm] [Cancel]" — no modal. Confirming removes the event from state. The + New event inline form also gets a working Cancel that collapses it without saving.

FEATURE 2 — Custom Timers (replaces hardcoded Pomodoro/Sleep/Focus)

The three fixed timer tabs (Pomodoro · Sleep · Focus) become a fully dynamic system. Users can create their own timers with a custom name and duration, and delete them.
Timer structure:
{
  id: string
  name: string        // e.g. "Deep Read", "Power Nap", "Sprint"
  duration: number    // in minutes
}
Default timers (pre-loaded, deletable):
Pomodoro    → 25 min
Sleep       → 60 min
Focus       → 50 min
Timer panel layout:

Tabs are now rendered dynamically from the timers array
A small + icon at the end of the tab row opens an inline mini form: Name input + Duration input (minutes) + Save + Cancel
Each tab has a small × on hover to delete it (with inline confirmation: "Delete timer? [Yes] [No]")
Minimum 1 timer must always exist — if only one remains, the delete button is hidden
Timer state (selected tab, current countdown, running/paused) persists in component state and syncs to PlayerBar
All timer names use the translation system: default names translate (Pomodoro/Sleep/Focus), user-created names are stored as-is


FEATURE 3 — Complete Settings: Audio section

Replace "Coming soon" in Audio settings with:
Ambient synthesis quality     → Segment: Low / Medium / High (default: High)
Radio stream buffer           → Segment: Small (2s) / Medium (5s) / Large (10s) (default: Medium)
Crossfade duration            → Slider 0–5 seconds, value shown in mono font
Enable spatial audio          → Toggle (disabled on web: greyed + 🖥 tooltip "Available in desktop app")
Master volume normalization   → Toggle (default: on)

FEATURE 4 — Complete Settings: Data section

Replace "Coming soon" in Data settings with:
Export all data    → Button: downloads a JSON file with all events, timers, canvas elements, favorites
Import backup      → Button: opens file picker accepting .json only, merges data
Clear events       → Destructive button (red border): inline confirm "Are you sure? [Yes, clear] [Cancel]"
Clear canvas       → Destructive button (red border): same pattern
Clear favorites    → Destructive button (red border): same pattern
Storage estimate   → Mono font readout calculated from localStorage: "Events: 2.1 KB · Canvas: 8.4 KB · Total: 10.5 KB"

FEATURE 5 — Extended Appearance Settings (web-capable)
Full color customizer:

Replace the 6 fixed accent color circles with a proper color picker experience:

Show 6 preset swatches as before
Add a Custom swatch at the end (shows a gradient/rainbow indicator)
Clicking Custom opens an inline HEX input field + an HTML <input type="color"> native picker below it
The chosen color applies immediately to the live preview on the right
Chosen color is saved to localStorage as stanssion_accent

Per-section background system:

Add a new Settings row: Section Backgrounds

A segmented control to select which section to configure: Global / Audio / Workspace / Radio / Settings
Global = the default background for all sections that don't have a custom one
Each section can have: Default (use global) or Custom
Custom shows two options as cards:

Solid color: opens a color picker (same pattern as accent picker)
Image URL: a text input accepting a URL to an image used as background-image: cover


When navigating between sections the app applies the correct background with a smooth 0.3s fade transition
All background settings saved to localStorage as stanssion_bg_[section]

Font selector expanded:

Keep the existing Inter / Mono / Serif selector but add a 4th option:

Custom (App only): a greyed card with 🖥 icon and tooltip "Upload fonts in the desktop app". Non-functional on web, visible so users know the feature exists.


FEATURE 6 — Custom Ambient Configuration

In the AudioDashboard, below the Ambiente card, add a Save as Config button (small, ghost style).
Clicking it opens an inline form directly below the button:
Config name: [text input]
[Save Config]  [Cancel]
Saved configs appear as a horizontal scrollable strip below the Ambiente card, each as a small pill showing the emoji of the ambient type + config name. Clicking a pill instantly applies all stored values (ambient type, intensity, speed, density) to the current sliders with a smooth animated transition. Each pill has an × on hover with inline delete confirmation.
Config structure:
{
  id: string
  name: string
  ambientType: string
  emoji: string
  intensity: number
  speed: number
  density: number
}
All configs saved to localStorage as stanssion_configs. Translate the "Save as Config" label and form labels into the ES/EN system.

FEATURE 7 — Playlist (web: install CTA, app: future)

Add a Playlist navigation item to the sidebar between Audio and Workspace.
On web, the entire Playlist screen shows:
[🖥 icon large]
"Playlist is available in the desktop app"
"Upload and manage your own MP3 files natively,
 without size limits or browser restrictions."
[Download StanSsion] ← same download CTA as sidebar
Centered, calm, no aggression. Same style as other empty states. The sidebar nav item is fully visible and clickable — it just shows this screen on web. This plants the seed for the feature without frustrating the user.
Translate the screen text into ES/EN.

IMPLEMENTATION NOTES

Lift timer state to App level, pass down as props
All new features must respect the existing tr translation object — add new keys to both en and es in lang.ts for every new label
All localStorage keys use stanssion_ prefix
Web limitations always follow the same pattern: greyed control + 🖥 icon + tooltip, never a modal or block
No new external dependencies — use only what's already in the project
Maintain all existing design tokens exactly