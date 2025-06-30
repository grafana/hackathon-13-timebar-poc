import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  PanelProps,
  AbsoluteTimeRange,
  parseDuration,
  durationToMilliseconds,
} from '@grafana/data';
import { SimpleOptions } from 'types';
import { css, cx } from '@emotion/css';
import {
  AxisPlacement,
  Combobox,
  UPlotChart,
  UPlotConfigBuilder,
  useStyles2,
  useTheme2,
  IconButton,
} from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = () => ({
  wrapper: css`
    font-family: Open Sans;
    position: relative;
  `,
  resizeHandle: css`
    position: absolute;
    top: 0;
    width: 6px;
    height: 100%;
    background: rgba(0, 123, 255, 0.2);
    cursor: ew-resize;
    z-index: 11;
  `,
  controlRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  `,
});

const OPTIONS = [
  { label: 'Same as timepicker', value: '0h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 1 week', value: '7d' },
  { label: 'Last 2 weeks', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
];

export const SimplePanel: React.FC<Props> = ({
  options,
  data,
  width,
  height,
  fieldConfig,
  id,
  onChangeTimeRange,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const now = Date.now();

  const dashboardFrom = data.timeRange.from.valueOf();
  const dashboardTo = data.timeRange.to.valueOf();

  const [timelineRange, setTimelineRange] = useState({ from: dashboardFrom, to: dashboardTo });
  const [visibleRange, setVisibleRange] = useState<AbsoluteTimeRange>({
    from: dashboardFrom - 7 * 24 * 60 * 60 * 1000,
    to: Math.min(dashboardTo, now),
  });

  useEffect(() => {
    setTimelineRange({ from: dashboardFrom, to: dashboardTo });
  }, [dashboardFrom, dashboardTo]);

  const uplotRef = useRef<uPlot | null>(null);
  const isDragging = useRef(false);

  const timeField = data.series[0]?.fields.find(f => f.type === 'time');
  const valueField = data.series[0]?.fields.find(f => f.type === 'number');
  const timeValues = timeField?.values.toArray() ?? [];
  const valueValues = valueField?.values.toArray() ?? [];

  const zoomContextWindow = (factor: number) => {
    const mid = (visibleRange.from + visibleRange.to) / 2;
    const span = (visibleRange.to - visibleRange.from) * factor / 2;
    const newFrom = mid - span;
    const newTo = mid + span;
    setVisibleRange({ from: newFrom, to: newTo });
  };

  const panContextWindow = (direction: 'left' | 'right') => {
    const span = visibleRange.to - visibleRange.from;
    const shift = span * 0.25;
    const delta = direction === 'left' ? -shift : shift;
    setVisibleRange({ from: visibleRange.from + delta, to: visibleRange.to + delta });
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
      if (isDragging.current) return;

      const xDrag = Boolean(u.cursor?.drag?.x);
      if (xDrag && u.select.left != null && u.select.width != null) {
        const from = u.posToVal(u.select.left, 'x');
        const to = u.posToVal(u.select.left + u.select.width, 'x');
        const newRange: AbsoluteTimeRange = { from, to };
        setTimelineRange(newRange);
        onChangeTimeRange(newRange);
      }
    });

    b.addHook('ready', (u: uPlot) => {
      uplotRef.current = u;
      const left = u.valToPos(timelineRange.from, 'x');
      const right = u.valToPos(timelineRange.to, 'x');
      u.setSelect({
        left,
        top: 0,
        width: right - left,
        height: u.bbox.height,
      });
    });

    const internalConfig = b.getConfig();
    internalConfig.scales = internalConfig.scales ?? {};
    internalConfig.scales.x = {
      ...internalConfig.scales.x,
      range: [visibleRange.from, visibleRange.to],
    };

    return b;
  }, [theme, visibleRange, timelineRange.from, timelineRange.to, onChangeTimeRange]);

  let dragOverlayStyle: React.CSSProperties | undefined = undefined;
  let leftHandleStyle: React.CSSProperties | undefined = undefined;
  let rightHandleStyle: React.CSSProperties | undefined = undefined;

  if (uplotRef.current) {
    const u = uplotRef.current;
    const left = u.valToPos(timelineRange.from, 'x') + u.bbox.left;
    const right = u.valToPos(timelineRange.to, 'x') + u.bbox.left;
    dragOverlayStyle = {
      position: 'absolute',
      top: 0,
      left,
      width: right - left,
      height: u.bbox.height,
      cursor: 'grab',
      background: 'rgba(0, 123, 255, 0.1)',
      zIndex: 10,
    };
    leftHandleStyle = {
      ...dragOverlayStyle,
      left,
      width: 6,
      cursor: 'ew-resize',
    };
    rightHandleStyle = {
      ...dragOverlayStyle,
      left: right - 6,
      width: 6,
      cursor: 'ew-resize',
    };
  }

  const handleDrag = (
    e: React.MouseEvent,
    kind: 'move' | 'left' | 'right'
  ) => {
    const u = uplotRef.current;
    if (!u) return;

    e.preventDefault();
    e.stopPropagation();

    isDragging.current = true;

    const startX = e.clientX;
    const origFrom = timelineRange.from;
    const origTo = timelineRange.to;
    let newFrom = origFrom;
    let newTo = origTo;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      const deltaVal = u.posToVal(u.valToPos(origFrom, 'x') + deltaPx, 'x') - origFrom;

      if (kind === 'move') {
        newFrom = origFrom + deltaVal;
        newTo = origTo + deltaVal;
      } else if (kind === 'left') {
        newFrom = u.posToVal(u.valToPos(origFrom, 'x') + deltaPx, 'x');
      } else if (kind === 'right') {
        newTo = u.posToVal(u.valToPos(origTo, 'x') + deltaPx, 'x');
      }

      u.setSelect({
        left: u.valToPos(newFrom, 'x'),
        top: 0,
        width: u.valToPos(newTo, 'x') - u.valToPos(newFrom, 'x'),
        height: u.bbox.height,
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      isDragging.current = false;

      u.setSelect({ left: 0, width: 0, top: 0, height: 0 });
      if (u.cursor?.drag) {
        u.cursor.drag.x = false;
      }

      setTimelineRange({ from: newFrom, to: newTo });
      onChangeTimeRange({ from: newFrom, to: newTo });
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
        <Combobox
          width="auto"
          minWidth={25}
          placeholder="Select added window size..."
          options={OPTIONS}
          onChange={(val) => {
            const extraWindow = durationToMilliseconds(parseDuration(val.value));
            const newFrom = dashboardFrom - extraWindow;
            const newTo = Math.min(dashboardTo + extraWindow, now);
            setVisibleRange({ from: newFrom, to: newTo });

            const u = uplotRef.current;
            if (u) {
              const left = u.valToPos(timelineRange.from, 'x');
              const right = u.valToPos(timelineRange.to, 'x');
              u.setSelect({
                left,
                top: 0,
                width: right - left,
                height: u.bbox.height,
              });
            }
          }}
        />
        <IconButton
          tooltip="Pan left"
          name="arrow-left"
          onClick={() => panContextWindow('left')}
        />
        <IconButton
          tooltip="Zoom out context"
          name="search-minus"
          onClick={() => zoomContextWindow(2)}
        />
        <IconButton
          tooltip="Zoom in context"
          name="search-plus"
          onClick={() => zoomContextWindow(0.5)}
        />
        <IconButton
          tooltip="Pan right"
          name="arrow-right"
          onClick={() => panContextWindow('right')}
        />
        <span style={{ fontSize: 12 }}>
          {new Date(visibleRange.from).toISOString().replace('T', ' ').slice(0, 19)} to {new Date(visibleRange.to).toISOString().replace('T', ' ').slice(0, 19)}
        </span>
      </div>
      <div style={{ position: 'relative', width: width - 100, height: 50 }}>
        <UPlotChart
          data={[timeValues, valueValues]}
          width={width - 100}
          height={50}
          config={builder}
        />
        {dragOverlayStyle && (
          <>
            <div
              style={dragOverlayStyle}
              onMouseDown={(e) => handleDrag(e, 'move')}
            />
            <div
              className={styles.resizeHandle}
              style={leftHandleStyle}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleDrag(e, 'left');
              }}
            />
            <div
              className={styles.resizeHandle}
              style={rightHandleStyle}
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
