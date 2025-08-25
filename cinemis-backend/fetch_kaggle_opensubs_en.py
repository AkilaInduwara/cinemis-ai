# fetch_kaggle_opensubs_en.py
from pathlib import Path
import os, sqlite3
from io import BytesIO
import gzip, zipfile, re
from kaggle.api.kaggle_api_extended import KaggleApi
from tqdm import tqdm
from charset_normalizer import from_bytes

# --------- Paths / settings ----------
PROJECT = Path(__file__).resolve().parent
DL_DIR   = PROJECT / "data" / "kaggle" / "opensubs_en"
OUT_DIR  = PROJECT / "data" / "opus_hf"
OUT_TXT  = OUT_DIR / "opensubtitles_en.txt"
OUT_TSV  = OUT_DIR / "opensubtitles_en_meta.tsv"

DATASET_SLUG = "kaushikrahul/english-subtitles-opensubtitles-org"
MAX_LINES = None  # e.g., 2_000_000 to cap for a fast run

# --------- Cleaning helpers ----------
TIMESTAMP_RE   = re.compile(r"\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?\s*-->\s*\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?")
SRT_INDEX_RE   = re.compile(r"^\s*\d+\s*$")
HTML_TAG_RE    = re.compile(r"<[^>]+>")
CUE_SETTINGS_RE= re.compile(r"(align|position|size|line):\S+")

def clean_sub_line(s: str) -> str:
    if TIMESTAMP_RE.search(s): return ""
    if SRT_INDEX_RE.match(s): return ""
    s = CUE_SETTINGS_RE.sub("", s)
    s = HTML_TAG_RE.sub("", s)
    s = s.replace("\r", " ").strip()
    if len(s) < 2: return ""
    if s in {"[]","()","{}"}: return ""
    return s

def decode_bytes(b: bytes) -> str:
    res = from_bytes(b).best()
    if res is None:
        try: return b.decode("utf-8", errors="ignore")
        except: return b.decode("latin-1", errors="ignore")
    return str(res)

def iter_text_files_from_blob(name: str, blob: bytes):
    """
    Yield (inner_name, decoded_text) from one DB row which may contain:
      - ZIP (starts with PK)
      - GZIP (starts with 1F 8B)
      - Plain text (everything else)
    """
    # ZIP file ?
    if blob.startswith(b"PK\x03\x04"):
        with zipfile.ZipFile(BytesIO(blob)) as zf:
            for zi in zf.infolist():
                inner = zi.filename.lower()
                if not inner.endswith((".srt", ".sub", ".txt", ".vtt")):
                    continue
                try:
                    raw = zf.read(zi)
                except Exception:
                    continue
                yield zi.filename, decode_bytes(raw)
        return

    # GZIP file ?
    if blob.startswith(b"\x1f\x8b"):
        try:
            raw = gzip.decompress(blob)
            # Try as plain text first
            txt = decode_bytes(raw)
            if txt.strip():
                yield name.replace(".gz",""), txt
                return
            # or maybe a zipped container inside
            if raw.startswith(b"PK\x03\x04"):
                with zipfile.ZipFile(BytesIO(raw)) as zf:
                    for zi in zf.infolist():
                        inner = zi.filename.lower()
                        if not inner.endswith((".srt", ".sub", ".txt", ".vtt")):
                            continue
                        try:
                            inner_raw = zf.read(zi)
                        except Exception:
                            continue
                        yield zi.filename, decode_bytes(inner_raw)
                return
        except Exception:
            pass  # fall through to plain

    # Plain text fallback
    yield name, decode_bytes(blob)

# --------- Kaggle steps ----------
def kaggle_auth():
    api = KaggleApi()
    api.authenticate()
    return api

def download_dataset(api: KaggleApi):
    DL_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"⏬ Downloading {DATASET_SLUG} into {DL_DIR} …")
    api.dataset_download_files(DATASET_SLUG, path=str(DL_DIR), quiet=False, unzip=True)

def find_db(root: Path) -> Path:
    cands = list(root.glob("*.db")) + list(root.glob("**/*.db"))
    if not cands:
        raise SystemExit("No .db found after unzip. Check the downloaded folder.")
    # choose largest
    return max(cands, key=lambda p: p.stat().st_size)

# --------- Exporter (DB -> text) ----------
def export_text(db_path: Path):
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    # keep bytes for row values so BLOBs come through untouched
    conn.text_factory = bytes

    cur = conn.cursor()

    # --- normalize table names to str ---
    raw_tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    tables = [(t.decode("utf-8", "ignore") if isinstance(t, (bytes, bytearray)) else t) for t in raw_tables]

    if "zipfiles" not in tables:
        print(f"'zipfiles' table not found. Found tables: {tables}")
        raise SystemExit(f"'zipfiles' table not found in {db_path.name}.")

    # --- normalize column names to str ---
    raw_cols = [r[1] for r in cur.execute('PRAGMA table_info("zipfiles")')]
    cols = [(c.decode("utf-8", "ignore") if isinstance(c, (bytes, bytearray)) else c) for c in raw_cols]

    if "name" not in cols or "content" not in cols:
        raise SystemExit(f"'zipfiles' must have columns 'name' and 'content'. Found: {cols}")

    print(f"🔎 DB: {db_path.name} | table: zipfiles | cols: {cols}")
    print("   Exporting to plain text…")

    written = 0
    with OUT_TXT.open("w", encoding="utf-8", newline="\n") as ftxt, \
         OUT_TSV.open("w", encoding="utf-8", newline="\n") as ftsv:

        ftsv.write("source\tinner_name\ttext_sample\n")

        # row values still come as bytes (because of text_factory=bytes)
        for name, blob in tqdm(cur.execute('SELECT "name","content" FROM "zipfiles"'),
                               unit="files", mininterval=0.5):
            # decode the source file name (bytes -> str)
            if isinstance(name, (bytes, bytearray)):
                name = name.decode("utf-8", "ignore")

            if not isinstance(blob, (bytes, bytearray)):
                blob = b""

            for inner_name, text in iter_text_files_from_blob(name, blob):
                for raw_line in text.splitlines():
                    cleaned = clean_sub_line(raw_line)
                    if not cleaned:
                        continue
                    ftxt.write(cleaned + "\n")
                    ftsv.write(f"{name}\t{inner_name}\t{cleaned[:200].replace('\t',' ')}\n")
                    written += 1
                    if MAX_LINES and written >= MAX_LINES:
                        print(f"⛔ MAX_LINES reached: {MAX_LINES}")
                        print(f"✅ Wrote {written:,} lines to {OUT_TXT}")
                        conn.close()
                        return

    conn.close()
    print(f"✅ Wrote {written:,} lines to {OUT_TXT}")


def main():
    api = kaggle_auth()
    download_dataset(api)
    db = find_db(DL_DIR)
    export_text(db)

if __name__ == "__main__":
    main()
