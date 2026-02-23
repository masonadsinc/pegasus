import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  // Login page is always accessible
  if (req.nextUrl.pathname === '/login') {
    return NextResponse.next()
  }
  return NextResponse.next()
}
