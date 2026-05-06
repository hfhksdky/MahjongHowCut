"""Minimal Bilibili Web WBI signer (for API queries)."""
from __future__ import annotations

import hashlib
import json
import time
import urllib.parse
import urllib.request

MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
]


def _mixin_key(img_key: str, sub_key: str) -> str:
  raw = img_key + sub_key
  return "".join(raw[i] for i in MIXIN_KEY_ENC_TAB)[:32]


def fetch_nav_wbi_img_keys() -> tuple[str, str]:
  """Resolved img_key / sub_key for WBi signing (one /nav request)."""
  req = urllib.request.Request(
    "https://api.bilibili.com/x/web-interface/nav",
    headers={
      "User-Agent": "Mozilla/5.0 Chrome/131",
      "Referer": "https://www.bilibili.com/",
    },
  )
  data = json.loads(urllib.request.urlopen(req, timeout=20).read().decode())
  w = data.get("data") or {}
  wbi = w.get("wbi_img") or {}
  img_url = wbi.get("img_url") or ""
  sub_url = wbi.get("sub_url") or ""
  img_key = img_url.rsplit("/", 1)[-1].split(".")[0]
  sub_key = sub_url.rsplit("/", 1)[-1].split(".")[0]
  return img_key, sub_key


def encode_w_rid(params: dict[str, object], img_key: str, sub_key: str, wts: int | None = None) -> dict[str, str]:
  mixin = _mixin_key(img_key, sub_key)
  p = dict(params)
  ts = round(time.time()) if wts is None else int(wts)
  p["wts"] = ts
  # filter characters in values that break signing - common B rule: ints as str OK
  out: dict[str, str] = {k: str(v) for k, v in sorted(p.items()) if v is not None}
  query = urllib.parse.urlencode(out, safe="*")
  decoded = urllib.parse.unquote(query)
  w_rid = hashlib.md5((decoded + mixin).encode("utf-8")).hexdigest()
  out["w_rid"] = w_rid
  return out


def sign_with_fresh_nav_keys(params: dict[str, object]) -> dict[str, str]:
  ik, sk = fetch_nav_wbi_img_keys()
  return encode_w_rid(params, ik, sk)


# Back-compat alias used in early probes
_fetch_nav_wbi_img = fetch_nav_wbi_img_keys
