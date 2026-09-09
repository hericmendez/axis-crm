process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.MONGO_URI = 'mongodb://localhost:27017/axis-test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-do-not-use-in-production';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_TTL_DAYS = '30';
process.env.BCRYPT_ROUNDS = '4';
process.env.PANEL_ORIGIN = 'https://panel.example.com,http://localhost:5173';
// Production default is 20/15min; the suite performs dozens of logins per worker.
process.env.AUTH_LOGIN_MAX = '1000';
// Operator owner of the single WhatsApp channel (mirrors production config).
// Must be set here — not in beforeAll — because getEnv() is cached at import time.
process.env.AXIS_USER_ID = '507f1f77bcf86cd799439011';
