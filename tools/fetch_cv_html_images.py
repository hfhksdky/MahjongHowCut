"""One-off: probe Bilibili cv HTML for embedded image URLs."""
import re
import urllib.request

URL = "https://www.bilibili.com/read/cv39815512/"
req = urllib.request.Request(
  URL,
  headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com/",
  },
)
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
print("len", len(html))
urls = set(re.findall(r"https://i\d\.hdslb\.com[^\s\"'<>]+", html))
print("hdslb image urls", len(urls))
for u in sorted(urls)[:40]:
  print(u)
