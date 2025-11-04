import json, pathlib
p = pathlib.Path("data/subwoofers.json")
if not p.exists():
    print("No subwoofers.json")
else:
    data = json.loads(p.read_text(encoding="utf-8"))
    src = [d for d in data if d.get("source") == "crutchfield"]
    eight = [d for d in src if d.get("size_in") and 7.75 <= d["size_in"] <= 8.25]
    print("Total records:", len(data))
    print("Crutchfield records:", len(src))
    print("Crutchfield 8\" (±0.25):", len(eight))
