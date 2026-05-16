import { NextRequest, NextResponse } from 'next/server'
import { generatePDF } from '@/lib/pdf-service'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.lastName || !body.firstName || !body.passportNumber || !body.arrivalDate || !body.departureDate) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants: nom, prénom, passeport, dates' },
        { status: 400 }
      )
    }

    const pdfBytes = await generatePDF(body)

    const safeLastName = (body.lastName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const safeFirstName = (body.firstName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `invitation_${safeLastName}_${safeFirstName}.pdf`

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : ''
    console.error('PDF generation error:', message)
    console.error('Stack:', stack)
    return NextResponse.json({ error: 'Erreur de génération PDF: ' + message, stack: stack?.split('\n').slice(0,5).join('\n') }, { status: 500 })
  }
}
