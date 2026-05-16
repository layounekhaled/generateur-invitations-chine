import { createServer } from 'http';
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PORT = 3001;

interface InvitationData {
  template: string;
  lastName: string;
  firstName: string;
  sex: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  arrivalDate: string;
  departureDate: string;
  visitPurpose: string;
  cityToVisit: string;
  inviterRelation: string;
  fundingSource: string;
  notes: string;
}

function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateChinese(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateChineseRange(arrivalStr: string, departureStr: string): string {
  const a = new Date(arrivalStr);
  const d = new Date(departureStr);
  return `${a.getMonth() + 1}月${a.getDate()}日-${d.getMonth() + 1}月${d.getDate()}日`;
}

function generateItinerary(arrivalDate: string, departureDate: string, city: string, nationality: string): Array<{ date: string; activity: string; accommodation: string }> {
  const arrival = new Date(arrivalDate);
  const departure = new Date(departureDate);
  const days: Array<{ date: string; activity: string; accommodation: string }> = [];

  const totalDays = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < totalDays; i++) {
    const currentDate = new Date(arrival);
    currentDate.setDate(currentDate.getDate() + i);
    const dateStr = `${currentDate.getMonth() + 1}月${currentDate.getDate()}日`;

    if (i === 0) {
      days.push({ date: dateStr, activity: `到达${city}机场。`, accommodation: city });
    } else if (i === 1) {
      days.push({ date: dateStr, activity: `到达佛山市乐织外贸服务公司。`, accommodation: '佛山' });
    } else if (i < totalDays - 2) {
      days.push({
        date: i === 2 ? `${dateStr}-${formatDateChinese(departureDate).replace(/日.*/, '日')}`.replace(dateStr, dateStr) : '',
        activity: '佛山南海工厂洽谈业务和订货。',
        accommodation: '佛山'
      });
    } else if (i === totalDays - 2) {
      days.push({ date: dateStr, activity: `拜访${city}物流公司。`, accommodation: city });
    } else {
      days.push({ date: dateStr, activity: `从${city}返回${nationality}。`, accommodation: '/' });
    }
  }

  // Merge middle days if there are 3+ middle days
  if (totalDays > 4) {
    const middleStart = 2;
    const middleEnd = totalDays - 3;
    const middleStartDate = new Date(arrival);
    middleStartDate.setDate(middleStartDate.getDate() + middleStart);
    const middleEndDate = new Date(arrival);
    middleEndDate.setDate(middleEndDate.getDate() + middleEnd);

    const mergedDays = [
      days[0],
      days[1],
      {
        date: `${formatDateChinese(middleStartDate.toISOString().split('T')[0])}-${formatDateChinese(middleEndDate.toISOString().split('T')[0])}`,
        activity: '佛山南海工厂洽谈业务和订货。',
        accommodation: '佛山'
      }
    ];

    if (totalDays > 3) {
      mergedDays.push(days[totalDays - 2]);
    }
    if (totalDays > 2) {
      mergedDays.push(days[totalDays - 1]);
    }

    return mergedDays;
  }

  return days;
}

function generateHouacineHTML(data: InvitationData): string {
  const fullName = `${data.lastName} ${data.firstName}`;
  const itinerary = generateItinerary(data.arrivalDate, data.departureDate, data.cityToVisit || '广州', data.nationality);

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  const nationalityMap: Record<string, string> = {
    'Algeria': '阿尔及利亚',
    'Algeria/Algeria': '阿尔及利亚/Algeria',
    'France': '法国',
    'Morocco': '摩洛哥',
    'Tunisia': '突尼斯',
  };

  const cnNationality = nationalityMap[data.nationality] || data.nationality;

  const itineraryRows = itinerary.map(item => `
    <tr>
      <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 13px; white-space: nowrap;">${item.date}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 13px;">${item.activity}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 13px; text-align: center;">${item.accommodation}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; font-family: "Noto Sans SC", "SimSun", "Microsoft YaHei", sans-serif; }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 0;
    position: relative;
    background: white;
  }
  .page-1 {
    padding: 30mm 25mm 20mm 25mm;
  }
  .page-2 {
    padding: 25mm 20mm 20mm 20mm;
  }
  .page-3 {
    padding: 0;
  }
  .title-en {
    text-align: center;
    font-size: 24pt;
    font-weight: bold;
    color: #1a1a1a;
    margin-bottom: 4px;
    letter-spacing: 4px;
  }
  .title-cn {
    text-align: center;
    font-size: 22pt;
    font-weight: bold;
    color: #1a1a1a;
    margin-bottom: 20px;
  }
  .body-text {
    font-size: 12pt;
    line-height: 1.8;
    color: #333;
    text-indent: 2em;
    margin-bottom: 2px;
  }
  .body-text-no-indent {
    font-size: 12pt;
    line-height: 1.8;
    color: #333;
    margin-bottom: 2px;
  }
  .closing {
    font-size: 12pt;
    line-height: 1.8;
    color: #333;
    margin-top: 10px;
  }
  .info-row {
    font-size: 12pt;
    line-height: 2;
    color: #333;
    padding-left: 2em;
  }
  .english-text {
    font-size: 11pt;
    line-height: 1.8;
    color: #333;
    margin-top: 16px;
  }
  .signature-block {
    text-align: right;
    margin-top: 40px;
  }
  .signature-date {
    font-size: 12pt;
    color: #333;
  }
  .signature-company {
    font-size: 13pt;
    font-weight: bold;
    color: #1a1a1a;
    margin-top: 6px;
  }
  .itinerary-title {
    text-align: center;
    font-size: 18pt;
    font-weight: bold;
    color: #1a1a1a;
    margin-bottom: 20px;
  }
  .itinerary-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }
  .itinerary-table th {
    background-color: #f0f0f0;
    padding: 10px;
    border: 1px solid #ccc;
    font-size: 14px;
    font-weight: bold;
    text-align: center;
  }
  .itinerary-table td {
    border: 1px solid #ddd;
  }
  .bottom-bar {
    position: absolute;
    bottom: 20mm;
    left: 15mm;
    right: 15mm;
    height: 8mm;
    background: linear-gradient(90deg, #c41e3a, #de2910, #c41e3a);
    border-radius: 2px;
  }
  .red-line {
    width: 100%;
    height: 3px;
    background: #c41e3a;
    margin: 8px 0;
  }
</style>
</head>
<body>
  <!-- Page 1: Invitation Letter -->
  <div class="page page-1">
    <div class="title-en">INVITATION</div>
    <div class="title-cn">邀请函</div>
    <div class="red-line"></div>

    <div class="body-text-no-indent" style="margin-top: 16px;">敬启者：</div>

    <div class="body-text">谨以此函，我们诚挚的邀请函如下客户来我公司洽谈采购及商务交流，届时一切费用由客户本人承担。</div>
    <div class="body-text">我们将保证其遵守中国的法律法规，并且不会超期滞留，若贵处能酌情协助其办理签证，我公司将不胜感激！</div>
    <div class="closing">恭祝工作顺利！</div>

    <div style="margin-top: 16px;">
      <div class="info-row">国籍／Nationality：${cnNationality}／${data.nationality}</div>
      <div class="info-row">姓名／Name: ${fullName}</div>
      <div class="info-row">护照号码／Passport NO.:${data.passportNumber}</div>
      <div class="info-row">拜访日期／time:${formatDateForDisplay(data.arrivalDate)}-${formatDateForDisplay(data.departureDate)}</div>
    </div>

    <div class="english-text">
      We would like to sincerely invite the following client to visit our company for purchase bargain and business exchange. At that time, all the expenses will be borne by the client.
    </div>
    <div class="english-text">
      We guarantee that the client will abide by Chinese laws and regulations and will not overstay their visa. We would be extremely grateful if your company could assist the client with visa processing. Wish you the best in your work!
    </div>

    <div class="signature-block">
      <div class="signature-date">${dateStr}</div>
      <div class="signature-company">佛山市乐织外贸服务有限公司</div>
    </div>

    <div class="bottom-bar"></div>
  </div>

  <!-- Page 2: Itinerary -->
  <div class="page page-2" style="page-break-before: always;">
    <div class="itinerary-title">行程安排</div>
    <div class="red-line" style="margin-bottom: 16px;"></div>

    <table class="itinerary-table">
      <thead>
        <tr>
          <th style="width: 25%;">日期</th>
          <th style="width: 55%;">行程</th>
          <th style="width: 20%;">住处</th>
        </tr>
      </thead>
      <tbody>
        ${itineraryRows}
      </tbody>
    </table>

    <div class="signature-block" style="margin-top: 60px;">
      <div class="signature-date">${dateStr}</div>
      <div class="signature-company">佛山市乐织外贸服务有限公司</div>
    </div>

    <div class="bottom-bar"></div>
  </div>

  <!-- Page 3: Blank/stamp page -->
  <div class="page page-3" style="page-break-before: always;">
    <div class="bottom-bar"></div>
  </div>
</body>
</html>`;
}

function generateAkkakHTML(data: InvitationData): string {
  const fullName = `${data.lastName} ${data.firstName}`;
  const dobFormatted = data.dateOfBirth.replace(/-/g, '/');
  const itinerary = generateItinerary(data.arrivalDate, data.departureDate, data.cityToVisit || '广州', data.nationality);
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  const nationalityMap: Record<string, string> = {
    'Algeria': '阿尔及利亚',
    'France': '法国',
    'Morocco': '摩洛哥',
    'Tunisia': '突尼斯',
  };
  const cnNationality = nationalityMap[data.nationality] || data.nationality;

  const itineraryRows = itinerary.map(item => `
    <tr>
      <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 13px; white-space: nowrap;">${item.date}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 13px;">${item.activity}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 13px; text-align: center;">${item.accommodation}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; font-family: "Noto Sans SC", "SimSun", "Microsoft YaHei", sans-serif; }
  .page {
    width: 210mm;
    min-height: 297mm;
    position: relative;
    background: white;
  }
  .page-1 {
    padding: 30mm 25mm 20mm 25mm;
  }
  .page-2 {
    padding: 25mm 20mm 20mm 20mm;
  }
  .page-3 {
    padding: 0;
  }
  .header-bar {
    width: 100%;
    height: 12mm;
    background: linear-gradient(135deg, #1a5276, #2980b9, #1a5276);
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .header-bar h1 {
    color: white;
    font-size: 20pt;
    letter-spacing: 6px;
  }
  .title-en {
    text-align: center;
    font-size: 24pt;
    font-weight: bold;
    color: #1a5276;
    margin-bottom: 4px;
    letter-spacing: 4px;
  }
  .title-cn {
    text-align: center;
    font-size: 22pt;
    font-weight: bold;
    color: #1a5276;
    margin-bottom: 20px;
  }
  .body-text {
    font-size: 12pt;
    line-height: 1.8;
    color: #333;
    text-indent: 2em;
    margin-bottom: 2px;
  }
  .body-text-no-indent {
    font-size: 12pt;
    line-height: 1.8;
    color: #333;
    margin-bottom: 2px;
  }
  .closing {
    font-size: 12pt;
    line-height: 1.8;
    color: #333;
    margin-top: 10px;
  }
  .info-row {
    font-size: 12pt;
    line-height: 2;
    color: #333;
    padding-left: 2em;
  }
  .english-text {
    font-size: 11pt;
    line-height: 1.8;
    color: #333;
    margin-top: 16px;
  }
  .signature-block {
    text-align: right;
    margin-top: 40px;
  }
  .signature-date {
    font-size: 12pt;
    color: #333;
  }
  .signature-company {
    font-size: 13pt;
    font-weight: bold;
    color: #1a5276;
    margin-top: 6px;
  }
  .itinerary-title {
    text-align: center;
    font-size: 18pt;
    font-weight: bold;
    color: #1a5276;
    margin-bottom: 20px;
  }
  .itinerary-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }
  .itinerary-table th {
    background-color: #2980b9;
    color: white;
    padding: 10px;
    border: 1px solid #2471a3;
    font-size: 14px;
    font-weight: bold;
    text-align: center;
  }
  .itinerary-table td {
    border: 1px solid #ddd;
  }
  .blue-line {
    width: 100%;
    height: 3px;
    background: #1a5276;
    margin: 8px 0;
  }
  .bottom-bar {
    position: absolute;
    bottom: 20mm;
    left: 15mm;
    right: 15mm;
    height: 8mm;
    background: linear-gradient(90deg, #1a5276, #2980b9, #1a5276);
    border-radius: 2px;
  }
  .info-box {
    border: 2px solid #2980b9;
    border-radius: 8px;
    padding: 16px 20px;
    margin: 16px 0;
    background: #f8f9fa;
  }
  .info-box .info-row {
    padding-left: 0;
    font-size: 12pt;
    line-height: 2.2;
  }
</style>
</head>
<body>
  <!-- Page 1: Invitation Letter -->
  <div class="page page-1">
    <div class="header-bar">
      <h1>INVITATION 邀请函</h1>
    </div>

    <div class="body-text-no-indent" style="margin-top: 16px;">敬启者：</div>

    <div class="body-text">谨以此函，我们诚挚的邀请函如下客户来我公司洽谈采购及商务交流，届时一切费用由客户本人承担。</div>
    <div class="body-text">我们将保证其遵守中国的法律法规，并且不会超期滞留，若贵处能酌情协助其办理签证，我公司将不胜感激！</div>
    <div class="closing">恭祝工作顺利！</div>

    <div class="info-box">
      <div class="info-row">国籍／Nationality：${cnNationality}／${data.nationality}</div>
      <div class="info-row">姓名／Name: ${fullName}</div>
      <div class="info-row">性别／Gender: ${data.sex === 'M' ? '男/Male' : '女/Female'}</div>
      <div class="info-row">出生日期／Date of Birth: ${dobFormatted}</div>
      <div class="info-row">护照号码／Passport NO.: ${data.passportNumber}</div>
      <div class="info-row">拜访日期／time: ${formatDateForDisplay(data.arrivalDate)}-${formatDateForDisplay(data.departureDate)}</div>
      <div class="info-row">访问目的／Purpose: ${data.visitPurpose || '商务洽谈'}</div>
      <div class="info-row">资金来源／Funding: ${data.fundingSource || '客户本人'}</div>
    </div>

    <div class="english-text">
      We would like to sincerely invite the following client to visit our company for purchase bargain and business exchange. At that time, all the expenses will be borne by the client.
    </div>
    <div class="english-text">
      We guarantee that the client will abide by Chinese laws and regulations and will not overstay their visa. We would be extremely grateful if your company could assist the client with visa processing. Wish you the best in your work!
    </div>

    <div class="signature-block">
      <div class="signature-date">${dateStr}</div>
      <div class="signature-company">佛山市乐织外贸服务有限公司</div>
    </div>

    <div class="bottom-bar"></div>
  </div>

  <!-- Page 2: Itinerary -->
  <div class="page page-2" style="page-break-before: always;">
    <div class="itinerary-title">行程安排</div>
    <div class="blue-line" style="margin-bottom: 16px;"></div>

    <table class="itinerary-table">
      <thead>
        <tr>
          <th style="width: 25%;">日期</th>
          <th style="width: 55%;">行程</th>
          <th style="width: 20%;">住处</th>
        </tr>
      </thead>
      <tbody>
        ${itineraryRows}
      </tbody>
    </table>

    <div class="signature-block" style="margin-top: 60px;">
      <div class="signature-date">${dateStr}</div>
      <div class="signature-company">佛山市乐织外贸服务有限公司</div>
    </div>

    <div class="bottom-bar"></div>
  </div>

  <!-- Page 3: Blank/stamp page -->
  <div class="page page-3" style="page-break-before: always;">
    <div class="bottom-bar"></div>
  </div>
</body>
</html>`;
}

async function generatePDF(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setContent(html, { waitUntil: 'networkidle' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
}

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data: InvitationData = JSON.parse(body);

        let html: string;
        if (data.template === 'akkak') {
          html = generateAkkakHTML(data);
        } else {
          html = generateHouacineHTML(data);
        }

        const pdfBuffer = await generatePDF(html);

        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="invitation_${data.lastName}_${data.firstName}.pdf"`,
          'Content-Length': pdfBuffer.length,
        });
        res.end(pdfBuffer);
      } catch (error: any) {
        console.error('PDF generation error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/generate-html') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data: InvitationData = JSON.parse(body);

        let html: string;
        if (data.template === 'akkak') {
          html = generateAkkakHTML(data);
        } else {
          html = generateHouacineHTML(data);
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch (error: any) {
        console.error('HTML generation error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`PDF service running on port ${PORT}`);
});
