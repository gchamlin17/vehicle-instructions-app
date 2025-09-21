import sys
from pdfminer.high_level import extract_text

if len(sys.argv) < 3:
    print("Usage: python extract_text_fallback.py <in.pdf> <out.txt>")
    sys.exit(2)

src, dst = sys.argv[1], sys.argv[2]
txt = extract_text(src) or ""
with open(dst, "w", encoding="utf-8") as f:
    f.write(txt)
print(f"Wrote {len(txt)} chars to {dst}")