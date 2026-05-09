import { NextRequest, NextResponse } from 'next/server'

// Proxy runtime para o backend Express (scintillating-freedom)
// Lê INBOX_BACKEND_URL em tempo de execução — sem problemas de build
const BACKEND = process.env.INBOX_BACKEND_URL?.replace(/\/$/, '')
  || process.env.NEXT_PUBLIC_INBOX_API_URL?.replace(/\/$/, '')
  || 'http://localhost:3001'

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/')
  const search = req.nextUrl.search || ''
  const targetUrl = `${BACKEND}/${path}${search}`

  try {
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      // Não passar headers host e connection
      if (!['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
        headers[key] = value
      }
    })

    let body: BodyInit | undefined
    if (!['GET', 'HEAD'].includes(req.method)) {
      body = await req.text()
    }

    const res = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    })

    const contentType = res.headers.get('content-type') || 'application/json'
    const data = await res.text()

    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err: any) {
    console.error(`[inbox-proxy] Erro ao chamar ${targetUrl}:`, err.message)
    return NextResponse.json(
      { error: `Proxy error: ${err.message}`, backend: BACKEND },
      { status: 502 }
    )
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
