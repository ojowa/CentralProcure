import 'dotenv/config';

const parseOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return ['http://localhost:6006'];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: process.env.DATABASE_URL ?? process.env.ConnectionStrings__Primary,
  jwt: {
    key: process.env.JWT_KEY ?? process.env.Jwt__Key,
    issuer: process.env.JWT_ISSUER ?? process.env.Jwt__Issuer ?? 'nis-eproc-identity',
    audience: process.env.JWT_AUDIENCE ?? process.env.Jwt__Audience ?? 'nis-eproc-clients',
    durationInMinutes: Number(process.env.JWT_DURATION_MINUTES ?? process.env.Jwt__DurationInMinutes ?? 1440)
  },
  cors: {
    allowedOrigins: parseOrigins(process.env.CORS_ALLOWED_ORIGINS)
  }
};

if (config.nodeEnv === 'production') {
  if (!config.databaseUrl) {
    console.error('FATAL: DATABASE_URL is not set.');
    process.exit(1);
  }
  if (!config.jwt.key) {
    console.error('FATAL: JWT_KEY is not set. Unsigned tokens are not allowed in production.');
    process.exit(1);
  }
}
