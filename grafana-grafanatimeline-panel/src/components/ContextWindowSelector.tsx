import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, DatePickerWithInput } from '@grafana/ui';
import { AbsoluteTimeRange, parseDuration, durationToMilliseconds, dateTime } from '@grafana/data';

interface Props {
  dashboardFrom: number;
  dashboardTo: number;
  now: number;
  uplotRef: React.MutableRefObject<uPlot | null>;
  timelineRange: AbsoluteTimeRange;
  visibleRange: AbsoluteTimeRange;
  setVisibleRange: (r: AbsoluteTimeRange) => void;
  onClose: () => void;
}

const OPTIONS = [
  { label: 'Same as timepicker', value: '0h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 1 week', value: '7d' },
  { label: 'Last 2 weeks', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
];

export const ContextWindowSelector: React.FC<Props> = ({
  dashboardFrom,
  dashboardTo,
  now,
  uplotRef,
  timelineRange,
  visibleRange,
  setVisibleRange,
  onClose,
}) => {
  const [fromText, setFromText] = useState<string>(dateTime(visibleRange.from).toISOString());
  const [toText, setToText] = useState<string>(dateTime(visibleRange.to).toISOString());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef, onClose]);

  const applyWindow = (newRange: AbsoluteTimeRange) => {
    const percentStart = (timelineRange.from - dashboardFrom) / (dashboardTo - dashboardFrom);
    const percentEnd = (timelineRange.to - dashboardFrom) / (dashboardTo - dashboardFrom);

    setVisibleRange(newRange);

    const u = uplotRef.current;
    if (u) {
      requestAnimationFrame(() => {
        const brushFrom = newRange.from + percentStart * (newRange.to - newRange.from);
        const brushTo = newRange.from + percentEnd * (newRange.to - newRange.from);
        const left = u.valToPos(brushFrom, 'x');
        const right = u.valToPos(brushTo, 'x');
        u.setSelect({
          left,
          top: 0,
          width: right - left,
          height: u.bbox.height,
        });
      });
    }

    onClose();
  };

  const applyExtraWindow = (duration: string) => {
    try {
      const extraWindow = durationToMilliseconds(parseDuration(duration));
      const newFrom = dashboardFrom - extraWindow;
      const newTo = Math.min(dashboardTo + extraWindow, now);
      applyWindow({ from: newFrom, to: newTo });
    } catch (err) {
      console.error('Failed to parse duration', err);
    }
  };

  const applyAbsoluteRange = () => {
    try {
      const from = dateTime(fromText).valueOf();
      const to = dateTime(toText).valueOf();
      if (!isNaN(from) && !isNaN(to) && from < to) {
        applyWindow({ from, to });
      }
    } catch (err) {
      console.error('Failed to parse absolute range', err);
    }
  };

  return (
    <div ref={wrapperRef} style={{ padding: 10, width: 350 }}>
      {OPTIONS.map(opt => (
        <Button
          key={opt.value}
          fullWidth
          variant="secondary"
          size="sm"
          onClick={() => applyExtraWindow(opt.value)}
        >
          {opt.label}
        </Button>
      ))}

      <div style={{ marginTop: 16 }}>
        <Input
          width={25}
          placeholder="Custom duration (e.g. 12h)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value;
              applyExtraWindow(val);
            }
          }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ marginRight: 6 }}>From:</span>
          <Input
            width={25}
            value={fromText}
            onChange={(e) => setFromText(e.currentTarget.value)}
          />
          <Button
            icon="calendar-alt"
            size="sm"
            variant="secondary"
            onClick={() => setShowFromPicker(true)}
            style={{ marginLeft: 8 }}
          />
        </div>
        {showFromPicker && (
          <DatePickerWithInput
            value={fromText}
            onChange={(val) => setFromText(val instanceof Date ? val.toISOString() : val)}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0 6px' }}>
          <span style={{ marginRight: 6 }}>To:</span>
          <Input
            width={25}
            value={toText}
            onChange={(e) => setToText(e.currentTarget.value)}
          />
          <Button
            icon="calendar-alt"
            size="sm"
            variant="secondary"
            onClick={() => setShowToPicker(true)}
            style={{ marginLeft: 8 }}
          />
        </div>
        {showToPicker && (
          <DatePickerWithInput
            value={toText}
            onChange={(val) => setToText(val instanceof Date ? val.toISOString() : val)}
          />
        )}

        <Button
          fullWidth
          size="sm"
          variant="primary"
          onClick={applyAbsoluteRange}
          style={{ marginTop: 10 }}
        >
          Apply Absolute Range
        </Button>
      </div>
    </div>
  );
};
