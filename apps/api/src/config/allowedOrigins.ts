const allowedOriginsEnv: string = process.env.ALLOWED_ORIGINS ?? '';
const allowedOrigins: string[] = allowedOriginsEnv.split(',').map((origin) => origin.trim());
export default allowedOrigins;
