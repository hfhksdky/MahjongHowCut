import json
import urllib.request

def get(url: str) -> bytes:
  req = urllib.request.Request(
    url,
    headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.bilibili.com/"},
  )
  return urllib.request.urlopen(req, timeout=25).read()


def main():
  for u in [
    "https://api.bilibili.com/x/article/info?id=39815512&mobi_app=pc&from=web",
    "https://api.bilibili.com/x/article/list/web/articles?ids=39815512&mobi_app=pc&from=web",
  ]:
    try:
      raw = get(u)
      data = json.loads(raw.decode("utf-8"))
      print(u, "code", data.get("code"), "msg", data.get("message"))
      if data.get("code") == 0 and data.get("data"):
        print("data keys", list(data["data"].keys())[:25])
    except Exception as e:
      print(u, e)


if __name__ == "__main__":
  main()
