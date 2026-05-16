import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(request: NextRequest) {
  try {
    const { invitations } = await request.json() as { invitations: InvitationData[] }

    if (!invitations || invitations.length === 0) {
      return NextResponse.json({ error: 'No invitations provided' }, { status: 400 })
    }

    // Generate all PDFs
    const pdfBuffers: Uint8Array[] = []
    for (const inv of invitations) {
      try {
        const pdfBytes = await generatePDF(inv)
        pdfBuffers.push(pdfBytes)
      } catch (e) {
        console.error('Failed to generate PDF for invitation:', e)
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
        for (const page of pages) mergedDoc.addPage(page)
      }
      finalPdfBytes = await mergedDoc.save()
    }

    return new NextResponse(finalPdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="invitations_groupe.pdf"',
        'Content-Length': finalPdfBytes.length.toString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Bulk PDF generation error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
