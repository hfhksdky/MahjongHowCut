import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPORT_FILE = ROOT / "progress-export.json"
QUESTIONS_FILE = ROOT / "data" / "questions.json"

if not EXPORT_FILE.exists():
    raise SystemExit("progress-export.json not found")

if not QUESTIONS_FILE.exists():
    raise SystemExit("data/questions.json not found")

export_data = json.loads(EXPORT_FILE.read_text(encoding="utf-8"))
overrides_root = export_data.get("overrides") or {}

bank_key = "questions.json"
bank_overrides = overrides_root.get(bank_key) or {}

data = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
questions = data.get("questions", [])
id_to_q = {q.get("id"): q for q in questions}

applied = 0
for qid, patch in bank_overrides.items():
    q = id_to_q.get(qid)
    if not q or not isinstance(patch, dict):
        continue
    for k, v in patch.items():
        q[k] = v
    applied += 1

QUESTIONS_FILE.write_text(
    json.dumps(data, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)

print(f"Applied overrides to {applied} questions in data/questions.json")
