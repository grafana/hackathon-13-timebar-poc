# grafana-timeline

## Why? It’s easy to get lost in time.
When you’re zooming in, jumping around, comparing spikes — it can be hard to stay oriented when you mind is also on problem solving and understanding the data.

## Spatial manipulation of time
The timebar introduces spatial manipulation of time to Grafana dashboards (or apps like drilldown). You can see where you are in time, remember where you've been with visual aid, and move through time directly — with brushing, dragging, zooming, and playback-style control.

This helps offload your mental stack so you can focus on what matters: the data, not the date math. The timebar gives you a clear visual anchor in the flow of time.

https://github.com/user-attachments/assets/20deefc4-7c4b-47b8-9475-16b99614e350

### Controls
 - Pan / Zoom the time line via the buttons or with the mouse wheel for zoom and dragging on x-axis (without changing time selection)
 - Drag the selection to shift time
 - Resize the selection using side handle bars to shrink of expand the window
 - Draw a new selection on the time line
 - Use a picker to set absolute time for the context window
 - Recenter Context button
 - Can use existing:
   - forward, back and zoom buttons on time picker.
   - auto-refresh
   - Brush selection on other panels

## Imagineering future additions
 - Visual context in the background: e.g. spark lines, or density behind the timeline, annotations
 - Multi-range selection: What if you could hold down ⌘ or Shift and brush a second time range? Compare week-over-week, isolate anomalies, or align trace spans.
 - Snap-to dynamics: The brush could gently "snap" to meaningful anchors, tick marks, log events, etc
 - Visual History: Show past selected time ranges visually 

## About Code
**Don't look at it** ;-) This is largely AI/hackathon code, and is panel instead of a proper component, and we are hacking an overlay ontop of uPlot instead of working with uPlot more directly. So this is a hack to get an interactive PoC of the idea.

[Dashboard JSON used in video](https://github.com/user-attachments/files/21039528/Time.bar-1751552464591.json)
