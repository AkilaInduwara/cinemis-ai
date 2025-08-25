# build_sub_index.py — Resumable, dedupe-safe builder for 8GB RAM
from __future__ import annotations
from pathlib import Path
from collections import defaultdict, deque
import argparse, re, json, pickle, os, gc, sys, hashlib
from typing import Iterator, Tuple, Dict, Any, List, Set

import faiss
import numpy as np
from tqdm import tqdm
from sentence_transformers import SentenceTransformer

# ---------- Paths ----------
PROJECT   = Path(__file__).resolve().parent
TXT_PATH  = PROJECT / "data" / "opus_hf" / "opensubtitles_en.txt"
TSV_PATH  = PROJECT / "data" / "opus_hf" / "opensubtitles_en_meta.tsv"

OUT_DIR    = PROJECT / "data" / "subs_index"
FAISS_PATH = OUT_DIR / "subs_index.faiss"
META_JL    = OUT_DIR / "meta_shards"
CFG_PATH   = OUT_DIR / "subs_index_config.json"

# progress state
PROG_DIR          = OUT_DIR / "progress"
SEEN_FILES_TXT    = PROG_DIR / "seen_files.txt"     # processed source::inner_name
SEEN_WORKS_TXT    = PROG_DIR / "seen_works.txt"     # processed Title|S|E|Year
SEEN_CHUNKS_TXT   = PROG_DIR / "seen_chunks.txt"    # hashes of (work_key + chunk), optional

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

# ---------- Regex ----------
FEXT_RE    = re.compile(r"\.(srt|sub|txt|vtt|gz|zip)$", re.I)
SEAS_EP_RE = re.compile(r"\bS?(\d{1,2})[EEx](\d{1,2})\b", re.I)
YEAR_RE    = re.compile(r"\b(19|20)\d{2}\b")
SEP_RE     = re.compile(r"[\._]+")
WS_RE      = re.compile(r"\s+")

def norm_ws(s: str) -> str:
    return WS_RE.sub(" ", s).strip()

def parse_title_fields(source: str, inner_name: str) -> Dict[str, Any]:
    raw = (inner_name or source or "")
    base = FEXT_RE.sub("", raw.split("/")[-1].split("\\")[-1])
    base = SEP_RE.sub(" ", base)
    year = None
    m = YEAR_RE.search(base)
    if m: year = m.group(0)
    season = episode = None
    m = SEAS_EP_RE.search(base)
    if m:
        season, episode = int(m.group(1)), int(m.group(2))
        base = base[:m.start()].strip()
    base = re.sub(r"[\[\(\{].*?[\]\)\}]", "", base)
    title = norm_ws(base).title()
    return {
        "title_guess": title or None,
        "year_guess": year,
        "season": season,
        "episode": episode,
        "source": source,
        "inner_name": inner_name
    }

def load_set(path: Path) -> Set[str]:
    if not path.exists(): return set()
    with path.open("r", encoding="utf-8") as f:
        return {ln.strip() for ln in f if ln.strip()}

def append_set(path: Path, items: List[str]) -> None:
    if not items: return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for it in items:
            f.write(it + "\n")

def stream_txt_and_meta() -> Iterator[Tuple[str, str, str]]:
    if not TXT_PATH.exists() or not TSV_PATH.exists():
        print(f"❌ Missing inputs:\n- {TXT_PATH}\n- {TSV_PATH}", file=sys.stderr)
        raise SystemExit(1)
    with TXT_PATH.open("r", encoding="utf-8", errors="ignore") as ftxt, \
         TSV_PATH.open("r", encoding="utf-8", errors="ignore") as ftsv:
        _ = ftsv.readline()  # header
        for txt_line, meta_line in zip(ftxt, ftsv):
            txt = txt_line.strip()
            if not txt: continue
            parts = meta_line.rstrip("\n").split("\t")
            if len(parts) < 2: continue
            source, inner_name = parts[0], parts[1]
            yield txt, source, inner_name

def hash_chunk(work_key: str, chunk: str) -> str:
    h = hashlib.sha1()
    h.update(work_key.encode("utf-8", errors="ignore"))
    h.update(b"\x00")
    h.update(chunk.encode("utf-8", errors="ignore"))
    return h.hexdigest()

def build_pass(
    lines_per_window: int,
    stride: int,
    min_chars: int,
    batch_windows: int,
    target_new_works: int,
    max_windows_per_file: int,
    use_chunk_dedupe: bool = True,
):
    # dirs
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    META_JL.mkdir(parents=True, exist_ok=True)
    PROG_DIR.mkdir(parents=True, exist_ok=True)

    # progress sets
    seen_files   = load_set(SEEN_FILES_TXT)     # file keys: "source::inner"
    seen_works   = load_set(SEEN_WORKS_TXT)     # "Title|S|E|Year"
    seen_chunks  = load_set(SEEN_CHUNKS_TXT) if use_chunk_dedupe else set()

    # additions this pass
    new_files_written: List[str] = []
    new_works_written: List[str] = []
    new_chunks_written: List[str] = []

    print(f"🧠 Model: {MODEL_NAME}")
    print(f"🎯 Target NEW works this pass: {target_new_works}")
    print(f"⚙️  window={lines_per_window}, stride={stride}, min_chars={min_chars}, batch_windows={batch_windows}")
    print(f"⚙️  cap per file={max_windows_per_file}, chunk_dedupe={use_chunk_dedupe}")
    print(f"📈 already have: seen_files={len(seen_files)} | seen_works={len(seen_works)} | seen_chunks={len(seen_chunks)}")

    model = SentenceTransformer(MODEL_NAME)

    # open or create FAISS (cosine via normalized/IP)
    index = faiss.read_index(str(FAISS_PATH)) if FAISS_PATH.exists() else None
    if index is not None:
        print(f"🔄 Appending to FAISS (ntotal={index.ntotal})")
    else:
        print("🆕 Creating FAISS on first batch…")

    # state for this pass
    buffers: Dict[str, deque] = defaultdict(lambda: deque(maxlen=lines_per_window))
    wins_per_file: Dict[str, int] = defaultdict(int)
    files_touched: Set[str] = set()  # <-- NEW: mark all files we emitted from
    works_seen_this_pass: Set[str] = set()

    # batching
    batch_texts: List[str] = []
    batch_meta:  List[Dict[str, Any]] = []

    shard_idx = len(list(META_JL.glob("meta_pass_*.jsonl")))
    shard_path = META_JL / f"meta_pass_{shard_idx:04d}.jsonl"
    shard_f = shard_path.open("w", encoding="utf-8")

    def flush_batch():
        nonlocal index, batch_texts, batch_meta
        if not batch_texts:
            return
        X = model.encode(
            batch_texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
            batch_size=min(256, max(64, batch_windows // 4)),
            show_progress_bar=False
        ).astype("float32")
        if index is None:
            d = X.shape[1]
            index = faiss.IndexFlatIP(d)
            print(f"✅ Created FAISS IndexFlatIP(d={d})")
        index.add(X)
        for m in batch_meta:
            shard_f.write(json.dumps(m, ensure_ascii=False) + "\n")
        batch_texts.clear()
        batch_meta.clear()
        del X
        gc.collect()

    produced_works = 0
    last_key = None

    for line, src, inner in tqdm(stream_txt_and_meta(), desc="📖 Reading", unit="line", mininterval=0.5):
        key_file = f"{src}::{inner}"
        if key_file in seen_files:
            continue  # whole file already done in a previous pass

        # stop if we reached our per-pass quota of NEW works
        if produced_works >= target_new_works:
            break

        buf = buffers[key_file]
        buf.append(line)
        if len(buf) < lines_per_window:
            last_key = key_file
            continue

        # make a window, slide
        chunk = norm_ws(" ".join(buf))
        for _ in range(stride):
            if buf: buf.popleft()
        if len(chunk) < min_chars:
            last_key = key_file
            continue

        meta = parse_title_fields(src, inner)
        work_key = f"{meta.get('title_guess') or 'Unknown'}|{meta.get('season') or ''}|{meta.get('episode') or ''}|{meta.get('year_guess') or ''}"

        # HARD DEDUPE by work: if work is already covered from earlier passes, skip entirely
        if work_key in seen_works:
            # we still want to mark this file as "touched" if we produced any window (to avoid revisits)
            # but since we don't add a window, we only mark at end if wins_per_file>0
            last_key = key_file
            continue

        # optional content dedupe: avoid embedding exact same chunk for this work again
        if use_chunk_dedupe:
            h = hash_chunk(work_key, chunk[:512])
            if h in seen_chunks:
                last_key = key_file
                continue
            seen_chunks.add(h)
            new_chunks_written.append(h)

        # record first time we see a new work
        if work_key not in works_seen_this_pass:
            works_seen_this_pass.add(work_key)
            produced_works += 1
            new_works_written.append(work_key)

        # batch add
        batch_texts.append(chunk[:512])
        batch_meta.append(meta)
        wins_per_file[key_file] += 1
        files_touched.add(key_file)

        # cap windows per file to spread coverage wide
        if wins_per_file[key_file] >= max_windows_per_file:
            # mark file as fully done so it won't reappear next pass
            if key_file not in seen_files:
                seen_files.add(key_file)
                new_files_written.append(key_file)

        if len(batch_texts) >= batch_windows:
            flush_batch()

        last_key = key_file

    # final flush and close
    flush_batch()
    shard_f.close()

    # --- CRITICAL: mark ALL touched files as seen (even if < max_per_file or ended early) ---
    for k, n in wins_per_file.items():
        if n > 0 and k not in seen_files:
            seen_files.add(k)
            new_files_written.append(k)

    # persist progress
    append_set(SEEN_FILES_TXT, new_files_written)
    append_set(SEEN_WORKS_TXT, new_works_written)
    if use_chunk_dedupe:
        append_set(SEEN_CHUNKS_TXT, new_chunks_written)

    # persist FAISS
    if index is None or index.ntotal == 0:
        print("❌ Nothing added; try lowering --min-chars or check inputs.", file=sys.stderr)
        raise SystemExit(1)
    faiss.write_index(index, str(FAISS_PATH))

    # config
    cfg = {
        "model": MODEL_NAME,
        "lines_per_window": lines_per_window,
        "stride": stride,
        "min_chars": min_chars,
        "batch_windows": batch_windows,
        "max_windows_per_file": max_windows_per_file,
        "passes": len(list(META_JL.glob('meta_pass_*.jsonl'))),
        "faiss_ntotal": index.ntotal,
        "seen_files": len(load_set(SEEN_FILES_TXT)),
        "seen_works": len(load_set(SEEN_WORKS_TXT)),
        "seen_chunks": len(load_set(SEEN_CHUNKS_TXT)) if use_chunk_dedupe else None,
        "shards_dir": str(META_JL),
    }
    with CFG_PATH.open("w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)

    print("✅ PASS DONE")
    print(f"   new works this pass: {len(new_works_written)}")
    print(f"   files touched:       {len(files_touched)} (now marked seen)")
    print(f"   total works seen:    {cfg['seen_works']}")
    print(f"   FAISS vectors:       {cfg['faiss_ntotal']}")
    print(f"   wrote shard:         {shard_path.name}")

def finalize():
    """Merge all jsonl shards into one pickle for fast loading at runtime."""
    if not META_JL.exists():
        print("❌ No meta_shards folder found.", file=sys.stderr)
        raise SystemExit(1)
    shard_paths = sorted(META_JL.glob("meta_pass_*.jsonl"))
    if not shard_paths:
        print("❌ No shards to finalize.", file=sys.stderr)
        raise SystemExit(1)

    all_meta: List[Dict[str, Any]] = []
    for p in shard_paths:
        with p.open("r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    all_meta.append(json.loads(line))
    with (OUT_DIR / "subs_index_meta.pkl").open("wb") as f:
        pickle.dump(all_meta, f, protocol=pickle.HIGHEST_PROTOCOL)

    print(f"✅ Finalized metadata: {len(all_meta)} rows → {OUT_DIR/'subs_index_meta.pkl'}")

def main():
    ap = argparse.ArgumentParser(description="Build subtitle FAISS in dedupe-safe multi-passes")
    ap.add_argument("--target-new-works", type=int, default=12000,
                    help="Aim to cover this many NEW (title/season/episode/year) in THIS pass.")
    ap.add_argument("--lines-per-window", type=int, default=6)
    ap.add_argument("--stride", type=int, default=3)
    ap.add_argument("--min-chars", type=int, default=80)
    ap.add_argument("--batch-windows", type=int, default=1000)
    ap.add_argument("--max-per-file", type=int, default=8)
    ap.add_argument("--no-chunk-dedupe", action="store_true",
                    help="Disable chunk-level dedupe (saves I/O, allows near-duplicate windows).")
    ap.add_argument("--finalize", action="store_true", help="Merge jsonl shards → subs_index_meta.pkl")
    args = ap.parse_args()

    if args.finalize:
        finalize()
    else:
        build_pass(
            lines_per_window=args.lines_per_window,
            stride=args.stride,
            min_chars=args.min_chars,
            batch_windows=args.batch_windows,
            target_new_works=args.target_new_works,
            max_windows_per_file=args.max_per_file,
            use_chunk_dedupe=(not args.no_chunk_dedupe),
        )

if __name__ == "__main__":
    main()
