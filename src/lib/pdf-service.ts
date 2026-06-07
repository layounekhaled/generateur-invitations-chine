/**
 * PDF Generation Service — China Invitation Generator
 * Generates PDF based on the "Foshan Yingtabong" template style
 * Uses pdf-lib directly in-process (no child process)
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import path from 'path'
import fs from 'fs'

// ============== Design Constants ==============
const PAGE_W = 595.28   // A4 width
const PAGE_H = 841.89   // A4 height
const M_LEFT = 70       // left margin
const M_RIGHT = 70      // right margin
const M_TOP = 70        // top margin
const M_BOTTOM = 70     // bottom margin
const CW = PAGE_W - M_LEFT - M_RIGHT  // content width

// Colors — matching the Yingtabong template (professional dark blue/black theme)
const C_TITLE    = rgb(0.0, 0.0, 0.0)       // Black for title
const C_BODY     = rgb(0.05, 0.05, 0.05)     // Near-black for body
const C_HEADER   = rgb(0.15, 0.25, 0.45)     // Dark blue for table headers
const C_HEADER_T = rgb(1, 1, 1)              // White text on header
const C_LIGHT_BG = rgb(0.94, 0.95, 0.97)     // Light blue-gray for alt rows
const C_BORDER   = rgb(0.75, 0.78, 0.82)     // Border color
const C_WHITE    = rgb(1, 1, 1)
const C_LGRAY    = rgb(0.85, 0.85, 0.85)
const C_DGRAY    = rgb(0.35, 0.35, 0.35)
const C_LABEL_BG = rgb(0.92, 0.93, 0.95)     // Light label background

// ============== Data ==============
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

const CITY_MAP: Record<string, string> = {
  '广州': 'Guangzhou', '佛山': 'Foshan', '深圳': 'Shenzhen',
  '上海': 'Shanghai', '北京': 'Beijing', '义乌': 'Yiwu', '杭州': 'Hangzhou',
  '东莞': 'Dongguan',
}

// Embassy mapping
const EMBASSY_MAP: Record<string, string> = {
  'Algeria': '中国驻阿尔及利亚使领馆签证中心',
  'France': '中国驻法国使领馆签证中心',
  'Morocco': '中国驻摩洛哥使领馆签证中心',
  'Tunisia': '中国驻突尼斯使领馆签证中心',
  'Egypt': '中国驻埃及使领馆签证中心',
  'Libya': '中国驻利比亚使领馆签证中心',
  'Mauritania': '中国驻毛里塔尼亚使领馆签证中心',
  'Iraq': '中国驻伊拉克使领馆签证中心',
  'Iran': '中国驻伊朗使领馆签证中心',
  'Turkey': '中国驻土耳其使领馆签证中心',
  'Pakistan': '中国驻巴基斯坦使领馆签证中心',
  'India': '中国驻印度使领馆签证中心',
  'Russia': '中国驻俄罗斯使领馆签证中心',
  'Ukraine': '中国驻乌克兰使领馆签证中心',
  'Nigeria': '中国驻尼日利亚使领馆签证中心',
  'Senegal': '中国驻塞内加尔使领馆签证中心',
  'Mali': '中国驻马里使领馆签证中心',
}

// ============== Helpers ==============
function dateSlash(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`
}

function dateCN(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`
}

function todayCN(): string {
  const n = new Date()
  return `${n.getFullYear()}年${n.getMonth() + 1}月${n.getDate()}日`
}

// Draw a table cell with border and text
function drawCell(
  page: any,
  x: number, y: number, w: number, h: number,
  text: string,
  font: any, size: number, color: any,
  bgColor?: any,
  align: 'left' | 'center' = 'left',
  vPad: number = 5
) {
  // Background
  page.drawRectangle({
    x, y, width: w, height: h,
    color: bgColor || C_WHITE,
    borderColor: C_BORDER,
    borderWidth: 0.5,
  })
  // Text
  const tw = font.widthOfTextAtSize(text, size)
  let tx: number
  if (align === 'center') {
    tx = x + (w - tw) / 2
  } else {
    tx = x + 6
  }
  page.drawText(text, {
    x: tx,
    y: y + h / 2 - size / 2 + vPad,
    size, font, color
  })
}

// Itinerary generation — matches the Yingtabong template style
interface ItinDay {
  days: string
  date: string
  activity: string
  transport: string
  meals: string
}

function makeItinerary(arrival: string, departure: string, city: string, cnNat: string): ItinDay[] {
  const a = new Date(arrival + 'T00:00:00')
  const dep = new Date(departure + 'T00:00:00')
  const total = Math.floor((dep.getTime() - a.getTime()) / 86400000) + 1
  if (total <= 0) return []

  const fmtShort = (d: string) => {
    const dt = new Date(d + 'T00:00:00')
    return `${dt.getMonth() + 1}.${dt.getDate()}`
  }

  const days: ItinDay[] = []

  // Day 1: arrival by plane
  days.push({
    days: 'Day1',
    date: fmtShort(arrival),
    activity: `搭乘国际航班，飞往${city}，夜宿航班。`,
    transport: '飞机',
    meals: '无'
  })

  if (total >= 2) {
    const d2 = new Date(a.getTime() + 86400000)
    if (total === 2) {
      // Short trip: day 2 is departure
      days.push({
        days: 'Day2',
        date: fmtShort(d2.toISOString().slice(0, 10)),
        activity: `到达${city}，商务洽谈，考察市场。`,
        transport: '包车',
        meals: '早／午／晚'
      })
    } else if (total === 3) {
      // 3-day trip
      days.push({
        days: 'Day2',
        date: fmtShort(d2.toISOString().slice(0, 10)),
        activity: `到达佛山市盈达通外贸服务有限公司，商务洽谈。`,
        transport: '包车',
        meals: '早／午／晚'
      })
      const d3 = new Date(a.getTime() + 2 * 86400000)
      days.push({
        days: 'Day3',
        date: fmtShort(d3.toISOString().slice(0, 10)),
        activity: `酒店早餐后，送往${city}机场，乘坐国际航班返回${cnNat}，行程圆满结束。`,
        transport: '包车',
        meals: '早'
      })
    } else {
      // 4+ day trip — matches the Yingtabong template pattern
      const d2 = new Date(a.getTime() + 86400000)
      days.push({
        days: 'Day2-3',
        date: `${fmtShort(d2.toISOString().slice(0, 10))}-${fmtShort(new Date(a.getTime() + 2 * 86400000).toISOString().slice(0, 10))}`,
        activity: `考察${city}中大纺织商圈，走访国际轻纺城和长江辅料城。`,
        transport: '包车',
        meals: '早／午／晚'
      })

      if (total >= 5) {
        const d4 = new Date(a.getTime() + 3 * 86400000)
        days.push({
          days: 'Day4',
          date: fmtShort(d4.toISOString().slice(0, 10)),
          activity: `考察${city}番禺服装产业带，走访沙溪商贸城和周边工厂。`,
          transport: '包车',
          meals: '早／午／晚'
        })
      }

      if (total >= 6) {
        const d5 = new Date(a.getTime() + 4 * 86400000)
        days.push({
          days: 'Day5',
          date: fmtShort(d5.toISOString().slice(0, 10)),
          activity: '东莞虎门服装批发市场采购。',
          transport: '包车',
          meals: '早／午／晚'
        })
      }

      if (total >= 7) {
        const d6 = new Date(a.getTime() + 5 * 86400000)
        const endRange = total >= 10 ? total - 2 : total - 1
        const endDate = new Date(a.getTime() + (endRange - 1) * 86400000)
        if (endRange > 6) {
          days.push({
            days: `Day6-Day${endRange}`,
            date: `${fmtShort(d6.toISOString().slice(0, 10))}-${fmtShort(endDate.toISOString().slice(0, 10))}`,
            activity: '深度验厂与采购谈判。',
            transport: '包车',
            meals: '早／午／晚'
          })
        } else {
          days.push({
            days: `Day6`,
            date: fmtShort(d6.toISOString().slice(0, 10)),
            activity: '深度验厂与采购谈判。',
            transport: '包车',
            meals: '早／午／晚'
          })
        }
      }

      if (total >= 8) {
        const dBeforeLast = new Date(dep.getTime() - 86400000)
        days.push({
          days: `Day${total - 1}`,
          date: fmtShort(dBeforeLast.toISOString().slice(0, 10)),
          activity: '考察南沙保税仓。',
          transport: '包车',
          meals: '早／午／晚'
        })
      }

      // Last day: departure
      days.push({
        days: `Day${total}`,
        date: fmtShort(departure),
        activity: `酒店早餐后，送往${city}白云国际机场，办理乘机手续。乘坐国际航班离开中国，返回${cnNat}，行程圆满结束。`,
        transport: '包车',
        meals: '早'
      })
    }
  }

  return days
}

// ============== Interface ==============
interface InvitationData {
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
  inviterCompany?: string
}

// ============== Main PDF Generation ==============
export async function generatePDF(data: InvitationData): Promise<Uint8Array> {
  const nationality = data.nationality || 'Algeria'
  const cnNat = NAT_MAP[nationality] || nationality
  const fullName = `${data.lastName} ${data.firstName}`
  const city = data.cityToVisit || '广州'
  const cityEN = CITY_MAP[city] || city
  const sex = data.sex || 'M'
  const passportNo = data.passportNumber || ''
  const arrival = data.arrivalDate || ''
  const departure = data.departureDate || ''
  const inviterCompany = data.inviterCompany || '佛山市盈达通外贸服务有限公司'
  const dateStr = todayCN()
  const embassy = EMBASSY_MAP[nationality] || '中国驻相关国家使领馆签证中心'
  const itin = makeItinerary(arrival, departure, city, cnNat)

  // Create PDF
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const cwd = process.cwd()
  const cnFont     = await pdfDoc.embedFont(fs.readFileSync(path.join(cwd, 'public/fonts/chinese-subset.ttf')))
  const cnFontBold = await pdfDoc.embedFont(fs.readFileSync(path.join(cwd, 'public/fonts/chinese-subset-bold.ttf')))
  const latinFont     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const latinFontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y: number

  // ========================================
  // PAGE 1 — 商务邀请函 (Business Invitation Letter)
  // ========================================
  const p1 = pdfDoc.addPage([PAGE_W, PAGE_H])
  y = PAGE_H - M_TOP

  // Title: 商务邀请函 (centered, bold, 18pt)
  const titleText = '商务邀请函'
  const titleSize = 18
  const titleW = cnFontBold.widthOfTextAtSize(titleText, titleSize)
  p1.drawText(titleText, {
    x: (PAGE_W - titleW) / 2, y, size: titleSize,
    font: cnFontBold, color: C_TITLE
  })
  y -= 35

  // Recipient: 致：中国驻XXX使领馆签证中心
  p1.drawText(`致：${embassy}`, {
    x: M_LEFT, y, size: 10, font: cnFont, color: C_BODY
  })
  y -= 22

  // Greeting: 尊敬的签证官员：
  p1.drawText('尊敬的签证官员：', {
    x: M_LEFT, y, size: 10, font: cnFont, color: C_BODY
  })
  y -= 25

  // Body paragraph 1 — invitation text
  const bodyLine1a = `我司${inviterCompany}诚挚邀请以下合作伙伴莅临中国，开展贸易合作`
  const bodyLine1b = '洽谈及市场考察活动。本次行程旨在促进双方商业交流，探讨长期合'
  const bodyLine1c = `作机遇。受邀方需自行承担国际往返旅费及在华期间产生的各项费用。`
  p1.drawText(bodyLine1a, { x: M_LEFT, y, size: 10, font: cnFont, color: C_BODY })
  y -= 17
  p1.drawText(bodyLine1b, { x: M_LEFT, y, size: 10, font: cnFont, color: C_BODY })
  y -= 17
  p1.drawText(bodyLine1c, { x: M_LEFT, y, size: 10, font: cnFont, color: C_BODY })
  y -= 28

  // "邀请信息如下："
  p1.drawText('邀请信息如下：', {
    x: M_LEFT, y, size: 10, font: cnFont, color: C_BODY
  })
  y -= 22

  // Table 1: Invitee Information (2 columns)
  const t1_x = M_LEFT
  const t1_col1_w = 150
  const t1_col2_w = CW - t1_col1_w
  const t1_row_h = 24

  // Header row
  drawCell(p1, t1_x, y - t1_row_h, t1_col1_w, t1_row_h,
    '被邀请人详细信息', cnFontBold, 9.5, C_HEADER_T, C_HEADER, 'center')
  drawCell(p1, t1_x + t1_col1_w, y - t1_row_h, t1_col2_w, t1_row_h,
    '具体内容', cnFontBold, 9.5, C_HEADER_T, C_HEADER, 'center')
  y -= t1_row_h

  // Data rows
  const inviteeFields = [
    ['姓名', fullName],
    ['性别', sex === 'M' ? '男' : '女'],
    ['国籍', cnNat],
    ['护照号码', passportNo],
    ['预计入境日期', dateCN(arrival)],
    ['预计离境日期', dateCN(departure)],
    ['访问城市', `${city}、佛山等城市`],
  ]

  for (let i = 0; i < inviteeFields.length; i++) {
    const bg = i % 2 === 0 ? C_WHITE : C_LIGHT_BG
    drawCell(p1, t1_x, y - t1_row_h, t1_col1_w, t1_row_h,
      inviteeFields[i][0], cnFont, 9.5, C_BODY, bg, 'center')
    drawCell(p1, t1_x + t1_col1_w, y - t1_row_h, t1_col2_w, t1_row_h,
      inviteeFields[i][1], cnFont, 9.5, C_BODY, bg)
    y -= t1_row_h
  }

  y -= 20

  // "邀请方声明："
  p1.drawText('邀请方声明：', {
    x: M_LEFT, y, size: 10, font: cnFont, color: C_BODY
  })
  y -= 20

  // Declaration text
  const declLine1 = '我公司督促被邀请人在华期间将严格遵循中国法律法规，并安排其按时离'
  const declLine2 = '境。如有需要进一步了解的信息，请随时与我公司取得联系。'
  p1.drawText(declLine1, { x: M_LEFT, y, size: 10, font: cnFont, color: C_BODY })
  y -= 17
  p1.drawText(declLine2, { x: M_LEFT, y, size: 10, font: cnFont, color: C_BODY })
  y -= 40

  // Company signature (right-aligned)
  const compW = cnFont.widthOfTextAtSize(inviterCompany, 11)
  p1.drawText(inviterCompany, {
    x: PAGE_W - M_RIGHT - compW, y, size: 11, font: cnFont, color: C_BODY
  })
  y -= 22

  // Date (right-aligned)
  const dateW = cnFont.widthOfTextAtSize(dateStr, 11)
  // Mix of Chinese and Latin chars — draw separately
  const dateParts = dateStr
  p1.drawText(dateParts, {
    x: PAGE_W - M_RIGHT - dateW, y, size: 11, font: cnFont, color: C_BODY
  })

  // ========================================
  // PAGE 2 — 详细行程 (Detailed Itinerary)
  // ========================================
  const p2 = pdfDoc.addPage([PAGE_W, PAGE_H])
  y = PAGE_H - M_TOP

  // Title: 详细行程 (centered, bold)
  const itinTitle = '详细行程'
  const itinTitleSize = 16
  const itinTitleW = cnFontBold.widthOfTextAtSize(itinTitle, itinTitleSize)
  p2.drawText(itinTitle, {
    x: (PAGE_W - itinTitleW) / 2, y, size: itinTitleSize,
    font: cnFontBold, color: C_TITLE
  })
  y -= 35

  // Itinerary table (5 columns)
  const t2_x = M_LEFT
  const t2_cols = [55, 55, 230, 55, 60] // 天数, 日期, 行程, 交通, 用餐
  const t2_row_h = 26

  // Calculate column x positions
  const t2_colX: number[] = [t2_x]
  for (let i = 0; i < t2_cols.length - 1; i++) {
    t2_colX.push(t2_colX[i] + t2_cols[i])
  }

  // Header row
  const headerLabels = ['天数', '日期', '行程', '交通', '用餐']
  for (let i = 0; i < headerLabels.length; i++) {
    drawCell(p2, t2_colX[i], y - t2_row_h, t2_cols[i], t2_row_h,
      headerLabels[i], cnFontBold, 9, C_HEADER_T, C_HEADER, 'center')
  }
  y -= t2_row_h

  // Itinerary data rows
  for (let i = 0; i < itin.length; i++) {
    const day = itin[i]
    const bg = i % 2 === 0 ? C_WHITE : C_LIGHT_BG

    // Calculate row height based on activity text length
    const actTextWidth = cnFont.widthOfTextAtSize(day.activity, 9)
    const actLines = Math.max(1, Math.ceil(actTextWidth / (t2_cols[2] - 12)))
    const rowH = Math.max(t2_row_h, actLines * 15 + 10)

    // Draw cells
    const cellData = [
      { text: day.days, align: 'center' as const },
      { text: day.date, align: 'center' as const },
      { text: day.activity, align: 'left' as const },
      { text: day.transport, align: 'center' as const },
      { text: day.meals, align: 'center' as const },
    ]

    for (let ci = 0; ci < cellData.length; ci++) {
      drawCell(p2, t2_colX[ci], y - rowH, t2_cols[ci], rowH,
        cellData[ci].text, cnFont, 9, C_BODY, bg, cellData[ci].align)
    }
    y -= rowH
  }

  // Bottom of itinerary table
  y -= 35

  // Company signature
  const compW2 = cnFont.widthOfTextAtSize(inviterCompany, 11)
  p2.drawText(inviterCompany, {
    x: PAGE_W - M_RIGHT - compW2, y, size: 11, font: cnFont, color: C_BODY
  })
  y -= 22

  // Date
  const dateW2 = cnFont.widthOfTextAtSize(dateStr, 11)
  p2.drawText(dateStr, {
    x: PAGE_W - M_RIGHT - dateW2, y, size: 11, font: cnFont, color: C_BODY
  })

  return await pdfDoc.save()
}

// ============== HTML Preview ==============
function fmtDate(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`
}

function genItineraryHTML(arrival: string, departure: string, city: string, nationality: string): { date: string; act: string; acc: string }[] {
  const a = new Date(arrival + 'T00:00:00')
  const dep = new Date(departure + 'T00:00:00')
  const total = Math.floor((dep.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (total <= 0) return []

  const cnNat = NAT_MAP[nationality] || nationality
  const days: { date: string; act: string; acc: string }[] = []
  days.push({ date: dateCN(arrival), act: `到达${city}机场。`, acc: city })
  if (total >= 2) {
    const d2 = new Date(a.getTime() + 86400000)
    days.push({ date: dateCN(d2.toISOString().slice(0, 10)), act: '到达佛山市盈达通外贸服务有限公司，商务洽谈。', acc: '佛山' })
  }
  if (total >= 4) {
    const ms = new Date(a.getTime() + 2 * 86400000)
    const me = new Date(dep.getTime() - 2 * 86400000)
    days.push({ date: `${dateCN(ms.toISOString().slice(0, 10))}-${dateCN(me.toISOString().slice(0, 10))}`, act: '佛山南海工厂洽谈业务和订货。', acc: '佛山' })
  } else if (total === 3) {
    const d3 = new Date(a.getTime() + 2 * 86400000)
    days.push({ date: dateCN(d3.toISOString().slice(0, 10)), act: '佛山南海工厂洽谈业务和订货。', acc: '佛山' })
  }
  if (total >= 4) {
    const sl = new Date(dep.getTime() - 86400000)
    days.push({ date: dateCN(sl.toISOString().slice(0, 10)), act: `拜访${city}物流公司。`, acc: city })
  }
  if (total >= 2) {
    days.push({ date: dateCN(departure), act: `从${city}返回${cnNat}。`, acc: '/' })
  }
  return days
}

export function generateHTMLPreview(data: InvitationData): string {
  const nationality = data.nationality || 'Algeria'
  const cnNat = NAT_MAP[nationality] || nationality
  const fullName = `${data.lastName} ${data.firstName}`
  const passport = data.passportNumber
  const arrival = data.arrivalDate
  const departure = data.departureDate
  const city = data.cityToVisit || '广州'
  const cityEN = CITY_MAP[city] || city
  const sex = data.sex || 'M'
  const dob = (data.dateOfBirth || '').replace(/-/g, '/')
  const purpose = data.visitPurpose || '商务洽谈'
  const funding = data.fundingSource || '客户本人'
  const relation = data.inviterRelation || '客户'
  const inviterCompany = data.inviterCompany || '佛山市盈达通外贸服务有限公司'
  const itin = genItineraryHTML(arrival, departure, city, nationality)
  const dateStr = todayCN()
  const genderSuffix = sex === 'M' ? '先生' : '女士'
  const embassy = EMBASSY_MAP[nationality] || '中国驻相关国家使领馆签证中心'

  const fv = 'background:#fffde7;border:1px dashed #ff9800;padding:1px 4px;font-weight:bold'

  const itinRows = itin.map(d =>
    `<tr><td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;white-space:nowrap">${d.date}</td>` +
    `<td style="padding:8px 10px;border:1px solid #ddd;font-size:13px">${d.act}</td>` +
    `<td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;text-align:center">${d.acc}</td>` +
    `<td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;text-align:center">包车</td></tr>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}
html,body{width:210mm;font-family:sans-serif}
.page{width:210mm;min-height:297mm;background:white;padding:25mm 35mm}
h1{font-size:22px;text-align:center;margin-bottom:20px;color:#000}
.recipient{font-size:12px;margin-bottom:5px;color:#111}
.greeting{font-size:12px;margin-bottom:15px;color:#111}
.body-text{font-size:12px;line-height:1.8;margin-bottom:15px;color:#111;text-align:justify}
.body-text p{margin-bottom:10px}
.section-title{font-size:12px;font-weight:bold;margin:15px 0 10px;color:#111}
table{width:100%;border-collapse:collapse;margin:10px 0}
th{background:#263b6e;color:white;padding:8px 10px;font-size:11px;text-align:center}
td{padding:8px 10px;border:1px solid #c0c5cc;font-size:11px}
tr:nth-child(even){background:#eff0f4}
.label-cell{background:#ebeef3;font-weight:bold;text-align:center;width:35%}
.signature{text-align:right;margin-top:40px;font-size:12px}
.signature .company{color:#111;font-weight:bold;margin-bottom:5px}
</style></head><body>

<div class="page">
  <h1>商务邀请函</h1>
  <div class="recipient">致：${embassy}</div>
  <div class="greeting">尊敬的签证官员：</div>

  <div class="body-text">
    <p>我司${inviterCompany}诚挚邀请以下合作伙伴莅临中国，开展贸易合作洽谈及市场考察活动。本次行程旨在促进双方商业交流，探讨长期合作机遇。受邀方需自行承担国际往返旅费及在华期间产生的各项费用。</p>
  </div>

  <div class="section-title">邀请信息如下：</div>

  <table>
    <tr><th>被邀请人详细信息</th><th>具体内容</th></tr>
    <tr><td class="label-cell">姓名</td><td style="${fv}">${fullName}</td></tr>
    <tr><td class="label-cell">性别</td><td style="${fv}">${sex === 'M' ? '男' : '女'}</td></tr>
    <tr><td class="label-cell">国籍</td><td style="${fv}">${cnNat}</td></tr>
    <tr><td class="label-cell">护照号码</td><td style="${fv}">${passport}</td></tr>
    <tr><td class="label-cell">预计入境日期</td><td style="${fv}">${dateCN(arrival)}</td></tr>
    <tr><td class="label-cell">预计离境日期</td><td style="${fv}">${dateCN(departure)}</td></tr>
    <tr><td class="label-cell">访问城市</td><td style="${fv}">${city}、佛山等城市</td></tr>
  </table>

  <div class="section-title">邀请方声明：</div>
  <div class="body-text">
    <p>我公司督促被邀请人在华期间将严格遵循中国法律法规，并安排其按时离境。如有需要进一步了解的信息，请随时与我公司取得联系。</p>
  </div>

  <div class="signature">
    <div class="company">${inviterCompany}</div>
    <div>${dateStr}</div>
  </div>
</div>

<div class="page" style="page-break-before:always">
  <h1>详细行程</h1>
  <table>
    <thead><tr>
      <th>天数</th><th>日期</th><th>行程</th><th>交通</th><th>用餐</th>
    </tr></thead>
    <tbody>${itinRows}</tbody>
  </table>

  <div class="signature" style="margin-top:50px">
    <div class="company">${inviterCompany}</div>
    <div>${dateStr}</div>
  </div>
</div>

</body></html>`
}
