import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CSRF_COOKIE = 'XSRF-TOKEN';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const existingToken = request.cookies.get(CSRF_COOKIE)?.value;

  if (!existingToken) {
    const token = crypto.randomUUID();
    response.cookies.set(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
