import { durationToMs, selectionFromRelativeDuration } from './duration';

describe('durationToMs', () => {
  it('parses simple single-unit durations', () => {
    expect(durationToMs('12h')).toBe(43_200_000);
    expect(durationToMs('2d')).toBe(172_800_000);
    expect(durationToMs('1h')).toBe(3_600_000);
    expect(durationToMs('30s')).toBe(30_000);
    expect(durationToMs('15m')).toBe(900_000);
  });

  it('parses SPACE-separated compound durations', () => {
    // NOTE: the compound form requires a space. `@grafana/data`'s parseDuration('1h 30m')
    // yields { hours: 1, minutes: 30 }.
    expect(durationToMs('1h 30m')).toBe(3_600_000 + 30 * 60_000);
  });

  it('returns null for the space-LESS compound form (surprising: docstring calls "1h30m" valid)', () => {
    // parseDuration('1h30m') returns {} -> 0ms -> null. The `duration.ts` docstring lists
    // "1h30m" as a valid example, but without a space it does NOT parse. Latent doc bug.
    expect(durationToMs('1h30m')).toBeNull();
  });

  it('returns null for garbage / non-duration strings', () => {
    expect(durationToMs('abc')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(durationToMs('')).toBeNull();
  });

  it('treats a genuine zero duration as valid (0), used by "Same as timepicker"', () => {
    expect(durationToMs('0s')).toBe(0);
    expect(durationToMs('0h')).toBe(0);
  });

  it('rejects a negatively-signed duration (upstream parseDuration silently drops the sign)', () => {
    expect(durationToMs('-5m')).toBeNull();
  });
});

describe('selectionFromRelativeDuration', () => {
  it('returns [dashboardTo - ms, dashboardTo] for a valid duration', () => {
    const to = 100_000_000;
    expect(selectionFromRelativeDuration(to, '1h')).toEqual({ from: to - 3_600_000, to });
    expect(selectionFromRelativeDuration(to, '6h')).toEqual({ from: to - 21_600_000, to });
    expect(selectionFromRelativeDuration(to, '2d')).toEqual({ from: to - 172_800_000, to });
  });

  it('returns null when the duration is invalid', () => {
    expect(selectionFromRelativeDuration(1000, 'abc')).toBeNull();
    expect(selectionFromRelativeDuration(1000, '')).toBeNull();
    expect(selectionFromRelativeDuration(1000, '0s')).toBeNull();
  });
});
