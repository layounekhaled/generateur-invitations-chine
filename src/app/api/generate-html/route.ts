import { NextRequest, NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.lastName || !body.firstName) {
      return NextResponse.json(
        { error: 'Nom et prénom requis' },
        { status: 400 }
      )
    }

    const scriptPath = path.join(process.cwd(), 'mini-services', 'pdf-service')
    const inputData = JSON.stringify(body)

    const htmlBuffer = execFileSync('python3', ['-c', `
import sys, json
sys.path.insert(0, '${scriptPath}')
from service import gen_html_preview
data = json.loads(sys.stdin.read())
html = gen_html_preview(data)
sys.stdout.write(html)
`, ], {
      input: inputData,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
    })

    return new NextResponse(htmlBuffer, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('HTML generation error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
