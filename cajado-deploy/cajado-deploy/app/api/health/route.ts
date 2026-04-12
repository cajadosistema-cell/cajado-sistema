import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: process.env.NEXT_PUBLIC_APP_NAME || 'Sistema Cajado',
    timestamp: new Date().toISOString(),
  })
}
