/**
 * PDF Generation Service for China Invitation Generator
 * Uses pdf-lib (pure JavaScript) for Vercel serverless compatibility.
 * Reads original PDF templates, overlays dynamic text fields.
 */
import { PDFDocument, rgb, StandardFonts, pdfColors } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import path from 'path'
import fs from 'fs'

// Font cache
let _fontRegular: Uint8Array | null = null
let _fontBold: Uint8Array | null = null

async function getFontRegular(): Promise<Uint8Array> {
  if (!_fontRegular) {
    const fontPath = path.join(process.cwd(), 'src/lib/fonts/chinese-subset.ttf')
    _fontRegular = fs.readFileSync(fontPath)
  }
  return _fontRegular!
}

async function getFontBold(): Promise<Uint8Array> {
  if (!_fontBold) {
    const fontPath = path.join(process.cwd(), 'src/lib/fonts/chinese-subset-bold.ttf')
    _fontBold = fs.readFileSync(fontPath)
  }
  return _fontBold!
}

// Nationality mapping
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
    const d2s = d2.toISOString().slice(0, 10)
    days.push({ date: fmtDateCN(d2s), act: '到达佛山市乐织外贸服务公司。', acc: '佛山' })
  }

  if (total >= 4) {
    const ms = new Date(a.getTime() + 2 * 86400000)
    const me = new Date(dep.getTime() - 2 * 86400000)
    days.push({
      date: `${fmtDateCN(ms.toISOString().slice(0, 10))}-${fmtDateCN(me.toISOString().slice(0, 10))}`,
      act: '佛山南海工厂洽谈业务和订货。',
      acc: '佛山',
    })
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

// Helper to draw white rectangle to cover old text
function whiteOut(page: any, x: number, y: number, width: number, height: number) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  })
}

// Get today's date in Chinese format
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

// Overlay HOUACINE template page 1
function overlayHouacinePage1(pdfDoc: PDFDocument, page: any, font: any, fontBold: any, data: InvitationData) {
  const name = `${data.lastName} ${data.firstName}`
  const nationality = data.nationality || 'Algeria'
  const cnNat = NAT_MAP[nationality] || nationality
  const passport = data.passportNumber
  const arrival = data.arrivalDate
  const departure = data.departureDate
  const dateStr = todayCN()

  const fontSize = 11

  // Nationality field: original around y=550, x=248
  whiteOut(page, 248, 550, 200, 16)
  page.drawText(`${cnNat}／${nationality}`, { x: 248, y: 553, size: fontSize, font, color: rgb(0, 0, 0) })

  // Name field: original around y=530, x=216
  whiteOut(page, 216, 530, 300, 16)
  page.drawText(name, { x: 216, y: 533, size: fontSize, font, color: rgb(0, 0, 0) })

  // Passport field: original around y=513, x=275
  whiteOut(page, 275, 513, 200, 16)
  page.drawText(passport, { x: 275, y: 516, size: fontSize, font, color: rgb(0, 0, 0) })

  // Visit dates: original around y=496, x=262
  const dateVal = `${fmtDate(arrival)}-${fmtDate(departure)}`
  whiteOut(page, 262, 496, 220, 16)
  page.drawText(dateVal, { x: 262, y: 499, size: fontSize, font, color: rgb(0, 0, 0) })

  // Signature date: original around y=294, x=381
  whiteOut(page, 370, 294, 160, 16)
  page.drawText(dateStr, { x: 370, y: 297, size: fontSize, font, color: rgb(0, 0, 0) })
}

// Overlay HOUACINE template page 2
function overlayHouacinePage2(pdfDoc: PDFDocument, page: any, font: any, fontBold: any, data: InvitationData) {
  const arrival = data.arrivalDate
  const departure = data.departureDate
  const city = data.cityToVisit || '广州'
  const nationality = data.nationality || 'Algeria'
  const cnNat = NAT_MAP[nationality] || nationality
  const itin = genItinerary(arrival, departure, city, cnNat)
  const dateStr = todayCN()

  const fontSize = 11

  // White out itinerary table data area
  whiteOut(page, 75, 555, 475, 115)

  // Redraw table headers
  page.drawText('日期', { x: 82, y: 658, size: fontSize, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText('行程', { x: 222, y: 658, size: fontSize, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText('住处', { x: 469, y: 658, size: fontSize, font: fontBold, color: rgb(0, 0, 0) })

  // Draw itinerary rows
  let rowY = 636
  for (const day of itin) {
    page.drawText(day.date, { x: 80, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    page.drawText(day.act, { x: 222, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    page.drawText(day.acc, { x: 469, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    rowY -= 18
  }

  // Signature date
  whiteOut(page, 385, 287, 120, 16)
  page.drawText(dateStr, { x: 385, y: 290, size: fontSize, font, color: rgb(0, 0, 0) })
}

// Overlay AKKAK template page 1
function overlayAkkakPage1(pdfDoc: PDFDocument, page: any, font: any, fontBold: any, data: InvitationData) {
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
  const relation = data.inviterRelation || '客户'

  const fontSize = 10

  // Name field: original around x=203, y=508
  whiteOut(page, 200, 508, 200, 14)
  page.drawText(name, { x: 200, y: 510, size: fontSize, font, color: rgb(0, 0, 0) })

  // DOB field: original around x=228, y=486
  whiteOut(page, 225, 486, 100, 14)
  page.drawText(dob, { x: 225, y: 488, size: fontSize, font, color: rgb(0, 0, 0) })

  // Passport field: original around x=429, y=486
  whiteOut(page, 425, 486, 130, 14)
  page.drawText(passport, { x: 425, y: 488, size: fontSize, font, color: rgb(0, 0, 0) })

  // Gender field
  whiteOut(page, 335, 486, 60, 14)
  page.drawText(sex === 'M' ? '男/Male' : '女/Female', { x: 335, y: 488, size: fontSize, font, color: rgb(0, 0, 0) })

  // Visit purpose
  whiteOut(page, 115, 462, 180, 14)
  page.drawText(purpose, { x: 115, y: 464, size: fontSize, font, color: rgb(0, 0, 0) })

  // Visit dates
  const dateVal = `${fmtDate(arrival)} TO ${fmtDate(departure)}`
  whiteOut(page, 320, 462, 200, 14)
  page.drawText(dateVal, { x: 320, y: 464, size: fontSize, font, color: rgb(0, 0, 0) })

  // Place to visit
  whiteOut(page, 115, 432, 180, 14)
  page.drawText(city, { x: 115, y: 434, size: fontSize, font, color: rgb(0, 0, 0) })

  // Relationship
  whiteOut(page, 320, 432, 200, 14)
  page.drawText(relation, { x: 320, y: 434, size: fontSize, font, color: rgb(0, 0, 0) })

  // Funding source
  whiteOut(page, 115, 402, 180, 14)
  page.drawText(funding, { x: 115, y: 404, size: fontSize, font, color: rgb(0, 0, 0) })

  // Nationality
  whiteOut(page, 320, 402, 200, 14)
  page.drawText(`${cnNat}／${nationality}`, { x: 320, y: 404, size: fontSize, font, color: rgb(0, 0, 0) })
}

// Overlay AKKAK template page 2
function overlayAkkakPage2(pdfDoc: PDFDocument, page: any, font: any, fontBold: any, data: InvitationData) {
  const arrival = data.arrivalDate
  const departure = data.departureDate
  const city = data.cityToVisit || '广州'
  const nationality = data.nationality || 'Algeria'
  const cnNat = NAT_MAP[nationality] || nationality
  const itin = genItinerary(arrival, departure, city, cnNat)
  const fullName = `${data.lastName} ${data.firstName}`

  const fontSize = 10

  // White out itinerary table area
  whiteOut(page, 78, 550, 440, 165)

  // Table header (4 columns)
  page.drawText('日期', { x: 82, y: 703, size: fontSize, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText('行程', { x: 160, y: 703, size: fontSize, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText('交通', { x: 390, y: 703, size: fontSize, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText('用餐', { x: 460, y: 703, size: fontSize, font: fontBold, color: rgb(0, 0, 0) })

  // Table data
  let rowY = 683
  for (const day of itin) {
    page.drawText(day.date, { x: 82, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    page.drawText(day.act, { x: 160, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    page.drawText('包车', { x: 390, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    page.drawText('早/午/晚', { x: 460, y: rowY, size: fontSize, font, color: rgb(0, 0, 0) })
    rowY -= 22
  }

  // Footer note
  whiteOut(page, 60, 45, 470, 14)
  page.drawText(`仅供${fullName}先生申请签证使用`, { x: 60, y: 47, size: 9, font, color: rgb(0, 0, 0) })
}

/**
 * Generate a PDF by loading the original template PDF and overlaying text fields.
 */
export async function generatePDF(data: InvitationData): Promise<Uint8Array> {
  const template = data.template || 'houacine'
  const templateFileName = template === 'akkak' ? 'AKKAK AMIR FAHD.pdf' : 'HOUACINE ABDESSALAM.pdf'
  const templatePath = path.join(process.cwd(), 'upload', templateFileName)

  // Load original PDF template
  const templateBytes = fs.readFileSync(templatePath)
  const pdfDoc = await PDFDocument.load(templateBytes)

  // Register fontkit for custom font embedding
  pdfDoc.registerFontkit(fontkit)

  // Load Chinese fonts
  const fontBytes = await getFontRegular()
  const fontBoldBytes = await getFontBold()
  const font = await pdfDoc.embedFont(fontBytes)
  const fontBold = await pdfDoc.embedFont(fontBoldBytes)

  // Get pages
  const pages = pdfDoc.getPages()

  // Overlay dynamic fields on each page
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx]

    if (template === 'houacine') {
      if (pageIdx === 0) overlayHouacinePage1(pdfDoc, page, font, fontBold, data)
      else if (pageIdx === 1) overlayHouacinePage2(pdfDoc, page, font, fontBold, data)
    } else {
      if (pageIdx === 0) overlayAkkakPage1(pdfDoc, page, font, fontBold, data)
      else if (pageIdx === 1) overlayAkkakPage2(pdfDoc, page, font, fontBold, data)
    }
  }

  // Save and return
  const pdfBytes = await pdfDoc.save()
  return pdfBytes
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
  const cnNatForItin = cnNat
  const itin = genItinerary(arrival, departure, city, cnNatForItin)
  const dateStr = todayCN()

  const fieldStyle = 'background:#fffde7;border:1px dashed #ff9800;padding:1px 4px;font-weight:bold'

  if (isAkkak) {
    const rows = itin.map(d =>
      `<tr><td style="padding:6px 8px;border:1px solid #ccc;font-size:11px;white-space:nowrap">${d.date}</td>` +
      `<td style="padding:6px 8px;border:1px solid #ccc;font-size:11px">${d.act}</td>` +
      `<td style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:center">包车</td>` +
      `<td style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:center">早/午/晚</td></tr>`
    ).join('')

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}
html,body{width:210mm;font-family:"Noto Sans SC","Sarasa Mono SC",sans-serif}
.page{width:210mm;min-height:297mm;position:relative}</style></head><body>
<div class="page" style="padding:25mm 20mm">
<h3 style="color:#1a5276">Aperçu - Modèle AKKAK</h3>
<table style="border-collapse:collapse;margin:10px 0;width:100%"><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">姓名/Name</td>
<td style="${fieldStyle}">${name}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">性别/Gender</td>
<td style="${fieldStyle}">${sex === 'M' ? '男/Male' : '女/Female'}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">出生日期/DOB</td>
<td style="${fieldStyle}">${dob}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">护照/Passport</td>
<td style="${fieldStyle}">${passport}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">访问目的/Purpose</td>
<td style="${fieldStyle}">${purpose}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">日期/Dates</td>
<td style="${fieldStyle}">${fmtDate(arrival)} TO ${fmtDate(departure)}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">地点/Place</td>
<td style="${fieldStyle}">${city}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">关系/Relation</td>
<td style="${fieldStyle}">${data.inviterRelation || '客户'}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">资金/Funding</td>
<td style="${fieldStyle}">${funding}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">国籍/Nationality</td>
<td style="${fieldStyle}">${cnNat}／${nationality}</td></tr></table>
</div>
<div class="page" style="page-break-before:always;padding:20mm">
<h3 style="color:#1a5276">行程安排 / Itinerary</h3>
<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">日期</th>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">行程</th>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">交通</th>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">用餐</th>
</tr></thead><tbody>${rows}</tbody></table>
</div></body></html>`
  } else {
    const rows = itin.map(d =>
      `<tr><td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;white-space:nowrap">${d.date}</td>` +
      `<td style="padding:8px 10px;border:1px solid #ddd;font-size:13px">${d.act}</td>` +
      `<td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;text-align:center">${d.acc}</td></tr>`
    ).join('')

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}
html,body{width:210mm;font-family:"Noto Sans SC","Sarasa Mono SC",sans-serif}
.page{width:210mm;min-height:297mm;position:relative;background:white}</style></head><body>
<div class="page" style="padding:25mm 25mm 20mm 25mm">
<h3 style="color:#c41e3a">Aperçu - Modèle HOUACINE</h3>
<div style="margin-top:20px">
<div style="font-size:12pt;line-height:2.2">国籍／Nationality：<span style="${fieldStyle}">${cnNat}／${nationality}</span></div>
<div style="font-size:12pt;line-height:2.2">姓名／Name: <span style="${fieldStyle}">${name}</span></div>
<div style="font-size:12pt;line-height:2.2">护照号码／Passport NO.: <span style="${fieldStyle}">${passport}</span></div>
<div style="font-size:12pt;line-height:2.2">拜访日期／time: <span style="${fieldStyle}">${fmtDate(arrival)}-${fmtDate(departure)}</span></div>
</div>
<div style="text-align:right;margin-top:40px"><div style="font-size:12pt;color:#333">${dateStr}</div>
<div style="font-size:13pt;font-weight:bold;color:#c41e3a;margin-top:6px">佛山市乐织外贸服务有限公司</div></div>
</div>
<div class="page" style="page-break-before:always;padding:25mm 20mm">
<h3 style="color:#c41e3a">行程安排 / Itinerary</h3>
<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr>
<th style="background:#f0f0f0;padding:10px;border:1px solid #ccc;font-size:14px;width:25%">日期</th>
<th style="background:#f0f0f0;padding:10px;border:1px solid #ccc;font-size:14px;width:55%">行程</th>
<th style="background:#f0f0f0;padding:10px;border:1px solid #ccc;font-size:14px;width:20%">住处</th>
</tr></thead><tbody>${rows}</tbody></table>
</div></body></html>`
  }
}
