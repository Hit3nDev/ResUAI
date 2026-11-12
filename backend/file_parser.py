import io

MAX_UPLOAD_BYTES = 10 * 1024 * 1024   # 10 MB


def extract_text_from_bytes(filename: str, data: bytes) -> str:
    """
    Extract text from raw upload bytes. Raises ValueError (-> HTTP 400) for
    unsupported types, oversized files, and files that contain no readable text.
    """
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("File is too large (max 10 MB).")
    if not data:
        raise ValueError("The uploaded file is empty.")

    class _Upload:
        name = filename or ""
        def read(self_): return data

    try:
        text = extract_text_from_upload(_Upload())
    except ValueError:
        raise
    except Exception as exc:   # corrupt PDF / DOCX etc.
        raise ValueError(f"Could not read this file ({type(exc).__name__}). Is it a valid PDF/DOCX/TXT?") from exc
    if not text.strip():
        raise ValueError("No readable text found in this file (scanned/image-only PDFs are not supported).")
    return text

def extract_text_from_upload(uploaded_file) -> str:
    """
    Extract plain text from an uploaded file.
    Supports PDF, DOCX, and TXT formats.
    Returns extracted text as a string.
    """
    filename = (uploaded_file.name or "").lower()
    file_bytes = uploaded_file.read()

    if filename.endswith(".txt"):
        return _extract_txt(file_bytes)
    elif filename.endswith(".pdf"):
        return _extract_pdf(file_bytes)
    elif filename.endswith(".docx"):
        return _extract_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {uploaded_file.name}. Please upload PDF, DOCX, or TXT.")

def _extract_txt(file_bytes: bytes) -> str:
    """Extract text from a plain text file."""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1")

def _extract_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF using pdfplumber."""
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts)
    except ImportError:
        # Fallback to PyPDF2 if pdfplumber not available
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            return "\n".join(
                page.extract_text() for page in reader.pages if page.extract_text()
            )
        except ImportError:
            raise ImportError("Please install pdfplumber: pip install pdfplumber")

def _extract_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX file using python-docx."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
        return "\n".join(paragraphs)
    except ImportError:
        raise ImportError("Please install python-docx: pip install python-docx")
