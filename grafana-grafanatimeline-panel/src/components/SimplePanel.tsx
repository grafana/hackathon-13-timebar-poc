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

  // Brush box state (the actual dashboard range)
  const [timelineRange, setTimelineRange] = useState({ from: dashboardFrom, to: dashboardTo });

  // Fixed view window (larger than the brush box)
  const [visibleRange, setVisibleRange] = useState<AbsoluteTimeRange>({
    from: dashboardFrom - 7 * 24 * 60 * 60 * 1000, // default to 1 week before
    to: Math.min(dashboardTo, now),
  });

  const uplotRef = useRef<uPlot | null>(null);

  // Extract time and value arrays
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

  // ✅ Patch internal config range
  const internalConfig = b.getConfig();
  internalConfig.scales = internalConfig.scales ?? {};
  internalConfig.scales.x = {
    ...internalConfig.scales.x,
    range: [visibleRange.from, visibleRange.to],
  };

  return b;
}, [theme, visibleRange, timelineRange.from, timelineRange.to, onChangeTimeRange]);

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  return (
    <div
      className={cx(
        styles.wrapper,
        css`
          width: ${width}px;
          height: ${height}px;
        `
      )}
    >
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

          // Optionally re-center brush box if you want
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
      <UPlotChart
        data={[timeValues, valueValues]}
        width={width - 100}
        height={50}
        config={builder}
      />
    </div>
  );
};