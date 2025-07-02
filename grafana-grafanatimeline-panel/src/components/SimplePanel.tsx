import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { PanelProps, AbsoluteTimeRange } from '@grafana/data';
import { SimpleOptions } from 'types';
import { css, cx } from '@emotion/css';
import { AxisPlacement, UPlotChart, UPlotConfigBuilder, useStyles2, useTheme2, IconButton, Popover } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { ContextWindowSelector } from './ContextWindowSelector';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = (theme: ReturnType<typeof useTheme2>) => ({
  wrapper: css`
    font-family: Open Sans;
    position: relative;
  `,
  resizeHandle: css`
    position: absolute;
    top: 0;
    width: 8px;
    height: 100%;
    background: linear-gradient(to right, rgba(0, 123, 255, 0.4), rgba(0, 123, 255, 0.2));
    border: 1px solid rgba(0, 123, 255, 0.8);
    cursor: ew-resize;
    z-index: 11;
    box-shadow: 0 0 4px rgba(0, 123, 255, 0.5);
    transition: background 0.2s;
    &:hover {
      background: rgba(0, 123, 255, 0.6);
    }
  `,
  controlRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  `,
  popoverContent: css`
    background-color: ${theme.colors.background.primary};
    padding: 8px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  `,
});

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id, onChangeTimeRange }) => {
  const theme = useTheme2();
  const styles = useStyles2(() => getStyles(theme));
  const now = Date.now();

  const dashboardFrom = data.timeRange.from.valueOf();
  const dashboardTo = data.timeRange.to.valueOf();

  const computeContextWindowFromSelection = (from: number, to: number): AbsoluteTimeRange => {
    const mid = (from + to) / 2;
    const span = to - from;
    const zoomSpan = span * 8;

    let newFrom = mid - zoomSpan / 2;
    let newTo = mid + zoomSpan / 2;

    if (newTo > now) {
      const shift = newTo - now;
      newFrom -= shift;
      newTo = now;
    }

    return { from: newFrom, to: newTo };
  };

  const [timelineRange, setTimelineRange] = useState({ from: dashboardFrom, to: dashboardTo });
  const [visibleRange, setVisibleRangeState] = useState<AbsoluteTimeRange>(
    computeContextWindowFromSelection(dashboardFrom, dashboardTo)
  );

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const suppressNextDashboardUpdate = useRef(false);
  const isProgrammaticSelect = useRef(false);
  const skipNextSelectUpdate = useRef(false);
  const uplotRef = useRef<uPlot | null>(null);
  const isDragging = useRef(false);

  const isPanning = useRef(false);
  const wheelListenerRef = useRef<((e: WheelEvent) => void) | null>(null);

  const handlePanStart = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const u = uplotRef.current;
      if (!u || isDragging.current) {
        return;
      }

      const startX = e instanceof MouseEvent ? e.clientX : e.nativeEvent.clientX;
      const startFrom = visibleRange.from;
      const startTo = visibleRange.to;
      const pixelsToMs = (startTo - startFrom) / u.bbox.width;

      isPanning.current = true;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaPx = moveEvent.clientX - startX;
        const deltaMs = -deltaPx * pixelsToMs;
        const newFrom = startFrom + deltaMs;
        const newTo = startTo + deltaMs;
        setVisibleRange({ from: newFrom, to: newTo }, true);
      };

      const onMouseUp = () => {
        isPanning.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [visibleRange.from, visibleRange.to]
  );

  const [dragStyles, setDragStyles] = useState<{
    dragOverlayStyle?: React.CSSProperties;
    leftHandleStyle?: React.CSSProperties;
    rightHandleStyle?: React.CSSProperties;
  }>({});

  const updateOverlay = useCallback(() => {
    const u = uplotRef.current;
    if (!u) {
      return;
    }

    const left = u.valToPos(timelineRange.from, 'x') + u.bbox.left;
    const right = u.valToPos(timelineRange.to, 'x') + u.bbox.left;

    const handleWidth = 6;
    const handleHeight = u.bbox.height * 0.6;
    const topOffset = (u.bbox.height - handleHeight) / 2;

    setDragStyles({
      dragOverlayStyle: {
        position: 'absolute',
        top: 0,
        left,
        width: right - left,
        height: u.bbox.height,
        cursor: 'grab',
        background: 'rgba(0, 123, 255, 0.1)',
        zIndex: 10,
      },
      leftHandleStyle: {
        position: 'absolute',
        top: topOffset,
        left: left - handleWidth,
        width: handleWidth,
        height: handleHeight,
        cursor: 'ew-resize',
        background: 'rgba(0, 123, 255, 0.6)',
        borderRadius: 2,
        zIndex: 11,
      },
      rightHandleStyle: {
        position: 'absolute',
        top: topOffset,
        left: right,
        width: handleWidth,
        height: handleHeight,
        cursor: 'ew-resize',
        background: 'rgba(0, 123, 255, 0.6)',
        borderRadius: 2,
        zIndex: 11,
      },
    });
  }, [timelineRange.from, timelineRange.to]);

  useEffect(() => {
    updateOverlay();
  }, [updateOverlay, visibleRange, timelineRange.from, timelineRange.to]);

  const lastDashboardRange = useRef<AbsoluteTimeRange>({
    from: dashboardFrom,
    to: dashboardTo,
  });

  useEffect(() => {
    const dashboardChanged =
      lastDashboardRange.current.from !== dashboardFrom || lastDashboardRange.current.to !== dashboardTo;

    const timelineMatchesDashboard =
      Math.abs(timelineRange.from - dashboardFrom) < 1000 && Math.abs(timelineRange.to - dashboardTo) < 1000;

    if (dashboardChanged && !timelineMatchesDashboard) {
      setTimelineRange({ from: dashboardFrom, to: dashboardTo });
    }

    lastDashboardRange.current = { from: dashboardFrom, to: dashboardTo };
  }, [dashboardFrom, dashboardTo, timelineRange.from, timelineRange.to]);

  const setVisibleRange = (range: AbsoluteTimeRange, suppressDashboardUpdate = false) => {
    setVisibleRangeState(range);
    if (suppressDashboardUpdate) {
      suppressNextDashboardUpdate.current = true;
      skipNextSelectUpdate.current = true;
      isProgrammaticSelect.current = true;
    }
  };

  const timeField = data.series[0]?.fields.find((f) => f.type === 'time');
  const valueField = data.series[0]?.fields.find((f) => f.type === 'number');
  const timeValues = timeField?.values ?? [];
  const valueValues = valueField?.values ?? [];

  const zoomContextWindow = (factor: number) => {
    const mid = (visibleRange.from + visibleRange.to) / 2;
    const span = ((visibleRange.to - visibleRange.from) * factor) / 2;
    const newFrom = mid - span;
    const newTo = mid + span;
    setVisibleRange({ from: newFrom, to: newTo }, true);
  };

  const panContextWindow = (direction: 'left' | 'right') => {
    const span = visibleRange.to - visibleRange.from;
    const shift = span * 0.25;
    const delta = direction === 'left' ? -shift : shift;
    setVisibleRange({ from: visibleRange.from + delta, to: visibleRange.to + delta }, true);
  };

  const resetContextWindow = () => {
    const newRange = computeContextWindowFromSelection(timelineRange.from, timelineRange.to);
    suppressNextDashboardUpdate.current = true;
    setVisibleRange(newRange, true);
  };

  const builder = useMemo(() => {
    const b = new UPlotConfigBuilder();

    b.setCursor({ y: false });

    b.addAxis({
      placement: AxisPlacement.Bottom,
      scaleKey: 'x',
      isTime: true,
      theme,
    });

    b.addHook('setSelect', (u: uPlot) => {
      if (isProgrammaticSelect.current || skipNextSelectUpdate.current) {
        isProgrammaticSelect.current = false;
        skipNextSelectUpdate.current = false;
        return;
      }
      if (isDragging.current) {
        return;
      }

      const xDrag = Boolean(u.cursor?.drag?.x);
      if (xDrag && u.select.left != null && u.select.width != null) {
        const from = u.posToVal(u.select.left, 'x');
        const to = u.posToVal(u.select.left + u.select.width, 'x');
        const newRange: AbsoluteTimeRange = { from, to };
        setTimelineRange(newRange);
        if (!suppressNextDashboardUpdate.current) {
          onChangeTimeRange(newRange);
        }
        suppressNextDashboardUpdate.current = false;
      }
    });

    b.addHook('ready', (u: uPlot) => {
      uplotRef.current = u;

      // Store the wheel listener so it can be reused in the overlay div
      wheelListenerRef.current = (e: WheelEvent) => {
        e.preventDefault(); // prevent page scroll
        const zoomBase = 0.8;
        const zoomFactor = e.deltaY < 0 ? zoomBase : 1 / zoomBase;

        const rect = u.root.getBoundingClientRect();
        const cursorX = e.clientX - rect.left - u.bbox.left;
        const cursorVal = u.posToVal(cursorX, 'x');

        const span = visibleRange.to - visibleRange.from;
        const newSpan = span * zoomFactor;
        const newFrom = cursorVal - ((cursorVal - visibleRange.from) / span) * newSpan;
        const newTo = newFrom + newSpan;

        setVisibleRange({ from: newFrom, to: newTo }, true);
      };

      // Attach wheel zoom to uPlot overlay
      const over = u.root.querySelector('.u-over') as HTMLElement;
      if (over && wheelListenerRef.current) {
        over.addEventListener('wheel', wheelListenerRef.current, { passive: false });

        (u as any)._cleanupWheelZoom = () => {
          over.removeEventListener('wheel', wheelListenerRef.current!);
        };
      }

      // Draw selection brush
      requestAnimationFrame(() => {
        const left = u.valToPos(timelineRange.from, 'x');
        const right = u.valToPos(timelineRange.to, 'x');
        u.setSelect({
          left,
          top: 0,
          width: right - left,
          height: u.bbox.height,
        });
        updateOverlay();
      });

      // Enable pan drag on bottom axis
      const bottomAxis = u.root.querySelector('.u-axis') as HTMLElement;
      if (bottomAxis) {
        bottomAxis.style.cursor = 'grab';
        const listener = (e: MouseEvent) => handlePanStart(e);
        bottomAxis.addEventListener('mousedown', listener);
        (u as any)._cleanupBottomAxisPan = () => {
          bottomAxis.removeEventListener('mousedown', listener);
        };
      }
    });

    b.addHook('destroy', (u: uPlot) => {
      if ((u as any)._cleanupBottomAxisPan) {
        (u as any)._cleanupBottomAxisPan();
      }
      if ((u as any)._cleanupWheelZoom) {
        (u as any)._cleanupWheelZoom();
      }
    });

    const internalConfig = b.getConfig();
    internalConfig.scales = internalConfig.scales ?? {};
    internalConfig.scales.x = {
      ...internalConfig.scales.x,
      range: [visibleRange.from, visibleRange.to],
    };

    return b;
  }, [
    theme,
    visibleRange.from,
    visibleRange.to,
    timelineRange.from,
    timelineRange.to,
    handlePanStart,
    onChangeTimeRange,
    updateOverlay,
  ]);

  const handleDrag = (e: React.MouseEvent, kind: 'move' | 'left' | 'right') => {
    const u = uplotRef.current;
    if (!u) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    isDragging.current = true;

    const startX = e.clientX;
    const origFrom = timelineRange.from;
    const origTo = timelineRange.to;
    let newFrom = origFrom;
    let newTo = origTo;

    const MIN_WIDTH_PX = 10;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;

      const origFromPx = u.valToPos(origFrom, 'x');
      const origToPx = u.valToPos(origTo, 'x');

      let fromPx = origFromPx;
      let toPx = origToPx;

      if (kind === 'move') {
        fromPx += deltaPx;
        toPx += deltaPx;
      } else if (kind === 'left') {
        fromPx = origFromPx + deltaPx;
        if (toPx - fromPx < MIN_WIDTH_PX) {
          fromPx = toPx - MIN_WIDTH_PX;
        }
      } else if (kind === 'right') {
        toPx = origToPx + deltaPx;
        if (toPx - fromPx < MIN_WIDTH_PX) {
          toPx = fromPx + MIN_WIDTH_PX;
        }
      }

      newFrom = u.posToVal(fromPx, 'x');
      newTo = u.posToVal(toPx, 'x');

      u.setSelect({
        left: fromPx,
        top: 0,
        width: toPx - fromPx,
        height: u.bbox.height,
      });
      updateOverlay();
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      isDragging.current = false;

      u.setSelect({ left: 0, width: 0, top: 0, height: 0 });
      if (u.cursor?.drag) {
        u.cursor.drag.x = false;
      }

      const newRange = { from: newFrom, to: newTo };
      setTimelineRange(newRange);
      if (!suppressNextDashboardUpdate.current) {
        onChangeTimeRange(newRange);
      }
      suppressNextDashboardUpdate.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  return (
    <div className={cx(styles.wrapper)} style={{ width, height }}>
      <div className={styles.controlRow}>
        <IconButton name="calendar-alt" tooltip="Set context window" onClick={(e) => setAnchorEl(e.currentTarget)} />
        {anchorEl && (
          <Popover
            referenceElement={anchorEl}
            show={true}
            content={
              <div className={styles.popoverContent}>
                <ContextWindowSelector
                  dashboardFrom={dashboardFrom}
                  dashboardTo={dashboardTo}
                  now={now}
                  uplotRef={uplotRef}
                  timelineRange={timelineRange}
                  visibleRange={visibleRange}
                  setVisibleRange={(r) => {
                    const oldVisibleFrom = visibleRange.from;
                    const oldVisibleTo = visibleRange.to;
                    const visibleSpan = oldVisibleTo - oldVisibleFrom;

                    const relFrom = (timelineRange.from - oldVisibleFrom) / visibleSpan;
                    const relTo = (timelineRange.to - oldVisibleFrom) / visibleSpan;

                    const newVisibleFrom = r.from;
                    const newVisibleTo = r.to;

                    const newTimelineFrom = newVisibleFrom + relFrom * (newVisibleTo - newVisibleFrom);
                    const newTimelineTo = newVisibleFrom + relTo * (newVisibleTo - newVisibleFrom);

                    setVisibleRange(r, true);
                    requestAnimationFrame(() => {
                      suppressNextDashboardUpdate.current = true;
                      setTimelineRange({ from: newTimelineFrom, to: newTimelineTo });

                      const u = uplotRef.current;
                      if (u) {
                        u.setSelect({ left: 0, top: 0, width: 0, height: 0 });
                      }
                    });
                  }}
                  setTimelineRange={setTimelineRange}
                  onClose={() => setAnchorEl(null)}
                />
              </div>
            }
          />
        )}
        <IconButton tooltip="Pan left" name="arrow-left" onClick={() => panContextWindow('left')} />
        <IconButton tooltip="Zoom out context" name="search-minus" onClick={() => zoomContextWindow(2)} />
        <IconButton tooltip="Zoom in context" name="search-plus" onClick={() => zoomContextWindow(0.5)} />
        <IconButton tooltip="Pan right" name="arrow-right" onClick={() => panContextWindow('right')} />
        <IconButton tooltip="Reset context window" name="crosshair" onClick={resetContextWindow} />
      </div>
      <div style={{ position: 'relative', width: width - 100, height: 50 }}>
        <UPlotChart data={[timeValues, valueValues]} width={width - 100} height={50} config={builder} />
        {dragStyles.dragOverlayStyle && (
          <>
            <div
              style={dragStyles.dragOverlayStyle}
              onMouseDown={(e) => handleDrag(e, 'move')}
              onWheel={(e) => wheelListenerRef.current?.(e.nativeEvent)}
            />
            <div
              className={styles.resizeHandle}
              style={dragStyles.leftHandleStyle}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleDrag(e, 'left');
              }}
            />
            <div
              className={styles.resizeHandle}
              style={dragStyles.rightHandleStyle}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleDrag(e, 'right');
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};
