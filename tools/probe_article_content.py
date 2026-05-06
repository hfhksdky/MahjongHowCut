"""List images + Q headings order from signed article/view."""
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from bilibili_wbi import sign_with_fresh_nav_keys  # noqa: E402


def main():
  cid = 39815512
  signed = sign_with_fresh_nav_keys({"id": cid, "gaia_source": "main_web", "mobi_app": "pc", "from": "web"})
  q = urllib.parse.urlencode(signed)
  url = f"https://api.bilibili.com/x/article/view?{q}"
  req = urllib.request.Request(
    url,
    headers={"User-Agent": "Mozilla/5.0 Chrome/131", "Referer": "https://www.bilibili.com/"},
  )
  time.sleep(1.6)
  d = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
  if d.get("code") != 0:
    print("API error:", d.get("code"), d.get("message"))
    return
  ct = d["data"]["content"]
  imgs = re.findall(r"<img[^>]+src=[\"']([^\"']+)[\"']", ct)
  print("img count", len(imgs))
  for i, u in enumerate(imgs, 1):
    print(i, ("https:" + u) if u.startswith("//") else u)
  markers = list(re.finditer(r"<p>Q(\d+)[:：]</p>", ct))
  print("Q paragraph markers", [(m.group(1), m.start()) for m in markers])


if __name__ == "__main__":
  main()
