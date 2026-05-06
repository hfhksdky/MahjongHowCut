"""Probe bilibili read/cv HTML for embedded JSON."""
import json
import re
import urllib.request

URL = "https://www.bilibili.com/read/cv39815512"
req = urllib.request.Request(
  URL,
  headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0",
    "Referer": "https://www.bilibili.com/",
    "Accept-Language": "zh-CN,zh;q=0.9",
  },
)
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
print("len", len(html))
for name in ("__NEXT_DATA__", "__INITIAL_STATE__", "preloadState", "__RENDER_DATA"):
  print(name, html.find(name))

m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.+?)</script>', html, re.S)
if m:
  data = json.loads(m.group(1))
  print("NEXT_DATA top keys:", list(data.keys()))
  blob = json.dumps(data, ensure_ascii=False)
  print("snippet:", blob[:2000])
