import React, { useEffect, useRef, useState } from 'react';
import { Button, DatePickerWithInput, Input } from '@grafana/ui';
import { dateTime } from '@grafana/data';
import { TimeRangeMs } from './timeModel';
import { durationToMs } from './duration';

interface Props {
  /** The current context window, used to seed the absolute-range inputs. */
  contextWindow: TimeRangeMs;
  /** Apply a relative context window that extends the dashboard range by the given duration each side. */
  onApplyRelative: (duration: string) => void;
  /** Apply an absolute context window. */
  onApplyAbsolute: (range: TimeRangeMs) => void;
  onClose: () => void;
}

const PRESETS = [
  { label: 'Same as timepicker', value: '0h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 1 week', value: '7d' },
  { label: 'Last 2 weeks', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
];

export const ContextWindowSelector: React.FC<Props> = ({ contextWindow, onApplyRelative, onApplyAbsolute, onClose }) => {
  const [fromText, setFromText] = useState(() => dateTime(contextWindow.from).toISOString());
  const [toText, setToText] = useState(() => dateTime(contextWindow.to).toISOString());
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
  }, [onClose]);

  const applyRelative = (duration: string) => {
    if (durationToMs(duration) == null) {
      return; // ignore invalid durations; keep the popover open so it can be corrected
    }
    onApplyRelative(duration);
    onClose();
  };

  const applyAbsolute = () => {
    const from = dateTime(fromText).valueOf();
    const to = dateTime(toText).valueOf();
    if (Number.isFinite(from) && Number.isFinite(to) && from < to) {
      onApplyAbsolute({ from, to });
      onClose();
    }
  };

  return (
    <div ref={wrapperRef} style={{ padding: 10, width: 350 }}>
      {PRESETS.map((opt) => (
        <Button key={opt.value} fullWidth variant="secondary" size="sm" onClick={() => applyRelative(opt.value)}>
          {opt.label}
        </Button>
      ))}

      <div style={{ marginTop: 16 }}>
        <Input
          width={25}
          placeholder="Custom duration (e.g. 12h)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              applyRelative((e.target as HTMLInputElement).value);
            }
          }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ marginRight: 6 }}>From:</span>
          <Input width={25} value={fromText} onChange={(e) => setFromText(e.currentTarget.value)} />
          <Button
            icon="calendar-alt"
            size="sm"
            variant="secondary"
            onClick={() => setShowFromPicker((v) => !v)}
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
          <Input width={25} value={toText} onChange={(e) => setToText(e.currentTarget.value)} />
          <Button
            icon="calendar-alt"
            size="sm"
            variant="secondary"
            onClick={() => setShowToPicker((v) => !v)}
            style={{ marginLeft: 8 }}
          />
        </div>
        {showToPicker && (
          <DatePickerWithInput
            value={toText}
            onChange={(val) => setToText(val instanceof Date ? val.toISOString() : val)}
          />
        )}

        <Button fullWidth size="sm" variant="primary" onClick={applyAbsolute} style={{ marginTop: 10 }}>
          Apply Absolute Range
        </Button>
      </div>
    </div>
  );
};
