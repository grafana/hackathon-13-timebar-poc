# Timebar architecture

## The concept

Two independent time ranges, in **epoch milliseconds**:

- **`contextWindow`** — the zoomed-out view the timebar renders (the uPlot x-scale range).
  "Where you're looking." Purely a view concern; changing it never changes the dashboard.
- **`selection`** — the active **dashboard** time range, drawn as a brushed box inside the context
  window. "Where you are." Committing a new selection is what drives the dashboard time.

```
context window:  |------------------------------------------------|   (e.g. last 7 days)
selection:                    [===============]                        (e.g. last 6 hours)
                              ^ drag to move   ^ resize handles
```

## How the *old* PoC worked (and why it was fragile)

Everything lived in one 580-line `SimplePanel.tsx`. It coordinated three sources of truth —
`visibleRange` (context), `timelineRange` (selection), and uPlot's own `setSelect` events — through
**seven `useRef` flags**: `suppressNextDashboardUpdate`, `isProgrammaticSelect`, `skipNextSelectUpdate`,
`isDragging`, `isPanning`, `applyRelativeContextWindow`, `lastDashboardRange`.

The core hazard: it drew the persistent selection by calling `u.setSelect(...)` itself, which *also*
fired uPlot's `setSelect` hook — so it needed `isProgrammaticSelect`/`skipNextSelectUpdate` to ignore
its own echoes. Those flags were only *consumed* inside the `setSelect` hook, but zoom/pan/wheel never
call `setSelect`; they only worked because changing the context rebuilt the uPlot config on every tick,
destroying and recreating the whole instance, whose `ready` hook re-ran `setSelect`. Removing that
(the obvious perf fix) would silently swallow the first brush after any zoom. Plus: a suppress flag that
leaked out of panning, an effect tug-of-war guarded by a magic `<1000ms` tolerance, and no range clamping
(span could reach 0 → `NaN`).

## How it works *now*

Three layers, each independently testable:

### 1. Pure model — `timebar/timeModel.ts` (+ `timebar/duration.ts`)
Pure functions `(range, args) => range`: `computeContextWindow`, `zoomRange`, `panRange`,
`wheelZoomRange`, `extendedContext`, `clampRange`, `approxEqual`, `parseRelativeToken`. No React, no uPlot,
no DOM — 100% unit-tested. All the time math and clamping (min span, never past `now`) lives here.

### 2. State machine — `timebar/timebarState.ts`
A `useReducer` with an explicit interaction state instead of seven flags:

```
interaction: 'idle' | 'brushing' | 'moving' | 'resizingLeft' | 'resizingRight' | 'panning'
state:       { interaction, contextWindow, selection, relativeDuration }
```

```
                         ┌───────────────────────── IDLE ─────────────────────────┐
  brush on plot (uPlot   │   overlay        handle         axis           wheel /   │
  drag → setSelect) ─────┤   mousedown      mousedown      mousedown      buttons /  │
   = one-shot COMMIT     │      │              │              │           popover    │
                         ▼      ▼              ▼              ▼              │        │
                    (no state) MOVING     RESIZING L/R      PANNING         │        │
                         │      │              │              │             │        │
                    setSelection (no emit) on mousemove       setContext    setContext(no emit)
                         │      │              │              │  (no emit)   │        │
                         ▼      ▼(mouseup)     ▼(mouseup)     ▼(mouseup)     ▼        │
                    COMMIT: setSelection + EMIT onChangeTimeRange            └────────┘
```

Key simplifications that delete the flag soup:
- **uPlot select is transient input only.** We never call `u.setSelect` to *display* the selection —
  the persistent selection is our own overlay. uPlot's native drag-select is used solely to *create* a
  new selection; the `setSelect` hook reads the range, commits it, and immediately clears uPlot's box.
  Because we never programmatically `setSelect`, the hook only ever fires from a real user drag →
  `isProgrammaticSelect`/`skipNextSelectUpdate` are gone.
- **Emit is decided by the handler, not a flag.** Only selection-commit handlers (brush end, move end,
  resize end) call `onChangeTimeRange`. Context changes (zoom/pan/wheel/popover) and dashboard-sync never
  emit → `suppressNextDashboardUpdate` is gone.
- **One explicit echo guard.** After we emit, we remember `lastEmitted`; the dashboard-sync effect
  ignores an incoming `value` that matches `lastEmitted` (or the current selection) within a tolerance.
  This replaces `lastDashboardRange` + the scattered `<1000ms` checks with a single named comparison.
- **All range math is clamped** in the model (min span, never past `now`) → no `NaN`/zero-span states.

### 3. View — `timebar/TimeBar.tsx` (+ `timebar/ContextWindowSelector.tsx`)
A presentational, framework-agnostic component: props in (`value`, `now`, `width`, `height`, `time`,
`values`, `onChangeTimeRange`), UI out. It owns the uPlot instance, config built **once** (keyed on
theme) — no more per-tick recreate. The x-scale is **pinned** to the context window by a scale `range`
function (so `uPlot.setData` can never auto-range over it) and pushed on change via `setScale`; the data
array is memoized so `setData` only fires on real data changes. The overlay handles are positioned by a
**single** value↔pixel convention computed directly from the context window and plot geometry (not
`valToPos`), which is both dpr-correct and independent of `setScale`'s async (microtask) commit. Knows
nothing about Grafana panels.

### Adapter — `components/SimplePanel.tsx`
Thin: maps `PanelProps` → `<TimeBar>`, extracts the background series from `data.series`, and forwards
`onChangeTimeRange`. This is the seam that lets the same `<TimeBar>` later back a Scenes
`SceneTimeNavigator` in core (see the assessment) — only the adapter changes.

## Intentional behaviour refinements (documented, not accidental)
- **Zooming/panning the context no longer moves the dashboard selection.** The selection keeps its
  absolute time and simply appears at a new screen position — matching every real navigator
  (Highcharts/ECharts/Plotly). The old popover "remap selection on context change" workaround is dropped.
- **On external dashboard changes** (time picker, autorefresh, another panel) the selection tracks the
  dashboard, and the context window follows so the selection stays framed (relative windows re-extend;
  otherwise the context shifts by the same delta), preserving the user's zoom level.
