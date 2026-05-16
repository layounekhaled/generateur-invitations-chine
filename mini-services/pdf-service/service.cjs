const { chromium } = require('playwright');
const http = require('http');
const PORT = 3001;

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });
  }
  return browserInstance;
}

function formatDateForDisplay(d) { if(!d)return''; const dt=new Date(d); return dt.getFullYear()+'/'+(dt.getMonth()+1)+'/'+dt.getDate(); }
function formatDateChinese(d) { if(!d)return''; const dt=new Date(d); return (dt.getMonth()+1)+'月'+dt.getDate()+'日'; }

function generateItinerary(arrivalDate, departureDate, city, nationality) {
  const a = new Date(arrivalDate), dep = new Date(departureDate);
  const total = Math.ceil((dep-a)/(864e5))+1;
  if(total<=0) return [];
  const days = [];
  days.push({date:formatDateChinese(arrivalDate), activity:'到达'+city+'机场。', accommodation:city});
  if(total>=2){ const d2=new Date(a); d2.setDate(d2.getDate()+1); days.push({date:formatDateChinese(d2.toISOString().split('T')[0]), activity:'到达佛山市乐织外贸服务公司。', accommodation:'佛山'}); }
  if(total>=4){ const ms=new Date(a); ms.setDate(ms.getDate()+2); const me=new Date(dep); me.setDate(me.getDate()-2); days.push({date:formatDateChinese(ms.toISOString().split('T')[0])+'-'+formatDateChinese(me.toISOString().split('T')[0]), activity:'佛山南海工厂洽谈业务和订货。', accommodation:'佛山'}); }
  else if(total===3){ const d3=new Date(a); d3.setDate(d3.getDate()+2); days.push({date:formatDateChinese(d3.toISOString().split('T')[0]), activity:'佛山南海工厂洽谈业务和订货。', accommodation:'佛山'}); }
  if(total>=4){ const sl=new Date(dep); sl.setDate(sl.getDate()-1); days.push({date:formatDateChinese(sl.toISOString().split('T')[0]), activity:'拜访'+city+'物流公司。', accommodation:city}); }
  if(total>=2){ days.push({date:formatDateChinese(departureDate), activity:'从'+city+'返回'+nationality+'。', accommodation:'/'}); }
  return days;
}

const natMap = {Algeria:'阿尔及利亚',France:'法国',Morocco:'摩洛哥',Tunisia:'突尼斯',Egypt:'埃及'};

function genHTML(data) {
  const name = data.lastName+' '+data.firstName;
  const itin = generateItinerary(data.arrivalDate, data.departureDate, data.cityToVisit||'广州', data.nationality);
  const today = new Date();
  const ds = today.getFullYear()+'年'+(today.getMonth()+1)+'月'+today.getDate()+'日';
  const cn = natMap[data.nationality]||data.nationality;
  const isAkkak = data.template==='akkak';
  const rows = itin.map(i=>'<tr><td style="padding:8px 10px;border-bottom:1px solid #ddd;font-size:13px;white-space:nowrap">'+i.date+'</td><td style="padding:8px 10px;border-bottom:1px solid #ddd;font-size:13px">'+i.activity+'</td><td style="padding:8px 10px;border-bottom:1px solid #ddd;font-size:13px;text-align:center">'+i.accommodation+'</td></tr>').join('');
  const primaryColor = isAkkak ? '#1a5276' : '#c41e3a';
  const accentColor = isAkkak ? '#2980b9' : '#de2910';
  const thBg = isAkkak ? '#2980b9' : '#f0f0f0';
  const thColor = isAkkak ? 'white' : '#1a1a1a';
  const borderTh = isAkkak ? '#2471a3' : '#ccc';

  let infoRows;
  if(isAkkak) {
    const dob = data.dateOfBirth.replace(/-/g,'/');
    infoRows = '<div style="border:2px solid #2980b9;border-radius:8px;padding:16px 20px;margin:16px 0;background:#f8f9fa">'
      +'<div style="font-size:12pt;line-height:2.2">国籍／Nationality：'+cn+'／'+data.nationality+'</div>'
      +'<div style="font-size:12pt;line-height:2.2">姓名／Name: '+name+'</div>'
      +'<div style="font-size:12pt;line-height:2.2">性别／Gender: '+(data.sex==='M'?'男/Male':'女/Female')+'</div>'
      +'<div style="font-size:12pt;line-height:2.2">出生日期／Date of Birth: '+dob+'</div>'
      +'<div style="font-size:12pt;line-height:2.2">护照号码／Passport NO.: '+data.passportNumber+'</div>'
      +'<div style="font-size:12pt;line-height:2.2">拜访日期／time: '+formatDateForDisplay(data.arrivalDate)+'-'+formatDateForDisplay(data.departureDate)+'</div>'
      +'<div style="font-size:12pt;line-height:2.2">访问目的／Purpose: '+(data.visitPurpose||'商务洽谈')+'</div>'
      +'<div style="font-size:12pt;line-height:2.2">资金来源／Funding: '+(data.fundingSource||'客户本人')+'</div>'
      +'</div>';
  } else {
    infoRows = '<div style="margin-top:16px">'
      +'<div style="font-size:12pt;line-height:2;color:#333;padding-left:2em">国籍／Nationality：'+cn+'／'+data.nationality+'</div>'
      +'<div style="font-size:12pt;line-height:2;color:#333;padding-left:2em">姓名／Name: '+name+'</div>'
      +'<div style="font-size:12pt;line-height:2;color:#333;padding-left:2em">护照号码／Passport NO.:'+data.passportNumber+'</div>'
      +'<div style="font-size:12pt;line-height:2;color:#333;padding-left:2em">拜访日期／time:'+formatDateForDisplay(data.arrivalDate)+'-'+formatDateForDisplay(data.departureDate)+'</div>'
      +'</div>';
  }

  const header = isAkkak
    ? '<div style="width:100%;height:12mm;background:linear-gradient(135deg,#1a5276,#2980b9,#1a5276);margin-bottom:20px;display:flex;align-items:center;justify-content:center"><h1 style="color:white;font-size:20pt;letter-spacing:6px;margin:0">INVITATION 邀请函</h1></div>'
    : '<div style="text-align:center;font-size:24pt;font-weight:bold;color:#1a1a1a;margin-bottom:4px;letter-spacing:4px">INVITATION</div><div style="text-align:center;font-size:22pt;font-weight:bold;color:#1a1a1a;margin-bottom:20px">邀请函</div><div style="width:100%;height:3px;background:'+primaryColor+';margin:8px 0"></div>';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
    +'@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}html,body{width:210mm;margin:0;padding:0;font-family:"Noto Sans SC","SimSun","Microsoft YaHei",sans-serif}'
    +'.page{width:210mm;min-height:297mm;position:relative;background:white}'
    +'</style></head><body>'
    +'<div class="page" style="padding:30mm 25mm 20mm 25mm">'
    +header
    +'<div style="font-size:12pt;line-height:1.8;color:#333;margin-top:16px">敬启者：</div>'
    +'<div style="font-size:12pt;line-height:1.8;color:#333;text-indent:2em;margin-bottom:2px">谨以此函，我们诚挚的邀请函如下客户来我公司洽谈采购及商务交流，届时一切费用由客户本人承担。</div>'
    +'<div style="font-size:12pt;line-height:1.8;color:#333;text-indent:2em;margin-bottom:2px">我们将保证其遵守中国的法律法规，并且不会超期滞留，若贵处能酌情协助其办理签证，我公司将不胜感激！</div>'
    +'<div style="font-size:12pt;line-height:1.8;color:#333;margin-top:10px">恭祝工作顺利！</div>'
    +infoRows
    +'<div style="font-size:11pt;line-height:1.8;color:#333;margin-top:16px">We would like to sincerely invite the following client to visit our company for purchase bargain and business exchange. At that time, all the expenses will be borne by the client.</div>'
    +'<div style="font-size:11pt;line-height:1.8;color:#333;margin-top:4px">We guarantee that the client will abide by Chinese laws and regulations and will not overstay their visa. We would be extremely grateful if your company could assist the client with visa processing. Wish you the best in your work!</div>'
    +'<div style="text-align:right;margin-top:40px"><div style="font-size:12pt;color:#333">'+ds+'</div><div style="font-size:13pt;font-weight:bold;color:'+primaryColor+';margin-top:6px">佛山市乐织外贸服务有限公司</div></div>'
    +'<div style="position:absolute;bottom:20mm;left:15mm;right:15mm;height:8mm;background:linear-gradient(90deg,'+primaryColor+','+accentColor+','+primaryColor+');border-radius:2px"></div>'
    +'</div>'
    +'<div class="page" style="padding:25mm 20mm 20mm 20mm;page-break-before:always">'
    +'<div style="text-align:center;font-size:18pt;font-weight:bold;color:'+primaryColor+';margin-bottom:20px">行程安排</div>'
    +'<div style="width:100%;height:3px;background:'+primaryColor+';margin-bottom:16px"></div>'
    +'<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr>'
    +'<th style="background-color:'+thBg+';color:'+thColor+';padding:10px;border:1px solid '+borderTh+';font-size:14px;font-weight:bold;text-align:center;width:25%">日期</th>'
    +'<th style="background-color:'+thBg+';color:'+thColor+';padding:10px;border:1px solid '+borderTh+';font-size:14px;font-weight:bold;text-align:center;width:55%">行程</th>'
    +'<th style="background-color:'+thBg+';color:'+thColor+';padding:10px;border:1px solid '+borderTh+';font-size:14px;font-weight:bold;text-align:center;width:20%">住处</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div style="text-align:right;margin-top:60px"><div style="font-size:12pt;color:#333">'+ds+'</div><div style="font-size:13pt;font-weight:bold;color:'+primaryColor+';margin-top:6px">佛山市乐织外贸服务有限公司</div></div>'
    +'<div style="position:absolute;bottom:20mm;left:15mm;right:15mm;height:8mm;background:linear-gradient(90deg,'+primaryColor+','+accentColor+','+primaryColor+');border-radius:2px"></div>'
    +'</div>'
    +'<div class="page" style="page-break-before:always">'
    +'<div style="position:absolute;bottom:20mm;left:15mm;right:15mm;height:8mm;background:linear-gradient(90deg,'+primaryColor+','+accentColor+','+primaryColor+');border-radius:2px"></div>'
    +'</div>'
    +'</body></html>';
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200,{'Content-Type':'application/json'}); res.end('{"status":"ok"}'); return; }

  let body = '';
  req.on('data', c => { body += c; });

  if (req.method === 'POST' && (req.url === '/generate' || req.url === '/generate-html')) {
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const html = genHTML(data);
        if (req.url === '/generate-html') {
          res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
          res.end(html);
          return;
        }
        const browser = await getBrowser();
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.setContent(html, {waitUntil:'networkidle'});
        const pdfBuffer = await page.pdf({format:'A4', printBackground:true, margin:{top:'0',right:'0',bottom:'0',left:'0'}});
        await context.close();
        res.writeHead(200, {'Content-Type':'application/pdf', 'Content-Length':pdfBuffer.length});
        res.end(pdfBuffer);
      } catch(e) {
        console.error('Error:', e.message);
        // Reset browser on error
        try { if(browserInstance) await browserInstance.close(); } catch(x){}
        browserInstance = null;
        if(!res.headersSent){ res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:e.message})); }
      }
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log('PDF service running on port ' + PORT));

process.on('SIGTERM', async () => {
  if(browserInstance) await browserInstance.close();
  process.exit(0);
});
