type LogArg = string | number | boolean | object | null | undefined;

export const logger = {
  info: (...args: LogArg[]) => {
    console.info('[INFO]', ...args);
  },
  warn: (...args: LogArg[]) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args: LogArg[]) => {
    console.error('[ERROR]', ...args);
  },
  debug: (...args: LogArg[]) => {
    console.debug('[DEBUG]', ...args);
  },
};
