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
