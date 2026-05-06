"""
Download per-question figures from a Bilibili column (cv) via signed x/article/view.

Usage:
  python tools/fetch_cv_question_images.py --cv 39815512 --out-dir assets/extracted_cv39815512

Requires: stdlib only (WBI keys from /x/web-interface/nav).

Heuristics:

- **Classic HTML**: split by ``<p>Qk：</p>``; first ``<img src=...>`` in each block
  (skip common divider filename under ``bfs/article/``).
- **Quill JSON delta** (newer columns): ``data.content`` is JSON with ``ops``; each literal
  ``Q`` + number op is followed by ``native-image.url`` (``bfs/new_dyn/``).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from bilibili_wbi import sign_with_fresh_nav_keys  # noqa: E402

# Separator / line art image reused between blocks in this article layout
_DIVIDER_BASENAME = "02db465212d3c374a43c60fa2625cc1caeaab796.png"


def _wrap_snippet_for_browser(fragment: str) -> str:
  """Wrap raw article HTML so opening as a local file still resolves ``//host`` images to https."""
  return (
    "<!DOCTYPE html>\n"
    '<html lang="zh-Hans">\n<head>\n'
    '<meta charset="UTF-8" />\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
    '<base href="https://www.bilibili.com/" />\n'
    "<title>Bilibili column snippet (preview)</title>\n"
    "<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:1rem auto;"
    "padding:0 12px;line-height:1.5;} img{max-width:100%;height:auto;}</style>\n"
    "</head>\n<body>\n"
    + fragment.strip()
    + "\n</body>\n</html>\n"
  )


def _abs_img_url(src: str) -> str:
  if src.startswith("//"):
    return "https:" + src
  if src.startswith("http"):
    return src
  return "https:" + src


def _fetch_article_html(cv_id: int) -> tuple[dict, str]:
  """Pull article HTML; `-509` 時拉長間隔並重新拉取 nav mixin（較易被限流環境放行）。"""
  params = {"id": cv_id, "gaia_source": "main_web", "mobi_app": "pc", "from": "web"}
  last: dict | None = None
  for attempt in range(12):
    time.sleep(min(8, 2 + attempt))
    signed = sign_with_fresh_nav_keys(params)
    q = urllib.parse.urlencode(signed)
    url = f"https://api.bilibili.com/x/article/view?{q}"
    req = urllib.request.Request(
      url,
      headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0",
        "Referer": "https://www.bilibili.com/",
      },
    )
    raw = urllib.request.urlopen(req, timeout=45).read()
    last = json.loads(raw.decode("utf-8"))
    code = last.get("code")
    if code == 0:
      return last, last["data"]["content"]
    if code == -509:
      wait = min(90, 12 + attempt * 10)
      print(f"article/view -509, sleep {wait}s then retry (attempt {attempt + 1})", flush=True)
      time.sleep(wait)
      continue
    raise RuntimeError(f"article/view error {code}: {last.get('message')}")
  raise RuntimeError(f"article/view failed after retries: {last}")


def _first_hand_image_in_segment(segment_html: str) -> str | None:
  for m in re.finditer(r"<img[^>]+src=[\"']([^\"']+)[\"']", segment_html):
    u = _abs_img_url(m.group(1).strip())
    base = u.rsplit("/", 1)[-1]
    if base == _DIVIDER_BASENAME:
      continue
    if "bfs/article/" not in u and "bfs/new_dyn/" not in u:
      continue
    return u
  return None


def _is_likely_question_image_tag(img_tag: str) -> bool:
  """Filter obvious inline/supplemental figures (e.g. 455x50 waits chart)."""
  m_w = re.search(r"\bwidth\s*=\s*[\"']?(\d+)", img_tag, flags=re.I)
  m_h = re.search(r"\bheight\s*=\s*[\"']?(\d+)", img_tag, flags=re.I)
  if m_w and m_h:
    w = int(m_w.group(1))
    h = int(m_h.group(1))
    if w < 800 or h < 100:
      return False
  return True


def _map_questions_from_html_stream(content_html: str) -> dict[str, str]:
  """
  Parse mixed html stream in order:
  - detect Q markers like <p>Q11</p>, <p>Q11：</p>, plain "Q11"
  - detect img src
  - when an image appears without explicit marker, auto-increment last q number
    (works for some posts where one Q marker line is accidentally omitted)
  """
  token_re = re.compile(r"<p>\s*Q(\d+)[^<]*</p>|Q(\d+)(?=[^<]{0,24}<)|(<img[^>]+>)", flags=re.I)
  out: dict[str, str] = {}
  pending_qn: int | None = None
  last_assigned_qn: int | None = None
  for m in token_re.finditer(content_html):
    q1, q2, img_tag = m.group(1), m.group(2), m.group(3)
    if q1 or q2:
      pending_qn = int(q1 or q2)
      continue
    if not img_tag:
      continue
    src_m = re.search(r"src=[\"']([^\"']+)[\"']", img_tag, flags=re.I)
    if not src_m:
      continue
    src = src_m.group(1)
    url = _abs_img_url(src.strip())
    base = url.rsplit("/", 1)[-1]
    if base == _DIVIDER_BASENAME:
      continue
    if "bfs/article/" not in url and "bfs/new_dyn/" not in url:
      continue
    if pending_qn is not None:
      qn = pending_qn
      pending_qn = None
    elif last_assigned_qn is not None:
      if not _is_likely_question_image_tag(img_tag):
        continue
      qn = last_assigned_qn + 1
    else:
      # no way to infer index safely for first image without any marker
      continue
    out[f"q{qn}"] = url
    last_assigned_qn = qn
  return out


def _map_questions_from_quill_json(content: str) -> dict[str, str]:
  """cv39816653-style: outer JSON {\"ops\":[{\"insert\":\"Q7\"},...,{\"insert\":{\"native-image\":{url}}}}]}."""
  data = json.loads(content)
  ops = data.get("ops") or []
  out: dict[str, str] = {}
  pending_qn: str | None = None
  for op in ops:
    ins = op.get("insert")
    if isinstance(ins, str):
      for chunk in filter(None, re.split(r"\n+", ins)):
        stripped = chunk.strip()
        mq = re.match(r"^Q(\d+)\s*$", stripped, flags=re.I)
        if mq:
          pending_qn = mq.group(1)
          break
      continue
    if not isinstance(ins, dict):
      continue
    ni = ins.get("native-image")
    if not isinstance(ni, dict):
      continue
    url = ni.get("url")
    if pending_qn and isinstance(url, str) and url.strip():
      out[f"q{pending_qn}"] = _abs_img_url(url.strip())
      pending_qn = None
  return out


def _map_questions_to_urls(content_html: str) -> dict[str, str]:
  stripped = content_html.lstrip()
  if stripped.startswith("{") and '"ops"' in stripped[:300]:
    try:
      quill = _map_questions_from_quill_json(stripped)
    except json.JSONDecodeError:
      quill = {}
    if quill:
      return quill

  html_stream = _map_questions_from_html_stream(content_html)
  if html_stream:
    return html_stream

  markers = list(re.finditer(r"<p>\s*Q(\d+)\s*(?:[:：])?\s*</p>", content_html, flags=re.I))
  if not markers:
    raise ValueError("Could not parse article content (neither Quill ops nor supported HTML Q/image stream).")
  out: dict[str, str] = {}
  for i, m in enumerate(markers):
    qn = m.group(1)
    start = m.end()
    end = markers[i + 1].start() if i + 1 < len(markers) else len(content_html)
    segment = content_html[start:end]
    url = _first_hand_image_in_segment(segment)
    if not url:
      raise ValueError(f"No non-divider article image found for Q{qn}")
    out[f"q{qn}"] = url
  return out


def _download(url: str, dest: pathlib.Path) -> None:
  req = urllib.request.Request(
    url,
    headers={
      "User-Agent": "Mozilla/5.0 Chrome/131",
      "Referer": "https://www.bilibili.com/",
    },
  )
  dest.parent.mkdir(parents=True, exist_ok=True)
  with urllib.request.urlopen(req, timeout=60) as resp, dest.open("wb") as fp:
    fp.write(resp.read())


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--cv", type=int, default=None, help="專欄 id（數字）；與 --from-html 擇一")
  parser.add_argument("--from-html", type=pathlib.Path, default=None, help="已儲存的 data.content HTML，略過 article/view API")
  parser.add_argument("--out-dir", type=pathlib.Path, required=True)
  parser.add_argument("--manifest", type=pathlib.Path, default=None)
  parser.add_argument("--save-html", type=pathlib.Path, default=None, help="成功自 API 拉回時把 content 另存備查")
  args = parser.parse_args()

  api_meta: dict | None = None
  if args.from_html:
    html = args.from_html.read_text(encoding="utf-8")
  else:
    if args.cv is None:
      parser.error("--cv is required unless --from-html is set")
    api_meta, html = _fetch_article_html(args.cv)
    if args.save_html:
      args.save_html.parent.mkdir(parents=True, exist_ok=True)
      args.save_html.write_text(html, encoding="utf-8")
      print("Saved HTML snippet to", args.save_html)
      preview_path = args.save_html.with_name(args.save_html.stem + ".preview.html")
      preview_path.write_text(_wrap_snippet_for_browser(html), encoding="utf-8")
      print("Saved browser-openable preview to", preview_path)

  mapping = _map_questions_to_urls(html)

  manifest = {
    "cv": args.cv,
    "fromHtml": str(args.from_html) if args.from_html else None,
    "source_api": "local-html"
    if args.from_html
    else "https://api.bilibili.com/x/article/view (WBI-signed)",
    "images": {},
  }

  args.out_dir.mkdir(parents=True, exist_ok=True)

  for qid, url in sorted(mapping.items(), key=lambda kv: int(kv[0][1:])):
    ext = url.rsplit(".", 1)[-1].split("@", 1)[0]
    if ext not in {"png", "jpg", "jpeg", "webp"}:
      ext = "png"
    dest = args.out_dir / f"{qid}.{ext}"
    print("GET", qid, url, "->", dest)
    _download(url, dest)
    # Web app serves from repo root; relative path from mahjong-tile-efficiency-poc/
    rel = dest.as_posix()
    manifest["images"][qid] = {"url": url, "localRelative": rel}

  man_path = args.manifest or (args.out_dir / "manifest.json")
  man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
  print("Wrote", man_path)


if __name__ == "__main__":
  main()
