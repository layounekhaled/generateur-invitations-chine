import { NextRequest, NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.lastName || !body.firstName || !body.passportNumber || !body.arrivalDate || !body.departureDate) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants: nom, prénom, passeport, dates' },
        { status: 400 }
      )
    }

    // Call Python script to generate PDF
    const scriptPath = path.join(process.cwd(), 'mini-services', 'pdf-service', 'service.py')
    const inputData = JSON.stringify(body)

    const pdfBuffer = execFileSync('python3', ['-c', `
import sys, json
sys.path.insert(0, '${path.join(process.cwd(), 'mini-services', 'pdf-service')}')
from service import gen_pdf
data = json.loads(sys.stdin.read())
pdf = gen_pdf(data)
sys.stdout.buffer.write(pdf)
`, ], {
      input: inputData,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 30000,
    })

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invitation_${body.lastName}_${body.firstName}.pdf"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('PDF generation error:', message)
    return NextResponse.json({ error: 'Erreur de génération PDF: ' + message }, { status: 500 })
  }
}
