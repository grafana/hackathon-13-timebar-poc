import {
  approxEqual,
  clampRange,
  computeContextWindow,
  CONTEXT_ZOOM_FACTOR,
  DASHBOARD_SYNC_TOLERANCE_MS,
  extendedContext,
  midOf,
  MIN_SPAN_MS,
  panRange,
  PAN_STEP_FRACTION,
  parseRelativeToken,
  spanOf,
  TimeRangeMs,
  WHEEL_ZOOM_BASE,
  wheelZoomRange,
  zoomRange,
} from './timeModel';

// A `now` far in the future so it never clips the windows under test unless we want it to.
const HUGE_NOW = 1e15;

describe('constants', () => {
  it('has the documented defaults', () => {
    expect(CONTEXT_ZOOM_FACTOR).toBe(8);
    expect(MIN_SPAN_MS).toBe(1000);
    expect(WHEEL_ZOOM_BASE).toBe(0.8);
    expect(PAN_STEP_FRACTION).toBe(0.25);
    expect(DASHBOARD_SYNC_TOLERANCE_MS).toBe(1000);
  });
});

describe('spanOf', () => {
  it('returns to - from', () => {
    expect(spanOf({ from: 0, to: 100 })).toBe(100);
    expect(spanOf({ from: -50, to: 50 })).toBe(100);
    expect(spanOf({ from: 100, to: 100 })).toBe(0);
  });

  it('is negative for reversed ends (no ordering here)', () => {
    expect(spanOf({ from: 100, to: 0 })).toBe(-100);
  });
});

describe('midOf', () => {
  it('returns the arithmetic midpoint', () => {
    expect(midOf({ from: 0, to: 100 })).toBe(50);
    expect(midOf({ from: -100, to: 100 })).toBe(0);
    expect(midOf({ from: 10, to: 10 })).toBe(10);
  });
});

describe('approxEqual', () => {
  const base: TimeRangeMs = { from: 1000, to: 2000 };

  it('is true for identical ranges', () => {
    expect(approxEqual(base, { from: 1000, to: 2000 })).toBe(true);
  });

  it('is true just inside tolerance on the `from` end', () => {
    expect(approxEqual(base, { from: 1000 + 999, to: 2000 })).toBe(true);
    expect(approxEqual(base, { from: 1000 - 999, to: 2000 })).toBe(true);
  });

  it('is true just inside tolerance on the `to` end', () => {
    expect(approxEqual(base, { from: 1000, to: 2000 + 999 })).toBe(true);
    expect(approxEqual(base, { from: 1000, to: 2000 - 999 })).toBe(true);
  });

  it('is false at exactly the tolerance (comparison is strict `<`)', () => {
    // A difference of exactly DASHBOARD_SYNC_TOLERANCE_MS is NOT within tolerance.
    expect(approxEqual(base, { from: 1000 + 1000, to: 2000 })).toBe(false);
    expect(approxEqual(base, { from: 1000, to: 2000 + 1000 })).toBe(false);
  });

  it('is false when the `from` end is outside tolerance', () => {
    expect(approxEqual(base, { from: 1000 + 1001, to: 2000 })).toBe(false);
  });

  it('is false when the `to` end is outside tolerance', () => {
    expect(approxEqual(base, { from: 1000, to: 2000 + 1001 })).toBe(false);
  });

  it('requires BOTH ends within tolerance', () => {
    // from inside, to outside
    expect(approxEqual(base, { from: 1000, to: 2000 + 5000 })).toBe(false);
    // from outside, to inside
    expect(approxEqual(base, { from: 1000 + 5000, to: 2000 })).toBe(false);
  });

  it('honours a custom tolerance', () => {
    expect(approxEqual({ from: 0, to: 0 }, { from: 0, to: 2 }, 3)).toBe(true);
    expect(approxEqual({ from: 0, to: 0 }, { from: 0, to: 5 }, 3)).toBe(false);
    // exactly at the custom tolerance -> false (strict)
    expect(approxEqual({ from: 0, to: 0 }, { from: 0, to: 3 }, 3)).toBe(false);
  });
});

describe('clampRange', () => {
  it('orders reversed ends (from > to)', () => {
    // Span (2000) is >= MIN_SPAN_MS, so only ordering is exercised, no widening.
    expect(clampRange({ from: 2000, to: 0 })).toEqual({ from: 0, to: 2000 });
  });

  it('leaves a normal (wide enough) range untouched', () => {
    const r: TimeRangeMs = { from: 0, to: 5000 };
    expect(clampRange(r)).toEqual({ from: 0, to: 5000 });
  });

  it('widens a sub-min-span range around its midpoint', () => {
    // span 100 < MIN_SPAN_MS (1000). mid = 150.
    const out = clampRange({ from: 100, to: 200 });
    expect(spanOf(out)).toBe(MIN_SPAN_MS);
    expect(midOf(out)).toBe(150);
    expect(out).toEqual({ from: 150 - 500, to: 150 + 500 });
  });

  it('widens a zero-span range around its midpoint', () => {
    const out = clampRange({ from: 500, to: 500 });
    expect(spanOf(out)).toBe(MIN_SPAN_MS);
    expect(midOf(out)).toBe(500);
    expect(out).toEqual({ from: 0, to: 1000 });
  });

  it('respects a custom minSpanMs', () => {
    const out = clampRange({ from: 0, to: 100 }, { minSpanMs: 4000 });
    expect(spanOf(out)).toBe(4000);
    expect(midOf(out)).toBe(50);
    expect(out).toEqual({ from: 50 - 2000, to: 50 + 2000 });
  });

  it('shifts the whole window back when it exceeds maxTo (span preserved)', () => {
    const out = clampRange({ from: 0, to: 5000 }, { maxTo: 3000 });
    expect(out).toEqual({ from: -2000, to: 3000 });
    expect(spanOf(out)).toBe(5000);
  });

  it('does not touch a range already within maxTo', () => {
    expect(clampRange({ from: 0, to: 2000 }, { maxTo: 3000 })).toEqual({ from: 0, to: 2000 });
  });

  it('leaves a range whose `to` equals maxTo untouched (strict >)', () => {
    expect(clampRange({ from: 0, to: 3000 }, { maxTo: 3000 })).toEqual({ from: 0, to: 3000 });
  });

  it('applies min-span widening before the maxTo shift', () => {
    // tiny range hugging maxTo: widened to 1000 then shifted back so to === maxTo.
    const out = clampRange({ from: 999, to: 1000 }, { maxTo: 1000 });
    expect(spanOf(out)).toBe(MIN_SPAN_MS);
    expect(out.to).toBe(1000);
    expect(out).toEqual({ from: 0, to: 1000 });
  });

  it('returns the input unchanged when `from` is non-finite', () => {
    const r = { from: NaN, to: 100 };
    const out = clampRange(r);
    expect(out).toBe(r); // same reference, untouched
  });

  it('returns the input unchanged when `to` is non-finite', () => {
    const r = { from: 0, to: Infinity };
    expect(clampRange(r)).toBe(r);
    const r2 = { from: 0, to: -Infinity };
    expect(clampRange(r2)).toBe(r2);
  });
});

describe('computeContextWindow', () => {
  it('centres on the selection and is factor× wider for a wide-enough selection', () => {
    // selection span 2000 >= MIN_SPAN_MS, so no min-span floor interferes.
    const out = computeContextWindow({ from: 0, to: 2000 }, HUGE_NOW, 8);
    expect(midOf(out)).toBe(1000);
    expect(spanOf(out)).toBe(2000 * 8);
    expect(out).toEqual({ from: -7000, to: 9000 });
  });

  it('defaults to CONTEXT_ZOOM_FACTOR (8)', () => {
    const out = computeContextWindow({ from: 0, to: 2000 }, HUGE_NOW);
    expect(spanOf(out)).toBe(2000 * CONTEXT_ZOOM_FACTOR);
    expect(midOf(out)).toBe(1000);
  });

  it('floors the selection span at MIN_SPAN_MS *before* multiplying by factor', () => {
    // NOTE: for selection {0,100} the raw span is 100, but MIN_SPAN_MS (1000) is the floor,
    // so the window is 1000*8 = 8000 wide, NOT 100*8 = 800. Still centred on 50.
    const out = computeContextWindow({ from: 0, to: 100 }, HUGE_NOW, 8);
    expect(midOf(out)).toBe(50);
    expect(spanOf(out)).toBe(MIN_SPAN_MS * 8); // 8000, not 800
    expect(out).toEqual({ from: 50 - 4000, to: 50 + 4000 });
  });

  it('uses MIN_SPAN_MS for a zero-span selection', () => {
    // With factor 1 the resulting span is exactly MIN_SPAN_MS.
    const out = computeContextWindow({ from: 500, to: 500 }, HUGE_NOW, 1);
    expect(spanOf(out)).toBe(MIN_SPAN_MS);
    expect(midOf(out)).toBe(500);
    expect(out).toEqual({ from: 0, to: 1000 });
  });

  it('clamps to `now` by shifting the window back, preserving span', () => {
    const now = 1_000_000;
    // selection {now-2000, now}: span 2000 (>= MIN_SPAN_MS).
    const out = computeContextWindow({ from: now - 2000, to: now }, now, 8);
    expect(out.to).toBe(now);
    expect(spanOf(out)).toBe(2000 * 8); // span preserved through the shift
    expect(out).toEqual({ from: now - 16000, to: now });
  });

  it('does not shift when the window already ends before now', () => {
    const out = computeContextWindow({ from: 0, to: 2000 }, HUGE_NOW, 8);
    expect(out.to).toBeLessThan(HUGE_NOW);
    expect(out).toEqual({ from: -7000, to: 9000 });
  });
});

describe('zoomRange', () => {
  it('widens about the midpoint for factor > 1', () => {
    const out = zoomRange({ from: 0, to: 100 }, 2);
    expect(midOf(out)).toBe(50);
    expect(spanOf(out)).toBe(200);
    expect(out).toEqual({ from: -50, to: 150 });
  });

  it('narrows about the midpoint for factor < 1', () => {
    const out = zoomRange({ from: 0, to: 100 }, 0.5);
    expect(midOf(out)).toBe(50);
    expect(spanOf(out)).toBe(50);
    expect(out).toEqual({ from: 25, to: 75 });
  });

  it('is the identity for factor === 1', () => {
    expect(zoomRange({ from: 10, to: 210 }, 1)).toEqual({ from: 10, to: 210 });
  });

  it('preserves a non-zero midpoint', () => {
    const out = zoomRange({ from: 100, to: 300 }, 3);
    expect(midOf(out)).toBe(200);
    expect(spanOf(out)).toBe(600);
  });
});

describe('panRange', () => {
  it("shifts left by fraction × span (negative delta)", () => {
    const out = panRange({ from: 0, to: 100 }, 'left');
    expect(out).toEqual({ from: -25, to: 75 });
    expect(spanOf(out)).toBe(100);
  });

  it('shifts right by fraction × span (positive delta)', () => {
    const out = panRange({ from: 0, to: 100 }, 'right');
    expect(out).toEqual({ from: 25, to: 125 });
    expect(spanOf(out)).toBe(100);
  });

  it('defaults the fraction to PAN_STEP_FRACTION (0.25)', () => {
    expect(panRange({ from: 0, to: 400 }, 'right')).toEqual({ from: 100, to: 500 });
  });

  it('honours a custom fraction', () => {
    expect(panRange({ from: 0, to: 100 }, 'right', 0.5)).toEqual({ from: 50, to: 150 });
    expect(panRange({ from: 0, to: 100 }, 'left', 0.5)).toEqual({ from: -50, to: 50 });
  });
});

describe('wheelZoomRange', () => {
  it('zooms in (span shrinks by base) when deltaY < 0', () => {
    const out = wheelZoomRange({ from: 0, to: 100 }, 50, -1);
    expect(spanOf(out)).toBeCloseTo(100 * WHEEL_ZOOM_BASE, 9); // 80
    expect(out).toEqual({ from: 10, to: 90 });
  });

  it('zooms out (span grows by 1/base) when deltaY > 0', () => {
    const out = wheelZoomRange({ from: 0, to: 100 }, 50, 1);
    expect(spanOf(out)).toBeCloseTo(100 / WHEEL_ZOOM_BASE, 9); // 125
    expect(out.from).toBeCloseTo(-12.5, 9);
    expect(out.to).toBeCloseTo(112.5, 9);
  });

  it('keeps the cursor value fixed at its relative position (zoom in, off-centre cursor)', () => {
    const range = { from: 0, to: 100 };
    const cursorVal = 25;
    const relBefore = (cursorVal - range.from) / spanOf(range); // 0.25
    const out = wheelZoomRange(range, cursorVal, -1);
    const relAfter = (cursorVal - out.from) / spanOf(out);
    expect(relAfter).toBeCloseTo(relBefore, 9);
    expect(out).toEqual({ from: 5, to: 85 });
  });

  it('keeps the cursor value fixed at its relative position (zoom out, off-centre cursor)', () => {
    const range = { from: 200, to: 600 };
    const cursorVal = 300; // rel 0.25
    const relBefore = (cursorVal - range.from) / spanOf(range);
    const out = wheelZoomRange(range, cursorVal, 5);
    const relAfter = (cursorVal - out.from) / spanOf(out);
    expect(relAfter).toBeCloseTo(relBefore, 9);
  });

  it('honours a custom base', () => {
    const out = wheelZoomRange({ from: 0, to: 100 }, 50, -1, 0.5);
    expect(spanOf(out)).toBeCloseTo(50, 9);
    expect(out).toEqual({ from: 25, to: 75 });
  });

  it('returns the input unchanged for a zero span', () => {
    const r = { from: 50, to: 50 };
    expect(wheelZoomRange(r, 50, -1)).toBe(r);
  });

  it('returns the input unchanged for a negative span', () => {
    const r = { from: 100, to: 0 };
    expect(wheelZoomRange(r, 50, -1)).toBe(r);
  });
});

describe('extendedContext', () => {
  it('extends both sides by extraMs', () => {
    const out = extendedContext({ from: 0, to: 100 }, 50, HUGE_NOW);
    expect(out).toEqual({ from: -50, to: 150 });
  });

  it('caps `to` at now while still extending `from`', () => {
    const out = extendedContext({ from: 0, to: 100 }, 50, 120);
    expect(out).toEqual({ from: -50, to: 120 });
  });

  it('does not cap when base.to + extraMs is already below now', () => {
    const out = extendedContext({ from: 0, to: 100 }, 50, 1000);
    expect(out).toEqual({ from: -50, to: 150 });
  });
});

describe('parseRelativeToken', () => {
  it('extracts the duration token from "now-<n><unit>"', () => {
    expect(parseRelativeToken('now-2d')).toBe('2d');
    expect(parseRelativeToken('now-15m')).toBe('15m');
    expect(parseRelativeToken('now-30s')).toBe('30s');
    expect(parseRelativeToken('now-1h')).toBe('1h');
    expect(parseRelativeToken('now-2w')).toBe('2w');
  });

  it('returns null for bare "now"', () => {
    expect(parseRelativeToken('now')).toBeNull();
  });

  it('returns null for rounded relative tokens like "now-2d/d"', () => {
    expect(parseRelativeToken('now-2d/d')).toBeNull();
  });

  it('returns null for absolute strings', () => {
    expect(parseRelativeToken('2024-01-01T00:00:00Z')).toBeNull();
    expect(parseRelativeToken('1700000000000')).toBeNull();
  });

  it('returns null for an unsupported unit', () => {
    expect(parseRelativeToken('now-2y')).toBeNull();
    expect(parseRelativeToken('now-2M')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseRelativeToken(123)).toBeNull();
    expect(parseRelativeToken(undefined)).toBeNull();
    expect(parseRelativeToken(null)).toBeNull();
    expect(parseRelativeToken({})).toBeNull();
  });
});
