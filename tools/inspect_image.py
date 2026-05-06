"""Print image size; quick helper before choosing --bbox for crop_question_panel.py."""
import argparse

from PIL import Image


def main():
  p = argparse.ArgumentParser()
  p.add_argument("path")
  args = p.parse_args()
  im = Image.open(args.path)
  print(im.size, "mode", im.mode, args.path)


if __name__ == "__main__":
  main()
