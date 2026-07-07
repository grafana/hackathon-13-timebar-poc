import { test, expect } from '@grafana/plugin-e2e';

// NOTE: these require a running Grafana (`yarn server`) and are not part of the unit test suite.
// The pure model/state machine is covered by src/timebar/*.test.ts.

test('renders the timebar and its controls', async ({ panelEditPage, readProvisionedDataSource, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await panelEditPage.datasource.set(ds.name);
  await panelEditPage.setVisualization('Grafana-Timeline-Panel');

  await expect(page.getByTestId('timebar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in context' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset context window' })).toBeVisible();
});

test('renders the timebar even when the panel has no data', async ({ panelEditPage, page }) => {
  // Unlike the scaffold panel, the timebar is a time navigator and is useful without any series,
  // so it renders instead of showing a "No data" error view.
  await panelEditPage.setVisualization('Grafana-Timeline-Panel');
  await expect(page.getByTestId('timebar')).toBeVisible();
});
