/**
 * Word Template Modifier — Pure JavaScript
 * Modifies the .docx template directly by replacing placeholder data.
 * Uses PizZip for ZIP manipulation and regex for XML text replacement.
 */

import PizZip from 'pizzip'

// ============== Nationality Mapping ==============
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

// ============== Embassy Mapping ==============
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

// ============== Helper Functions ==============

function dateToCn(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(d.getTime())) return dateStr
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
}

function todayCn(): string {
  const n = new Date()
  return `${n.getFullYear()}年${n.getMonth() + 1}月${n.getDate()}日`
}

interface ItineraryItem {
  day: number
  date: string
  activity: string
  transport: string
  meals: string
}

function generateItinerary(arrivalStr: string, departureStr: string): ItineraryItem[] {
  const arrival = new Date(arrivalStr + 'T00:00:00Z')
  const departure = new Date(departureStr + 'T00:00:00Z')
  if (isNaN(arrival.getTime()) || isNaN(departure.getTime())) return []

  let totalDays = Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (totalDays < 1) totalDays = 1

  const itinerary: ItineraryItem[] = []

  for (let i = 0; i < totalDays; i++) {
    const currentDate = new Date(arrival.getTime() + i * 24 * 60 * 60 * 1000)
    const dayNum = i + 1
    const dateStr = `${currentDate.getUTCMonth() + 1}.${currentDate.getUTCDate()}`

    if (i === 0) {
      itinerary.push({
        day: dayNum, date: dateStr,
        activity: '搭乘国际航班，飞往广州，夜宿航班。',
        transport: '飞机', meals: '无',
      })
    } else if (i === totalDays - 1) {
      itinerary.push({
        day: dayNum, date: dateStr,
        activity: '酒店早餐后，送往广州白云国际机场，办理乘机手续。乘坐国际航班离开中国，返回阿尔及利亚，行程圆满结束。',
        transport: '包车', meals: '早',
      })
    } else if (i <= 2) {
      itinerary.push({
        day: dayNum, date: dateStr,
        activity: '考察广州中大纺织商圈，走访国际轻纺城和长江辅料城。',
        transport: '包车', meals: '早／午／晚',
      })
    } else if (i === 3) {
      itinerary.push({
        day: dayNum, date: dateStr,
        activity: '考察广州番禺服装产业带，走访沙溪商贸城和周边工厂。',
        transport: '包车', meals: '早／午／晚',
      })
    } else if (i === 4) {
      itinerary.push({
        day: dayNum, date: dateStr,
        activity: '东莞虎门服装批发市场采购。',
        transport: '包车', meals: '早／午／晚',
      })
    } else if (i >= totalDays - 2) {
      itinerary.push({
        day: dayNum, date: dateStr,
        activity: '考察南沙保税仓。',
        transport: '包车', meals: '早／午／晚',
      })
    } else {
      itinerary.push({
        day: dayNum, date: dateStr,
        activity: '深度验厂与采购谈判。',
        transport: '包车', meals: '早／午／晚',
      })
    }
  }

  return itinerary
}

// ============== XML Manipulation ==============

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Replace text within <w:t> elements in the XML.
 */
function replaceTextInXml(xml: string, oldText: string, newText: string): string {
  // Match <w:t> or <w:t xml:space="preserve"> containing the oldText
  const result = xml.replace(
    new RegExp(`<w:t(?:\\s[^>]*)?>[^<]*?${escapeRegex(oldText)}[^<]*?<\\/w:t>`, 'g'),
    (match) => {
      return match.replace(oldText, newText)
    }
  )
  return result
}

/**
 * Replace ALL split date patterns in the XML with new dates, in order.
 * Strategy: Find paragraphs containing date patterns and replace their runs.
 *
 * The template has 3 date patterns:
 * 1. Arrival date (in table row with "预计入境日期")
 * 2. Departure date (in table row with "预计离境日期")
 * 3. Signature date (after company name, sz=23)
 */
function replaceAllSplitDates(xml: string, arrivalCn: string, departureCn: string, todayCn: string): string {
  // Step 1: Replace arrival date - find the paragraph that's in the same row as "预计入境日期"
  // The structure is: <w:tr>...<w:tc>...预计入境日期...</w:tc><w:tc>...<w:p>...DATE RUNS...</w:p></w:tc></w:tr>
  // We find the row containing "预计入境日期", then find the date cell's paragraph

  // Replace arrival date by finding the cell after "预计入境日期"
  xml = replaceDateInTableRow(xml, '预计入境日期', arrivalCn, false)

  // Replace departure date by finding the cell after "预计离境日期"
  xml = replaceDateInTableRow(xml, '预计离境日期', departureCn, false)

  // Replace signature date (after company name)
  xml = replaceSignatureDateInXml(xml, todayCn)

  return xml
}

/**
 * Find a table row containing the label text, then replace the date
 * in the adjacent cell's paragraph.
 */
function replaceDateInTableRow(xml: string, rowLabel: string, newDateCn: string, isSignature: boolean): string {
  // Find the label text in the XML
  const labelPos = xml.indexOf(rowLabel)
  if (labelPos === -1) return xml

  // Find the containing <w:tr> element
  const trStartBefore = xml.lastIndexOf('<w:tr', labelPos)
  const trEndAfter = xml.indexOf('</w:tr>', labelPos)
  if (trStartBefore === -1 || trEndAfter === -1) return xml

  // Find the second <w:tc> in this row (the value cell)
  const trContent = xml.substring(trStartBefore, trEndAfter + '</w:tr>'.length)
  const firstTcEnd = trContent.indexOf('</w:tc>')
  if (firstTcEnd === -1) return xml

  const secondTcStart = trContent.indexOf('<w:tc', firstTcEnd + 1)
  const secondTcEnd = trContent.indexOf('</w:tc>', secondTcStart)
  if (secondTcStart === -1 || secondTcEnd === -1) return xml

  const secondTcContent = trContent.substring(secondTcStart, secondTcEnd + '</w:tc>'.length)

  // Find the <w:p> in this cell that contains the date runs
  // Replace all <w:r> elements in the paragraph with new date runs
  const newDateRuns = createDateRunsXml(newDateCn, isSignature)

  // Find all <w:r> elements in the cell's paragraph that contain <w:t> with date parts
  // Strategy: replace the paragraph content (all runs) with just the new date runs
  const pStart = secondTcContent.lastIndexOf('<w:p', secondTcEnd)
  const pEnd = secondTcContent.indexOf('</w:p>', pStart)
  if (pStart === -1 || pEnd === -1) return xml

  const paragraph = secondTcContent.substring(pStart, pEnd + '</w:p>'.length)

  // Extract the paragraph properties (pPr)
  const pPrMatch = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)
  const pPr = pPrMatch ? pPrMatch[0] : ''

  // Create new paragraph with same pPr but new runs
  const newParagraph = `<w:p>${pPr}${newDateRuns}</w:p>`

  // Replace in the trContent
  const newTrContent = trContent.substring(0, trStartBefore + pStart) +
    (secondTcContent.substring(0, pStart) + newParagraph + secondTcContent.substring(pEnd + '</w:p>'.length)) +
    trContent.substring(trStartBefore + secondTcEnd + '</w:tc>'.length)

  // This approach is getting too complex with string indexing. Let me use a simpler approach.
  // Instead, replace the paragraph directly in the full XML

  // Calculate absolute position of the paragraph in the full XML
  const absParagraphStart = trStartBefore + secondTcStart + pStart
  const absParagraphEnd = trStartBefore + secondTcStart + pEnd + '</w:p>'.length

  const newXml = xml.substring(0, absParagraphStart) + `<w:p>${pPr}${newDateRuns}</w:p>` + xml.substring(absParagraphEnd)
  return newXml
}

/**
 * Replace the signature date (after the company name).
 * Strategy: Find paragraphs with date patterns (containing 年) that are NOT
 * the table dates (which have sz=20 and are already replaced).
 * Replace all remaining date paragraphs with today's date.
 */
function replaceSignatureDateInXml(xml: string, newDateCn: string): string {
  // Find all <w:p> paragraphs that contain 年 in <w:t> elements
  const paraRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g
  const matches: { match: string; index: number }[] = []
  let m: RegExpExecArray | null

  while ((m = paraRegex.exec(xml)) !== null) {
    const para = m[0]
    // Check if this paragraph contains 年
    if (/<w:t[^>]*>年<\/w:t>/.test(para)) {
      // Skip paragraphs with sz=20 (these are table dates, already replaced)
      if (para.includes('w:sz w:val="20"') && !para.includes('w:sz w:val="23"')) {
        continue
      }
      // This is a signature date (sz=23 or no sz)
      matches.push({ match: para, index: m.index })
    }
  }

  if (matches.length === 0) return xml

  // Replace from end to start (to preserve indices)
  let result = xml
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]
    const paragraph = match.match

    // Determine if it's sz=23 or no sz
    const isSignature = paragraph.includes('w:sz w:val="23"')

    // Extract the paragraph properties (pPr)
    const pPrMatch = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)
    const pPr = pPrMatch ? pPrMatch[0] : ''

    // Create new paragraph with same pPr but new date runs
    const newDateRuns = createDateRunsXml(newDateCn, isSignature)
    const newParagraph = `<w:p>${pPr}${newDateRuns}</w:p>`

    result = result.substring(0, match.index) + newParagraph + result.substring(match.index + match.match.length)
  }

  return result
}

/**
 * Create XML for date runs (6 runs: year, 年, month, 月, day, 日)
 */
function createDateRunsXml(dateCn: string, isSignature: boolean): string {
  const parts = dateCn.match(/(\d+)年(\d+)月(\d+)日/)
  if (!parts) return ''

  const numberFont = '<w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri" w:hint="eastAsia"/>'
  const cnFont = '<w:rFonts w:ascii="SimSun" w:eastAsia="SimSun" w:hAnsi="SimSun" w:hint="eastAsia"/>'
  const sz = isSignature ? '23' : '20'
  const colorSize = `<w:color w:val="000000"/><w:sz w:val="${sz}"/><w:szCs w:val="18"/>`

  function makeRun(text: string, isNumber: boolean): string {
    const font = isNumber ? numberFont : cnFont
    return `<w:r><w:rPr>${font}${colorSize}</w:rPr><w:t>${text}</w:t></w:r>`
  }

  return makeRun(parts[1], true) + makeRun('年', false) +
         makeRun(parts[2], true) + makeRun('月', false) +
         makeRun(parts[3], true) + makeRun('日', false)
}

/**
 * Create an itinerary table row XML
 */
function createItineraryRowXml(dayLabel: string, dateLabel: string, activity: string, transport: string, meals: string): string {
  const colWidths = ['1199', '1318', '3669', '658', '1138']
  const colTexts = [dayLabel, dateLabel, activity, transport, meals]
  const aligns = ['center', 'center', 'both', 'center', 'center']

  let rowXml = '<w:tr><w:trPr><w:trHeight w:val="480"/></w:trPr>'

  for (let i = 0; i < 5; i++) {
    const width = colWidths[i]
    const text = escapeXml(colTexts[i])
    const align = aligns[i]
    const isChinese = i === 2 || i === 3 || i === 4
    const font = isChinese
      ? '<w:rFonts w:ascii="SimSun" w:eastAsia="SimSun" w:hAnsi="SimSun" w:hint="eastAsia"/>'
      : '<w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri" w:hint="eastAsia"/>'

    rowXml += `<w:tc>` +
      `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>` +
      `<w:tcBorders>` +
      `<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>` +
      `<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>` +
      `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>` +
      `<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>` +
      `</w:tcBorders></w:tcPr>` +
      `<w:p>` +
      `<w:pPr>` +
      `<w:wordWrap w:val="0"/><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/>` +
      `<w:spacing w:before="20" w:after="0" w:line="239" w:lineRule="auto"/>` +
      `<w:jc w:val="${align}"/>` +
      `<w:rPr><w:sz w:val="20"/><w:szCs w:val="18"/></w:rPr>` +
      `</w:pPr>` +
      `<w:r><w:rPr>${font}<w:color w:val="000000"/><w:sz w:val="20"/><w:szCs w:val="18"/></w:rPr>` +
      `<w:t xml:space="preserve">${text}</w:t></w:r>` +
      `</w:p></w:tc>`
  }

  rowXml += '</w:tr>'
  return rowXml
}

/**
 * Create the full itinerary table XML
 */
function createItineraryTableXml(itinerary: ItineraryItem[]): string {
  // Table header row
  const headerCols = ['Day', '日期', '行程安排', '交通', '用餐']
  const headerWidths = ['1199', '1318', '3669', '658', '1138']

  let headerXml = '<w:tr><w:trPr><w:trHeight w:val="480"/></w:trPr>'
  for (let i = 0; i < 5; i++) {
    headerXml += `<w:tc>` +
      `<w:tcPr><w:tcW w:w="${headerWidths[i]}" w:type="dxa"/>` +
      `<w:tcBorders>` +
      `<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>` +
      `<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>` +
      `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>` +
      `<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>` +
      `</w:tcBorders></w:tcPr>` +
      `<w:p>` +
      `<w:pPr>` +
      `<w:wordWrap w:val="0"/><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/>` +
      `<w:spacing w:before="20" w:after="0" w:line="239" w:lineRule="auto"/>` +
      `<w:jc w:val="center"/>` +
      `<w:rPr><w:sz w:val="20"/><w:szCs w:val="18"/></w:rPr>` +
      `</w:pPr>` +
      `<w:r><w:rPr><w:rFonts w:ascii="SimSun" w:eastAsia="SimSun" w:hAnsi="SimSun" w:hint="eastAsia"/><w:b/><w:color w:val="000000"/><w:sz w:val="20"/><w:szCs w:val="18"/></w:rPr>` +
      `<w:t>${headerCols[i]}</w:t></w:r>` +
      `</w:p></w:tc>`
  }
  headerXml += '</w:tr>'

  // Data rows
  let dataRows = ''
  for (const item of itinerary) {
    dataRows += createItineraryRowXml(
      `Day${item.day}`,
      item.date,
      item.activity,
      item.transport,
      item.meals
    )
  }

  // Full table
  const tableXml = '<w:tbl>' +
    '<w:tblPr>' +
    '<w:tblW w:w="0" w:type="auto"/>' +
    '<w:tblInd w:w="560" w:type="dxa"/>' +
    '<w:tblBorders>' +
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
    '</w:tblBorders>' +
    '<w:tblCellMar>' +
    '<w:left w:w="40" w:type="dxa"/>' +
    '<w:right w:w="40" w:type="dxa"/>' +
    '</w:tblCellMar>' +
    '</w:tblPr>' +
    '<w:tblGrid>' +
    '<w:gridCol w:w="1199"/>' +
    '<w:gridCol w:w="1318"/>' +
    '<w:gridCol w:w="3669"/>' +
    '<w:gridCol w:w="658"/>' +
    '<w:gridCol w:w="1138"/>' +
    '</w:tblGrid>' +
    headerXml +
    dataRows +
    '</w:tbl>'

  return tableXml
}

// ============== Main Function ==============

export interface TemplateData {
  lastName: string
  firstName: string
  sex: string
  nationality: string
  passportNumber: string
  arrivalDate: string
  departureDate: string
  cityToVisit: string
  inviterCompany: string
}

export function modifyTemplate(templateBuffer: Buffer | ArrayBuffer, data: TemplateData): Buffer {
  const zip = new PizZip(templateBuffer)
  let xml = zip.file('word/document.xml')!.asText()

  // Derived values
  const fullName = `${data.lastName} ${data.firstName}`.trim()
  const sexCn = data.sex === 'M' ? '男' : '女'
  const nationalityCn = NAT_MAP[data.nationality] || data.nationality
  const embassy = EMBASSY_MAP[data.nationality] || '中国驻阿尔及利亚使领馆签证中心'
  const arrivalCn = dateToCn(data.arrivalDate)
  const departureCn = dateToCn(data.departureDate)
  const todayStr = todayCn()

  // ============== Step 1: Replace split dates FIRST ==============
  // Do this before text replacements to avoid confusion with "阿尔及利亚" appearing in embassy text
  xml = replaceAllSplitDates(xml, arrivalCn, departureCn, todayStr)

  // ============== Step 2: Simple text replacements ==============
  // Replace embassy name (must be before nationality to avoid "阿尔及利亚" in embassy text)
  xml = replaceTextInXml(xml, '中国驻阿尔及利亚使领馆签证中心', embassy)

  // Replace full name
  xml = replaceTextInXml(xml, 'KRIBAA ABDELOUAHID', fullName)

  // Replace passport number
  xml = replaceTextInXml(xml, '176782160', data.passportNumber)

  // Replace city
  xml = replaceTextInXml(xml, '广州、东莞等城市', data.cityToVisit)

  // Replace sex
  xml = xml.replace(/<w:t>男<\/w:t>/g, `<w:t>${sexCn}</w:t>`)

  // Replace nationality (after embassy, so "阿尔及利亚" in embassy text is already replaced)
  xml = replaceTextInXml(xml, '阿尔及利亚', nationalityCn)

  // Replace inviter company name
  xml = replaceTextInXml(xml, '佛山市盈达通外贸服务有限公司', data.inviterCompany)

  // ============== Step 3: Add itinerary table ==============
  const itinerary = generateItinerary(data.arrivalDate, data.departureDate)
  if (itinerary.length > 0) {
    const itineraryTableXml = createItineraryTableXml(itinerary)

    // Find the "详细行程" heading and add the table after it
    const headingText = '详细行程</w:t>'
    const headingPos = xml.indexOf(headingText)

    if (headingPos !== -1) {
      // Find the end of the paragraph containing "详细行程"
      const paraEndPos = xml.indexOf('</w:p>', headingPos)
      if (paraEndPos !== -1) {
        const insertPos = paraEndPos + '</w:p>'.length

        // Check if there's already an itinerary table after the heading
        const afterHeading = xml.substring(insertPos)
        const nextTableStart = afterHeading.indexOf('<w:tbl>')

        if (nextTableStart !== -1 && nextTableStart < 500) {
          // Replace existing table
          const tableStartAbs = insertPos + nextTableStart
          const tableEndStr = '</w:tbl>'
          const tableEndRel = afterHeading.indexOf(tableEndStr)
          if (tableEndRel !== -1) {
            const tableEndAbs = insertPos + tableEndRel + tableEndStr.length
            xml = xml.substring(0, tableStartAbs) + itineraryTableXml + xml.substring(tableEndAbs)
          }
        } else {
          // Insert the table after the heading paragraph
          xml = xml.substring(0, insertPos) + itineraryTableXml + xml.substring(insertPos)
        }
      }
    }
  }

  // ============== Step 4: Save ==============
  zip.file('word/document.xml', xml)
  const output = zip.generate({ type: 'nodebuffer' })
  return output as Buffer
}
