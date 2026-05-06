"""
Read deduped Bilibili read/cv URLs (one per line), run fetch_cv_question_images.py per cv.

Usage (from mahjong-tile-efficiency-poc):
  python tools/batch_fetch_cv_from_url_list.py data/bilibili_readlist_cv_urls.txt

Options:
  --delay SEC   sleep between articles (default 18, helps avoid -509)
  --dry-run     print commands only
  --start N     skip first N URLs (resume)
  --count N     process at most N URLs from start
  --continue-on-error  keep going and print failed cv list
"""
from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]


def parse_cv_from_line(line: str) -> int | None:
  m = re.search(r"cv(\d+)", line.strip(), flags=re.I)
  return int(m.group(1)) if m else None


def load_urls(path: pathlib.Path) -> list[tuple[int, str]]:
  seen: set[int] = set()
  out: list[tuple[int, str]] = []
  for raw in path.read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
      continue
    cv = parse_cv_from_line(line)
    if cv is None:
      print(f"skip (no cv): {line!r}", file=sys.stderr)
      continue
    if cv in seen:
      continue
    seen.add(cv)
    out.append((cv, line))
  out.sort(key=lambda x: x[0])
  return out


def main() -> None:
  ap = argparse.ArgumentParser(description="Batch-download question images for many cv ids.")
  ap.add_argument("url_file", type=pathlib.Path, help="e.g. data/bilibili_readlist_cv_urls.txt")
  ap.add_argument("--delay", type=float, default=18.0, help="seconds between successful starts")
  ap.add_argument("--dry-run", action="store_true")
  ap.add_argument("--start", type=int, default=0, help="0-based index to start from (resume)")
  ap.add_argument("--count", type=int, default=None, help="max number of URLs to process from start")
  ap.add_argument("--continue-on-error", action="store_true", help="do not stop when one cv fails")
  args = ap.parse_args()

  pairs = load_urls(args.url_file)
  if not pairs:
    sys.exit("No URLs with cv id found.")

  fetch_script = ROOT / "tools" / "fetch_cv_question_images.py"
  if not fetch_script.is_file():
    sys.exit(f"Missing {fetch_script}")

  total = len(pairs)
  end_exclusive = total if args.count is None else min(total, args.start + max(0, args.count))
  print(f"Total unique cv: {total}", flush=True)
  print(f"Processing range: [{args.start}, {end_exclusive})", flush=True)
  failed: list[tuple[int, int]] = []
  for idx, (cv, url) in enumerate(pairs):
    if idx < args.start:
      continue
    if idx >= end_exclusive:
      break
    out_dir = ROOT / "assets" / f"extracted_cv{cv}"
    save_html = ROOT / "tools" / f"_snippet_cv{cv}.html"
    cmd = [
      sys.executable,
      str(fetch_script),
      "--cv",
      str(cv),
      "--out-dir",
      str(out_dir),
      "--save-html",
      str(save_html),
    ]
    print(f"\n[{idx + 1}/{len(pairs)}] cv{cv}", flush=True)
    print(" ", url, flush=True)
    print(" ", " ".join(cmd), flush=True)
    if args.dry_run:
      continue
    r = subprocess.run(cmd, cwd=str(ROOT))
    if r.returncode != 0:
      print(f"FAILED cv{cv} exit {r.returncode}", flush=True)
      failed.append((cv, r.returncode))
      if not args.continue_on_error:
        print(f"Stop on first failure. Resume with --start {idx}", flush=True)
        sys.exit(r.returncode)
    if idx + 1 < end_exclusive:
      time.sleep(max(0.0, args.delay))

  print("\nDone.", flush=True)
  if failed:
    print("Failed CV list:", flush=True)
    for cv, rc in failed:
      print(f"  cv{cv} (exit {rc})", flush=True)
    if args.continue_on_error:
      sys.exit(0)


if __name__ == "__main__":
  main()
