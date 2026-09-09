import type { Request, Response } from 'express';
import { mediaTokenFromRequest, setMediaCookie, clearMediaCookie } from './media-cookie';

describe('photo-only browser credentials', () => {
  it('never authenticates a business mutation or API read using a photo cookie', () => {
    for (const [method, path] of [['POST', '/api/field/work-days/start'], ['GET', '/api/users'], ['POST', '/uploads/photos/file.jpg']]) {
      expect(mediaTokenFromRequest({ method, path, headers: { cookie: 'gp_work_media=token' } } as Request)).toBeNull();
    }
    expect(mediaTokenFromRequest({ method: 'GET', path: '/uploads/photos/file.jpg', headers: { cookie: 'other=a; gp_work_media=token' } } as Request)).toBe('token');
  });
  it('ignores malformed cookie encoding', () => {
    expect(mediaTokenFromRequest({ method: 'GET', path: '/uploads/photos/file.jpg', headers: { cookie: 'gp_work_media=%' } } as Request)).toBeNull();
  });
  it('issues a restricted cookie and clears the exact same path on logout', () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };
    setMediaCookie(res as unknown as Response, 'token');
    clearMediaCookie(res as unknown as Response);
    expect(res.cookie).toHaveBeenCalledWith('gp_work_media', 'token', expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/uploads/photos' }));
    expect(res.clearCookie).toHaveBeenCalledWith('gp_work_media', expect.objectContaining({ path: '/uploads/photos' }));
  });
});
