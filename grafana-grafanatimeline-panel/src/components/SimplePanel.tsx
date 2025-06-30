import React, { useState } from 'react';
import { PanelProps, AbsoluteTimeRange, parseDuration, durationToMilliseconds } from '@grafana/data';
import { SimpleOptions } from 'types';
import { css, cx } from '@emotion/css';
import { AxisPlacement, Combobox, UPlotChart, UPlotConfigBuilder, useStyles2, useTheme2 } from '@grafana/ui';
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
  {label: 'Same as timepicker', value: '0h'},
  {label: 'Last 24 hours', value: '24h'},
  {label: 'Last 1 week', value: '7d'},
  {label: 'Last 2 weeks', value: '14d'},
  {label: 'Last 30 days', value: '30d'},
]

/*

todo: turn off horizontal cursor line

*/

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id, onChangeTimeRange }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const builder = new UPlotConfigBuilder();
  const [timelineRange, setTimelineRange] = useState({from: data.timeRange.from.valueOf(), to: data.timeRange.to.valueOf()});


  builder.addAxis({isTime: true, placement: AxisPlacement.Bottom, theme, scaleKey: 'x'});

  builder.addHook('setSelect', (u) => {
      const xDrag = Boolean(u.cursor!.drag!.x);

      let xSel: AbsoluteTimeRange | null = null;

      // get x selection
      if (xDrag) {
        xSel = {
          to: u.posToVal(u.select.left!, 'x'),
          from: u.posToVal(u.select.top!, 'x'),
        };
      }
      if (xSel !== null) {
        onChangeTimeRange(xSel);
      }
  })

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
          placeholder='Select added window size...'
          options={OPTIONS}
          onChange={(val)=>{
            const selectedDurationMs = durationToMilliseconds(parseDuration(val.value));
            const fromVal = data.timeRange.from.valueOf() - selectedDurationMs;
            const toVal = data.timeRange.to.valueOf() + selectedDurationMs;
            setTimelineRange({from: fromVal, to: toVal})
          }}
          />
      <UPlotChart data={[[timelineRange.from, timelineRange.to]]} width={width-100} height={50} config={builder}/>
    </div>
  );
};
