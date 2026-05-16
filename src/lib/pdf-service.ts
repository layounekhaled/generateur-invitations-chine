/**
 * PDF Generation Service for China Invitation Generator
 * Uses pdf-lib (pure JavaScript) for Vercel serverless compatibility.
 * - Returns PDF bytes directly (no filesystem write needed)
 * - Loads fonts from bundled files (works on Vercel)
 * - Loads template images from /public via fetch (Vercel) or fs (local)
 */
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import path from 'path'
import fs from 'fs'

// ============== Font loading ==============
// Fonts are served from /public/fonts/ as static files to avoid Turbopack bundling issues.
// On local dev, we try fs first. On Vercel, we use fetch().

let _fontRegular: Uint8Array | null = null
// Bold font removed - SarasaMonoSC-Bold subset has GSUB table issues with fontkit
// We use the regular font with slightly larger size for headings instead

async function loadResource(localPath: string, publicUrl: string): Promise<Uint8Array> {
  // Try local filesystem first
  try {
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath)
    }
  } catch {}

  // Fallback: fetch from public URL (works on Vercel)
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
  const url = `${baseUrl}${publicUrl}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`)
  return Buffer.from(await resp.arrayBuffer())
}

async function getFontRegular(): Promise<Uint8Array> {
  if (!_fontRegular) {
    _fontRegular = await loadResource(
      path.join(process.cwd(), 'public/fonts/chinese-subset.ttf'),
      '/fonts/chinese-subset.ttf'
    )
  }
  return _fontRegular!
}

async function getFontBold(): Promise<Uint8Array> {
  // Return regular font instead of bold (bold has GSUB parsing issues)
  return getFontRegular()
}

// ============== Template image loading ==============

const _imageCache: Record<string, Uint8Array> = {}

async function getTemplateImage(template: string, pageIdx: number): Promise<Uint8Array | null> {
  const key = `${template}_page${pageIdx + 1}`
  if (_imageCache[key]) return _imageCache[key]

  const filename = `${template}_page${pageIdx + 1}.png`
  const localPath = path.join(process.cwd(), 'public/templates', filename)

  // Try loading via shared utility (fs first, then fetch)
  try {
    const data = await loadResource(localPath, `/templates/${filename}`)
    _imageCache[key] = data
    return data
  } catch {
    return null
  }
}

// ============== Data helpers ==============

const NAT_MAP: Record<string, string> = {
  'Algeria': '阿尔及利亚', 'France': '法国', 'Morocco': '摩洛哥',
  'Tunisia': '突尼斯', 'Egypt': '埃及', 'Libya': '利比亚',
  'Mauritania': '毛里塔尼亚', 'Iraq': '伊拉克', 'Iran': '伊朗',
  'Turkey': '土耳其', 'Pakistan': '巴基斯坦', 'India': '印度',
  'Russia': '俄罗斯', 'Ukraine': '乌克兰', 'Nigeria': '尼日利亚',
  'Ghana': '加纳', 'Cameroon': '喀麦隆', 'Ethiopia': '埃塞俄比亚',
  'Kenya': '肯尼亚', 'South Africa': '南非', 'Indonesia': '印度尼西亚',
  'Malaysia': '马来西亚', 'Thailand': '泰国', 'Vietnam': '越南',
  'Philippines': '菲律宾', 'Bangladesh': '孟加拉国',
  'Senegal': '塞内加尔', 'Mali': '马里', 'Niger': '尼日尔',
  'Chad': '乍得', 'Sudan': '苏丹', 'Kazakhstan': '哈萨克斯坦',
  'Uzbekistan': '乌兹别克斯坦', 'Tanzania': '坦桑尼亚',
  'Congo': '刚果', 'Angola': '安哥拉', 'Mozambique': '莫桑比克',
  'Madagascar': '马达加斯加',
}

function fmtDate(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`
}

function fmtDateCN(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getMonth() + 1}月${dt.getDate()}日`
}

interface ItineraryDay {
  date: string
  act: string
  acc: string
}

function genItinerary(arrival: string, departure: string, city: string, nationality: string): ItineraryDay[] {
  const a = new Date(arrival + 'T00:00:00')
  const dep = new Date(departure + 'T00:00:00')
  const total = Math.floor((dep.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (total <= 0) return []

  const days: ItineraryDay[] = []
  days.push({ date: fmtDateCN(arrival), act: `到达${city}机场。`, acc: city })

  if (total >= 2) {
    const d2 = new Date(a.getTime() + 1 * 86400000)
    days.push({ date: fmtDateCN(d2.toISOString().slice(0, 10)), act: '到达佛山市乐织外贸服务公司。', acc: '佛山' })
  }
  if (total >= 4) {
    const ms = new Date(a.getTime() + 2 * 86400000)
    const me = new Date(dep.getTime() - 2 * 86400000)
    days.push({ date: `${fmtDateCN(ms.toISOString().slice(0, 10))}-${fmtDateCN(me.toISOString().slice(0, 10))}`, act: '佛山南海工厂洽谈业务和订货。', acc: '佛山' })
  } else if (total === 3) {
    const d3 = new Date(a.getTime() + 2 * 86400000)
    days.push({ date: fmtDateCN(d3.toISOString().slice(0, 10)), act: '佛山南海工厂洽谈业务和订货。', acc: '佛山' })
  }
  if (total >= 4) {
    const sl = new Date(dep.getTime() - 1 * 86400000)
    days.push({ date: fmtDateCN(sl.toISOString().slice(0, 10)), act: `拜访${city}物流公司。`, acc: city })
  }
  if (total >= 2) {
    days.push({ date: fmtDateCN(departure), act: `从${city}返回${nationality}。`, acc: '/' })
  }
  return days
}

function whiteOut(page: any, x: number, y: number, width: number, height: number) {
  page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), borderWidth: 0 })
}

function todayCN(): string {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
}

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

// ============== Page overlays ==============

function overlayHouacinePage1(page: any, font: any, data: InvitationData) {
  const name = `${data.lastName} ${data.firstName}`
  const nationality = data.nationality || 'Algeria'
  const cnNat = NAT_MAP[nationality] || nationality
  const passport = data.passportNumber
  const arrival = data.arrivalDate
  const departure = data.departureDate
  const dateStr = todayCN()
  const sz = 11
  const black = rgb(0, 0, 0)

  whiteOut(page, 248, 550, 200, 16)
  page.drawText(`${cnNat}/${nationality}`, { x: 248, y: 553, size: sz, font, color: black })
  whiteOut(page, 216, 530, 300, 16)
  page.drawText(name, { x: 216, y: 533, size: sz, font, color: black })
  whiteOut(page, 275, 513, 200, 16)
  page.drawText(passport, { x: 275, y: 516, size: sz, font, color: black })
  whiteOut(page, 262, 496, 220, 16)
  page.drawText(`${fmtDate(arrival)}-${fmtDate(departure)}`, { x: 262, y: 499, size: sz, font, color: black })
  whiteOut(page, 370, 294, 160, 16)
  page.drawText(dateStr, { x: 370, y: 297, size: sz, font, color: black })
}

function overlayHouacinePage2(page: any, font: any, _fontBold: any, data: InvitationData) {
  const city = data.cityToVisit || '广州'
  const cnNat = NAT_MAP[data.nationality || 'Algeria'] || data.nationality || 'Algeria'
  const itin = genItinerary(data.arrivalDate, data.departureDate, city, cnNat)
  const dateStr = todayCN()
  const sz = 11
  const szBold = 12.5
  const black = rgb(0, 0, 0)

  whiteOut(page, 75, 555, 475, 115)
  page.drawText('日期', { x: 82, y: 658, size: szBold, font, color: black })
  page.drawText('行程', { x: 222, y: 658, size: szBold, font, color: black })
  page.drawText('住处', { x: 469, y: 658, size: szBold, font, color: black })

  let rowY = 636
  for (const day of itin) {
    page.drawText(day.date, { x: 80, y: rowY, size: sz, font, color: black })
    page.drawText(day.act, { x: 222, y: rowY, size: sz, font, color: black })
    page.drawText(day.acc, { x: 469, y: rowY, size: sz, font, color: black })
    rowY -= 18
  }
  whiteOut(page, 385, 287, 120, 16)
  page.drawText(dateStr, { x: 385, y: 290, size: sz, font, color: black })
}

function overlayAkkakPage1(page: any, font: any, data: InvitationData) {
  const name = `${data.lastName} ${data.firstName}`
  const nationality = data.nationality || 'Algeria'
  const cnNat = NAT_MAP[nationality] || nationality
  const sex = data.sex || 'M'
  const dob = (data.dateOfBirth || '').replace(/-/g, '/')
  const purpose = data.visitPurpose || '商务洽谈'
  const funding = data.fundingSource || '客户本人'
  const relation = data.inviterRelation || '客户'
  const sz = 10
  const black = rgb(0, 0, 0)

  whiteOut(page, 200, 508, 200, 14)
  page.drawText(name, { x: 200, y: 510, size: sz, font, color: black })
  whiteOut(page, 225, 486, 100, 14)
  page.drawText(dob, { x: 225, y: 488, size: sz, font, color: black })
  whiteOut(page, 425, 486, 130, 14)
  page.drawText(data.passportNumber, { x: 425, y: 488, size: sz, font, color: black })
  whiteOut(page, 335, 486, 60, 14)
  page.drawText(sex === 'M' ? '男/Male' : '女/Female', { x: 335, y: 488, size: sz, font, color: black })
  whiteOut(page, 115, 462, 180, 14)
  page.drawText(purpose, { x: 115, y: 464, size: sz, font, color: black })
  whiteOut(page, 320, 462, 200, 14)
  page.drawText(`${fmtDate(data.arrivalDate)} TO ${fmtDate(data.departureDate)}`, { x: 320, y: 464, size: sz, font, color: black })
  whiteOut(page, 115, 432, 180, 14)
  page.drawText(data.cityToVisit || '广州', { x: 115, y: 434, size: sz, font, color: black })
  whiteOut(page, 320, 432, 200, 14)
  page.drawText(relation, { x: 320, y: 434, size: sz, font, color: black })
  whiteOut(page, 115, 402, 180, 14)
  page.drawText(funding, { x: 115, y: 404, size: sz, font, color: black })
  whiteOut(page, 320, 402, 200, 14)
  page.drawText(`${cnNat}/${nationality}`, { x: 320, y: 404, size: sz, font, color: black })
}

function overlayAkkakPage2(page: any, font: any, _fontBold: any, data: InvitationData) {
  const city = data.cityToVisit || '广州'
  const cnNat = NAT_MAP[data.nationality || 'Algeria'] || data.nationality || 'Algeria'
  const itin = genItinerary(data.arrivalDate, data.departureDate, city, cnNat)
  const fullName = `${data.lastName} ${data.firstName}`
  const sz = 10
  const szBold = 11.5
  const black = rgb(0, 0, 0)

  whiteOut(page, 78, 550, 440, 165)
  page.drawText('日期', { x: 82, y: 703, size: szBold, font, color: black })
  page.drawText('行程', { x: 160, y: 703, size: szBold, font, color: black })
  page.drawText('交通', { x: 390, y: 703, size: szBold, font, color: black })
  page.drawText('用餐', { x: 460, y: 703, size: szBold, font, color: black })

  let rowY = 683
  for (const day of itin) {
    page.drawText(day.date, { x: 82, y: rowY, size: sz, font, color: black })
    page.drawText(day.act, { x: 160, y: rowY, size: sz, font, color: black })
    page.drawText('包车', { x: 390, y: rowY, size: sz, font, color: black })
    page.drawText('早/午/晚', { x: 460, y: rowY, size: sz, font, color: black })
    rowY -= 22
  }
  whiteOut(page, 60, 45, 470, 14)
  page.drawText(`仅供${fullName}先生申请签证使用`, { x: 60, y: 47, size: 9, font, color: black })
}

// ============== Main PDF generation ==============

/**
 * Generate PDF using template images as backgrounds.
 * Works on both local dev and Vercel serverless.
 */
export async function generatePDF(data: InvitationData): Promise<Uint8Array> {
  const template = data.template || 'houacine'

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const fontBytes = await getFontRegular()
  const font = await pdfDoc.embedFont(fontBytes)
  const fontBold = font // Use same font (bold has GSUB issues)

  // A4 dimensions in points
  const pageWidth = 595.28
  const pageHeight = 841.89
  const numPages = 3

  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight])

    // Draw template image as background
    try {
      const imgBytes = await getTemplateImage(template, pageIdx)
      if (imgBytes) {
        const img = await pdfDoc.embedPng(imgBytes)
        page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight })
      }
    } catch (e) {
      console.error(`Template image page ${pageIdx + 1} error:`, e)
    }

    // Overlay dynamic fields
    if (template === 'houacine') {
      if (pageIdx === 0) overlayHouacinePage1(page, font, data)
      else if (pageIdx === 1) overlayHouacinePage2(page, font, font, data)
    } else {
      if (pageIdx === 0) overlayAkkakPage1(page, font, data)
      else if (pageIdx === 1) overlayAkkakPage2(page, font, font, data)
    }
  }

  return await pdfDoc.save()
}

/**
 * Generate HTML preview
 */
export function generateHTMLPreview(data: InvitationData): string {
  const template = data.template || 'houacine'
  const isAkkak = template === 'akkak'
  const name = `${data.lastName} ${data.firstName}`
  const nationality = data.nationality || 'Algeria'
  const cnNat = NAT_MAP[nationality] || nationality
  const passport = data.passportNumber
  const arrival = data.arrivalDate
  const departure = data.departureDate
  const city = data.cityToVisit || '广州'
  const sex = data.sex || 'M'
  const dob = (data.dateOfBirth || '').replace(/-/g, '/')
  const purpose = data.visitPurpose || '商务洽谈'
  const funding = data.fundingSource || '客户本人'
  const itin = genItinerary(arrival, departure, city, cnNat)
  const dateStr = todayCN()

  const fs = 'background:#fffde7;border:1px dashed #ff9800;padding:1px 4px;font-weight:bold'

  if (isAkkak) {
    const rows = itin.map(d =>
      `<tr><td style="padding:6px 8px;border:1px solid #ccc;font-size:11px;white-space:nowrap">${d.date}</td>` +
      `<td style="padding:6px 8px;border:1px solid #ccc;font-size:11px">${d.act}</td>` +
      `<td style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:center">包车</td>` +
      `<td style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:center">早/午/晚</td></tr>`
    ).join('')
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}
html,body{width:210mm;font-family:sans-serif}.page{width:210mm;min-height:297mm}</style></head><body>
<div class="page" style="padding:25mm 20mm">
<h3 style="color:#1a5276">Apercu - Modele AKKAK</h3>
<table style="border-collapse:collapse;margin:10px 0;width:100%"><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">Name</td><td style="${fs}">${name}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">Gender</td><td style="${fs}">${sex === 'M' ? 'Male' : 'Female'}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">DOB</td><td style="${fs}">${dob}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">Passport</td><td style="${fs}">${passport}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">Purpose</td><td style="${fs}">${purpose}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">Dates</td><td style="${fs}">${fmtDate(arrival)} TO ${fmtDate(departure)}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">Place</td><td style="${fs}">${city}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">Relation</td><td style="${fs}">${data.inviterRelation || '客户'}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">Funding</td><td style="${fs}">${funding}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">Nationality</td><td style="${fs}">${cnNat}/${nationality}</td></tr></table>
</div>
<div class="page" style="page-break-before:always;padding:20mm">
<h3 style="color:#1a5276">Itinerary</h3>
<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">Date</th>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">Activity</th>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">Transport</th>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">Meals</th></tr></thead><tbody>${rows}</tbody></table>
</div></body></html>`
  } else {
    const rows = itin.map(d =>
      `<tr><td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;white-space:nowrap">${d.date}</td>` +
      `<td style="padding:8px 10px;border:1px solid #ddd;font-size:13px">${d.act}</td>` +
      `<td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;text-align:center">${d.acc}</td></tr>`
    ).join('')
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}
html,body{width:210mm;font-family:sans-serif}.page{width:210mm;min-height:297mm;background:white}</style></head><body>
<div class="page" style="padding:25mm 25mm 20mm 25mm">
<h3 style="color:#c41e3a">Apercu - Modele HOUACINE</h3>
<div style="margin-top:20px">
<div style="font-size:12pt;line-height:2.2">Nationality: <span style="${fs}">${cnNat}/${nationality}</span></div>
<div style="font-size:12pt;line-height:2.2">Name: <span style="${fs}">${name}</span></div>
<div style="font-size:12pt;line-height:2.2">Passport: <span style="${fs}">${passport}</span></div>
<div style="font-size:12pt;line-height:2.2">Dates: <span style="${fs}">${fmtDate(arrival)}-${fmtDate(departure)}</span></div></div>
<div style="text-align:right;margin-top:40px"><div style="font-size:12pt;color:#333">${dateStr}</div>
<div style="font-size:13pt;font-weight:bold;color:#c41e3a;margin-top:6px">Company Name</div></div>
</div>
<div class="page" style="page-break-before:always;padding:25mm 20mm">
<h3 style="color:#c41e3a">Itinerary</h3>
<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr>
<th style="background:#f0f0f0;padding:10px;border:1px solid #ccc;font-size:14px;width:25%">Date</th>
<th style="background:#f0f0f0;padding:10px;border:1px solid #ccc;font-size:14px;width:55%">Activity</th>
<th style="background:#f0f0f0;padding:10px;border:1px solid #ccc;font-size:14px;width:20%">Hotel</th></tr></thead><tbody>${rows}</tbody></table>
</div></body></html>`
  }
}
