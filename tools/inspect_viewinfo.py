import json
import urllib.request

req = urllib.request.Request(
  "https://api.bilibili.com/x/article/viewinfo?id=39815512&mobi_app=pc&from=web",
  headers={"User-Agent": "Mozilla/5.0 Chrome/131", "Referer": "https://www.bilibili.com/"},
)
d = json.loads(urllib.request.urlopen(req, timeout=20).read().decode())
data = d["data"]
for k in sorted(data.keys()):
  if k in {"image_urls", "origin_image_urls", "video_url", "type", "banner_url", "title", "pre", "next"}:
    print(k, data.get(k))
