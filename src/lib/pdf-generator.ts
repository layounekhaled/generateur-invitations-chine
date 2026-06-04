/**
 * Standalone PDF generator script
 * Reads JSON data from stdin, writes PDF bytes to stdout
 * This runs as a separate Node.js process to avoid fontkit crashes in Next.js
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import path from 'path'
import fs from 'fs'

// Colors
const DARK_RED = rgb(0.72, 0.05, 0.05)
const GOLD = rgb(0.85, 0.65, 0.13)
const BLACK = rgb(0.1, 0.1, 0.1)
const DARK_TEXT = rgb(0.15, 0.15, 0.15)
const WHITE = rgb(1, 1, 1)
const LIGHT_GRAY = rgb(0.9, 0.9, 0.9)

const LEFT_MARGIN = 55
const RIGHT_MARGIN = 55
const TABLE_WIDTH = 485

// Helpers
function drawCentered(page: any, text: string, y: number, size: number, font: any, color: any = BLACK) {
  const { width } = page.getSize()
  const tw = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (width - tw) / 2, y, size, font, color })
}

function drawRightAligned(page: any, text: string, y: number, size: number, font: any, color: any = BLACK) {
  const { width } = page.getSize()
  const tw = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: width - RIGHT_MARGIN - tw, y, size, font, color })
}

function drawHLine(page: any, y: number, x1: number = LEFT_MARGIN, x2?: number, color: any = LIGHT_GRAY, thickness: number = 0.5) {
  const { width } = page.getSize()
  page.drawLine({ start: { x: x1, y }, end: { x: x2 ?? (width - RIGHT_MARGIN), y }, thickness, color })
}

function drawTopBand(page: any, height: number = 80) {
  const { width, height: pageH } = page.getSize()
  page.drawRectangle({ x: 0, y: pageH - height, width, height, color: DARK_RED, borderWidth: 0 })
  page.drawRectangle({ x: 0, y: pageH - height - 4, width, height: 4, color: GOLD, borderWidth: 0 })
}

function drawBottomBand(page: any) {
  const { width } = page.getSize()
  page.drawRectangle({ x: 0, y: 6, width, height: 2, color: GOLD, borderWidth: 0 })
  page.drawRectangle({ x: 0, y: 0, width, height: 6, color: DARK_RED, borderWidth: 0 })
}

function drawFieldRow(
  page: any,
  labelCN: string,
  labelEN: string,
  value: string,
  y: number,
  cnFontBold: any,
  cnFont: any,
  latinFont: any,
  labelWidth: number = 160,
  valueWidth: number = 325
) {
  page.drawRectangle({ x: LEFT_MARGIN, y: y - 4, width: labelWidth, height: 24, color: rgb(0.97, 0.94, 0.94), borderWidth: 0 })
  page.drawText(labelCN, { x: LEFT_MARGIN + 6, y: y + 4, size: 10, font: cnFontBold, color: DARK_RED })
  page.drawText(labelEN, { x: LEFT_MARGIN + 6, y: y - 1, size: 6.5, font: latinFont, color: rgb(0.55, 0.55, 0.55) })
  page.drawText(value, { x: LEFT_MARGIN + labelWidth + 10, y: y + 2, size: 10.5, font: cnFont, color: BLACK })
  drawHLine(page, y - 4, LEFT_MARGIN, LEFT_MARGIN + labelWidth + valueWidth, rgb(0.85, 0.85, 0.85), 0.5)
  return y - 32
}

// Main
async function main() {
  // Read JSON from stdin
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  const inputStr = Buffer.concat(chunks).toString('utf-8')
  const data = JSON.parse(inputStr)

  const NAT_MAP: Record<string, string> = data._natMap || {}
  const CITY_MAP: Record<string, string> = data._cityMap || {}

  // Data extraction
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
  const dateStr = (() => { const n = new Date(); return `${n.getFullYear()}年${n.getMonth() + 1}月${n.getDate()}日` })()
  const genderSuffix = sex === 'M' ? '先生' : '女士'

  // Itinerary
  function fmtDateCN(d: string): string {
    if (!d) return ''
    const dt = new Date(d + 'T00:00:00')
    return `${dt.getMonth() + 1}月${dt.getDate()}日`
  }

  const a = new Date(data.arrivalDate + 'T00:00:00')
  const dep = new Date(data.departureDate + 'T00:00:00')
  const total = Math.floor((dep.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const itin: { date: string; act: string; acc: string }[] = []
  if (total > 0) {
    itin.push({ date: fmtDateCN(data.arrivalDate), act: `到达${city}机场。`, acc: city })
    if (total >= 2) {
      const d2 = new Date(a.getTime() + 86400000)
      itin.push({ date: fmtDateCN(d2.toISOString().slice(0, 10)), act: '到达佛山市乐织外贸服务公司。', acc: '佛山' })
    }
    if (total >= 4) {
      const ms = new Date(a.getTime() + 2 * 86400000)
      const me = new Date(dep.getTime() - 2 * 86400000)
      itin.push({ date: `${fmtDateCN(ms.toISOString().slice(0, 10))}-${fmtDateCN(me.toISOString().slice(0, 10))}`, act: '佛山南海工厂洽谈业务和订货。', acc: '佛山' })
    } else if (total === 3) {
      const d3 = new Date(a.getTime() + 2 * 86400000)
      itin.push({ date: fmtDateCN(d3.toISOString().slice(0, 10)), act: '佛山南海工厂洽谈业务和订货。', acc: '佛山' })
    }
    if (total >= 4) {
      const sl = new Date(dep.getTime() - 86400000)
      itin.push({ date: fmtDateCN(sl.toISOString().slice(0, 10)), act: `拜访${city}物流公司。`, acc: city })
    }
    if (total >= 2) {
      itin.push({ date: fmtDateCN(data.departureDate), act: `从${city}返回${cnNat}。`, acc: '/' })
    }
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const cwd = process.cwd()
  const cnFont = await pdfDoc.embedFont(fs.readFileSync(path.join(cwd, 'public/fonts/chinese-subset.ttf')))
  const cnFontBold = await pdfDoc.embedFont(fs.readFileSync(path.join(cwd, 'public/fonts/chinese-subset-bold.ttf')))
  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const latinFontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28
  const pageHeight = 841.89

  // ==================== PAGE 1 ====================
  const page1 = pdfDoc.addPage([pageWidth, pageHeight])

  drawTopBand(page1, 80)
  drawCentered(page1, '邀 请 函', pageHeight - 38, 28, cnFontBold, WHITE)
  drawCentered(page1, 'INVITATION LETTER', pageHeight - 58, 12, latinFontBold, rgb(1, 0.92, 0.92))

  // Company stamp
  page1.drawRectangle({ x: pageWidth - 165, y: pageHeight - 195, width: 115, height: 115, borderColor: DARK_RED, borderWidth: 1.5, color: rgb(1, 0.99, 0.99) })
  page1.drawRectangle({ x: pageWidth - 163, y: pageHeight - 193, width: 111, height: 111, borderColor: DARK_RED, borderWidth: 0.5, color: rgb(1, 0.99, 0.99) })
  page1.drawText(inviterCompany, { x: pageWidth - 155, y: pageHeight - 140, size: 7.5, font: cnFont, color: DARK_RED })

  let y = pageHeight - 115
  page1.drawText('敬启者：', { x: LEFT_MARGIN, y, size: 11, font: cnFontBold, color: DARK_TEXT })
  y -= 22

  const bodyCN = [
    '谨以此函，我们诚挚地邀请如下客户来我公司洽谈采购及商务',
    '交流，届时一切费用由客户本人承担。我们将保证其遵守中国',
    '的法律法规，并且不会超期滞留，若贵处能酌情协助其办理签',
    '证，我公司将不胜感激！恭祝工作顺利！',
  ]
  for (const line of bodyCN) {
    page1.drawText(line, { x: LEFT_MARGIN + 20, y, size: 11, font: cnFont, color: DARK_TEXT })
    y -= 18
  }

  y -= 8
  const bodyEN = [
    'We would like to sincerely invite the following client to visit',
    'our company for purchase bargain and business exchange. All the',
    'expenses will be borne by the client. We guarantee that the client',
    'will abide by Chinese laws and regulations and will not overstay',
    'their visa. We would be extremely grateful if your company could',
    'assist them with visa processing. Wish you the best in your work!',
  ]
  for (const line of bodyEN) {
    page1.drawText(line, { x: LEFT_MARGIN + 20, y, size: 9, font: latinFont, color: rgb(0.35, 0.35, 0.35) })
    y -= 14
  }

  y -= 12
  drawHLine(page1, y + 4, LEFT_MARGIN, pageWidth - RIGHT_MARGIN, DARK_RED, 2)
  y -= 8

  page1.drawRectangle({ x: LEFT_MARGIN, y: y - 4, width: 280, height: 20, color: DARK_RED, borderWidth: 0 })
  page1.drawText('受邀人信息', { x: LEFT_MARGIN + 8, y: y + 2, size: 11, font: cnFontBold, color: WHITE })
  page1.drawText('/ Invitee Information', { x: LEFT_MARGIN + 78, y: y + 2, size: 10, font: latinFont, color: rgb(1, 0.92, 0.92) })
  y -= 28

  y = drawFieldRow(page1, '国籍', 'Nationality', `${cnNat} / ${nationality}`, y, cnFontBold, cnFont, latinFont)
  y = drawFieldRow(page1, '姓名', 'Name', fullName, y, cnFontBold, cnFont, latinFont)
  y = drawFieldRow(page1, '性别', 'Gender', sex === 'M' ? '男 / Male' : '女 / Female', y, cnFontBold, cnFont, latinFont)
  y = drawFieldRow(page1, '出生日期', 'Date of Birth', dob, y, cnFontBold, cnFont, latinFont)
  y = drawFieldRow(page1, '护照号码', 'Passport No.', data.passportNumber, y, cnFontBold, cnFont, latinFont)
  y = drawFieldRow(page1, '拜访日期', 'Visit Dates', `${((d: string) => { if (!d) return ''; const dt = new Date(d + 'T00:00:00'); return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}` })(data.arrivalDate)} - ${((d: string) => { if (!d) return ''; const dt = new Date(d + 'T00:00:00'); return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}` })(data.departureDate)}`, y, cnFontBold, cnFont, latinFont)
  y = drawFieldRow(page1, '前往城市', 'City to Visit', `${city} / ${cityEN}`, y, cnFontBold, cnFont, latinFont)
  y = drawFieldRow(page1, '访目的', 'Purpose', purpose, y, cnFontBold, cnFont, latinFont)
  y = drawFieldRow(page1, '关系', 'Relation', relation, y, cnFontBold, cnFont, latinFont)
  y = drawFieldRow(page1, '费用负担', 'Funding', funding, y, cnFontBold, cnFont, latinFont)

  drawRightAligned(page1, dateStr, 90, 12, cnFont, DARK_TEXT)
  drawRightAligned(page1, inviterCompany, 72, 11, cnFont, DARK_RED)
  page1.drawText(`仅供${fullName}${genderSuffix}申请签证使用`, { x: LEFT_MARGIN, y: 22, size: 8, font: cnFont, color: rgb(0.6, 0.6, 0.6) })
  drawBottomBand(page1)

  // ==================== PAGE 2 ====================
  const page2 = pdfDoc.addPage([pageWidth, pageHeight])
  drawTopBand(page2, 55)
  drawCentered(page2, '行程安排', pageHeight - 30, 20, cnFontBold, WHITE)
  page2.drawText('/ Itinerary', { x: pageWidth / 2 + 40, y: pageHeight - 30, size: 12, font: latinFont, color: rgb(1, 0.92, 0.92) })

  y = pageHeight - 90
  page2.drawText(`受邀人: ${fullName}`, { x: LEFT_MARGIN, y, size: 11, font: cnFont, color: DARK_TEXT })
  page2.drawText(`护照: ${data.passportNumber}`, { x: 300, y, size: 11, font: cnFont, color: DARK_TEXT })
  y -= 18
  const fmtDateSimple = (d: string) => { if (!d) return ''; const dt = new Date(d + 'T00:00:00'); return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}` }
  page2.drawText(`日期: ${fmtDateSimple(data.arrivalDate)} - ${fmtDateSimple(data.departureDate)}`, { x: LEFT_MARGIN, y, size: 11, font: cnFont, color: DARK_TEXT })
  page2.drawText(`城市: ${city} / ${cityEN}`, { x: 300, y, size: 11, font: cnFont, color: DARK_TEXT })
  y -= 30

  const colX = [LEFT_MARGIN, LEFT_MARGIN + 120, LEFT_MARGIN + 340, LEFT_MARGIN + 430]
  page2.drawRectangle({ x: LEFT_MARGIN, y: y - 28 + 8, width: TABLE_WIDTH, height: 28, color: DARK_RED, borderWidth: 0 })
  page2.drawText('日期', { x: colX[0] + 6, y: y - 4, size: 10, font: cnFontBold, color: WHITE })
  page2.drawText('/ Date', { x: colX[0] + 30, y: y - 4, size: 8, font: latinFont, color: rgb(1, 0.92, 0.92) })
  page2.drawText('行程', { x: colX[1] + 6, y: y - 4, size: 10, font: cnFontBold, color: WHITE })
  page2.drawText('/ Activity', { x: colX[1] + 30, y: y - 4, size: 8, font: latinFont, color: rgb(1, 0.92, 0.92) })
  page2.drawText('住处', { x: colX[2] + 6, y: y - 4, size: 10, font: cnFontBold, color: WHITE })
  page2.drawText('/ Hotel', { x: colX[2] + 30, y: y - 4, size: 8, font: latinFont, color: rgb(1, 0.92, 0.92) })
  page2.drawText('交通', { x: colX[3] + 6, y: y - 4, size: 10, font: cnFontBold, color: WHITE })
  page2.drawText('/ Trans.', { x: colX[3] + 30, y: y - 4, size: 8, font: latinFont, color: rgb(1, 0.92, 0.92) })
  y -= 28

  for (let idx = 0; idx < itin.length; idx++) {
    const day = itin[idx]
    const bgColor = idx % 2 === 0 ? WHITE : rgb(0.99, 0.98, 0.98)
    page2.drawRectangle({ x: LEFT_MARGIN, y: y - 26 + 8, width: TABLE_WIDTH, height: 26, color: bgColor, borderWidth: 0 })
    drawHLine(page2, y - 26 + 8, LEFT_MARGIN, LEFT_MARGIN + TABLE_WIDTH, rgb(0.9, 0.9, 0.9), 0.3)
    page2.drawText(day.date, { x: colX[0] + 6, y: y - 4, size: 9.5, font: cnFont, color: BLACK })
    page2.drawText(day.act, { x: colX[1] + 6, y: y - 4, size: 9.5, font: cnFont, color: BLACK })
    page2.drawText(day.acc, { x: colX[2] + 6, y: y - 4, size: 9.5, font: cnFont, color: BLACK })
    page2.drawText('包车', { x: colX[3] + 6, y: y - 4, size: 9.5, font: cnFont, color: BLACK })
    y -= 26
  }

  drawHLine(page2, y + 8, LEFT_MARGIN, LEFT_MARGIN + TABLE_WIDTH, DARK_RED, 1.5)

  const footerY = 100
  page2.drawRectangle({ x: LEFT_MARGIN, y: footerY - 5, width: TABLE_WIDTH, height: 22, color: rgb(1, 0.98, 0.95), borderWidth: 0 })
  drawHLine(page2, footerY + 17, LEFT_MARGIN, LEFT_MARGIN + TABLE_WIDTH, GOLD, 1)
  drawHLine(page2, footerY - 5, LEFT_MARGIN, LEFT_MARGIN + TABLE_WIDTH, GOLD, 1)
  page2.drawText(`备注: 仅供${fullName}${genderSuffix}申请签证使用`, { x: LEFT_MARGIN + 10, y: footerY + 2, size: 9, font: cnFont, color: DARK_RED })

  drawRightAligned(page2, dateStr, 55, 12, cnFont, DARK_TEXT)
  drawRightAligned(page2, inviterCompany, 37, 11, cnFont, DARK_RED)
  drawBottomBand(page2)

  // ==================== PAGE 3 ====================
  const page3 = pdfDoc.addPage([pageWidth, pageHeight])
  drawTopBand(page3, 55)
  drawCentered(page3, '备注', pageHeight - 30, 20, cnFontBold, WHITE)
  page3.drawText('/ Notes', { x: pageWidth / 2 + 30, y: pageHeight - 30, size: 12, font: latinFont, color: rgb(1, 0.92, 0.92) })
  y = pageHeight - 100
  for (let i = 0; i < 25; i++) {
    drawHLine(page3, y, LEFT_MARGIN, pageWidth - RIGHT_MARGIN, LIGHT_GRAY, 0.5)
    y -= 28
  }
  drawBottomBand(page3)

  // Output PDF bytes to stdout
  const pdfBytes = await pdfDoc.save()
  process.stdout.write(pdfBytes)
}

main().catch((e) => {
  process.stderr.write(`Error: ${e.message}\n${e.stack}\n`)
  process.exit(1)
})
