import os from 'os';
import pino, { type Logger, type LoggerOptions } from 'pino';

const nodeEnv = process.env.NODE_ENV;
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

// Sensitive keys removed (not masked) from every log object, incl. pino-http req/res.
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  // Secrets: both top-level and nested (`*.token` alone misses a root `token`).
  'password',
  'token',
  'secret',
  '*.password',
  '*.token',
  '*.secret',
  // PII: email always stripped; username/name only in prod (userId still correlates).
  // `ip` kept on purpose — legitimate backend security data.
  'email',
  '*.email',
  ...(isProd ? ['username', '*.username', 'name', '*.name'] : []),
];

const options: LoggerOptions = {
  // e.g. LOG_LEVEL=warn to quiet a noisy environment.
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  redact: { paths: redactPaths, remove: true },
  // Stamped on every line for filtering by service / deploy. Unset values are
  // dropped by pino.
  base: {
    pid: process.pid,
    // In K8s os.hostname() is already the pod name, but POD_NAME (downward API)
    // is explicit and survives custom hostnames; falls back to hostname locally.
    pod: process.env.POD_NAME ?? os.hostname(),
    service: process.env.SERVICE_NAME,
    env: nodeEnv,
    version: process.env.SERVICE_VERSION ?? process.env.GIT_SHA,
  },
  // Pretty output in dev; prod/test emit raw JSON to stdout for the platform.
  ...(isProd || isTest
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            singleLine: true,
            // Hide verbose/base fields in dev; prod JSON keeps them all.
            ignore: 'pid,pod,req,res,responseTime,reqId,service,env,version',
          },
        },
      }),
};

// Shared application logger - use this instead of `console`.
// `logger.child({ ... })` attaches persistent context to a scope.
export const logger: Logger = pino(options);

export type { Logger } from 'pino';
