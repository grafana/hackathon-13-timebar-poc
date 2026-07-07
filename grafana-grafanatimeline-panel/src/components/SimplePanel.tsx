import React from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions } from '../types';
import { TimeBar } from '../timebar/TimeBar';

// Stable empty reference so the no-data case doesn't hand TimeBar a fresh array every render.
const EMPTY: number[] = [];

/**
 * Thin Grafana-panel adapter: maps `PanelProps` onto the framework-agnostic `<TimeBar>`. This is the only
 * Grafana-panel-specific seam — the same `<TimeBar>` could back a Scenes `SceneTimeNavigator` in core by
 * swapping just this adapter. See ARCHITECTURE.md.
 */
export const SimplePanel: React.FC<PanelProps<PanelOptions>> = ({ data, width, height, options, onChangeTimeRange }) => {
  const timeField = data.series[0]?.fields.find((f) => f.type === 'time');
  const valueField = data.series[0]?.fields.find((f) => f.type === 'number');

  return (
    <TimeBar
      value={{ from: data.timeRange.from.valueOf(), to: data.timeRange.to.valueOf() }}
      now={Date.now()}
      width={width}
      height={height}
      time={(timeField?.values ?? EMPTY) as number[]}
      values={(valueField?.values ?? EMPTY) as number[]}
      contextZoomFactor={options.contextZoomFactor}
      onChangeTimeRange={onChangeTimeRange}
    />
  );
};
