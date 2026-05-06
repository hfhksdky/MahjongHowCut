import json
import pathlib
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from bilibili_wbi import sign_with_fresh_nav_keys  # noqa: E402


def main():
  cid = 39815512
  base_params = {"id": cid, "gaia_source": "main_web", "mobi_app": "pc", "from": "web"}
  signed = sign_with_fresh_nav_keys(base_params)
  q = urllib.parse.urlencode(signed)
  url = f"https://api.bilibili.com/x/article/view?{q}"
  req = urllib.request.Request(
    url,
    headers={"User-Agent": "Mozilla/5.0 Chrome/131", "Referer": "https://www.bilibili.com/"},
  )
  raw = urllib.request.urlopen(req, timeout=30).read()
  d = json.loads(raw.decode("utf-8"))
  print("code", d.get("code"), "msg", (d.get("message") or "")[:80])
  if d.get("code") != 0:
    sys.stdout.flush()
    return
  dd = d.get("data") or {}
  print("type_field", dd.get("type"))
  print("origin_image_urls count", len(dd.get("origin_image_urls") or []))
  print("image_urls count", len(dd.get("image_urls") or []))
  ct = dd.get("content") or ""
  print("content len", len(ct))
  print("content head", ct[:350].replace("\n", " "))
  # peek if JSON quill
  if ct.startswith("{"):
    try:
      jc = json.loads(ct)
      if isinstance(jc, dict) and "ops" in jc:
        imgs = []
        for op in jc.get("ops") or []:
          ins = op.get("insert")
          if isinstance(ins, dict):
            ni = ins.get("native-image")
            if isinstance(ni, dict) and ni.get("url"):
              imgs.append(ni["url"])
        print("quill native-image count", len(imgs))
        for u in imgs[:12]:
          print(u)
    except json.JSONDecodeError:
      print("json parse failed for content")


if __name__ == "__main__":
  main()
