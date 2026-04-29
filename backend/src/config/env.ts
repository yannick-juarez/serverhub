import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  jwt: {
    secret: process.env.JWT_SECRET ?? 'fallback_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },

  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'changeme',
  },

  mysql: {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT ?? '3306', 10),
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
  },

  pg: {
    host: process.env.PG_HOST ?? '127.0.0.1',
    port: parseInt(process.env.PG_PORT ?? '5432', 10),
    user: process.env.PG_USER ?? 'postgres',
    password: process.env.PG_PASSWORD ?? '',
  },

  filesRoot: process.env.FILES_ROOT ?? '/var/www',

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
} as const;
