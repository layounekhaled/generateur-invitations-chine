import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { generatePDF } from '@/lib/pdf-service'

const DOWNLOAD_DIR = path.join(process.cwd(), 'download')

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

    // Generate PDF using pdf-lib (pure JavaScript, Vercel-compatible)
    const pdfBytes = await generatePDF(body)

    // Save PDF to download directory
    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })

    const timestamp = Date.now()
    const safeLastName = (body.lastName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const safeFirstName = (body.firstName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `invitation_${safeLastName}_${safeFirstName}_${timestamp}.pdf`
    const filePath = path.join(DOWNLOAD_DIR, filename)

    fs.writeFileSync(filePath, pdfBytes)

    // Return download URL
    const downloadUrl = `/api/download/${filename}`

    return NextResponse.json({
      success: true,
      downloadUrl,
      filename,
      size: pdfBytes.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('PDF generation error:', message)
    return NextResponse.json({ error: 'Erreur de génération PDF: ' + message }, { status: 500 })
  }
}
