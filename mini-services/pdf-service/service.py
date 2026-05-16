#!/usr/bin/env python3
"""PDF Generation Service for China Invitation Generator"""
import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle

# Register fonts
pdfmetrics.registerFont(TTFont('SansSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SansSCBold', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SerifSC', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))

NAT_MAP = {
    'Algeria': '阿尔及利亚', 'France': '法国', 'Morocco': '摩洛哥',
    'Tunisia': '突尼斯', 'Egypt': '埃及', 'Libya': '利比亚',
    'Mauritania': '毛里塔尼亚', 'Iraq': '伊拉克', 'Iran': '伊朗',
    'Turkey': '土耳其', 'Pakistan': '巴基斯坦', 'India': '印度',
    'Russia': '俄罗斯', 'Ukraine': '乌克兰', 'Nigeria': '尼日利亚',
    'Ghana': '加纳', 'Cameroon': '喀麦隆', 'Ethiopia': '埃塞俄比亚',
    'Kenya': '肯尼亚', 'South Africa': '南非', 'Indonesia': '印度尼西亚',
    'Malaysia': '马来西亚', 'Thailand': '泰国', 'Vietnam': '越南',
    'Philippines': '菲律宾', 'Bangladesh': '孟加拉国',
}


def fmt_date(d):
    if not d: return ''
    dt = datetime.strptime(d, '%Y-%m-%d')
    return f'{dt.year}/{dt.month}/{dt.day}'


def fmt_date_cn(d):
    if not d: return ''
    dt = datetime.strptime(d, '%Y-%m-%d')
    return f'{dt.month}月{dt.day}日'


def gen_itinerary(arrival, departure, city, nationality):
    a = datetime.strptime(arrival, '%Y-%m-%d')
    dep = datetime.strptime(departure, '%Y-%m-%d')
    total = (dep - a).days + 1
    if total <= 0:
        return []

    days = []
    days.append({'date': fmt_date_cn(arrival), 'act': f'到达{city}机场。', 'acc': city})

    if total >= 2:
        d2 = datetime.fromtimestamp(a.timestamp() + 86400)
        days.append({'date': fmt_date_cn(d2.strftime('%Y-%m-%d')), 'act': '到达佛山市乐织外贸服务公司。', 'acc': '佛山'})

    if total >= 4:
        ms = datetime.fromtimestamp(a.timestamp() + 86400 * 2)
        me = datetime.fromtimestamp(dep.timestamp() - 86400 * 2)
        days.append({'date': f'{fmt_date_cn(ms.strftime("%Y-%m-%d"))}-{fmt_date_cn(me.strftime("%Y-%m-%d"))}', 'act': '佛山南海工厂洽谈业务和订货。', 'acc': '佛山'})
    elif total == 3:
        d3 = datetime.fromtimestamp(a.timestamp() + 86400 * 2)
        days.append({'date': fmt_date_cn(d3.strftime('%Y-%m-%d')), 'act': '佛山南海工厂洽谈业务和订货。', 'acc': '佛山'})

    if total >= 4:
        sl = datetime.fromtimestamp(dep.timestamp() - 86400)
        days.append({'date': fmt_date_cn(sl.strftime('%Y-%m-%d')), 'act': f'拜访{city}物流公司。', 'acc': city})

    if total >= 2:
        days.append({'date': fmt_date_cn(departure), 'act': f'从{city}返回{nationality}。', 'acc': '/'})

    return days


def gen_pdf(data):
    template = data.get('template', 'houacine')
    is_akkak = template == 'akkak'

    name = f'{data.get("lastName", "")} {data.get("firstName", "")}'
    nationality = data.get('nationality', 'Algeria')
    cn_nat = NAT_MAP.get(nationality, nationality)
    passport = data.get('passportNumber', '')
    arrival = data.get('arrivalDate', '')
    departure = data.get('departureDate', '')
    city = data.get('cityToVisit', '广州')
    sex = data.get('sex', 'M')
    dob = data.get('dateOfBirth', '').replace('-', '/')
    purpose = data.get('visitPurpose', '商务洽谈')
    funding = data.get('fundingSource', '客户本人')
    itin = gen_itinerary(arrival, departure, city, nationality)

    today = datetime.now()
    date_str = f'{today.year}年{today.month}月{today.day}日'

    primary = HexColor('#1a5276') if is_akkak else HexColor('#c41e3a')
    accent = HexColor('#2980b9') if is_akkak else HexColor('#de2910')

    # Use StringIO to write PDF to memory
    from io import BytesIO
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    # ---- PAGE 1: Invitation Letter ----
    if is_akkak:
        # Header bar
        c.setFillColor(primary)
        c.rect(0, h - 42*mm, w, 12*mm, fill=1, stroke=0)
        c.setFillColor(HexColor('#ffffff'))
        c.setFont('SansSCBold', 16)
        c.drawCentredString(w/2, h - 38*mm, 'INVITATION  邀请函')
    else:
        # Title
        c.setFillColor(HexColor('#1a1a1a'))
        c.setFont('SansSCBold', 24)
        c.drawCentredString(w/2, h - 35*mm, 'INVITATION')
        c.setFont('SansSCBold', 22)
        c.drawCentredString(w/2, h - 45*mm, '邀请函')
        # Red line
        c.setStrokeColor(primary)
        c.setLineWidth(3)
        c.line(25*mm, h - 50*mm, w - 25*mm, h - 50*mm)

    # Body text
    body_y = h - 60*mm if is_akkak else h - 58*mm
    c.setFillColor(HexColor('#333333'))
    c.setFont('SansSC', 12)

    c.drawString(25*mm, body_y, '敬启者：')
    body_y -= 8*mm

    texts = [
        '谨以此函，我们诚挚的邀请函如下客户来我公司洽谈采购及商务交流，届时一切费用由客户本人承担。',
        '我们将保证其遵守中国的法律法规，并且不会超期滞留，若贵处能酌情协助其办理签证，我公司将不胜感激！',
    ]
    for t in texts:
        # Wrap text
        chars_per_line = int((w - 50*mm) / (7.2))  # approx char width
        lines = []
        remaining = t
        while remaining:
            lines.append(remaining[:chars_per_line])
            remaining = remaining[chars_per_line:]
        for line in lines:
            indent = 8*mm if line == lines[0] else 8*mm
            c.drawString(25*mm + indent, body_y, line)
            body_y -= 7*mm

    c.drawString(25*mm + 8*mm, body_y, '恭祝工作顺利！')
    body_y -= 10*mm

    # Info section
    if is_akkak:
        # Draw info box
        box_y_top = body_y + 4*mm
        box_height = 58*mm
        c.setStrokeColor(accent)
        c.setLineWidth(2)
        c.setFillColor(HexColor('#f8f9fa'))
        c.roundRect(25*mm, body_y - box_height + 4*mm, w - 50*mm, box_height, 8, fill=1, stroke=1)

        c.setFillColor(HexColor('#333333'))
        c.setFont('SansSC', 12)
        info_y = body_y
        info_items = [
            f'国籍／Nationality：{cn_nat}／{nationality}',
            f'姓名／Name: {name}',
            f'性别／Gender: {"男/Male" if sex == "M" else "女/Female"}',
            f'出生日期／Date of Birth: {dob}',
            f'护照号码／Passport NO.: {passport}',
            f'拜访日期／time: {fmt_date(arrival)}-{fmt_date(departure)}',
            f'访问目的／Purpose: {purpose}',
            f'资金来源／Funding: {funding}',
        ]
        for item in info_items:
            c.drawString(30*mm, info_y, item)
            info_y -= 7*mm
        body_y = info_y - 5*mm
    else:
        c.setFont('SansSC', 12)
        info_items = [
            f'国籍／Nationality：{cn_nat}／{nationality}',
            f'姓名／Name: {name}',
            f'护照号码／Passport NO.:{passport}',
            f'拜访日期／time:{fmt_date(arrival)}-{fmt_date(departure)}',
        ]
        for item in info_items:
            c.drawString(25*mm + 8*mm, body_y, item)
            body_y -= 7*mm

    body_y -= 5*mm

    # English text
    c.setFont('SansSC', 11)
    en_texts = [
        'We would like to sincerely invite the following client to visit our company for purchase bargain and business exchange. At that time, all the expenses will be borne by the client.',
        'We guarantee that the client will abide by Chinese laws and regulations and will not overstay their visa. We would be extremely grateful if your company could assist the client with visa processing. Wish you the best in your work!',
    ]
    for t in en_texts:
        words = t.split()
        line = ''
        for word in words:
            test = line + ' ' + word if line else word
            if c.stringWidth(test, 'SansSC', 11) > w - 50*mm:
                c.drawString(25*mm, body_y, line)
                body_y -= 6*mm
                line = word
            else:
                line = test
        if line:
            c.drawString(25*mm, body_y, line)
            body_y -= 6*mm

    # Signature
    c.setFont('SansSC', 12)
    sig_y = 50*mm
    c.drawRightString(w - 25*mm, sig_y + 10*mm, date_str)
    c.setFont('SansSCBold', 13)
    c.setFillColor(primary)
    c.drawRightString(w - 25*mm, sig_y, '佛山市乐织外贸服务有限公司')

    # Bottom bar
    c.setFillColor(primary)
    c.rect(15*mm, 20*mm, w - 30*mm, 8*mm, fill=1, stroke=0)

    c.showPage()

    # ---- PAGE 2: Itinerary ----
    c.setFont('SansSCBold', 18)
    c.setFillColor(primary)
    c.drawCentredString(w/2, h - 35*mm, '行程安排')

    # Color line
    c.setStrokeColor(primary)
    c.setLineWidth(3)
    c.line(20*mm, h - 40*mm, w - 20*mm, h - 40*mm)

    # Table
    table_data = [['日期', '行程', '住处']]
    for day in itin:
        table_data.append([day['date'], day['act'], day['acc']])

    col_widths = [45*mm, 95*mm, 35*mm]
    table = Table(table_data, colWidths=col_widths)

    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), accent if is_akkak else HexColor('#f0f0f0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff') if is_akkak else HexColor('#1a1a1a')),
        ('FONTNAME', (0, 0), (-1, 0), 'SansSCBold'),
        ('FONTNAME', (0, 1), (-1, -1), 'SansSC'),
        ('FONTSIZE', (0, 0), (-1, -1), 13),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (2, 1), (2, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#dddddd')),
        ('BOX', (0, 0), (-1, -1), 1, HexColor('#cccccc')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#fafafa')]),
    ])

    if is_akkak:
        style.add('BOX', (0, 0), (-1, -1), 1, accent)

    table.setStyle(style)
    tw, th = table.wrap(0, 0)
    table_y = h - 50*mm - th
    table.drawOn(c, 20*mm, table_y)

    # Signature
    c.setFont('SansSC', 12)
    c.setFillColor(HexColor('#333333'))
    sig_y = 50*mm
    c.drawRightString(w - 20*mm, sig_y + 10*mm, date_str)
    c.setFont('SansSCBold', 13)
    c.setFillColor(primary)
    c.drawRightString(w - 20*mm, sig_y, '佛山市乐织外贸服务有限公司')

    # Bottom bar
    c.setFillColor(primary)
    c.rect(15*mm, 20*mm, w - 30*mm, 8*mm, fill=1, stroke=0)

    c.showPage()

    # ---- PAGE 3: Blank ----
    c.setFillColor(primary)
    c.rect(15*mm, 20*mm, w - 30*mm, 8*mm, fill=1, stroke=0)

    c.save()
    buf.seek(0)
    return buf.read()


class PDFHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f'[{datetime.now().isoformat()}] {format % args}')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok'}).encode())
            return
        self.send_error(404)

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            data = json.loads(body)
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
            return

        if self.path == '/generate-html':
            try:
                html = gen_html_preview(data)
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(html.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
            return

        if self.path == '/generate':
            try:
                pdf_bytes = gen_pdf(data)
                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Disposition', f'inline; filename="invitation_{data.get("lastName","")}_{data.get("firstName","")}.pdf"')
                self.send_header('Content-Length', str(len(pdf_bytes)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(pdf_bytes)
            except Exception as e:
                print(f'PDF generation error: {e}', file=sys.stderr)
                import traceback
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
            return

        self.send_error(404)


def gen_html_preview(data):
    """Generate HTML preview that matches the PDF layout"""
    template = data.get('template', 'houacine')
    is_akkak = template == 'akkak'
    name = f'{data.get("lastName", "")} {data.get("firstName", "")}'
    nationality = data.get('nationality', 'Algeria')
    cn_nat = NAT_MAP.get(nationality, nationality)
    passport = data.get('passportNumber', '')
    arrival = data.get('arrivalDate', '')
    departure = data.get('departureDate', '')
    city = data.get('cityToVisit', '广州')
    sex = data.get('sex', 'M')
    dob = data.get('dateOfBirth', '').replace('-', '/')
    purpose = data.get('visitPurpose', '商务洽谈')
    funding = data.get('fundingSource', '客户本人')
    itin = gen_itinerary(arrival, departure, city, nationality)
    today = datetime.now()
    date_str = f'{today.year}年{today.month}月{today.day}日'

    primary = '#1a5276' if is_akkak else '#c41e3a'
    accent = '#2980b9' if is_akkak else '#de2910'

    rows = ''.join(f'<tr><td style="padding:8px 10px;border-bottom:1px solid #ddd;font-size:13px;white-space:nowrap">{d["date"]}</td><td style="padding:8px 10px;border-bottom:1px solid #ddd;font-size:13px">{d["act"]}</td><td style="padding:8px 10px;border-bottom:1px solid #ddd;font-size:13px;text-align:center">{d["acc"]}</td></tr>' for d in itin)

    info = ''
    if is_akkak:
        info = f'''<div style="border:2px solid {accent};border-radius:8px;padding:16px 20px;margin:16px 0;background:#f8f9fa">
            <div style="font-size:12pt;line-height:2.2">国籍／Nationality：{cn_nat}／{nationality}</div>
            <div style="font-size:12pt;line-height:2.2">姓名／Name: {name}</div>
            <div style="font-size:12pt;line-height:2.2">性别／Gender: {'男/Male' if sex=='M' else '女/Female'}</div>
            <div style="font-size:12pt;line-height:2.2">出生日期／Date of Birth: {dob}</div>
            <div style="font-size:12pt;line-height:2.2">护照号码／Passport NO.: {passport}</div>
            <div style="font-size:12pt;line-height:2.2">拜访日期／time: {fmt_date(arrival)}-{fmt_date(departure)}</div>
            <div style="font-size:12pt;line-height:2.2">访问目的／Purpose: {purpose}</div>
            <div style="font-size:12pt;line-height:2.2">资金来源／Funding: {funding}</div>
        </div>'''
    else:
        info = f'''<div style="margin-top:16px">
            <div style="font-size:12pt;line-height:2;color:#333;padding-left:2em">国籍／Nationality：{cn_nat}／{nationality}</div>
            <div style="font-size:12pt;line-height:2;color:#333;padding-left:2em">姓名／Name: {name}</div>
            <div style="font-size:12pt;line-height:2;color:#333;padding-left:2em">护照号码／Passport NO.:{passport}</div>
            <div style="font-size:12pt;line-height:2;color:#333;padding-left:2em">拜访日期／time:{fmt_date(arrival)}-{fmt_date(departure)}</div>
        </div>'''

    header = f'<div style="width:100%;height:12mm;background:linear-gradient(135deg,{primary},{accent},{primary});margin-bottom:20px;display:flex;align-items:center;justify-content:center"><h1 style="color:white;font-size:20pt;letter-spacing:6px;margin:0">INVITATION 邀请函</h1></div>' if is_akkak else f'<div style="text-align:center;font-size:24pt;font-weight:bold;color:#1a1a1a;margin-bottom:4px;letter-spacing:4px">INVITATION</div><div style="text-align:center;font-size:22pt;font-weight:bold;color:#1a1a1a;margin-bottom:20px">邀请函</div><div style="width:100%;height:3px;background:{primary};margin:8px 0"></div>'

    thBg = accent if is_akkak else '#f0f0f0'
    thColor = 'white' if is_akkak else '#1a1a1a'
    borderTh = '#2471a3' if is_akkak else '#ccc'

    return f'''<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@page{{size:A4;margin:0}}*{{margin:0;padding:0;box-sizing:border-box}}html,body{{width:210mm;margin:0;padding:0;font-family:"Noto Sans SC","Sarasa Mono SC",sans-serif}}.page{{width:210mm;min-height:297mm;position:relative;background:white}}</style></head><body>
<div class="page" style="padding:30mm 25mm 20mm 25mm">
{header}
<div style="font-size:12pt;line-height:1.8;color:#333;margin-top:16px">敬启者：</div>
<div style="font-size:12pt;line-height:1.8;color:#333;text-indent:2em;margin-bottom:2px">谨以此函，我们诚挚的邀请函如下客户来我公司洽谈采购及商务交流，届时一切费用由客户本人承担。</div>
<div style="font-size:12pt;line-height:1.8;color:#333;text-indent:2em;margin-bottom:2px">我们将保证其遵守中国的法律法规，并且不会超期滞留，若贵处能酌情协助其办理签证，我公司将不胜感激！</div>
<div style="font-size:12pt;line-height:1.8;color:#333;margin-top:10px">恭祝工作顺利！</div>
{info}
<div style="font-size:11pt;line-height:1.8;color:#333;margin-top:16px">We would like to sincerely invite the following client to visit our company for purchase bargain and business exchange. At that time, all the expenses will be borne by the client.</div>
<div style="font-size:11pt;line-height:1.8;color:#333;margin-top:4px">We guarantee that the client will abide by Chinese laws and regulations and will not overstay their visa. We would be extremely grateful if your company could assist the client with visa processing. Wish you the best in your work!</div>
<div style="text-align:right;margin-top:40px"><div style="font-size:12pt;color:#333">{date_str}</div><div style="font-size:13pt;font-weight:bold;color:{primary};margin-top:6px">佛山市乐织外贸服务有限公司</div></div>
<div style="position:absolute;bottom:20mm;left:15mm;right:15mm;height:8mm;background:linear-gradient(90deg,{primary},{accent},{primary});border-radius:2px"></div>
</div>
<div class="page" style="padding:25mm 20mm 20mm 20mm;page-break-before:always">
<div style="text-align:center;font-size:18pt;font-weight:bold;color:{primary};margin-bottom:20px">行程安排</div>
<div style="width:100%;height:3px;background:{primary};margin-bottom:16px"></div>
<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr>
<th style="background-color:{thBg};color:{thColor};padding:10px;border:1px solid {borderTh};font-size:14px;font-weight:bold;text-align:center;width:25%">日期</th>
<th style="background-color:{thBg};color:{thColor};padding:10px;border:1px solid {borderTh};font-size:14px;font-weight:bold;text-align:center;width:55%">行程</th>
<th style="background-color:{thBg};color:{thColor};padding:10px;border:1px solid {borderTh};font-size:14px;font-weight:bold;text-align:center;width:20%">住处</th>
</tr></thead><tbody>{rows}</tbody></table>
<div style="text-align:right;margin-top:60px"><div style="font-size:12pt;color:#333">{date_str}</div><div style="font-size:13pt;font-weight:bold;color:{primary};margin-top:6px">佛山市乐织外贸服务有限公司</div></div>
<div style="position:absolute;bottom:20mm;left:15mm;right:15mm;height:8mm;background:linear-gradient(90deg,{primary},{accent},{primary});border-radius:2px"></div>
</div>
<div class="page" style="page-break-before:always">
<div style="position:absolute;bottom:20mm;left:15mm;right:15mm;height:8mm;background:linear-gradient(90deg,{primary},{accent},{primary});border-radius:2px"></div>
</div>
</body></html>'''


if __name__ == '__main__':
    from http.server import ThreadingHTTPServer
    server = ThreadingHTTPServer(('0.0.0.0', 3001), PDFHandler)
    print('Python PDF service running on port 3001')
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
