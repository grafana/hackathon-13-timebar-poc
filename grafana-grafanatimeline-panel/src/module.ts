import { PanelPlugin } from '@grafana/data';
import { PanelOptions } from './types';
import { SimplePanel } from './components/SimplePanel';
import { CONTEXT_ZOOM_FACTOR } from './timebar/timeModel';

export const plugin = new PanelPlugin<PanelOptions>(SimplePanel).setPanelOptions((builder) =>
  builder.addSliderInput({
    path: 'contextZoomFactor',
    name: 'Context zoom factor',
    description: 'How many times wider than the selection the initial/reset context window is.',
    defaultValue: CONTEXT_ZOOM_FACTOR,
    settings: { min: 2, max: 32, step: 1 },
  })
);
