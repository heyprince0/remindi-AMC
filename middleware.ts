import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/auth/callback']
  
  // Check if the route is public
  const isPublicRoute = publicRoutes.includes(pathname)

  // Check for auth session in cookies (Supabase sets auth tokens in cookies)
  const sessionCookie = request.cookies.get('sb-auth-token')?.value || 
                        request.cookies.get('sb-session')?.value

  // If no session and trying to access protected route, redirect to login
  if (!sessionCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If session exists and trying to access login/signup, redirect to appropriate page
  if (sessionCookie && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/auth/callback', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*).*)',
  ],
}
