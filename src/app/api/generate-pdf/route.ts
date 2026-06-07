import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { modifyTemplate, type TemplateData } from '@/lib/word-template'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // Support both FormData (with template upload) and JSON (using default template)
    let templateBuffer: Buffer
    let data: TemplateData

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // FormData: extract template file + data
      const formData = await request.formData()
      const templateFile = formData.get('template') as File | null
      const dataStr = formData.get('data') as string

      if (!dataStr) {
        return NextResponse.json(
          { error: 'Champs obligatoires manquants' },
          { status: 400 }
        )
      }

      data = JSON.parse(dataStr)

      if (templateFile) {
        templateBuffer = Buffer.from(await templateFile.arrayBuffer())
      } else {
        // Use default template
        const templatePath = path.join(process.cwd(), 'public', 'template.docx')
        templateBuffer = await fs.readFile(templatePath)
      }
    } else {
      // JSON: use default template
      const body = await request.json()
      data = body

      const templatePath = path.join(process.cwd(), 'public', 'template.docx')
      templateBuffer = await fs.readFile(templatePath)
    }

    // Validate required fields
    if (!data.lastName || !data.firstName || !data.passportNumber || !data.arrivalDate || !data.departureDate) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants: nom, prénom, passeport, dates' },
        { status: 400 }
      )
    }

    // Set defaults
    data.sex = data.sex || 'M'
    data.nationality = data.nationality || 'Algeria'
    data.cityToVisit = data.cityToVisit || '广州、东莞等城市'
    data.inviterCompany = data.inviterCompany || '佛山市盈达通外贸服务有限公司'

    // Generate the modified .docx
    const outputBuffer = modifyTemplate(templateBuffer, data)

    const safeLastName = (data.lastName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const safeFirstName = (data.firstName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `invitation_${safeLastName}_${safeFirstName}.docx`

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': outputBuffer.length.toString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : ''
    console.error('Document generation error:', message)
    console.error('Stack:', stack)
    return NextResponse.json(
      { error: 'Erreur de génération du document: ' + message },
      { status: 500 }
    )
  }
}
