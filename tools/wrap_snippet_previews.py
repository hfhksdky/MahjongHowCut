"""
Write sibling *.preview.html for each tools/_snippet_cv*.html so images using // URLs load when opened from disk.

Usage (from repo mahjong-tile-efficiency-poc):
  python tools/wrap_snippet_previews.py
"""

from __future__ import annotations

import pathlib
import sys

_ROOT = pathlib.Path(__file__).resolve().parents[1]
_TOOLS = _ROOT / "tools"
sys.path.insert(0, str(_TOOLS))
from fetch_cv_question_images import _wrap_snippet_for_browser  # noqa: E402


def main() -> None:
  n = 0
  for path in sorted(_TOOLS.glob("_snippet_cv*.html")):
    if path.name.endswith(".preview.html"):
      continue
    raw = path.read_text(encoding="utf-8")
    out = path.with_name(path.stem + ".preview.html")
    out.write_text(_wrap_snippet_for_browser(raw), encoding="utf-8")
    print("wrote", out.relative_to(_ROOT))
    n += 1
  print("done,", n, "preview files")


if __name__ == "__main__":
  main()
