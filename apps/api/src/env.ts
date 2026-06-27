import dotenv from 'dotenv';
import path from 'path';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
}

// Logger `service` base field. Set before `@workspace/logger` loads in index.ts.
process.env.SERVICE_NAME ??= 'api';
