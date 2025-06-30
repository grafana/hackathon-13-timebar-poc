import React, { useMemo, useRef, useState } from 'react';
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
} from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = () => {
  return {
    wrapper: css`
      font-family: Open Sans;
      position: relative;
    `,
    svg: css`
      position: absolute;
      top: 0;
      left: 0;
    `,
    textBox: css`
      position: absolute;
      bottom: 0;
      left: 0;
      padding: 10px;
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
  };
};

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

  const dashboardFrom = data.timeRange.from.valueOf();
  const dashboardTo = data.timeRange.to.valueOf();
  const now = Date.now();

  const [timelineRange, setTimelineRange] = useState({ from: dashboardFrom, to: dashboardTo });
  const [visibleRange, setVisibleRange] = useState<AbsoluteTimeRange>({
    from: dashboardFrom - 7 * 24 * 60 * 60 * 1000,
    to: Math.min(dashboardTo, now),
  });

  const uplotRef = useRef<uPlot | null>(null);

  const timeField = data.series[0]?.fields.find(f => f.type === 'time');
  const valueField = data.series[0]?.fields.find(f => f.type === 'number');
  const timeValues = timeField?.values.toArray() ?? [];
  const valueValues = valueField?.values.toArray() ?? [];

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

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  return (
    <div className={cx(styles.wrapper)} style={{ width, height }}>
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
              onMouseDown={(e) => {
                const u = uplotRef.current;
                if (!u) return;

                const startX = e.clientX;
                const origFrom = timelineRange.from;
                const origTo = timelineRange.to;

                let currentFrom = origFrom;
                let currentTo = origTo;

                const onMouseMove = (moveEvent: MouseEvent) => {
                  const deltaPx = moveEvent.clientX - startX;
                  const deltaVal = u.posToVal(u.valToPos(origFrom, 'x') + deltaPx, 'x') - origFrom;

                  currentFrom = origFrom + deltaVal;
                  currentTo = origTo + deltaVal;

                  u.setSelect({
                    left: u.valToPos(currentFrom, 'x'),
                    top: 0,
                    width: u.valToPos(currentTo, 'x') - u.valToPos(currentFrom, 'x'),
                    height: u.bbox.height,
                  });
                };

                const onMouseUp = () => {
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onMouseUp);
                  setTimelineRange({ from: currentFrom, to: currentTo });
                  onChangeTimeRange({ from: currentFrom, to: currentTo });
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
              }}
            />
            <div
              className={styles.resizeHandle}
              style={leftHandleStyle}
              onMouseDown={(e) => {
                const u = uplotRef.current;
                if (!u) return;
                e.stopPropagation();
                const startX = e.clientX;
                const origFrom = timelineRange.from;

                let currentFrom = origFrom;

                const onMouseMove = (moveEvent: MouseEvent) => {
                  const deltaPx = moveEvent.clientX - startX;
                  currentFrom = u.posToVal(u.valToPos(origFrom, 'x') + deltaPx, 'x');

                  u.setSelect({
                    left: u.valToPos(currentFrom, 'x'),
                    top: 0,
                    width: u.valToPos(timelineRange.to, 'x') - u.valToPos(currentFrom, 'x'),
                    height: u.bbox.height,
                  });
                };

                const onMouseUp = () => {
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onMouseUp);
                  setTimelineRange({ from: currentFrom, to: timelineRange.to });
                  onChangeTimeRange({ from: currentFrom, to: timelineRange.to });
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
              }}
            />
            <div
              className={styles.resizeHandle}
              style={rightHandleStyle}
              onMouseDown={(e) => {
                const u = uplotRef.current;
                if (!u) return;
                e.stopPropagation();
                const startX = e.clientX;
                const origTo = timelineRange.to;

                let currentTo = origTo;

                const onMouseMove = (moveEvent: MouseEvent) => {
                  const deltaPx = moveEvent.clientX - startX;
                  currentTo = u.posToVal(u.valToPos(origTo, 'x') + deltaPx, 'x');

                  u.setSelect({
                    left: u.valToPos(timelineRange.from, 'x'),
                    top: 0,
                    width: u.valToPos(currentTo, 'x') - u.valToPos(timelineRange.from, 'x'),
                    height: u.bbox.height,
                  });
                };

                const onMouseUp = () => {
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onMouseUp);
                  setTimelineRange({ from: timelineRange.from, to: currentTo });
                  onChangeTimeRange({ from: timelineRange.from, to: currentTo });
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};
