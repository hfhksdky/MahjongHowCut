"""Download q1..q6 images from a local URL manifest (no article/view API)."""
from __future__ import annotations

import argparse
import json
import pathlib
import urllib.request


def _get(url: str, dest: pathlib.Path) -> None:
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
  p = argparse.ArgumentParser()
  p.add_argument("--manifest", type=pathlib.Path, default=pathlib.Path("data/cv39815512_hand_image_urls.json"))
  p.add_argument("--out-dir", type=pathlib.Path, default=pathlib.Path("assets/extracted_cv39815512"))
  args = p.parse_args()

  data = json.loads(args.manifest.read_text(encoding="utf-8"))
  imgs = data.get("images") or {}
  args.out_dir.mkdir(parents=True, exist_ok=True)

  for qid in sorted(imgs.keys(), key=lambda x: int(x[1:])):
    url = imgs[qid]
    ext = url.rsplit(".", 1)[-1].split("@", 1)[0]
    if ext not in {"png", "jpg", "jpeg", "webp"}:
      ext = "png"
    dest = args.out_dir / f"{qid}.{ext}"
    print(qid, "->", dest)
    _get(url, dest)

  print("Done.")


if __name__ == "__main__":
  main()
