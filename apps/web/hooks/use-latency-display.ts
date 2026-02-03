import { useEffect, useState } from 'react';

/**
 * Custom hook to manage latency display with smooth updates
 * Prevents rapid flickering of latency values
 */
export function useLatencyDisplay(latency: number | null | undefined): number | null {
  const [displayedLatency, setDisplayedLatency] = useState<number | null>(null);

  useEffect(() => {
    if (latency !== null && latency !== undefined) {
      setDisplayedLatency(latency);
    }
  }, [latency]);

  return displayedLatency;
}

/**
 * Get the appropriate color class for latency badge based on value
 */
export function getLatencyColor(latency: number | null): string {
  if (latency === null) return '';
  if (latency < 50) return 'border-green-600 text-green-600';
  if (latency < 200) return 'border-yellow-600 text-yellow-600';
  return 'border-red-600 text-red-600';
}

/**
 * Get latency quality label
 */
export function getLatencyLabel(latency: number | null): string {
  if (latency === null) return 'Measuring...';
  if (latency < 50) return 'Excellent';
  if (latency < 100) return 'Good';
  if (latency < 200) return 'Fair';
  return 'Poor';
}
