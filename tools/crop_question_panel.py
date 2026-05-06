"""
Crop a single question panel from a tall screenshot / composite image.

Use when you capture the full column body (multiple Q blocks in one PNG).
Specify pixel box (left, upper, right, lower) via --bbox PIL format.

Examples:
  python tools/crop_question_panel.py ^
    --input path/to/full_column.png ^
    --output assets/question_panels/q2.png ^
    --bbox 0 400 980 760
"""

import argparse
from pathlib import Path

from PIL import Image


def main():
  parser = argparse.ArgumentParser()
  parser.add_argument("--input", required=True)
  parser.add_argument("--output", required=True)
  parser.add_argument("--bbox", nargs=4, type=int, metavar=("L", "U", "R", "L2"), required=True)
  args = parser.parse_args()
  bbox = tuple(args.bbox)  # noqa: TID251 PIL wants L,U,R,L2
  if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
    raise SystemExit("bbox must satisfy right>left and lower>upper")

  src = Path(args.input)
  out = Path(args.output)
  out.parent.mkdir(parents=True, exist_ok=True)
  img = Image.open(src).convert("RGB")
  crop = img.crop(bbox)
  crop.save(out, format="PNG", optimize=True)
  print(f"Saved {out} ({crop.size[0]}x{crop.size[1]}) from {src}")


if __name__ == "__main__":
  main()
