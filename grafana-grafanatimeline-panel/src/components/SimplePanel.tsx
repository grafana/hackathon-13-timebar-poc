import React from 'react';
import { PanelProps } from '@grafana/data';
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
  {label: 'Last 24 hours', value: 'now-24h'},
  {label: 'Last 1 week', value: 'now-7d'},
  {label: 'Last 2 weeks', value: 'now-14d'},
  {label: 'Last 30 days', value: 'now-30d'},
]

/*

todo: turn off horizontal cursor line

*/

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const builder = new UPlotConfigBuilder();

  builder.addAxis({isTime: true, placement: AxisPlacement.Bottom, theme, scaleKey: 'x'});

  builder.addHook('setSelect', (u) => {
            const xDrag = Boolean(u.cursor!.drag!.x);

            let xSel = null;

            // get x selection
            if (xDrag) {
              xSel = {
                from: u.posToVal(u.select.left!, 'x'),
                to: u.posToVal(u.select.top, 'x'),
              };
            }

            console.log(xSel);
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
          options={OPTIONS}
          onChange={()=>{}}
          />
      <UPlotChart data={[[data.timeRange.from.valueOf(), data.timeRange.to.valueOf()]]} width={width-100} height={50} config={builder}/>
    </div>
  );
};
