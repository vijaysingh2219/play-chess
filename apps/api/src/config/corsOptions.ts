import { CorsOptions } from 'cors';
import allowedOrigins from './allowedOrigins';

const isProd = process.env.NODE_ENV === 'production';

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // In production, require an origin header for security
    if (isProd && !origin) {
      callback(new Error('Origin header required in production'));
      return;
    }

    // Allow requests from allowed origins, or requests without origin in development
    if (allowedOrigins?.includes(origin || '') || (!isProd && !origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export default corsOptions;
