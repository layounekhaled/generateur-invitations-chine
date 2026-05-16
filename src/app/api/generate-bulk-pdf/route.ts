import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'
import { generatePDF } from '@/lib/pdf-service'

interface InvitationData {
  template: string
  lastName: string
  firstName: string
  sex: string
  dateOfBirth: string
  nationality: string
  passportNumber: string
  arrivalDate: string
  departureDate: string
  visitPurpose: string
  cityToVisit: string
  inviterRelation: string
  fundingSource: string
  notes: string
}

const DOWNLOAD_DIR = path.join(process.cwd(), 'download')

export async function POST(request: NextRequest) {
  try {
    const { invitations } = await request.json() as { invitations: InvitationData[] }

    if (!invitations || invitations.length === 0) {
      return NextResponse.json({ error: 'No invitations provided' }, { status: 400 })
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })

    if (invitations.length === 1) {
      // Single invitation
      const pdfBytes = await generatePDF(invitations[0])

      const timestamp = Date.now()
      const filename = `invitation_${(invitations[0].lastName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}_${(invitations[0].firstName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`
      const filePath = path.join(DOWNLOAD_DIR, filename)
      fs.writeFileSync(filePath, pdfBytes)

      return NextResponse.json({
        success: true,
        downloadUrl: `/api/download/${filename}`,
        filename,
        size: pdfBytes.length,
      })
    }

    // Multiple invitations - generate each and merge
    const pdfBuffers: Uint8Array[] = []
    for (let i = 0; i < invitations.length; i++) {
      try {
        const pdfBytes = await generatePDF(invitations[i])
        pdfBuffers.push(pdfBytes)
      } catch (e) {
        console.error(`Failed to generate PDF for invitation ${i}:`, e)
      }
    }

    if (pdfBuffers.length === 0) {
      return NextResponse.json({ error: 'No PDFs generated' }, { status: 500 })
    }

    let finalPdfBytes: Uint8Array

    if (pdfBuffers.length === 1) {
      finalPdfBytes = pdfBuffers[0]
    } else {
      // Merge using pdf-lib
      const mergedDoc = await PDFDocument.create()

      for (const pdfBytes of pdfBuffers) {
        const srcDoc = await PDFDocument.load(pdfBytes)
        const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
        for (const page of pages) {
          mergedDoc.addPage(page)
        }
      }

      finalPdfBytes = await mergedDoc.save()
    }

    const timestamp = Date.now()
    const filename = `invitations_groupe_${timestamp}.pdf`
    const filePath = path.join(DOWNLOAD_DIR, filename)
    fs.writeFileSync(filePath, finalPdfBytes)

    return NextResponse.json({
      success: true,
      downloadUrl: `/api/download/${filename}`,
      filename,
      size: finalPdfBytes.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Bulk PDF generation error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
