export interface TimeControl {
  key: string;
  label: string;
  timer: number;
  increment: number;
}

export const timeControls: TimeControl[] = [
  { key: '1+0', label: '1 min', timer: 1 * 60 * 1000, increment: 0 },
  { key: '3+0', label: '3 min', timer: 3 * 60 * 1000, increment: 0 },
  { key: '3+2', label: '3 min + 2s', timer: 3 * 60 * 1000, increment: 2 * 1000 },
  { key: '5+0', label: '5 min', timer: 5 * 60 * 1000, increment: 0 },
  { key: '5+2', label: '5 min + 2s', timer: 5 * 60 * 1000, increment: 2 * 1000 },
  { key: '10+0', label: '10 min', timer: 10 * 60 * 1000, increment: 0 },
];

export const defaultTimeControl = timeControls[3] ?? {
  key: '5+0',
  label: '5 min',
  timer: 5 * 60 * 1000,
  increment: 0,
}; // 5 min
