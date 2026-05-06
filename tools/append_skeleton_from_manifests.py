"""
Append placeholder question entries from extracted manifest images.

Usage:
  python tools/append_skeleton_from_manifests.py
"""
from __future__ import annotations

import json
import pathlib
import re


ROOT = pathlib.Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "data" / "questions.json"
MANIFEST_GLOB = "assets/extracted_cv*/manifest.json"


def qnum_from_qid(qid: str) -> int | None:
  m = re.match(r"q(\d+)$", qid.strip(), flags=re.I)
  return int(m.group(1)) if m else None


def cv_from_question_image(path: str) -> str | None:
  m = re.search(r"assets/extracted_cv(\d+)/q\d+\.png$", str(path))
  return m.group(1) if m else None


def main() -> None:
  data = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
  questions: list[dict] = data.get("questions", [])
  existing_ids = {str(q.get("id")) for q in questions}
  by_id = {str(q.get("id")): q for q in questions}

  add_map: dict[int, dict] = {}
  latest_source_by_qid: dict[str, str] = {}
  for mp in sorted(ROOT.glob(MANIFEST_GLOB)):
    manifest = json.loads(mp.read_text(encoding="utf-8"))
    cv = str(manifest.get("cv") or mp.parent.name.replace("extracted_cv", ""))
    images = manifest.get("images") or {}
    for qid in images:
      qn = qnum_from_qid(qid)
      if qn is None:
        continue
      latest_source_by_qid[qid] = cv
      if qid in existing_ids:
        continue
      if qn in add_map:
        continue
      add_map[qn] = {
        "id": qid,
        "title": f"Q{qn}",
        "type": "choice",
        "context": {},
        "prompt": "請依題圖判斷最佳打牌（自動骨架；請用回報／校正補上正式選項與答案）",
        "choices": ["待補答案A", "待補答案B"],
        "answer": "待補答案A",
        "answerLine": "待補：請依原文填入書中解答。",
        "solutionText": "待補：請依原文填入解說；目前先提供題圖進練習流程。",
        "tags": ["待補", "何切"],
        "difficulty": "待定",
        "references": [
          {"label": f"Bilibili：cv{cv}", "url": f"https://www.bilibili.com/read/cv{cv}"}
        ],
        "questionImage": f"assets/extracted_cv{cv}/{qid}.png",
      }

  refreshed = 0
  for qid, cv in latest_source_by_qid.items():
    q = by_id.get(qid)
    if not q:
      continue
    desired_image = f"assets/extracted_cv{cv}/{qid}.png"
    old_image = str(q.get("questionImage") or "")
    old_cv = cv_from_question_image(old_image)
    if old_cv and old_cv != cv:
      q["questionImage"] = desired_image
      refs = q.get("references") or []
      if refs and isinstance(refs[0], dict):
        refs[0]["url"] = f"https://www.bilibili.com/read/cv{cv}"
        if str(refs[0].get("label", "")).startswith("Bilibili"):
          refs[0]["label"] = f"Bilibili：cv{cv}"
      else:
        q["references"] = [{"label": f"Bilibili：cv{cv}", "url": f"https://www.bilibili.com/read/cv{cv}"}]
      refreshed += 1

  new_items = [add_map[k] for k in sorted(add_map)]
  if not new_items and refreshed == 0:
    print("No new questions to append.")
    return

  questions.extend(new_items)
  questions.sort(
    key=lambda q: (qnum_from_qid(str(q.get("id"))) if qnum_from_qid(str(q.get("id"))) is not None else 999999)
  )
  data["questions"] = questions

  nums = [qnum_from_qid(str(q.get("id"))) for q in questions]
  nums = [n for n in nums if n is not None]
  if nums:
    data["sourceSet"] = f"何切 金 Q{min(nums)}-Q{max(nums)}"

  QUESTIONS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
  print(f"Appended {len(new_items)} skeleton questions; refreshed {refreshed} existing mappings. Max question now: Q{max(nums)}")


if __name__ == "__main__":
  main()
