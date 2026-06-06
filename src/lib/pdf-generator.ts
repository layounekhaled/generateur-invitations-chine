/**
 * Standalone PDF generator script — China Invitation Letter
 * Reads JSON data from stdin, writes PDF bytes to stdout
 * Runs as a separate Node.js process to avoid fontkit crashes in Next.js
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import path from 'path'
import fs from 'fs'

// ============== Design Constants ==============
const PAGE_W = 595.28
const PAGE_H = 841.89
const M = 50           // left/right margin
const CW = PAGE_W - 2 * M  // content width (495)

// Colors
const C_RED     = rgb(0.71, 0.08, 0.08)
const C_GOLD    = rgb(0.83, 0.66, 0.15)
const C_BLACK   = rgb(0.12, 0.12, 0.12)
const C_DGRAY   = rgb(0.30, 0.30, 0.30)
const C_LGRAY   = rgb(0.82, 0.82, 0.82)
const C_WHITE   = rgb(1, 1, 1)
const C_CREAM   = rgb(0.99, 0.97, 0.94)
const C_LTRED   = rgb(0.97, 0.93, 0.93)
const C_BGALT   = rgb(0.98, 0.97, 0.97)

// ============== Helper Functions ==============

function centerText(page: any, text: string, y: number, size: number, font: any, color: any = C_BLACK) {
  const tw = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (PAGE_W - tw) / 2, y, size, font, color })
}

function rightText(page: any, text: string, y: number, size: number, font: any, color: any = C_BLACK) {
  const tw = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: PAGE_W - M - tw, y, size, font, color })
}

function hLine(page: any, y: number, x1: number = M, x2: number = PAGE_W - M, color: any = C_LGRAY, thick: number = 0.5) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: thick, color })
}

function headerBand(page: any, h: number = 75) {
  // Red band
  page.drawRectangle({ x: 0, y: PAGE_H - h, width: PAGE_W, height: h, color: C_RED })
  // Gold accent line below
  page.drawRectangle({ x: 0, y: PAGE_H - h - 3, width: PAGE_W, height: 3, color: C_GOLD })
  // Subtle gold line inside band
  page.drawRectangle({ x: 0, y: PAGE_H - h + 6, width: PAGE_W, height: 1, color: rgb(0.9, 0.78, 0.35) })
}

function footerBand(page: any) {
  page.drawRectangle({ x: 0, y: 5, width: PAGE_W, height: 2, color: C_GOLD })
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 5, color: C_RED })
}

function watermark(page: any, cnText: string, enText: string, cnFont: any, latinFont: any) {
  const cnW = cnFont.widthOfTextAtSize(cnText, 8)
  const sep = ' / '
  const sepW = cnFont.widthOfTextAtSize(sep, 8)
  page.drawText(cnText + sep, { x: M, y: 16, size: 8, font: cnFont, color: rgb(0.65, 0.65, 0.65) })
  page.drawText(enText, { x: M + cnW + sepW, y: 16, size: 8, font: latinFont, color: rgb(0.65, 0.65, 0.65) })
}

function dateSlash(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`
}

function dateCN(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getMonth() + 1}月${dt.getDate()}日`
}

function todayCN(): string {
  const n = new Date()
  return `${n.getFullYear()}年${n.getMonth() + 1}月${n.getDate()}日`
}

// Draw a styled field with bilingual label and value
function fieldRow(
  page: any,
  labelCN: string, labelEN: string,
  value: string,
  y: number,
  fonts: { cnBold: any; cn: any; latin: any },
  opts?: { labelW?: number; valueW?: number }
): number {
  const lw = opts?.labelW ?? 155
  const vw = opts?.valueW ?? (CW - lw)
  const rowH = 26

  // Label background
  page.drawRectangle({ x: M, y: y - 3, width: lw, height: rowH, color: C_LTRED })
  // Label text (Chinese)
  page.drawText(labelCN, { x: M + 8, y: y + 8, size: 10, font: fonts.cnBold, color: C_RED })
  // Label text (English) — smaller below
  page.drawText(labelEN, { x: M + 8, y: y - 0, size: 6, font: fonts.latin, color: rgb(0.5, 0.5, 0.5) })
  // Value text
  page.drawText(value, { x: M + lw + 12, y: y + 5, size: 10.5, font: fonts.cn, color: C_BLACK })
  // Separator line
  hLine(page, y - 3, M, M + lw + vw, rgb(0.88, 0.88, 0.88), 0.5)

  return y - rowH - 6
}

// Itinerary generation
interface ItinDay { date: string; act: string; hotel: string; transport: string }

function makeItinerary(arrival: string, departure: string, city: string, cnNat: string): ItinDay[] {
  const a = new Date(arrival + 'T00:00:00')
  const dep = new Date(departure + 'T00:00:00')
  const total = Math.floor((dep.getTime() - a.getTime()) / 86400000) + 1
  if (total <= 0) return []

  const days: ItinDay[] = []
  // Day 1: arrival
  days.push({ date: dateCN(arrival), act: `到达${city}机场，入住酒店。`, hotel: city, transport: '飞机' })

  if (total >= 2) {
    const d2 = new Date(a.getTime() + 86400000)
    days.push({
      date: dateCN(d2.toISOString().slice(0, 10)),
      act: '到达佛山市乐织外贸服务有限公司，商务洽谈。',
      hotel: '佛山',
      transport: '包车'
    })
  }

  if (total >= 4) {
    const ms = new Date(a.getTime() + 2 * 86400000)
    const me = new Date(dep.getTime() - 2 * 86400000)
    days.push({
      date: `${dateCN(ms.toISOString().slice(0, 10))} - ${dateCN(me.toISOString().slice(0, 10))}`,
      act: '佛山南海工厂洽谈业务和订货。',
      hotel: '佛山',
      transport: '包车'
    })
  } else if (total === 3) {
    const d3 = new Date(a.getTime() + 2 * 86400000)
    days.push({
      date: dateCN(d3.toISOString().slice(0, 10)),
      act: '佛山南海工厂洽谈业务和订货。',
      hotel: '佛山',
      transport: '包车'
    })
  }

  if (total >= 4) {
    const sl = new Date(dep.getTime() - 86400000)
    days.push({
      date: dateCN(sl.toISOString().slice(0, 10)),
      act: `拜访${city}物流公司，整理货物。`,
      hotel: city,
      transport: '包车'
    })
  }

  if (total >= 2) {
    days.push({
      date: dateCN(departure),
      act: `从${city}机场出发，返回${cnNat}。`,
      hotel: '/',
      transport: '飞机'
    })
  }

  return days
}

// ============== Main ==============
async function main() {
  // Read JSON from stdin
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'))

  const NAT_MAP: Record<string, string> = data._natMap || {}
  const CITY_MAP: Record<string, string> = data._cityMap || {}

  // Extract data
  const nationality = data.nationality || 'Algeria'
  const cnNat = NAT_MAP[nationality] || nationality
  const fullName = `${data.lastName} ${data.firstName}`
  const city = data.cityToVisit || '广州'
  const cityEN = CITY_MAP[city] || city
  const sex = data.sex || 'M'
  const dob = (data.dateOfBirth || '').replace(/-/g, '/')
  const purpose = data.visitPurpose || '商务洽谈'
  const funding = data.fundingSource || '客户本人'
  const relation = data.inviterRelation || '客户'
  const inviterCompany = data.inviterCompany || '佛山市乐织外贸服务有限公司'
  const passportNo = data.passportNumber || ''
  const dateStr = todayCN()
  const genderSuffix = sex === 'M' ? '先生' : '女士'
  const arrival = data.arrivalDate || ''
  const departure = data.departureDate || ''

  const itin = makeItinerary(arrival, departure, city, cnNat)

  // Create PDF
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const cwd = process.cwd()
  const cnFont     = await pdfDoc.embedFont(fs.readFileSync(path.join(cwd, 'public/fonts/chinese-subset.ttf')))
  const cnFontBold = await pdfDoc.embedFont(fs.readFileSync(path.join(cwd, 'public/fonts/chinese-subset-bold.ttf')))
  const latinFont     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const latinFontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const fonts = { cn: cnFont, cnBold: cnFontBold, latin: latinFont, latinBold: latinFontBold }

  // ========================================
  // PAGE 1 — Invitation Letter
  // ========================================
  const p1 = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H

  // Header band
  headerBand(p1, 78)
  centerText(p1, '邀 请 函', PAGE_H - 36, 26, cnFontBold, C_WHITE)
  centerText(p1, 'INVITATION LETTER', PAGE_H - 55, 11, latinFontBold, rgb(1, 0.90, 0.90))

  // Stamp area (top right) — double border rectangle for company seal
  const stampX = PAGE_W - M - 110
  const stampY = PAGE_H - 200
  p1.drawRectangle({ x: stampX, y: stampY, width: 105, height: 105, borderColor: C_RED, borderWidth: 2, color: rgb(1, 0.995, 0.995) })
  p1.drawRectangle({ x: stampX + 4, y: stampY + 4, width: 97, height: 97, borderColor: C_RED, borderWidth: 0.5, color: rgb(1, 0.995, 0.995) })
  // Company name inside stamp
  const stampText = inviterCompany
  const stampTextW = cnFont.widthOfTextAtSize(stampText, 8)
  const stampTextX = stampX + (105 - stampTextW) / 2
  p1.drawText(stampText, { x: stampTextX, y: stampY + 48, size: 8, font: cnFont, color: C_RED })
  // "公章" label inside stamp
  const stampLabel = '(公章)'
  const stampLabelW = cnFont.widthOfTextAtSize(stampLabel, 8)
  p1.drawText(stampLabel, { x: stampX + (105 - stampLabelW) / 2, y: stampY + 34, size: 8, font: cnFont, color: rgb(0.7, 0.4, 0.4) })
  // Decorative star
  p1.drawText('★', { x: stampX + 48, y: stampY + 72, size: 14, font: cnFont, color: C_RED })

  // Body text
  y = PAGE_H - 105
  p1.drawText('敬启者：', { x: M, y, size: 12, font: cnFontBold, color: C_BLACK })
  y -= 24

  const bodyLinesCN = [
    '谨以此函，我们诚挚地邀请如下客户来我公司洽谈采购及商务',
    '交流，届时一切费用由客户本人承担。我们将保证其遵守中国',
    '的法律法规，并且不会超期滞留，若贵处能酌情协助其办理签',
    '证，我公司将不胜感激！恭祝工作顺利！',
  ]
  for (const line of bodyLinesCN) {
    p1.drawText(line, { x: M + 18, y, size: 11, font: cnFont, color: C_BLACK })
    y -= 18
  }

  y -= 6
  const bodyLinesEN = [
    'We hereby sincerely invite the following client to visit our company for',
    'business negotiation and procurement. All expenses during the stay will be',
    'borne by the client. We guarantee that the invitee will comply with Chinese',
    'laws and regulations, and will not overstay the visa period. We would be',
    'extremely grateful if you could assist in processing the visa application.',
  ]
  for (const line of bodyLinesEN) {
    p1.drawText(line, { x: M + 18, y, size: 8.5, font: latinFont, color: C_DGRAY })
    y -= 13
  }

  // Section separator
  y -= 10
  hLine(p1, y, M, PAGE_W - M, C_RED, 2)
  y -= 8

  // Section header: Invitee Information
  p1.drawRectangle({ x: M, y: y - 2, width: 260, height: 22, color: C_RED })
  p1.drawText('受邀人信息', { x: M + 10, y: y + 4, size: 11, font: cnFontBold, color: C_WHITE })
  p1.drawText('/ Invitee Information', { x: M + 80, y: y + 4, size: 9.5, font: latinFont, color: rgb(1, 0.90, 0.90) })
  y -= 30

  // Field rows
  y = fieldRow(p1, '国籍', 'Nationality', `${cnNat} / ${nationality}`, y, fonts)
  y = fieldRow(p1, '姓名', 'Full Name', fullName, y, fonts)
  y = fieldRow(p1, '性别', 'Gender', sex === 'M' ? '男 / Male' : '女 / Female', y, fonts)
  y = fieldRow(p1, '出生日期', 'Date of Birth', dob, y, fonts)
  y = fieldRow(p1, '护照号码', 'Passport No.', passportNo, y, fonts)
  y = fieldRow(p1, '拜访日期', 'Visit Dates', `${dateSlash(arrival)} — ${dateSlash(departure)}`, y, fonts)
  y = fieldRow(p1, '前往城市', 'City to Visit', `${city} / ${cityEN}`, y, fonts)
  y = fieldRow(p1, '访问目的', 'Purpose', purpose, y, fonts)
  y = fieldRow(p1, '与邀请方关系', 'Relation', relation, y, fonts)
  y = fieldRow(p1, '费用负担', 'Funding Source', funding, y, fonts)

  // Signature area
  y -= 20
  rightText(p1, dateStr, y, 11, cnFont, C_BLACK)
  y -= 20
  rightText(p1, inviterCompany, y, 10, cnFontBold, C_RED)
  y -= 16
  // Small line for signature
  const sigW = 180
  hLine(p1, y, PAGE_W - M - sigW, PAGE_W - M, C_BLACK, 0.8)
  // Draw Chinese part with cnFont and Latin part with latinFont
  const sigLabelCN = '签字 / '
  const sigLabelEN = 'Signature:'
  p1.drawText(sigLabelCN, { x: PAGE_W - M - sigW, y: y + 4, size: 7, font: cnFont, color: C_DGRAY })
  const sigCNW = cnFont.widthOfTextAtSize(sigLabelCN, 7)
  p1.drawText(sigLabelEN, { x: PAGE_W - M - sigW + sigCNW, y: y + 4, size: 7, font: latinFont, color: C_DGRAY })

  // Footer
  watermark(p1, `仅供${fullName}${genderSuffix}申请签证使用`, 'For visa application only', cnFont, latinFont)
  footerBand(p1)

  // ========================================
  // PAGE 2 — Itinerary
  // ========================================
  const p2 = pdfDoc.addPage([PAGE_W, PAGE_H])
  headerBand(p2, 55)
  centerText(p2, '行程安排', PAGE_H - 28, 18, cnFontBold, C_WHITE)
  p2.drawText('/ Itinerary Schedule', { x: PAGE_W / 2 + 42, y: PAGE_H - 28, size: 10, font: latinFont, color: rgb(1, 0.90, 0.90) })

  y = PAGE_H - 82

  // Invitee summary
  p2.drawText(`受邀人 / Invitee: ${fullName}`, { x: M, y, size: 10, font: cnFont, color: C_BLACK })
  p2.drawText(`护照 / Passport: ${passportNo}`, { x: 320, y, size: 10, font: cnFont, color: C_BLACK })
  y -= 16
  p2.drawText(`日期 / Dates: ${dateSlash(arrival)} — ${dateSlash(departure)}`, { x: M, y, size: 10, font: cnFont, color: C_BLACK })
  p2.drawText(`城市 / City: ${city} / ${cityEN}`, { x: 320, y, size: 10, font: cnFont, color: C_BLACK })
  y -= 28

  // Table header
  const cols = [M, M + 115, M + 345, M + 430]
  const colW = [115 - 0, 345 - 115, 430 - 345, (PAGE_W - M) - 430]

  p2.drawRectangle({ x: M, y: y - 20, width: CW, height: 28, color: C_RED })
  p2.drawText('日期', { x: cols[0] + 8, y: y - 6, size: 10, font: cnFontBold, color: C_WHITE })
  p2.drawText('/ Date', { x: cols[0] + 32, y: y - 6, size: 7, font: latinFont, color: rgb(1, 0.90, 0.90) })
  p2.drawText('行程安排', { x: cols[1] + 8, y: y - 6, size: 10, font: cnFontBold, color: C_WHITE })
  p2.drawText('/ Activity', { x: cols[1] + 56, y: y - 6, size: 7, font: latinFont, color: rgb(1, 0.90, 0.90) })
  p2.drawText('住处', { x: cols[2] + 8, y: y - 6, size: 10, font: cnFontBold, color: C_WHITE })
  p2.drawText('/ Hotel', { x: cols[2] + 32, y: y - 6, size: 7, font: latinFont, color: rgb(1, 0.90, 0.90) })
  p2.drawText('交通', { x: cols[3] + 8, y: y - 6, size: 10, font: cnFontBold, color: C_WHITE })
  p2.drawText('/ Trans.', { x: cols[3] + 32, y: y - 6, size: 7, font: latinFont, color: rgb(1, 0.90, 0.90) })
  y -= 28

  // Table rows
  for (let i = 0; i < itin.length; i++) {
    const day = itin[i]
    const bg = i % 2 === 0 ? C_WHITE : C_BGALT
    const rowH = 28

    p2.drawRectangle({ x: M, y: y - rowH + 8, width: CW, height: rowH, color: bg })
    // Cell borders
    p2.drawRectangle({ x: cols[0], y: y - rowH + 8, width: colW[0], height: rowH, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.3, color: bg })
    p2.drawRectangle({ x: cols[1], y: y - rowH + 8, width: colW[1], height: rowH, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.3, color: bg })
    p2.drawRectangle({ x: cols[2], y: y - rowH + 8, width: colW[2], height: rowH, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.3, color: bg })
    p2.drawRectangle({ x: cols[3], y: y - rowH + 8, width: colW[3], height: rowH, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.3, color: bg })

    p2.drawText(day.date, { x: cols[0] + 8, y: y - 4, size: 9, font: cnFont, color: C_BLACK })
    p2.drawText(day.act, { x: cols[1] + 8, y: y - 4, size: 9, font: cnFont, color: C_BLACK })
    p2.drawText(day.hotel, { x: cols[2] + 8, y: y - 4, size: 9, font: cnFont, color: C_BLACK })
    p2.drawText(day.transport, { x: cols[3] + 8, y: y - 4, size: 9, font: cnFont, color: C_BLACK })
    y -= rowH
  }

  // Table bottom line
  hLine(p2, y + 8, M, PAGE_W - M, C_RED, 1.5)

  // Note box
  y -= 30
  p2.drawRectangle({ x: M, y: y - 4, width: CW, height: 26, color: rgb(1, 0.98, 0.93), borderWidth: 0 })
  hLine(p2, y + 22, M, PAGE_W - M, C_GOLD, 1)
  hLine(p2, y - 4, M, PAGE_W - M, C_GOLD, 1)
  p2.drawText(`备注: 仅供${fullName}${genderSuffix}申请签证使用`, { x: M + 12, y: y + 4, size: 9, font: cnFont, color: C_RED })

  // Signature on page 2
  y -= 60
  rightText(p2, dateStr, y, 11, cnFont, C_BLACK)
  y -= 20
  rightText(p2, inviterCompany, y, 10, cnFontBold, C_RED)

  watermark(p2, `仅供${fullName}${genderSuffix}申请签证使用`, 'For visa application only', cnFont, latinFont)
  footerBand(p2)

  // ========================================
  // PAGE 3 — Notes / Observations
  // ========================================
  const p3 = pdfDoc.addPage([PAGE_W, PAGE_H])
  headerBand(p3, 55)
  centerText(p3, '备注', PAGE_H - 28, 18, cnFontBold, C_WHITE)
  p3.drawText('/ Notes & Observations', { x: PAGE_W / 2 + 32, y: PAGE_H - 28, size: 10, font: latinFont, color: rgb(1, 0.90, 0.90) })

  y = PAGE_H - 90
  p3.drawText(`受邀人: ${fullName}    护照: ${passportNo}`, { x: M, y, size: 10, font: cnFont, color: C_BLACK })
  y -= 30

  // Lined note area
  for (let i = 0; i < 22; i++) {
    hLine(p3, y, M, PAGE_W - M, rgb(0.88, 0.88, 0.88), 0.5)
    y -= 28
  }

  // Signature area at bottom
  y -= 10
  rightText(p3, dateStr, y, 11, cnFont, C_BLACK)
  y -= 20
  rightText(p3, inviterCompany, y, 10, cnFontBold, C_RED)

  watermark(p3, `仅供${fullName}${genderSuffix}申请签证使用`, 'For visa application only', cnFont, latinFont)
  footerBand(p3)

  // ============== Output ==============
  const pdfBytes = await pdfDoc.save()
  process.stdout.write(pdfBytes)
}

main().catch((e) => {
  process.stderr.write(`Error: ${e.message}\n${e.stack}\n`)
  process.exit(1)
})
