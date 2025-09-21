import os, sys
from pdf2image import convert_from_path
import pytesseract

if len(sys.argv) < 3:
    print("Usage: python ocr_pdf.py <in.pdf> <out.txt> [max_pages]")
    sys.exit(2)

pdf, out = sys.argv[1], sys.argv[2]
max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 20

if "TESSERACT_PATH" in os.environ:
    pytesseract.pytesseract.tesseract_cmd = os.environ["TESSERACT_PATH"]

pages = convert_from_path(pdf, dpi=200, first_page=1, last_page=max_pages)
chunks = []
for i, img in enumerate(pages, 1):
    txt = pytesseract.image_to_string(img, lang="eng")
    chunks.append(txt)
    print(f"OCR page {i}/{len(pages)} -> {len(txt)} chars")

with open(out, "w", encoding="utf-8") as f:
    f.write("\n\n".join(chunks))
print(f"Wrote OCR text to {out}")