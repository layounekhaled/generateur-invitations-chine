import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  let tmpDir = ''
  try {
    const body = await request.json()

    if (!body.lastName || !body.firstName || !body.passportNumber || !body.arrivalDate || !body.departureDate) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants: nom, prénom, passeport, dates' },
        { status: 400 }
      )
    }

    // Create temp directory
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'invitation-'))
    const safeLastName = (body.lastName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const safeFirstName = (body.firstName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `invitation_${safeLastName}_${safeFirstName}`
    const docxPath = path.join(tmpDir, `${filename}.docx`)
    const pdfPath = path.join(tmpDir, `${filename}.pdf`)
    const dataPath = path.join(tmpDir, 'data.json')

    // Template path
    const templatePath = path.join(process.cwd(), 'public', 'template.docx')

    // Write data to a temp JSON file (avoids shell escaping issues with Chinese characters)
    const pythonData = {
      lastName: body.lastName,
      firstName: body.firstName,
      sex: body.sex || 'M',
      nationality: body.nationality || 'Algeria',
      passportNumber: body.passportNumber,
      arrivalDate: body.arrivalDate,
      departureDate: body.departureDate,
      cityToVisit: body.cityToVisit || '广州、东莞等城市',
      inviterCompany: body.inviterCompany || '佛山市盈达通外贸服务有限公司',
    }
    await fs.writeFile(dataPath, JSON.stringify(pythonData), 'utf-8')

    // Call Python script using @data.json file reference
    const scriptPath = path.join(process.cwd(), 'scripts', 'word_generator.py')

    const { stdout, stderr } = await execFileAsync('python3', [
      scriptPath,
      '--data', `@${dataPath}`,
      '--template', templatePath,
      '--output', docxPath,
      '--pdf', pdfPath,
    ], { timeout: 60000, maxBuffer: 5 * 1024 * 1024 })

    if (stderr) {
      console.error('Python stderr:', stderr)
    }

    console.log('Python stdout:', stdout)

    // Read the generated PDF
    let pdfBytes: Buffer
    try {
      pdfBytes = await fs.readFile(pdfPath)
    } catch {
      // If PDF conversion failed, try sending the DOCX instead
      try {
        const docxBytes = await fs.readFile(docxPath)
        return new NextResponse(docxBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${filename}.docx"`,
            'Content-Length': docxBytes.length.toString(),
          },
        })
      } catch {
        throw new Error('Failed to generate both PDF and DOCX')
      }
    }

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : ''
    console.error('PDF generation error:', message)
    console.error('Stack:', stack)
    return NextResponse.json({ error: 'Erreur de génération PDF: ' + message, stack: stack?.split('\n').slice(0,5).join('\n') }, { status: 500 })
  } finally {
    // Cleanup temp directory
    if (tmpDir) {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true })
      } catch {}
    }
  }
}
