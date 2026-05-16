import { NextRequest, NextResponse } from 'next/server'
import { generateHTMLPreview } from '@/lib/pdf-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.lastName || !body.firstName) {
      return NextResponse.json(
        { error: 'Nom et prénom requis' },
        { status: 400 }
      )
    }

    const html = generateHTMLPreview(body)

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('HTML generation error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
