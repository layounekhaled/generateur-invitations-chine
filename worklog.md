---
Task ID: 1
Agent: Main Agent
Task: Replace PDF generation with Word (.docx) generation using pure JavaScript

Work Log:
- Analyzed the project structure and identified the dependency on Python + python-docx + LibreOffice for PDF generation
- Installed pizzip package for ZIP manipulation in pure JavaScript
- Created /home/z/my-project/src/lib/word-template.ts with full template modification logic:
  - Nationality mapping (35+ countries)
  - Embassy mapping (17 countries)
  - Date formatting (Chinese format: 年月日)
  - Split date replacement (dates stored across 6 XML runs)
  - Table row date replacement (arrival/departure)
  - Signature date replacement (sz=23 and no-sz paragraphs)
  - Itinerary table generation (auto-generated based on date range)
  - Simple text replacement (name, passport, city, company, etc.)
- Updated /home/z/my-project/src/app/api/generate-pdf/route.ts:
  - Now supports both FormData (with template upload) and JSON (default template)
  - Returns .docx files instead of PDF
  - No dependency on Python, python-docx, or LibreOffice
- Updated /home/z/my-project/src/app/page.tsx:
  - Added template file upload UI (drag & drop area)
  - Changed all PDF references to Word (.docx)
  - Updated download buttons and toast messages
  - Changed handleGeneratePDF to handleGenerateDocx
  - Updated bulk generate and re-download handlers to use FormData
- Tested all replacements work correctly:
  - Name, passport, nationality, sex, city, company, embassy
  - Arrival date, departure date, signature dates
  - Itinerary table generation

Stage Summary:
- PDF generation completely replaced with Word (.docx) generation using pure JavaScript
- No external dependencies (Python, LibreOffice) required
- Template upload feature added - users can upload their own .docx template
- Default template still works from public/template.docx
- All date replacements working correctly including split-run dates
- Build passes successfully
