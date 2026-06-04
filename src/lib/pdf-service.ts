/**
 * PDF Generation Service - China Invitation Generator
 * Uses a child process running a pre-bundled JS script to avoid fontkit crashes in Next.js.
 */
import path from 'path'

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

const CITY_MAP: Record<string, string> = {
  '广州': 'Guangzhou', '佛山': 'Foshan', '深圳': 'Shenzhen',
  '上海': 'Shanghai', '北京': 'Beijing', '义乌': 'Yiwu', '杭州': 'Hangzhou',
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

function todayCN(): string {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
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

// ============== Main PDF generation ==============

interface InvitationData {
  template?: string
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
  invitedCompany?: string
}

export async function generatePDF(data: InvitationData): Promise<Uint8Array> {
  // Use the pre-bundled generator script via child process
  // This avoids fontkit crashes in Next.js production mode
  const scriptPath = path.join(process.cwd(), 'dist/pdf-generator.js')

  const inputData = JSON.stringify({
    ...data,
    _natMap: NAT_MAP,
    _cityMap: CITY_MAP,
  })

  return new Promise<Uint8Array>(async (resolve, reject) => {
    // Dynamic import to avoid Next.js bundling issues with child_process
    const { spawn } = await import('child_process')
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    const child = spawn('node', ['--max-old-space-size=256', scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    child.stdin.write(inputData)
    child.stdin.end()

    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk))

    child.on('close', (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString('utf-8')
        reject(new Error(`PDF generation failed (exit ${code}): ${stderr.slice(0, 500)}`))
      } else {
        resolve(new Uint8Array(Buffer.concat(chunks)))
      }
    })

    child.on('error', (err) => {
      reject(new Error(`PDF generation error: ${err.message}`))
    })

    setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('PDF generation timeout'))
    }, 30000)
  })
}

/**
 * Generate HTML preview
 */
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
  const inviterCompany = data.inviterCompany || '佛山市乐织外贸服务有限公司'
  const itin = genItinerary(arrival, departure, city, cnNat)
  const dateStr = todayCN()
  const genderSuffix = sex === 'M' ? '先生' : '女士'

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
.page{width:210mm;min-height:297mm;background:white;padding:25mm}
.red-bar{background:#b80d0d;color:white;padding:12px 20px;margin:-25mm -25mm 20px -25mm}
.gold-line{height:3px;background:#d9a621;margin:0 -25mm 15px -25mm}
h2{margin:0;font-size:22px}
.subtitle{font-size:12px;color:#ffd9d9;margin-top:4px}
.field{display:flex;margin-bottom:8px;font-size:12px}
.label{width:160px;color:#b80d0d;font-weight:bold;flex-shrink:0}
.value{flex:1}
table{width:100%;border-collapse:collapse;margin-top:15px}
th{background:#b80d0d;color:white;padding:8px;font-size:12px}
td{padding:8px;border:1px solid #ddd;font-size:12px}
tr:nth-child(even){background:#fafafa}
.note{background:#fff8e1;border:1px solid #d9a621;padding:8px;margin-top:20px;font-size:11px;color:#8b4513}
.signature{text-align:right;margin-top:30px;font-size:12px}
.signature .company{color:#b80d0d;font-weight:bold;margin-top:4px}
</style></head><body>

<div class="page">
  <div class="red-bar">
    <h2>邀 请 函</h2>
    <div class="subtitle">INVITATION LETTER</div>
  </div>
  <p style="font-size:12px;line-height:1.8;margin-bottom:15px">
    敬启者：谨以此函，我们诚挚地邀请如下客户来我公司洽谈采购及商务交流，届时一切费用由客户本人承担。
    我们将保证其遵守中国的法律法规，并且不会超期滞留，若贵处能酌情协助其办理签证，我公司将不胜感激！恭祝工作顺利！
  </p>
  <p style="font-size:10px;color:#666;line-height:1.6;margin-bottom:15px">
    We would like to sincerely invite the following client to visit our company for purchase bargain and business exchange.
    All expenses will be borne by the client. We guarantee that the client will abide by Chinese laws and regulations
    and will not overstay their visa. We would be extremely grateful if your company could assist them with visa processing.
  </p>
  <div class="gold-line"></div>
  <div class="field"><div class="label">国籍 / Nationality</div><div class="value" style="${fv}">${cnNat} / ${nationality}</div></div>
  <div class="field"><div class="label">姓名 / Name</div><div class="value" style="${fv}">${fullName}</div></div>
  <div class="field"><div class="label">性别 / Gender</div><div class="value" style="${fv}">${sex === 'M' ? '男 / Male' : '女 / Female'}</div></div>
  <div class="field"><div class="label">出生日期 / DOB</div><div class="value" style="${fv}">${dob}</div></div>
  <div class="field"><div class="label">护照号码 / Passport</div><div class="value" style="${fv}">${passport}</div></div>
  <div class="field"><div class="label">拜访日期 / Visit Dates</div><div class="value" style="${fv}">${fmtDate(arrival)} - ${fmtDate(departure)}</div></div>
  <div class="field"><div class="label">前往城市 / City</div><div class="value" style="${fv}">${city} / ${cityEN}</div></div>
  <div class="field"><div class="label">访目的 / Purpose</div><div class="value" style="${fv}">${purpose}</div></div>
  <div class="field"><div class="label">关系 / Relation</div><div class="value" style="${fv}">${relation}</div></div>
  <div class="field"><div class="label">费用负担 / Funding</div><div class="value" style="${fv}">${funding}</div></div>
  <div class="signature">
    <div>${dateStr}</div>
    <div class="company">${inviterCompany}</div>
  </div>
</div>

<div class="page" style="page-break-before:always">
  <div class="red-bar">
    <h2>行程安排</h2>
    <div class="subtitle">ITINERARY</div>
  </div>
  <p style="font-size:12px;margin-bottom:10px">
    受邀人: <strong>${fullName}</strong> &nbsp;&nbsp; 护照: <strong>${passport}</strong><br>
    日期: <strong>${fmtDate(arrival)} - ${fmtDate(departure)}</strong> &nbsp;&nbsp; 城市: <strong>${city} / ${cityEN}</strong>
  </p>
  <table>
    <thead><tr>
      <th>日期 / Date</th><th>行程 / Activity</th><th>住处 / Hotel</th><th>交通 / Trans.</th>
    </tr></thead>
    <tbody>${itinRows}</tbody>
  </table>
  <div class="note">备注: 仅供${fullName}${genderSuffix}申请签证使用</div>
  <div class="signature">
    <div>${dateStr}</div>
    <div class="company">${inviterCompany}</div>
  </div>
</div>

</body></html>`
}
