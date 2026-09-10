import type { Request, Response } from 'express';

const NAME = 'gp_work_media';
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/uploads/photos' });

export function setMediaCookie(res: Response, token: string) {
  res.cookie(NAME, token, { ...options(), maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearMediaCookie(res: Response) { res.clearCookie(NAME, options()); }

export function mediaTokenFromRequest(req: Request): string | null {
  // Cookie auth is strictly read-only. All business API requests still require
  // an explicit Authorization header, preventing cookie-based CSRF mutations.
  if (req.method !== 'GET' || !/^\/uploads\/photos\/[^/]+$/.test(req.path)) return null;
  const value = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${NAME}=`));
  if (!value) return null;
  try { return decodeURIComponent(value.slice(NAME.length + 1)); } catch { return null; }
}
