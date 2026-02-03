import {
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  format as formatDate,
  formatDistanceToNow,
  formatDuration,
  intervalToDuration,
} from 'date-fns';

export {
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  formatDate,
  formatDistanceToNow,
  formatDuration,
  intervalToDuration,
};

/**
 * Format a date range showing time remaining until expiry.
 * @param end - The end date to compare against now
 */
export function formatDateRange(end: Date): string {
  const now = new Date();
  const diffDays = differenceInDays(end, now);

  if (diffDays < 0) {
    return `Expired ${formatDistanceToNow(end, { addSuffix: true })}`;
  } else if (diffDays === 0) {
    return 'Expires today';
  } else if (diffDays === 1) {
    return 'Expires tomorrow';
  } else if (diffDays <= 7) {
    return `${diffDays} days remaining`;
  } else if (diffDays <= 30) {
    const diffWeeks = differenceInWeeks(end, now);
    return `${diffWeeks} weeks remaining`;
  } else {
    const diffMonths = differenceInMonths(end, now);
    return `${diffMonths} months remaining`;
  }
}
