"""
Auto-fill placeholder questions from downloaded snippet HTML files.

Rules:
- only update questions that still contain placeholder prompt/answer
- keep existing manual-edited fields untouched
- derive answer from `书中解答/书中解析`
- derive choices from answer-line bracket candidates or `浮牌价值` chain
"""
from __future__ import annotations

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
QPATH = ROOT / "data" / "questions.json"


def strip_tags(html: str) -> str:
  s = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
  s = re.sub(r"<[^>]+>", "", s)
  s = s.replace("&nbsp;", " ").replace("&gt;", ">").replace("&lt;", "<").replace("&amp;", "&")
  s = re.sub(r"[ \t]+", " ", s)
  s = re.sub(r"\n{2,}", "\n", s)
  return s.strip()


def parse_answer_value(raw: str) -> str:
  s = raw.strip()
  s = re.sub(r"^(?:切|打)\s*", lambda m: m.group(0), s)  # keep prefix
  s = re.split(r"\s*(?:\d+向听|聽牌|听牌|【)", s, maxsplit=1)[0].strip()
  s = re.sub(r"[，。；;：:]+$", "", s)
  return s or raw.strip()


def tile_tokens(text: str) -> list[str]:
  # includes m/p/s/z tiles + honors + common operation words
  out: list[str] = []
  for t in re.findall(r"(?:[0-9][mpsz]|[東南西北白發中])", text):
    if t not in out:
      out.append(t)
  return out


def choices_from_segment(seg_plain: str, answer: str) -> list[str]:
  choices: list[str] = []

  # 1) use candidates from x-count bracket
  m = re.search(r"【([^】]+)】", seg_plain)
  if m:
    for t in tile_tokens(m.group(1)):
      if t not in choices:
        choices.append(t)

  # 2) use 浮牌价值 chain
  for m2 in re.finditer(r"浮牌价值[:：]\s*([^\n]+)", seg_plain):
    for t in tile_tokens(m2.group(1)):
      if t not in choices:
        choices.append(t)

  # 3) "打X或者Y"
  for a, b in re.findall(r"打\s*([0-9mpsz東南西北白發中]+)\s*或者\s*([0-9mpsz東南西北白發中]+)", seg_plain):
    for t in (a, b):
      if t not in choices:
        choices.append(t)

  if answer not in choices:
    choices.insert(0, answer)

  # fallback
  if len(choices) < 2:
    other = "其他"
    if other == answer:
      other = "待補"
    choices.append(other)
  return choices[:6]


def parse_question_header_context(seg_plain: str) -> dict[str, str]:
  head = ""
  for ln in seg_plain.splitlines():
    t = ln.strip()
    if t:
      head = t
      break
  if not head:
    return {}

  out: dict[str, str] = {}
  m_round = re.search(r"([东東南西北]\s*\d+\s*局)", head)
  if m_round:
    out["round"] = re.sub(r"\s+", "", m_round.group(1))
  m_turn = re.search(r"(\d+\s*巡目?|\d+\s*巡)", head)
  if m_turn:
    out["turn"] = re.sub(r"\s+", "", m_turn.group(1))
  m_seat = re.search(r"([东東南西北]家)", head)
  if m_seat:
    out["seatWind"] = m_seat.group(1).replace("东", "東")
  m_discard = re.search(r"([上下对對]家打出\s*[0-9mpsz東南西北白發中]+)", head)
  if m_discard:
    out["event"] = re.sub(r"\s+", "", m_discard.group(1)).replace("对", "對")
  return out


def segment_by_qnum(html: str) -> list[tuple[int, str]]:
  marks = list(re.finditer(r"Q\s*(\d{1,3})", html, flags=re.I))
  out: list[tuple[int, str]] = []
  for i, m in enumerate(marks):
    qn = int(m.group(1))
    start = m.start()
    end = marks[i + 1].start() if i + 1 < len(marks) else len(html)
    out.append((qn, html[start:end]))
  return out


def main() -> None:
  data = json.loads(QPATH.read_text(encoding="utf-8"))
  by_id = {q["id"]: q for q in data["questions"]}

  updated = 0
  touched = 0

  for sp in sorted((ROOT / "tools").glob("_snippet_cv*.html")):
    html = sp.read_text(encoding="utf-8", errors="ignore")
    for qn, seg_html in segment_by_qnum(html):
      qid = f"q{qn}"
      q = by_id.get(qid)
      if not q:
        continue
      touched += 1

      seg_plain = strip_tags(seg_html)
      m_ans = re.search(r"书中(?:解答|解析)\s*[:：]\s*([^\n]+)", seg_plain)
      if not m_ans:
        continue
      ans_raw = m_ans.group(1).strip()
      answer = parse_answer_value(ans_raw)
      choices = choices_from_segment(seg_plain, answer)
      parsed_ctx = parse_question_header_context(seg_plain)
      is_naki = bool(re.search(r"[吃碰槓杠]", answer))
      generic_prompt = "依題圖與專欄解析，選擇本題最優先的打牌／操作。"

      # Update only placeholders
      prompt = str(q.get("prompt", ""))
      if "自動骨架" in prompt or "自动骨架" in prompt or "待補" in prompt:
        q["prompt"] = generic_prompt
      if parsed_ctx and (q.get("context") in ({}, None) or not isinstance(q.get("context"), dict)):
        q["context"] = parsed_ctx
      if parsed_ctx and str(q.get("prompt", "")).strip() == generic_prompt and is_naki:
        base_ctx = []
        if parsed_ctx.get("round"):
          base_ctx.append(parsed_ctx["round"])
        if parsed_ctx.get("seatWind"):
          base_ctx.append(parsed_ctx["seatWind"])
        if parsed_ctx.get("turn"):
          base_ctx.append(parsed_ctx["turn"])
        if parsed_ctx.get("event"):
          base_ctx.append(parsed_ctx["event"])
        ctx_text = " ".join(base_ctx).strip()
        q["prompt"] = (
          f"{ctx_text}。請先判斷是否鳴牌，再選擇本題最優先操作。"
          if ctx_text
          else "此題為鳴牌判斷題：請先判斷是否鳴牌，再選擇本題最優先操作。"
        )

      old_choices = q.get("choices") or []
      if old_choices == ["待補答案A", "待補答案B"] or "待補" in "".join(map(str, old_choices)):
        q["choices"] = choices
      elif is_naki:
        # 鳴牌題避免把「聽牌待牌」誤當作選項，至少提供「鳴 / 不鳴」決策。
        cur = [str(x).strip() for x in old_choices if str(x).strip()]
        if cur and all(re.fullmatch(r"[0-9][mpsz]|[東南西北白發中]", c) for c in cur):
          no_call = "不鳴（不吃／不碰）"
          q["choices"] = [answer, no_call]

      if str(q.get("answer", "")).startswith("待補"):
        q["answer"] = answer

      if str(q.get("answerLine", "")).startswith("待補"):
        q["answerLine"] = f"書中解析：{ans_raw}"

      if str(q.get("solutionText", "")).startswith("待補"):
        # take first 2 non-empty lines after answer line
        after = seg_plain.split(m_ans.group(0), 1)[-1].strip()
        lines = [ln.strip() for ln in after.splitlines() if ln.strip()]
        q["solutionText"] = " ".join(lines[:2]) if lines else "待補：請依原文填入解說。"

      tags = [str(x) for x in (q.get("tags") or [])]
      if "待補" in tags:
        tags = [t for t in tags if t != "待補"]
        if "何切" not in tags:
          tags.append("何切")
        if "自動抽取" not in tags:
          tags.append("自動抽取")
        q["tags"] = tags

      if q.get("difficulty") == "待定":
        q["difficulty"] = "中級"

      updated += 1

  QPATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
  print(f"touched={touched} updated={updated}")


if __name__ == "__main__":
  main()
