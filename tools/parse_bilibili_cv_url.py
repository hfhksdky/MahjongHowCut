"""Print numeric column cv id from Bilibili URL, opus page, or plain 'cv12345' text."""
from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request


def parse_cv_id_from_string(text: str) -> int | None:
  t = text.strip()
  m = re.search(r"cv(\d+)", t, re.I)
  if m:
    return int(m.group(1))
  m = re.search(r"/read/(?:cv)?(\d+)", t, re.I)
  if m:
    return int(m.group(1))
  m = re.search(r"id=(\d+)", t)
  if m:
    return int(m.group(1))
  return None


_OPUS_RE = re.compile(r"bilibili\.com/opus/(\d+)", re.I)


def _fetch_opus_html(opus_id: str) -> str:
  url = f"https://www.bilibili.com/opus/{opus_id}"
  req = urllib.request.Request(
    url,
    headers={
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0",
      "Referer": "https://www.bilibili.com/",
      "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    },
    method="GET",
  )
  with urllib.request.urlopen(req, timeout=45) as resp:
    return resp.read().decode("utf-8", errors="replace")


def parse_cv_id_from_opus_page(url_or_text: str) -> int | None:
  m = _OPUS_RE.search(url_or_text.strip())
  if not m:
    return None
  opus_id = m.group(1)
  html = _fetch_opus_html(opus_id)
  href_cvs = [int(x) for x in re.findall(r"/read/(?:cv)?(\d{5,})", html, re.I)]
  if href_cvs:
    return href_cvs[-1]
  bare = [int(x) for x in re.findall(r"\bcv(\d{5,})\b", html, re.I)]
  if bare:
    return bare[-1]
  return None


def parse_cv_id(text: str) -> int:
  direct = parse_cv_id_from_string(text)
  if direct is not None:
    return direct
  if _OPUS_RE.search(text.strip()):
    from_opus = parse_cv_id_from_opus_page(text)
    if from_opus is not None:
      return from_opus
    raise ValueError(
      "Fetched opus HTML but found no cv id (page may require login / captcha). "
      "Open the opus in a browser and search for 'cv' or use read/cv URL."
    )
  raise ValueError(f"Could not find cv id in: {text!r}")


def main() -> None:
  ap = argparse.ArgumentParser(
    description="Extract Bilibili column cv id from read/cv URL, opus URL (fetches page), or 'cv123'."
  )
  ap.add_argument("url_or_cv", help='e.g. read/cv…, opus/…, or "cv12345"')
  args = ap.parse_args()
  try:
    print(parse_cv_id(args.url_or_cv))
  except (ValueError, urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
    print(e, file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
  main()
