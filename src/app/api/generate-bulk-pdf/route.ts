import { NextRequest, NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import path from 'path'
import fs from 'fs'

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

    const scriptPath = path.join(process.cwd(), 'mini-services', 'pdf-service')

    if (invitations.length === 1) {
      // Single invitation
      const inputData = JSON.stringify(invitations[0])
      const pdfBuffer = execFileSync('python3', ['-c', `
import sys, json
sys.path.insert(0, '${scriptPath}')
from service import gen_pdf
data = json.loads(sys.stdin.read())
pdf = gen_pdf(data)
sys.stdout.buffer.write(pdf)
`, ], { input: inputData, maxBuffer: 10 * 1024 * 1024, timeout: 30000 })

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="invitations_groupe.pdf"`,
        },
      })
    }

    // Multiple invitations - generate each and merge
    const tmpDir = '/tmp/invitations_bulk'
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

    const pdfFiles: string[] = []
    for (let i = 0; i < invitations.length; i++) {
      try {
        const inputData = JSON.stringify(invitations[i])
        const pdfBuffer = execFileSync('python3', ['-c', `
import sys, json
sys.path.insert(0, '${scriptPath}')
from service import gen_pdf
data = json.loads(sys.stdin.read())
pdf = gen_pdf(data)
sys.stdout.buffer.write(pdf)
`, ], { input: inputData, maxBuffer: 10 * 1024 * 1024, timeout: 30000 })

        const filePath = path.join(tmpDir, `invite_${i}.pdf`)
        fs.writeFileSync(filePath, pdfBuffer)
        pdfFiles.push(filePath)
      } catch (e) {
        console.error(`Failed to generate PDF for invitation ${i}:`, e)
      }
    }

    if (pdfFiles.length === 0) {
      return NextResponse.json({ error: 'No PDFs generated' }, { status: 500 })
    }

    if (pdfFiles.length === 1) {
      const pdf = fs.readFileSync(pdfFiles[0])
      try { fs.unlinkSync(pdfFiles[0]) } catch {}
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="invitations_groupe.pdf"`,
        },
      })
    }

    // Merge using pypdf
    const outputPath = path.join(tmpDir, 'merged.pdf')
    const mergeScript = `
from pypdf import PdfMerger
merger = PdfMerger()
${pdfFiles.map(f => `merger.append("${f}")`).join('\n')}
merger.write("${outputPath}")
merger.close()
`
    try {
      execFileSync('python3', ['-c', mergeScript], { timeout: 30000 })
    } catch {
      const firstPdf = fs.readFileSync(pdfFiles[0])
      pdfFiles.forEach(f => { try { fs.unlinkSync(f) } catch {} })
      return new NextResponse(firstPdf, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      })
    }

    const mergedPdf = fs.readFileSync(outputPath)
    pdfFiles.forEach(f => { try { fs.unlinkSync(f) } catch { /* ignore */ } })
    try { fs.unlinkSync(outputPath) } catch {}

    return new NextResponse(mergedPdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invitations_groupe.pdf"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Bulk PDF generation error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
