import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DOWNLOAD_DIR = path.join(process.cwd(), 'download')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Security: prevent directory traversal
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = path.join(DOWNLOAD_DIR, safeName)

    // Ensure the path is within the download directory
    if (!filePath.startsWith(DOWNLOAD_DIR)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)

    // Clean up: delete the file after serving (optional, keep for re-download)
    // try { fs.unlinkSync(filePath) } catch {}

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Download error:', message)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}
