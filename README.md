# grafana-timeline

## Why? It’s easy to get lost in time.
When you’re zooming in, jumping around, comparing spikes — it can be hard to stay oriented when you mind is also on problem solving and understanding the data.

## Spatial manipulation of time
The timebar introduces spatial manipulation of time to Grafana dashboards (or apps like drilldown). You can see where you are in time, remember where you've been with visual aid, and move through time directly — with brushing, dragging, zooming, and playback-style control.

This helps offload your mental stack so you can focus on what matters: the data, not the date math. The timebar gives you a clear visual anchor in the flow of time.



https://github.com/user-attachments/assets/092082a3-3747-404a-ac87-566acd19275a



### Controls
 - Pan / Zoom the time line via the buttons or with the mouse wheel for zoom and dragging on x-axis (without changing time selection)
 - Drag the selection to shift time
 - Resize the selection using side handle bars to shrink of expand the window
 - Draw a new selection on the time line
 - Use a picker to set absolute time for the context window (note: the selection doesn't resize properly at the moment, it should shrink when effectively zooming out like the zoom button / mouse control does but doesn't)

## Imagineering future additions
 - Visual context in the background: e.g. spark lines, or density behind the timeline, annotations
 - Multi-range selection: What if you could hold down ⌘ or Shift and brush a second time range? Compare week-over-week, isolate anomalies, or align trace spans.
 - Snap-to dynamics: The brush could gently "snap" to meaningful anchors, tick marks, log events, etc
 - Visual History: Show past selected time ranges visually 

## About Code
This started as hackathon/AI code (a single 580-line panel hacking a ref-flag state machine over a uPlot
overlay). It has since been refactored into three testable layers — a pure time-math model, a
`useReducer` state machine, and a presentational `<TimeBar>` component, with the panel as a thin adapter.
See [`ARCHITECTURE.md`](grafana-grafanatimeline-panel/ARCHITECTURE.md) for the design and the state/event
model. It is still a panel (not yet a core Scenes component) and still overlays uPlot rather than driving
it fully natively — see ARCHITECTURE.md for what remains.
[Dashboard JSON used in video](https://github.com/user-attachments/files/21001198/Time.bar-1751381534278.json)
