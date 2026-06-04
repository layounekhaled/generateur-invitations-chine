/**
 * PDF Generation Service - China Invitation Generator
 * Uses a child process to avoid fontkit crashes in Next.js production mode.
 */
import { spawn } from 'child_process'
import path from 'path'

// ============== Data helpers (shared) ==============

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
  const scriptPath = path.join(process.cwd(), 'src/lib/pdf-generator.ts')

  const inputData = JSON.stringify({
    ...data,
    _natMap: NAT_MAP,
    _cityMap: CITY_MAP,
  })

  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    // Use detached process to avoid crashing the parent
    const child = spawn('node', ['--max-old-space-size=256', '-e', `
      const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
      const fontkit = require('@pdf-lib/fontkit');
      const fs = require('fs');
      const path = require('path');

      async function main() {
        const chunks = [];
        for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
        const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        const cwd = process.cwd();
        const cnFont = await pdfDoc.embedFont(fs.readFileSync(path.join(cwd, 'public/fonts/chinese-subset.ttf')));
        const cnFontBold = await pdfDoc.embedFont(fs.readFileSync(path.join(cwd, 'public/fonts/chinese-subset-bold.ttf')));
        const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const latinFontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const NAT_MAP = data._natMap || {};
        const CITY_MAP = data._cityMap || {};
        const nationality = data.nationality || 'Algeria';
        const cnNat = NAT_MAP[nationality] || nationality;
        const fullName = data.lastName + ' ' + data.firstName;
        const city = data.cityToVisit || '广州';
        const cityEN = CITY_MAP[city] || city;
        const sex = data.sex || 'M';
        const dob = (data.dateOfBirth || '').replace(/-/g, '/');
        const purpose = data.visitPurpose || '商务洽谈';
        const funding = data.fundingSource || '客户本人';
        const relation = data.inviterRelation || '客户';
        const inviterCompany = data.inviterCompany || '佛山市乐织外贸服务有限公司';
        const genderSuffix = sex === 'M' ? '先生' : '女士';
        const now = new Date();
        const dateStr = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日';

        const DR = rgb(0.72, 0.05, 0.05);
        const GOLD = rgb(0.85, 0.65, 0.13);
        const BLK = rgb(0.1, 0.1, 0.1);
        const DK = rgb(0.15, 0.15, 0.15);
        const WH = rgb(1, 1, 1);

        function fmtDate(d) { if (!d) return ''; const dt = new Date(d+'T00:00:00'); return dt.getFullYear()+'/'+(dt.getMonth()+1)+'/'+dt.getDate(); }
        function fmtDateCN(d) { if (!d) return ''; const dt = new Date(d+'T00:00:00'); return (dt.getMonth()+1)+'月'+dt.getDate()+'日'; }

        const pw = 595.28, ph = 841.89, LM = 55, RM = 55, TW = 485;

        // Itinerary
        const arr = new Date(data.arrivalDate+'T00:00:00');
        const dep = new Date(data.departureDate+'T00:00:00');
        const total = Math.floor((dep.getTime()-arr.getTime())/(86400000))+1;
        const itin = [];
        if (total > 0) {
          itin.push({date:fmtDateCN(data.arrivalDate), act:'到达'+city+'机场。', acc:city});
          if (total>=2) { const d2=new Date(arr.getTime()+86400000); itin.push({date:fmtDateCN(d2.toISOString().slice(0,10)), act:'到达佛山市乐织外贸服务公司。', acc:'佛山'}); }
          if (total>=4) { const ms=new Date(arr.getTime()+2*86400000); const me=new Date(dep.getTime()-2*86400000); itin.push({date:fmtDateCN(ms.toISOString().slice(0,10))+'-'+fmtDateCN(me.toISOString().slice(0,10)), act:'佛山南海工厂洽谈业务和订货。', acc:'佛山'}); }
          else if (total===3) { const d3=new Date(arr.getTime()+2*86400000); itin.push({date:fmtDateCN(d3.toISOString().slice(0,10)), act:'佛山南海工厂洽谈业务和订货。', acc:'佛山'}); }
          if (total>=4) { const sl=new Date(dep.getTime()-86400000); itin.push({date:fmtDateCN(sl.toISOString().slice(0,10)), act:'拜访'+city+'物流公司。', acc:city}); }
          if (total>=2) { itin.push({date:fmtDateCN(data.departureDate), act:'从'+city+'返回'+cnNat+'。', acc:'/'}); }
        }

        // PAGE 1
        const p1 = pdfDoc.addPage([pw,ph]);
        p1.drawRectangle({x:0,y:ph-80,width:pw,height:80,color:DR,borderWidth:0});
        p1.drawRectangle({x:0,y:ph-84,width:pw,height:4,color:GOLD,borderWidth:0});
        const tw1=cnFontBold.widthOfTextAtSize('邀 请 函',28); p1.drawText('邀 请 函',{x:(pw-tw1)/2,y:ph-38,size:28,font:cnFontBold,color:WH});
        const tw2=latinFontBold.widthOfTextAtSize('INVITATION LETTER',12); p1.drawText('INVITATION LETTER',{x:(pw-tw2)/2,y:ph-58,size:12,font:latinFontBold,color:rgb(1,0.92,0.92)});
        p1.drawRectangle({x:pw-165,y:ph-195,width:115,height:115,borderColor:DR,borderWidth:1.5,color:rgb(1,0.99,0.99)});
        p1.drawRectangle({x:pw-163,y:ph-193,width:111,height:111,borderColor:DR,borderWidth:0.5,color:rgb(1,0.99,0.99)});
        p1.drawText(inviterCompany,{x:pw-155,y:ph-140,size:7.5,font:cnFont,color:DR});

        let y=ph-115;
        p1.drawText('敬启者：',{x:LM,y,size:11,font:cnFontBold,color:DK}); y-=22;
        const bodyCN=['谨以此函，我们诚挚地邀请如下客户来我公司洽谈采购及商务','交流，届时一切费用由客户本人承担。我们将保证其遵守中国','的法律法规，并且不会超期滞留，若贵处能酌情协助其办理签','证，我公司将不胜感激！恭祝工作顺利！'];
        for (const l of bodyCN) { p1.drawText(l,{x:LM+20,y,size:11,font:cnFont,color:DK}); y-=18; }
        y-=8;
        const bodyEN=['We would like to sincerely invite the following client to visit','our company for purchase bargain and business exchange. All the','expenses will be borne by the client. We guarantee that the client','will abide by Chinese laws and regulations and will not overstay','their visa. We would be extremely grateful if your company could','assist them with visa processing. Wish you the best in your work!'];
        for (const l of bodyEN) { p1.drawText(l,{x:LM+20,y,size:9,font:latinFont,color:rgb(0.35,0.35,0.35)}); y-=14; }
        y-=12; p1.drawLine({start:{x:LM,y:y+4},end:{x:pw-RM,y:y+4},thickness:2,color:DR}); y-=8;
        p1.drawRectangle({x:LM,y:y-4,width:280,height:20,color:DR,borderWidth:0});
        p1.drawText('受邀人信息',{x:LM+8,y:y+2,size:11,font:cnFontBold,color:WH});
        p1.drawText('/ Invitee Information',{x:LM+78,y:y+2,size:10,font:latinFont,color:rgb(1,0.92,0.92)}); y-=28;

        function fieldRow(labelCN,labelEN,value) {
          p1.drawRectangle({x:LM,y:y-4,width:160,height:24,color:rgb(0.97,0.94,0.94),borderWidth:0});
          p1.drawText(labelCN,{x:LM+6,y:y+4,size:10,font:cnFontBold,color:DR});
          p1.drawText(labelEN,{x:LM+6,y:y-1,size:6.5,font:latinFont,color:rgb(0.55,0.55,0.55)});
          p1.drawText(value,{x:LM+170,y:y+2,size:10.5,font:cnFont,color:BLK});
          p1.drawLine({start:{x:LM,y:y-4},end:{x:LM+485,y:y-4},thickness:0.5,color:rgb(0.85,0.85,0.85)});
          y-=32;
        }
        fieldRow('国籍','Nationality',cnNat+' / '+nationality);
        fieldRow('姓名','Name',fullName);
        fieldRow('性别','Gender',sex==='M'?'男 / Male':'女 / Female');
        fieldRow('出生日期','Date of Birth',dob);
        fieldRow('护照号码','Passport No.',data.passportNumber);
        fieldRow('拜访日期','Visit Dates',fmtDate(data.arrivalDate)+' - '+fmtDate(data.departureDate));
        fieldRow('前往城市','City to Visit',city+' / '+cityEN);
        fieldRow('访目的','Purpose',purpose);
        fieldRow('关系','Relation',relation);
        fieldRow('费用负担','Funding',funding);

        const dsW=cnFont.widthOfTextAtSize(dateStr,12);
        p1.drawText(dateStr,{x:pw-RM-dsW,y:90,size:12,font:cnFont,color:DK});
        const icW=cnFont.widthOfTextAtSize(inviterCompany,11);
        p1.drawText(inviterCompany,{x:pw-RM-icW,y:72,size:11,font:cnFont,color:DR});
        p1.drawText('仅供'+fullName+genderSuffix+'申请签证使用',{x:LM,y:22,size:8,font:cnFont,color:rgb(0.6,0.6,0.6)});
        p1.drawRectangle({x:0,y:6,width:pw,height:2,color:GOLD,borderWidth:0});
        p1.drawRectangle({x:0,y:0,width:pw,height:6,color:DR,borderWidth:0});

        // PAGE 2
        const p2 = pdfDoc.addPage([pw,ph]);
        p2.drawRectangle({x:0,y:ph-55,width:pw,height:55,color:DR,borderWidth:0});
        p2.drawRectangle({x:0,y:ph-59,width:pw,height:4,color:GOLD,borderWidth:0});
        const t2w=cnFontBold.widthOfTextAtSize('行程安排',20);
        p2.drawText('行程安排',{x:(pw-t2w)/2,y:ph-35,size:20,font:cnFontBold,color:WH});
        p2.drawText('/ Itinerary',{x:(pw-t2w)/2+42,y:ph-35,size:12,font:latinFont,color:rgb(1,0.92,0.92)});

        y=ph-90;
        p2.drawText('受邀人: '+fullName,{x:LM,y,size:11,font:cnFont,color:DK});
        p2.drawText('护照: '+data.passportNumber,{x:300,y,size:11,font:cnFont,color:DK}); y-=18;
        p2.drawText('日期: '+fmtDate(data.arrivalDate)+' - '+fmtDate(data.departureDate),{x:LM,y,size:11,font:cnFont,color:DK});
        p2.drawText('城市: '+city+' / '+cityEN,{x:300,y,size:11,font:cnFont,color:DK}); y-=30;

        const colX=[LM,LM+120,LM+340,LM+430];
        p2.drawRectangle({x:LM,y:y-28+8,width:TW,height:28,color:DR,borderWidth:0});
        p2.drawText('日期',{x:colX[0]+6,y:y-4,size:10,font:cnFontBold,color:WH});
        p2.drawText('/ Date',{x:colX[0]+30,y:y-4,size:8,font:latinFont,color:rgb(1,0.92,0.92)});
        p2.drawText('行程',{x:colX[1]+6,y:y-4,size:10,font:cnFontBold,color:WH});
        p2.drawText('/ Activity',{x:colX[1]+30,y:y-4,size:8,font:latinFont,color:rgb(1,0.92,0.92)});
        p2.drawText('住处',{x:colX[2]+6,y:y-4,size:10,font:cnFontBold,color:WH});
        p2.drawText('/ Hotel',{x:colX[2]+30,y:y-4,size:8,font:latinFont,color:rgb(1,0.92,0.92)});
        p2.drawText('交通',{x:colX[3]+6,y:y-4,size:10,font:cnFontBold,color:WH});
        p2.drawText('/ Trans.',{x:colX[3]+30,y:y-4,size:8,font:latinFont,color:rgb(1,0.92,0.92)}); y-=28;

        for (let idx=0; idx<itin.length; idx++) {
          const day=itin[idx];
          p2.drawRectangle({x:LM,y:y-26+8,width:TW,height:26,color:idx%2===0?WH:rgb(0.99,0.98,0.98),borderWidth:0});
          p2.drawLine({start:{x:LM,y:y-26+8},end:{x:LM+TW,y:y-26+8},thickness:0.3,color:rgb(0.9,0.9,0.9)});
          p2.drawText(day.date,{x:colX[0]+6,y:y-4,size:9.5,font:cnFont,color:BLK});
          p2.drawText(day.act,{x:colX[1]+6,y:y-4,size:9.5,font:cnFont,color:BLK});
          p2.drawText(day.acc,{x:colX[2]+6,y:y-4,size:9.5,font:cnFont,color:BLK});
          p2.drawText('包车',{x:colX[3]+6,y:y-4,size:9.5,font:cnFont,color:BLK}); y-=26;
        }
        p2.drawLine({start:{x:LM,y:y+8},end:{x:LM+TW,y:y+8},thickness:1.5,color:DR});

        const fY=100;
        p2.drawRectangle({x:LM,y:fY-5,width:TW,height:22,color:rgb(1,0.98,0.95),borderWidth:0});
        p2.drawLine({start:{x:LM,y:fY+17},end:{x:LM+TW,y:fY+17},thickness:1,color:GOLD});
        p2.drawLine({start:{x:LM,y:fY-5},end:{x:LM+TW,y:fY-5},thickness:1,color:GOLD});
        p2.drawText('备注: 仅供'+fullName+genderSuffix+'申请签证使用',{x:LM+10,y:fY+2,size:9,font:cnFont,color:DR});
        const ds2W=cnFont.widthOfTextAtSize(dateStr,12);
        p2.drawText(dateStr,{x:pw-RM-ds2W,y:55,size:12,font:cnFont,color:DK});
        const ic2W=cnFont.widthOfTextAtSize(inviterCompany,11);
        p2.drawText(inviterCompany,{x:pw-RM-ic2W,y:37,size:11,font:cnFont,color:DR});
        p2.drawRectangle({x:0,y:6,width:pw,height:2,color:GOLD,borderWidth:0});
        p2.drawRectangle({x:0,y:0,width:pw,height:6,color:DR,borderWidth:0});

        // PAGE 3
        const p3 = pdfDoc.addPage([pw,ph]);
        p3.drawRectangle({x:0,y:ph-55,width:pw,height:55,color:DR,borderWidth:0});
        p3.drawRectangle({x:0,y:ph-59,width:pw,height:4,color:GOLD,borderWidth:0});
        const t3w=cnFontBold.widthOfTextAtSize('备注',20);
        p3.drawText('备注',{x:(pw-t3w)/2,y:ph-30,size:20,font:cnFontBold,color:WH});
        p3.drawText('/ Notes',{x:(pw-t3w)/2+30,y:ph-30,size:12,font:latinFont,color:rgb(1,0.92,0.92)});
        y=ph-100;
        for (let i=0;i<25;i++) { p3.drawLine({start:{x:LM,y},end:{x:pw-RM,y},thickness:0.5,color:rgb(0.9,0.9,0.9)}); y-=28; }
        p3.drawRectangle({x:0,y:6,width:pw,height:2,color:GOLD,borderWidth:0});
        p3.drawRectangle({x:0,y:0,width:pw,height:6,color:DR,borderWidth:0});

        const pdfBytes = await pdfDoc.save();
        process.stdout.write(pdfBytes);
        process.exit(0);
      }
      main().catch(e => { process.stderr.write(e.message+'\\n'); process.exit(1); });
    `], {
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
