import argparse
import json
import re
from pathlib import Path


def parse_questions(article_text: str, source_url: str):
  pattern = re.compile(r"Q(\d+)[:：]\s*(.*?)(?=\nQ\d+[:：]|\n本文禁止转载|\n本文禁止轉載|\Z)", re.S)
  questions = []
  for idx, block in pattern.findall(article_text):
    qid = f"q{idx}"
    title = f"Q{idx}"
    answer_match = re.search(r"(?:书中解答|書中解答)[:：]\s*(.+)", block)
    answer_line = f"書中解答：{answer_match.group(1).strip()}" if answer_match else "書中解答："
    solution = block
    if answer_match:
      solution = block[answer_match.end() :].strip()

    # Heuristic: Q5/Q6 often are action questions; keep choices editable later.
    q_type = "choice" if ("暗杠" in block or "暗槓" in block or "立直" in block) else "tile"
    base = {
      "id": qid,
      "title": title,
      "type": q_type,
      "context": {},
      "answer": "",
      "answerLine": answer_line,
      "solutionText": solution,
      "tags": [],
      "difficulty": "未分級",
      "references": [{"label": "Bilibili article", "url": source_url}],
      "questionImage": None,
    }

    if q_type == "tile":
      base["handTiles"] = []
      base["drawTile"] = ""
    else:
      pre_answer = block[: answer_match.start()].strip() if answer_match else block.strip()
      prompt_line = pre_answer.split("\n\n")[0].strip() if pre_answer else ""
      base["prompt"] = prompt_line
      base["choices"] = []
      if qid == "q5":
        base["choices"] = ["槓", "不槓（改打7m）"]
      elif qid == "q6":
        base["choices"] = ["打7m立直", "默聽"]

    answer_core = answer_match.group(1).strip() if answer_match else ""
    answer_token = re.search(r"^([0-9][mps]|[東南西北白發中]|杠|槓|打[0-9][mps]立直|立直)", answer_core)
    if answer_token:
      base["answer"] = answer_token.group(1).replace("杠", "槓")

    questions.append(base)

  return questions


def main():
  parser = argparse.ArgumentParser(description="Extract Q blocks from Bilibili article plain text.")
  parser.add_argument("--text-file", required=True, help="Path to plain text file copied from article")
  parser.add_argument("--source-url", required=True, help="Original Bilibili article URL")
  parser.add_argument("--output", required=True, help="Output JSON path")
  args = parser.parse_args()

  text = Path(args.text_file).read_text(encoding="utf-8")
  questions = parse_questions(text, args.source_url)
  out = {"sourceSet": "bilibili-article", "sourceUrl": args.source_url, "questions": questions}
  Path(args.output).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
  print(f"Extracted {len(questions)} questions -> {args.output}")


if __name__ == "__main__":
  main()
