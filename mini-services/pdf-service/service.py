#!/usr/bin/env python3
"""PDF Generation Service for China Invitation Generator
Uses original PDF templates converted to images as backgrounds,
then overlays dynamic text fields on top. This preserves the exact
original template appearance (logos, stamps, watermarks, etc.)"""
import json
import sys
import os
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timedelta
from io import BytesIO

from pdf2image import convert_from_path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white, black

# Register fonts
pdfmetrics.registerFont(TTFont('SansSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SansSCBold', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SerifSC', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))

# Template paths
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'upload')
TEMPLATE_PATHS = {
    'houacine': os.path.join(UPLOAD_DIR, 'HOUACINE ABDESSALAM.pdf'),
    'akkak': os.path.join(UPLOAD_DIR, 'AKKAK AMIR FAHD.pdf'),
}

# Cache for converted template images (avoid re-converting on every request)
_template_cache = {}

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
    'Senegal': '塞内加尔', 'Mali': '马里', 'Niger': '尼日尔',
    'Chad': '乍得', 'Sudan': '苏丹', 'Kazakhstan': '哈萨克斯坦',
    'Uzbekistan': '乌兹别克斯坦', 'Tanzania': '坦桑尼亚',
    'Congo': '刚果', 'Angola': '安哥拉', 'Mozambique': '莫桑比克',
    'Madagascar': '马达加斯加',
}


def fmt_date(d):
    if not d:
        return ''
    dt = datetime.strptime(d, '%Y-%m-%d')
    return f'{dt.year}/{dt.month}/{dt.day}'


def fmt_date_cn(d):
    if not d:
        return ''
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
        d2 = a + timedelta(days=1)
        days.append({'date': fmt_date_cn(d2.strftime('%Y-%m-%d')), 'act': '到达佛山市乐织外贸服务公司。', 'acc': '佛山'})

    if total >= 4:
        ms = a + timedelta(days=2)
        me = dep - timedelta(days=2)
        days.append({'date': f'{fmt_date_cn(ms.strftime("%Y-%m-%d"))}-{fmt_date_cn(me.strftime("%Y-%m-%d"))}', 'act': '佛山南海工厂洽谈业务和订货。', 'acc': '佛山'})
    elif total == 3:
        d3 = a + timedelta(days=2)
        days.append({'date': fmt_date_cn(d3.strftime('%Y-%m-%d')), 'act': '佛山南海工厂洽谈业务和订货。', 'acc': '佛山'})

    if total >= 4:
        sl = dep - timedelta(days=1)
        days.append({'date': fmt_date_cn(sl.strftime('%Y-%m-%d')), 'act': f'拜访{city}物流公司。', 'acc': city})

    if total >= 2:
        days.append({'date': fmt_date_cn(departure), 'act': f'从{city}返回{nationality}。', 'acc': '/'})

    return days


def _get_template_images(template_name):
    """Convert template PDF to images, with caching."""
    if template_name in _template_cache:
        return _template_cache[template_name]

    pdf_path = TEMPLATE_PATHS.get(template_name)
    if not pdf_path or not os.path.exists(pdf_path):
        raise FileNotFoundError(f'Template not found: {pdf_path}')

    # Convert PDF pages to high-res PNG images
    images = convert_from_path(pdf_path, dpi=300)

    # Save to temp files (ReportLab needs file paths for drawImage)
    temp_dir = tempfile.mkdtemp(prefix=f'inv_{template_name}_')
    img_paths = []
    for i, img in enumerate(images):
        path = os.path.join(temp_dir, f'page_{i}.png')
        img.save(path, 'PNG')
        img_paths.append(path)

    _template_cache[template_name] = img_paths
    return img_paths


def _white_rect(c, x, y, w, h):
    """Draw a white rectangle to cover old text."""
    c.setFillColorRGB(1, 1, 1)
    c.rect(x, y, w, h, fill=1, stroke=0)


def _overlay_houacine_page1(c, data):
    """Overlay dynamic fields on HOUACINE template page 1.
    Positions extracted from the original PDF text analysis."""
    name = f'{data.get("lastName", "")} {data.get("firstName", "")}'
    nationality = data.get('nationality', 'Algeria')
    cn_nat = NAT_MAP.get(nationality, nationality)
    passport = data.get('passportNumber', '')
    arrival = data.get('arrivalDate', '')
    departure = data.get('departureDate', '')
    today = datetime.now()
    date_str = f'{today.year}年{today.month}月{today.day}日'

    font_size = 12.5

    # Nationality: original at y=550.8, value at x=248.7
    _white_rect(c, 248, 548, 200, 16)
    c.setFont('SansSC', font_size)
    c.setFillColorRGB(0, 0, 0)
    c.drawString(248, 550, f'{cn_nat}／{nationality}')

    # Name: original at y=530.6, value at x=216.8
    _white_rect(c, 216, 528, 300, 16)
    c.drawString(216, 530, name)

    # Passport: original at y=513.7, value at x=275.0
    _white_rect(c, 275, 511, 200, 16)
    c.drawString(275, 513, passport)

    # Visit dates: original at y=496.9, value starts around x=262
    date_val = f'{fmt_date(arrival)}-{fmt_date(departure)}'
    _white_rect(c, 262, 494, 220, 16)
    c.drawString(262, 496, date_val)

    # Signature date: original at y=294.5, x=381.9
    _white_rect(c, 370, 292, 160, 16)
    c.drawString(370, 294, date_str)


def _overlay_houacine_page2(c, data):
    """Overlay itinerary on HOUACINE template page 2."""
    arrival = data.get('arrivalDate', '')
    departure = data.get('departureDate', '')
    city = data.get('cityToVisit', '广州')
    nationality = data.get('nationality', 'Algeria')
    cn_nat = NAT_MAP.get(nationality, nationality)
    itin = gen_itinerary(arrival, departure, city, cn_nat)
    today = datetime.now()
    date_str = f'{today.year}年{today.month}月{today.day}日'

    font_size = 13.0

    # White out the entire itinerary table data area
    _white_rect(c, 75, 555, 475, 115)

    # Redraw table headers
    c.setFont('SansSCBold', font_size)
    c.setFillColorRGB(0, 0, 0)
    c.drawString(82, 655, '日期')
    c.drawString(222, 655, '行程')
    c.drawString(469, 655, '住处')

    # Draw itinerary rows
    c.setFont('SansSC', font_size)
    c.setFillColorRGB(0, 0, 0)
    row_y = 636
    for day in itin:
        c.drawString(80, row_y, day['date'])
        c.drawString(222, row_y, day['act'])
        c.drawString(469, row_y, day['acc'])
        row_y -= 18

    # Signature date
    _white_rect(c, 385, 285, 120, 16)
    c.setFont('SansSC', font_size)
    c.drawString(385, 287, date_str)


def _overlay_akkak_page1(c, data):
    """Overlay dynamic fields on AKKAK template page 1.
    AKKAK is mostly image-based. Field positions estimated from VLM analysis
    and text extraction."""
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
    relation = data.get('inviterRelation', '客户')

    font_size = 10.5

    # Name field: original at x=203.3, y=508.8
    _white_rect(c, 200, 506, 200, 14)
    c.setFont('SansSC', font_size)
    c.setFillColorRGB(0, 0, 0)
    c.drawString(200, 508, name)

    # DOB field: original at x=228.0, y=486.5
    _white_rect(c, 225, 484, 100, 14)
    c.drawString(225, 486, dob)

    # Passport field: original at x=429.4, y=486.4
    _white_rect(c, 425, 484, 130, 14)
    c.drawString(425, 486, passport)

    # Gender field: estimated position
    _white_rect(c, 335, 484, 60, 14)
    c.drawString(335, 486, '男/Male' if sex == 'M' else '女/Female')

    # Other fields - estimated positions based on VLM analysis
    # Visit purpose
    _white_rect(c, 115, 460, 180, 14)
    c.drawString(115, 462, purpose)

    # Visit dates
    date_val = f'{fmt_date(arrival)} TO {fmt_date(departure)}'
    _white_rect(c, 320, 460, 200, 14)
    c.drawString(320, 462, date_val)

    # Place to visit
    _white_rect(c, 115, 430, 180, 14)
    c.drawString(115, 432, city)

    # Relationship
    _white_rect(c, 320, 430, 200, 14)
    c.drawString(320, 432, relation)

    # Funding source
    _white_rect(c, 115, 400, 180, 14)
    c.drawString(115, 402, funding)

    # Nationality
    _white_rect(c, 320, 400, 200, 14)
    c.drawString(320, 402, f'{cn_nat}／{nationality}')


def _overlay_akkak_page2(c, data):
    """Overlay itinerary on AKKAK template page 2."""
    arrival = data.get('arrivalDate', '')
    departure = data.get('departureDate', '')
    city = data.get('cityToVisit', '广州')
    nationality = data.get('nationality', 'Algeria')
    cn_nat = NAT_MAP.get(nationality, nationality)
    itin = gen_itinerary(arrival, departure, city, cn_nat)
    full_name = f'{data.get("lastName", "")} {data.get("firstName", "")}'

    # White out the itinerary table area
    _white_rect(c, 78, 550, 440, 165)

    font_size = 10
    c.setFont('SansSCBold', font_size)
    c.setFillColorRGB(0, 0, 0)

    # Table header (4 columns: 日期, 行程, 交通, 用餐)
    c.drawString(82, 700, '日期')
    c.drawString(160, 700, '行程')
    c.drawString(390, 700, '交通')
    c.drawString(460, 700, '用餐')

    # Table data
    c.setFont('SansSC', font_size)
    row_y = 680
    for day in itin:
        c.drawString(82, row_y, day['date'])
        c.drawString(160, row_y, day['act'])
        c.drawString(390, row_y, '包车')
        c.drawString(460, row_y, '早/午/晚')
        row_y -= 22

    # Footer note with applicant name
    _white_rect(c, 60, 42, 470, 14)
    c.setFont('SansSC', 9)
    c.drawString(60, 43, f'仅供{full_name}先生申请签证使用')


def gen_pdf(data):
    """Generate PDF by converting original template pages to images,
    using them as backgrounds, and overlaying dynamic text fields."""
    template = data.get('template', 'houacine')
    img_paths = _get_template_images(template)

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    pw, ph = A4

    for page_idx, img_path in enumerate(img_paths):
        # Draw original page as full-page background image
        c.drawImage(img_path, 0, 0, width=pw, height=ph)

        # Overlay dynamic fields
        if template == 'houacine':
            if page_idx == 0:
                _overlay_houacine_page1(c, data)
            elif page_idx == 1:
                _overlay_houacine_page2(c, data)
        else:  # akkak
            if page_idx == 0:
                _overlay_akkak_page1(c, data)
            elif page_idx == 1:
                _overlay_akkak_page2(c, data)

        c.showPage()

    c.save()
    buf.seek(0)
    return buf.read()


def gen_html_preview(data):
    """Generate HTML preview showing template with filled fields."""
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
    itin = gen_itinerary(arrival, departure, city, cn_nat)
    today = datetime.now()
    date_str = f'{today.year}年{today.month}月{today.day}日'

    field_style = 'background:#fffde7;border:1px dashed #ff9800;padding:1px 4px;font-weight:bold'

    if is_akkak:
        rows = ''.join(
            f'<tr><td style="padding:6px 8px;border:1px solid #ccc;font-size:11px;white-space:nowrap">{d["date"]}</td>'
            f'<td style="padding:6px 8px;border:1px solid #ccc;font-size:11px">{d["act"]}</td>'
            f'<td style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:center">包车</td>'
            f'<td style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:center">早/午/晚</td></tr>'
            for d in itin
        )
        return f'''<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>@page{{size:A4;margin:0}}*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:210mm;font-family:"Noto Sans SC","Sarasa Mono SC",sans-serif}}
.page{{width:210mm;min-height:297mm;position:relative}}</style></head><body>
<div class="page" style="padding:25mm 20mm">
<h3 style="color:#1a5276">Aperçu - Modèle AKKAK</h3>
<table style="border-collapse:collapse;margin:10px 0;width:100%"><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">姓名/Name</td>
<td style="{field_style}">{name}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">性别/Gender</td>
<td style="{field_style}">{"男/Male" if sex=="M" else "女/Female"}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">出生日期/DOB</td>
<td style="{field_style}">{dob}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">护照/Passport</td>
<td style="{field_style}">{passport}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">访问目的/Purpose</td>
<td style="{field_style}">{purpose}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">日期/Dates</td>
<td style="{field_style}">{fmt_date(arrival)} TO {fmt_date(departure)}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">地点/Place</td>
<td style="{field_style}">{city}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">关系/Relation</td>
<td style="{field_style}">{data.get("inviterRelation","客户")}</td></tr><tr>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">资金/Funding</td>
<td style="{field_style}">{funding}</td>
<td style="padding:6px;border:1px solid #ccc;font-weight:bold">国籍/Nationality</td>
<td style="{field_style}">{cn_nat}／{nationality}</td></tr></table>
</div>
<div class="page" style="page-break-before:always;padding:20mm">
<h3 style="color:#1a5276">行程安排 / Itinerary</h3>
<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">日期</th>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">行程</th>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">交通</th>
<th style="background:#f0f0f0;padding:8px;border:1px solid #ccc;font-size:12px">用餐</th>
</tr></thead><tbody>{rows}</tbody></table>
</div></body></html>'''
    else:
        rows = ''.join(
            f'<tr><td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;white-space:nowrap">{d["date"]}</td>'
            f'<td style="padding:8px 10px;border:1px solid #ddd;font-size:13px">{d["act"]}</td>'
            f'<td style="padding:8px 10px;border:1px solid #ddd;font-size:13px;text-align:center">{d["acc"]}</td></tr>'
            for d in itin
        )
        return f'''<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>@page{{size:A4;margin:0}}*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:210mm;font-family:"Noto Sans SC","Sarasa Mono SC",sans-serif}}
.page{{width:210mm;min-height:297mm;position:relative;background:white}}</style></head><body>
<div class="page" style="padding:25mm 25mm 20mm 25mm">
<h3 style="color:#c41e3a">Aperçu - Modèle HOUACINE</h3>
<div style="margin-top:20px">
<div style="font-size:12pt;line-height:2.2">国籍／Nationality：<span style="{field_style}">{cn_nat}／{nationality}</span></div>
<div style="font-size:12pt;line-height:2.2">姓名／Name: <span style="{field_style}">{name}</span></div>
<div style="font-size:12pt;line-height:2.2">护照号码／Passport NO.: <span style="{field_style}">{passport}</span></div>
<div style="font-size:12pt;line-height:2.2">拜访日期／time: <span style="{field_style}">{fmt_date(arrival)}-{fmt_date(departure)}</span></div>
</div>
<div style="text-align:right;margin-top:40px"><div style="font-size:12pt;color:#333">{date_str}</div>
<div style="font-size:13pt;font-weight:bold;color:#c41e3a;margin-top:6px">佛山市乐织外贸服务有限公司</div></div>
</div>
<div class="page" style="page-break-before:always;padding:25mm 20mm">
<h3 style="color:#c41e3a">行程安排 / Itinerary</h3>
<table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr>
<th style="background:#f0f0f0;padding:10px;border:1px solid #ccc;font-size:14px;width:25%">日期</th>
<th style="background:#f0f0f0;padding:10px;border:1px solid #ccc;font-size:14px;width:55%">行程</th>
<th style="background:#f0f0f0;padding:10px;border:1px solid #ccc;font-size:14px;width:20%">住处</th>
</tr></thead><tbody>{rows}</tbody></table>
</div></body></html>'''


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


if __name__ == '__main__':
    from http.server import ThreadingHTTPServer
    server = ThreadingHTTPServer(('0.0.0.0', 3001), PDFHandler)
    print('Python PDF service running on port 3001')
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
