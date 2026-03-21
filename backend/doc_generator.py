"""
doc_generator.py
================
Converts plain-text AI resume output into professionally formatted DOCX and PDF files.
Matches the reference template: single-column, clear hierarchy, proper spacing.

AI logic (ai_engine.py) is NEVER touched — this only handles formatting.

Parsing strategy
----------------
The AI always outputs plain text with:
  • First non-empty line         → Candidate name
  • Second content block         → Contact info (contains @ | phone)
  • ALL-CAPS lines               → Section headers  (EXPERIENCE, EDUCATION, …)
  • Lines starting with •/–/*   → Bullet points
  • Lines with year/date pattern → Entry company row
  • Lines following entry rows   → Entry subtitle row (role + location)
  • Skills section lines         → Kept verbatim (Label: values)
  • Everything else              → Body text
"""

import io
import re
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
#  SHARED CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

# Indigo accent — matches reference template
COLOR_ACCENT  = (0x4F, 0x46, 0xE5)   # #4F46E5
COLOR_DARK    = (0x0F, 0x14, 0x1F)   # near-black
COLOR_BODY    = (0x1F, 0x2A, 0x3A)   # dark navy
COLOR_GREY    = (0x6B, 0x72, 0x80)   # metadata / contact
COLOR_LIGHT   = (0x9C, 0xA3, 0xAF)   # very light grey

# Date / location detection
_RE_DATE = re.compile(
    r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*\d{2,4}'
    r'|(?:\d{4}\s*[–\-]\s*(?:\d{4}|Present|present))'
    r'|\bPresent\b',
    re.IGNORECASE,
)

_RE_YEAR = re.compile(r'\b(19|20)\d{2}\b')

# Location: "City, ST" or "City, Country"
_RE_LOCATION = re.compile(r'[A-Z][a-zA-Z\s\.]+,\s*[A-Z][A-Za-z\s]{1,20}\s*$')

# Section header: all-caps word(s), 3–40 chars
_RE_SECTION = re.compile(r'^[A-Z][A-Z0-9\s&\/\-,]{2,39}$')


# ═══════════════════════════════════════════════════════════════════════════════
#  PARSER — shared between DOCX and PDF
# ═══════════════════════════════════════════════════════════════════════════════

def _is_section_header(s: str) -> bool:
    s = s.strip()
    if not s or len(s) < 3 or len(s) > 40:
        return False
    if s[0] in ('•', '-', '*'):
        return False
    return s == s.upper() and bool(_RE_SECTION.match(s))


def _is_bullet(s: str) -> bool:
    return bool(s) and (
        s.startswith('•')
        or re.match(r'^[\-\*]\s+', s)
        or re.match(r'^\u2013\s+', s)
    )


def _is_divider(s: str) -> bool:
    return bool(re.match(r'^[\-=_]{3,}\s*$', s.strip()))


def _has_date(s: str) -> bool:
    return bool(_RE_DATE.search(s)) or bool(_RE_YEAR.search(s))


def _has_location(s: str) -> bool:
    return bool(_RE_LOCATION.search(s))


def _clean_bullet(s: str) -> str:
    return re.sub(r'^[•\-\*\u2013]\s*', '', s).strip()


def _split_at_date(line: str) -> tuple[str, str]:
    """
    Split "Company Name   Aug 2020 – Present" → ("Company Name", "Aug 2020 – Present").
    Also handles "Company | Date" and "Company (Date)" patterns.
    Returns (left_part, date_part). date_part may be empty.
    """
    # Pattern 1: "Company | Date"
    if '|' in line:
        parts = [p.strip() for p in line.split('|', 1)]
        if _has_date(parts[-1]) and not _has_date(parts[0]):
            return parts[0], parts[-1]

    # Pattern 2: multiple spaces before date
    m = re.search(
        r'(\s{2,}|\t)'
        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*\d{2,4}[^\n]*)',
        line, re.IGNORECASE
    )
    if m:
        left = line[:m.start()].strip()
        right = line[m.start():].strip()
        if left:
            return left, right

    # Pattern 3: " – " separator mid-line with year context
    m2 = re.search(r'\s+([–\-]\s+(?:\d{4}|Present).*)', line, re.IGNORECASE)
    if m2:
        # Make sure something year-like precedes it
        before = line[:m2.start()]
        if _has_date(before):
            pass  # the whole thing is date-ish, don't split
        else:
            return before.strip(), line[m2.start():].strip()

    # No split found
    return line.strip(), ''


def _split_at_location(line: str) -> tuple[str, str]:
    """
    Split "Software Engineer   San Francisco, CA" → ("Software Engineer", "San Francisco, CA").
    """
    # Pattern 1: "Role | Location"
    if '|' in line:
        parts = [p.strip() for p in line.split('|', 1)]
        if _has_location(parts[-1]) and not _has_location(parts[0]):
            return parts[0], parts[-1]

    # Pattern 2: multiple spaces before location
    m = re.search(r'(\s{2,}|\t)([A-Z][a-zA-Z\s\.]+,\s*[A-Z][A-Za-z\s]{1,20})\s*$', line)
    if m:
        left = line[:m.start()].strip()
        right = m.group(2).strip()
        if left:
            return left, right

    return line.strip(), ''


class Token:
    """A parsed resume element."""
    __slots__ = ('kind', 'text', 'extra')

    def __init__(self, kind: str, text: str, extra: str = ''):
        self.kind  = kind    # name|contact|section|entry_head|entry_sub|bullet|skill|body
        self.text  = text    # primary text
        self.extra = extra   # right-side text (date or location)

    def __repr__(self):
        return f"Token({self.kind!r}, {self.text!r}, {self.extra!r})"


def parse_resume(resume_text: str) -> list[Token]:
    """
    Parse plain-text AI resume into a list of Token objects.

    Called by both generate_docx() and generate_pdf() so formatting
    logic is shared and consistent.
    """
    raw_lines = resume_text.strip().split('\n')
    lines = [ln.rstrip() for ln in raw_lines]

    tokens: list[Token] = []
    found_name    = False
    found_contact = False
    current_sec   = None   # current section name (e.g. 'EXPERIENCE')

    def last_kind() -> str:
        for t in reversed(tokens):
            if t.kind not in ('empty',):
                return t.kind
        return ''

    i = 0
    while i < len(lines):
        raw   = lines[i]
        s     = raw.strip()
        i    += 1

        # ── Skip blank lines and pure dividers ─────────────────────────
        if not s or _is_divider(s):
            continue

        # ── NAME — always first real line ──────────────────────────────
        if not found_name:
            tokens.append(Token('name', s))
            found_name = True
            continue

        # ── CONTACT — before any section, contains @/|/phone ───────────
        if not found_contact and current_sec is None:
            has_contact_signal = (
                '@' in s
                or '|' in s
                or re.search(r'\+?\d[\d\s\(\)\-\.]{7,}', s)
                or re.search(r'(?:linkedin|github|twitter|phone|email)', s, re.I)
            )
            if has_contact_signal:
                tokens.append(Token('contact', s))
                found_contact = True
                continue

        # ── SECTION HEADER ─────────────────────────────────────────────
        if _is_section_header(s):
            current_sec = s.upper()
            tokens.append(Token('section', s))
            continue

        # ──────────────────────────────────────────────────────────────
        # Everything below is inside a section (or pre-section body)
        # ──────────────────────────────────────────────────────────────

        # ── BULLET ────────────────────────────────────────────────────
        if _is_bullet(s):
            tokens.append(Token('bullet', _clean_bullet(s)))
            continue

        # ── SKILLS SECTION — keep lines verbatim ──────────────────────
        if current_sec and 'SKILL' in current_sec:
            tokens.append(Token('skill', s))
            continue

        # ── ENTRY DETECTION (EXPERIENCE / PROJECTS / EDUCATION) ────────
        # We try to detect "Company / Date" and "Role / Location" lines.

        lk = last_kind()

        # If this line itself contains a date → entry_head
        if _has_date(s) and current_sec:
            left, right = _split_at_date(s)
            tokens.append(Token('entry_head', left or s, right))
            continue

        # If previous token was entry_head → this is entry_sub (role/location)
        if lk == 'entry_head' and current_sec:
            left, right = _split_at_location(s)
            tokens.append(Token('entry_sub', left or s, right))
            continue

        # Look-ahead: if next non-empty line has date/location, this is entry_head
        if current_sec:
            next_s = ''
            j = i
            while j < len(lines):
                ns = lines[j].strip()
                if ns and not _is_divider(ns) and not _is_bullet(ns):
                    next_s = ns
                    break
                j += 1
            if next_s and (_has_date(next_s) or _has_location(next_s)):
                tokens.append(Token('entry_head', s, ''))
                continue

        # ── BODY (summary, extra text, etc.) ──────────────────────────
        tokens.append(Token('body', s))

    return tokens


# ═══════════════════════════════════════════════════════════════════════════════
#  DOCX GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

def generate_docx(resume_text: str, candidate_name: str = "Resume") -> bytes:
    """
    Render parsed tokens into a professional .docx file.
    Matches the reference template exactly.
    """
    from docx import Document
    from docx.shared import Pt, Inches, RGBColor, Twips
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    doc = Document()

    # ── Page setup ──────────────────────────────────────────────────────
    for sec in doc.sections:
        sec.top_margin    = Inches(0.75)
        sec.bottom_margin = Inches(0.80)
        sec.left_margin   = Inches(0.90)
        sec.right_margin  = Inches(0.90)

    # Printable width (letter page: 8.5" – 1.8" margins = 6.7")
    PAGE_WIDTH_IN = 6.70

    # ── Normal style baseline ────────────────────────────────────────────
    normal = doc.styles['Normal']
    normal.font.name = 'Calibri'
    normal.font.size = Pt(10.5)

    # ── Helper: add a bottom-border HR paragraph ─────────────────────────
    def _add_hr(color_hex: str = '4F46E5'):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after  = Pt(0)
        pPr = p._p.get_or_add_pPr()
        pBdr = OxmlElement('w:pBdr')
        bottom = OxmlElement('w:bottom')
        bottom.set(qn('w:val'), 'single')
        bottom.set(qn('w:sz'), '8')        # line weight
        bottom.set(qn('w:space'), '2')
        bottom.set(qn('w:color'), color_hex)
        pBdr.append(bottom)
        pPr.append(pBdr)
        return p

    # ── Helper: set right-aligned tab stop ───────────────────────────────
    def _set_right_tab(para, pos_inches: float):
        """Add a right-aligned tab stop at pos_inches from left margin."""
        pPr = para._p.get_or_add_pPr()
        tabs = OxmlElement('w:tabs')
        tab  = OxmlElement('w:tab')
        tab.set(qn('w:val'), 'right')
        tab.set(qn('w:pos'), str(int(pos_inches * 1440)))  # twips
        tabs.append(tab)
        pPr.append(tabs)

    # ── Helper: RGB color tuple → RGBColor ──────────────────────────────
    def _rgb(r, g, b):
        return RGBColor(r, g, b)

    # ── Parse ────────────────────────────────────────────────────────────
    tokens = parse_resume(resume_text)

    # ── Render ───────────────────────────────────────────────────────────
    for tok in tokens:

        # ── NAME ──────────────────────────────────────────────────────
        if tok.kind == 'name':
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after  = Pt(4)
            run = p.add_run(tok.text.upper())
            run.bold       = True
            run.font.name  = 'Calibri'
            run.font.size  = Pt(22)
            run.font.color.rgb = _rgb(*COLOR_DARK)

        # ── CONTACT ───────────────────────────────────────────────────
        elif tok.kind == 'contact':
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after  = Pt(12)
            run = p.add_run(tok.text)
            run.font.name  = 'Calibri'
            run.font.size  = Pt(9.5)
            run.font.color.rgb = _rgb(*COLOR_GREY)

        # ── SECTION HEADER ────────────────────────────────────────────
        elif tok.kind == 'section':
            # Space before section (except very first)
            spacer = doc.add_paragraph()
            spacer.paragraph_format.space_before = Pt(0)
            spacer.paragraph_format.space_after  = Pt(6)

            # Section label
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after  = Pt(2)
            run = p.add_run(tok.text.upper())
            run.bold       = True
            run.font.name  = 'Calibri'
            run.font.size  = Pt(11)
            run.font.color.rgb = _rgb(*COLOR_ACCENT)

            # Thin divider line immediately below the header
            _add_hr()

            # Small gap after divider before content
            gap = doc.add_paragraph()
            gap.paragraph_format.space_before = Pt(0)
            gap.paragraph_format.space_after  = Pt(4)

        # ── ENTRY HEAD (company name + date) ─────────────────────────
        elif tok.kind == 'entry_head':
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(7)
            p.paragraph_format.space_after  = Pt(0)

            if tok.extra:
                # Two-column: company (left) + date (right-aligned tab)
                _set_right_tab(p, PAGE_WIDTH_IN)
                r1 = p.add_run(tok.text)
                r1.bold       = True
                r1.font.name  = 'Calibri'
                r1.font.size  = Pt(10.5)
                r1.font.color.rgb = _rgb(*COLOR_DARK)

                r_tab = p.add_run('\t')

                r2 = p.add_run(tok.extra)
                r2.bold       = False
                r2.font.name  = 'Calibri'
                r2.font.size  = Pt(9.5)
                r2.font.color.rgb = _rgb(*COLOR_GREY)
            else:
                r = p.add_run(tok.text)
                r.bold       = True
                r.font.name  = 'Calibri'
                r.font.size  = Pt(10.5)
                r.font.color.rgb = _rgb(*COLOR_DARK)

        # ── ENTRY SUB (role/title + location) ────────────────────────
        elif tok.kind == 'entry_sub':
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after  = Pt(2)

            if tok.extra:
                # Two-column: role (left) + location (right)
                _set_right_tab(p, PAGE_WIDTH_IN)
                r1 = p.add_run(tok.text)
                r1.bold       = False
                r1.italic     = True
                r1.font.name  = 'Calibri'
                r1.font.size  = Pt(10)
                r1.font.color.rgb = _rgb(*COLOR_GREY)

                r_tab = p.add_run('\t')

                r2 = p.add_run(tok.extra)
                r2.bold       = False
                r2.italic     = True
                r2.font.name  = 'Calibri'
                r2.font.size  = Pt(9.5)
                r2.font.color.rgb = _rgb(*COLOR_GREY)
            else:
                r = p.add_run(tok.text)
                r.italic      = True
                r.font.name   = 'Calibri'
                r.font.size   = Pt(10)
                r.font.color.rgb = _rgb(*COLOR_GREY)

        # ── BULLET ────────────────────────────────────────────────────
        elif tok.kind == 'bullet':
            p = doc.add_paragraph()
            p.paragraph_format.left_indent  = Inches(0.20)
            p.paragraph_format.first_line_indent = Inches(-0.16)
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after  = Pt(2)

            # Manual bullet char + space
            r_bul = p.add_run('• ')
            r_bul.font.name  = 'Calibri'
            r_bul.font.size  = Pt(10)
            r_bul.font.color.rgb = _rgb(*COLOR_ACCENT)

            r_txt = p.add_run(tok.text)
            r_txt.font.name  = 'Calibri'
            r_txt.font.size  = Pt(10)
            r_txt.font.color.rgb = _rgb(*COLOR_BODY)

        # ── SKILL LINE ────────────────────────────────────────────────
        elif tok.kind == 'skill':
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after  = Pt(2)

            # Bold the label (e.g. "Languages"), normal for values
            if ':' in tok.text:
                label, _, values = tok.text.partition(':')
                r_lbl = p.add_run(label.strip() + ': ')
                r_lbl.bold       = True
                r_lbl.font.name  = 'Calibri'
                r_lbl.font.size  = Pt(10.5)
                r_lbl.font.color.rgb = _rgb(*COLOR_DARK)
                r_val = p.add_run(values.strip())
                r_val.font.name  = 'Calibri'
                r_val.font.size  = Pt(10.5)
                r_val.font.color.rgb = _rgb(*COLOR_BODY)
            else:
                r = p.add_run(tok.text)
                r.font.name  = 'Calibri'
                r.font.size  = Pt(10.5)
                r.font.color.rgb = _rgb(*COLOR_BODY)

        # ── BODY / SUMMARY ────────────────────────────────────────────
        elif tok.kind == 'body':
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after  = Pt(2)
            run = p.add_run(tok.text)
            run.font.name  = 'Calibri'
            run.font.size  = Pt(10.5)
            run.font.color.rgb = _rgb(*COLOR_BODY)

    # ── Save ─────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()


# ═══════════════════════════════════════════════════════════════════════════════
#  PDF GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

def generate_pdf(resume_text: str, candidate_name: str = "Resume") -> bytes:
    """
    Render parsed tokens into a professional PDF using ReportLab.
    Matches the same visual hierarchy as the DOCX output.
    """
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer,
        HRFlowable, Table, TableStyle,
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

    buf = io.BytesIO()

    MARGIN_H = 0.85 * inch
    MARGIN_V = 0.75 * inch
    PAGE_W   = LETTER[0] - 2 * MARGIN_H   # usable width

    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=MARGIN_H,
        rightMargin=MARGIN_H,
        topMargin=MARGIN_V,
        bottomMargin=MARGIN_V,
    )

    # ── Color palette ────────────────────────────────────────────────────
    C_ACCENT = colors.HexColor('#4F46E5')
    C_DARK   = colors.HexColor('#0F141F')
    C_BODY   = colors.HexColor('#1F2A3A')
    C_GREY   = colors.HexColor('#6B7280')
    C_LIGHT  = colors.HexColor('#9CA3AF')
    C_LINE   = colors.HexColor('#C7D0E0')

    # ── Paragraph styles ─────────────────────────────────────────────────
    name_style = ParagraphStyle(
        'Name',
        fontName='Helvetica-Bold',
        fontSize=22,
        textColor=C_DARK,
        alignment=TA_CENTER,
        spaceBefore=0,
        spaceAfter=6,
        leading=26,
    )

    contact_style = ParagraphStyle(
        'Contact',
        fontName='Helvetica',
        fontSize=9,
        textColor=C_GREY,
        alignment=TA_CENTER,
        spaceBefore=2,
        spaceAfter=14,
        leading=13,
    )

    section_style = ParagraphStyle(
        'Section',
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=C_ACCENT,
        alignment=TA_LEFT,
        spaceBefore=0,
        spaceAfter=3,
        leading=15,
    )

    entry_head_l_style = ParagraphStyle(
        'EntryHeadL',
        fontName='Helvetica-Bold',
        fontSize=10.5,
        textColor=C_DARK,
        alignment=TA_LEFT,
        spaceBefore=0,
        spaceAfter=0,
        leading=14,
    )

    entry_head_r_style = ParagraphStyle(
        'EntryHeadR',
        fontName='Helvetica',
        fontSize=9.5,
        textColor=C_GREY,
        alignment=TA_RIGHT,
        spaceBefore=0,
        spaceAfter=0,
        leading=14,
    )

    entry_sub_l_style = ParagraphStyle(
        'EntrySubL',
        fontName='Helvetica-Oblique',
        fontSize=10,
        textColor=C_GREY,
        alignment=TA_LEFT,
        spaceBefore=0,
        spaceAfter=3,
        leading=13,
    )

    entry_sub_r_style = ParagraphStyle(
        'EntrySubR',
        fontName='Helvetica-Oblique',
        fontSize=9.5,
        textColor=C_GREY,
        alignment=TA_RIGHT,
        spaceBefore=0,
        spaceAfter=3,
        leading=13,
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        fontName='Helvetica',
        fontSize=10,
        textColor=C_BODY,
        alignment=TA_LEFT,
        leftIndent=14,
        firstLineIndent=0,
        spaceBefore=2,
        spaceAfter=2,
        leading=14,
    )

    skill_label_style = ParagraphStyle(
        'SkillLabel',
        fontName='Helvetica-Bold',
        fontSize=10.5,
        textColor=C_DARK,
        alignment=TA_LEFT,
        spaceBefore=2,
        spaceAfter=2,
        leading=14,
    )

    skill_value_style = ParagraphStyle(
        'SkillValue',
        fontName='Helvetica',
        fontSize=10.5,
        textColor=C_BODY,
        alignment=TA_LEFT,
        spaceBefore=2,
        spaceAfter=2,
        leading=14,
    )

    body_style = ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=10.5,
        textColor=C_BODY,
        alignment=TA_LEFT,
        spaceBefore=2,
        spaceAfter=2,
        leading=15,
    )

    # ── Two-column row helper ─────────────────────────────────────────────
    def _two_col(left_text, right_text, left_style, right_style,
                 space_before=0, space_after=0):
        """
        Build a 2-cell Table that puts left_text left-aligned and
        right_text right-aligned on the same visual row.
        """
        tbl = Table(
            [[Paragraph(left_text, left_style),
              Paragraph(right_text, right_style)]],
            colWidths=[PAGE_W * 0.68, PAGE_W * 0.32],
        )
        tbl.setStyle(TableStyle([
            ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING',  (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING',   (0, 0), (-1, -1), space_before),
            ('BOTTOMPADDING',(0, 0), (-1, -1), space_after),
        ]))
        return tbl

    # ── Bullet helper ────────────────────────────────────────────────────
    def _bullet_para(text: str):
        # Use an em-dash bullet in accent color
        return Paragraph(
            f'<font color="#4F46E5">•</font> {text}',
            bullet_style,
        )

    # ── Skill line helper ────────────────────────────────────────────────
    def _skill_para(text: str):
        if ':' in text:
            label, _, values = text.partition(':')
            html = (
                f'<b><font color="#0F141F">{label.strip()}:</font></b>'
                f' <font color="#1F2A3A">{values.strip()}</font>'
            )
            return Paragraph(html, body_style)
        return Paragraph(text, body_style)

    # ── Parse & render ────────────────────────────────────────────────────
    tokens = parse_resume(resume_text)
    story  = []

    for tok in tokens:

        if tok.kind == 'name':
            story.append(Paragraph(tok.text.upper(), name_style))

        elif tok.kind == 'contact':
            story.append(Paragraph(tok.text, contact_style))

        elif tok.kind == 'section':
            story.append(Spacer(1, 10))
            story.append(Paragraph(tok.text.upper(), section_style))
            story.append(HRFlowable(
                width='100%',
                thickness=1.0,
                color=C_LINE,
                spaceBefore=1,
                spaceAfter=4,
            ))

        elif tok.kind == 'entry_head':
            story.append(Spacer(1, 7))
            if tok.extra:
                story.append(_two_col(
                    tok.text, tok.extra,
                    entry_head_l_style, entry_head_r_style,
                ))
            else:
                story.append(Paragraph(tok.text, entry_head_l_style))

        elif tok.kind == 'entry_sub':
            if tok.extra:
                story.append(_two_col(
                    tok.text, tok.extra,
                    entry_sub_l_style, entry_sub_r_style,
                    space_before=0, space_after=3,
                ))
            else:
                story.append(Paragraph(tok.text, entry_sub_l_style))

        elif tok.kind == 'bullet':
            story.append(_bullet_para(tok.text))

        elif tok.kind == 'skill':
            story.append(_skill_para(tok.text))

        elif tok.kind == 'body':
            story.append(Paragraph(tok.text, body_style))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ═══════════════════════════════════════════════════════════════════════════════
#  UTILITY
# ═══════════════════════════════════════════════════════════════════════════════

def get_download_filename(candidate_name: str, feature: str, ext: str) -> str:
    safe = re.sub(r'[^a-zA-Z0-9_]', '_', candidate_name or "Resume")
    ts   = datetime.now().strftime("%Y%m%d")
    tag  = feature.replace(' ', '_')
    return f"{safe}_{tag}_{ts}.{ext}"
