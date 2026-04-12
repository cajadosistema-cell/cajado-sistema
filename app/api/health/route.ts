import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'Sistema Cajado',
    timestamp: new Date().toISOString(),
  })
}
