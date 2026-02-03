export function formatSeconds(ms: number) {
  const sec = Math.floor(ms / 1000);
  return `${sec}s`;
}

export function formatMinutes(ms: number) {
  const min = Math.floor(ms / 60000);
  return `${min}m`;
}

export function formatHours(ms: number) {
  const hrs = Math.floor(ms / 3600000);
  return `${hrs}h`;
}

export function formatDays(ms: number) {
  const days = Math.floor(ms / 86400000);
  return `${days}d`;
}

/**
 * Format milliseconds into a human-readable duration string.
 * Automatically selects the appropriate unit based on magnitude.
 */
function formatDuration(ms: number) {
  if (ms < 60000) return formatSeconds(ms);
  if (ms < 3600000) return formatMinutes(ms);
  if (ms < 86400000) return formatHours(ms);
  return formatDays(ms);
}

/**
 * Format a time control for display.
 * @param baseS - Base time in seconds
 * @param incrementS - Increment time in seconds (optional)
 */
export function formatTimeControl(baseS: number, incrementS?: number) {
  const baseDisplay = formatDuration(baseS * 1000);
  const incSec = incrementS ? Math.floor(incrementS) : 0;

  if (incrementS !== undefined) {
    return `${baseDisplay}${incSec !== 0 ? ` + ${incSec}s` : ''}`;
  }
  return baseDisplay;
}

type TimeUnit = 'd' | 'h' | 'm' | 's' | 'ms';

type TimeFormat =
  | 'd'
  | 'd:h'
  | 'd:h:m'
  | 'd:h:m:s'
  | 'd:h:m:s:ms'
  | 'h'
  | 'h:m'
  | 'h:m:s'
  | 'h:m:s:ms'
  | 'm'
  | 'm:s'
  | 'm:s:ms'
  | 's'
  | 's:ms'
  | 'ms';

/**
 * Format milliseconds into a time string with specified format.
 * @param ms - Time in milliseconds
 * @param format - Format string like 'h:m:s', 'm:s:ms', etc.
 */
export function formatTime(ms: number, format: TimeFormat = 'h:m:s') {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const centiseconds = Math.floor(milliseconds / 10);

  const units: Record<TimeUnit, number> = {
    d: Math.floor(totalSeconds / 86400),
    h: Math.floor((totalSeconds % 86400) / 3600),
    m: Math.floor((totalSeconds % 3600) / 60),
    s: totalSeconds % 60,
    ms: centiseconds,
  };

  const parts = (format as string).split(':') as TimeUnit[];
  return parts
    .map((u) =>
      u === 'ms' ? milliseconds.toString().padStart(3, '0') : units[u].toString().padStart(2, '0'),
    )
    .join(':');
}

export type ParsedTimeControl = {
  initialMinutes: number;
  initialTimeSeconds: number;
  incrementSeconds: number;
};

export function parseTimeControl(timeControl: string): ParsedTimeControl {
  if (!timeControl) {
    return {
      initialMinutes: 0,
      initialTimeSeconds: 0,
      incrementSeconds: 0,
    };
  }

  const [minutesRaw, incrementRaw = '0'] = timeControl.split('+');

  const initialMinutes = Number(minutesRaw) || 0;
  const incrementSeconds = Number(incrementRaw) || 0;

  return {
    initialMinutes,
    initialTimeSeconds: initialMinutes * 60,
    incrementSeconds,
  };
}
