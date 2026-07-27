import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  CanonicalRoleKey?: string;
  InternalUserId?: string;
  VendorId?: string;
  SecurityStamp?: string;
  exp?: number;
  iat?: number;
}

export const signToken = (payload: TokenPayload): string => {
  if (!config.jwt.key) {
    const header = { alg: 'none', typ: 'JWT' };
    const claims = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + config.jwt.durationInMinutes * 60,
      iss: config.jwt.issuer,
      aud: config.jwt.audience,
      ...payload
    };
    return `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.`;
  }

  return jwt.sign(payload as unknown as Record<string, unknown>, config.jwt.key, {
    expiresIn: `${config.jwt.durationInMinutes}m`,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience
  });
};

export const verifyToken = (token: string): TokenPayload | null => {
  if (!config.jwt.key) {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson) as TokenPayload;
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
      return payload;
    } catch {
      return null;
    }
  }

  try {
    return jwt.verify(token, config.jwt.key, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    }) as TokenPayload;
  } catch {
    return null;
  }
};

export const extractPayloadFromRequest = (authHeader: string | undefined): TokenPayload | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  return verifyToken(token);
};
