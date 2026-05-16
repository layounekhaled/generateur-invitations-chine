import { NextRequest, NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import path from 'path'
import fs from 'fs'

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

    // Call Python script to generate PDF
    const scriptPath = path.join(process.cwd(), 'mini-services', 'pdf-service')
    const inputData = JSON.stringify(body)

    const pdfBuffer = execFileSync('python3', ['-c', `
import sys, json
sys.path.insert(0, '${scriptPath}')
from service import gen_pdf
data = json.loads(sys.stdin.read())
pdf = gen_pdf(data)
sys.stdout.buffer.write(pdf)
`, ], {
      input: inputData,
      maxBuffer: 50 * 1024 * 1024, // 50MB - AKKAK template has large images
      timeout: 60000,
    })

    // Save PDF to download directory
    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })

    const timestamp = Date.now()
    const safeLastName = (body.lastName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const safeFirstName = (body.firstName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `invitation_${safeLastName}_${safeFirstName}_${timestamp}.pdf`
    const filePath = path.join(DOWNLOAD_DIR, filename)

    fs.writeFileSync(filePath, pdfBuffer)

    // Return download URL instead of binary PDF
    // This is more reliable in iframe/preview environments
    const downloadUrl = `/api/download/${filename}`

    return NextResponse.json({
      success: true,
      downloadUrl,
      filename,
      size: pdfBuffer.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('PDF generation error:', message)
    return NextResponse.json({ error: 'Erreur de génération PDF: ' + message }, { status: 500 })
  }
}
