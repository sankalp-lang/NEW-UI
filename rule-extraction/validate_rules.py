#!/usr/bin/env python3
"""
validate_rules.py - deterministic post-processor / validator for extracted regulatory rules.

A prompt cannot guarantee cross-model uniformity; this layer does the part that must be
mechanical. Run every model's raw JSON through it before anything reaches the DB.

It:
  1. parses the model JSON (tolerates ```json fences and leading/trailing prose),
  2. validates the schema + closed enums (rule_type, numeric_operator, category),
  3. NORMALIZES and LOCATES each verbatim_source_span in the source text -> char offsets
     (this is what makes the PDF highlight survive whitespace/newline differences),
  4. type-checks numeric vs timeline vs text (no dates smuggled into numeric_threshold),
  5. canonicalises para_ref and concept_key, dedupes,
  6. runs a completeness heuristic (flags an "immediate effect" / deadline date in the
     source that no rule covers).

Usage:
    python3 validate_rules.py --source circular.txt --rules model_output.json
    python3 validate_rules.py --source circular.txt --rules a.json b.json c.json --reconcile
"""
import argparse, json, re, sys, unicodedata

CATEGORIES = {
 "Risk Weightage","Capital Adequacy","Provisioning","Asset Classification","Exposure Limits",
 "Credit Appraisal","Underwriting Standards","Pricing & Interest","KYC/AML/CFT",
 "Reporting & Disclosure","Governance & Oversight","Consumer Protection & Fair Practices",
 "Recovery & Collections","Implementation Timeline","Other"}
RULE_TYPES = {"numeric","text","timeline"}
OPERATORS  = {"=",">=","<=","increase_by","none"}
REQUIRED   = {"concept_key","rule_type","numeric_operator","numeric_threshold","normalized_text",
              "verbatim_source_span","para_ref","category","sub_category","confidence"}
PARA_RE    = re.compile(r"^\d+([A-Z](\([a-z0-9]+\))?)?$")
CONCEPT_RE = re.compile(r"^[a-z0-9_]+__[a-z0-9_]+$")

def norm(s: str) -> str:
    """Whitespace/punct normalisation applied identically to spans and to source before matching."""
    if s is None: return ""
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("­", "")                      # soft hyphen
    s = (s.replace("‘","'").replace("’","'")
           .replace("“",'"').replace("”",'"')
           .replace("–","-").replace("—","-").replace("‑","-"))
    s = re.sub(r"\s+", " ", s)                        # collapse ALL whitespace runs
    return s.strip()

def loose(s: str) -> str:
    """Hyphen-insensitive form: fixes 'sub-\\nsegments' -> 'subsegments' vs 'sub-segments' mismatches."""
    return norm(s).replace("- ", "").replace("-", "")

def load_rules(path):
    raw = open(path, encoding="utf-8").read().strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.S)  # strip fences
    m = re.search(r"\{.*\}", raw, flags=re.S)          # first {...} block
    obj = json.loads(m.group(0) if m else raw)
    return obj["rules"] if isinstance(obj, dict) and "rules" in obj else obj

def validate_one(rule, i, nsource):
    errs, warns = [], []
    missing = REQUIRED - set(rule)
    if missing: errs.append(f"missing keys: {sorted(missing)}")
    rt = rule.get("rule_type")
    if rt not in RULE_TYPES: errs.append(f"rule_type '{rt}' not in {sorted(RULE_TYPES)}")
    if rule.get("numeric_operator") not in OPERATORS: errs.append(f"bad numeric_operator '{rule.get('numeric_operator')}'")
    if rule.get("category") not in CATEGORIES: errs.append(f"category '{rule.get('category')}' not in closed list")
    if not PARA_RE.match(str(rule.get("para_ref",""))): warns.append(f"para_ref '{rule.get('para_ref')}' not canonical (e.g. 2A(a))")
    if not CONCEPT_RE.match(str(rule.get("concept_key",""))): warns.append(f"concept_key '{rule.get('concept_key')}' not <subject>__<entity>")
    # type discipline
    nt = rule.get("numeric_threshold")
    if rt == "numeric":
        if not isinstance(nt,(int,float)): errs.append("numeric rule has non-numeric threshold")
        elif nt > 10_000_000: errs.append(f"numeric_threshold {nt} looks like a date smuggled into numeric (use rule_type 'timeline')")
    if rt == "text" and nt is not None: warns.append("text rule should have numeric_threshold null")
    if rt == "timeline":
        if not (rule.get("effective_date") or rule.get("compliance_deadline")):
            errs.append("timeline rule has neither effective_date nor compliance_deadline")
        for f in ("effective_date","compliance_deadline"):
            v = rule.get(f)
            if v not in (None,"immediate") and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(v)):
                errs.append(f"{f} '{v}' not ISO YYYY-MM-DD / 'immediate' / null")
    # span locate (the important one)
    span = norm(rule.get("verbatim_source_span",""))
    if not span:
        errs.append("empty verbatim_source_span")
    else:
        pos = nsource.find(span)
        if pos < 0:
            if loose(rule.get("verbatim_source_span","")) in loose(nsource):
                warns.append("span matched only via hyphen-insensitive fallback (line-break hyphenation) - store normalised text, not raw")
            else:
                errs.append("verbatim_source_span NOT found in source even after normalisation")
        else:
            rule["_span_offsets"] = [pos, pos+len(span)]
            if nsource.count(span) > 1: warns.append("span occurs >1x in source (ambiguous highlight)")
    return errs, warns

def completeness(rules, nsource):
    w = []
    if "immediate effect" in nsource and not any(
        (r.get("effective_date")=="immediate") or ("immediate" in norm(r.get("normalized_text",""))) for r in rules):
        w.append("source says 'immediate effect' but no rule captures an immediate effective date")
    for d in re.findall(r"[A-Z][a-z]+ \d{1,2}, \d{4}", nsource):  # e.g. 'February 29, 2024'
        if not any(d.replace(",","") in norm(r.get("normalized_text",""))+norm(r.get("verbatim_source_span","")) for r in rules):
            w.append(f"source names a date '{d}' not covered by any rule")
    return w

def check_file(path, nsource):
    rules = load_rules(path)
    print(f"\n=== {path}  ({len(rules)} rules) ===")
    seen, dups = {}, 0
    for i, r in enumerate(rules):
        errs, warns = validate_one(r, i, nsource)
        key = (r.get("para_ref"), norm(r.get("verbatim_source_span","")), r.get("numeric_threshold"), r.get("entity"))
        if key in seen: warns.append(f"duplicate of rule #{seen[key]} (same para/span/threshold/entity)"); dups += 1
        else: seen[key] = i
        tag = "FAIL" if errs else ("warn" if warns else "ok")
        print(f"  [{tag}] #{i} {r.get('concept_key','?')}  {r.get('para_ref','?')}")
        for e in errs:  print(f"        ! {e}")
        for wn in warns: print(f"        ~ {wn}")
    for wn in completeness(rules, nsource):
        print(f"  [completeness] ~ {wn}")
    return rules

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--rules", nargs="+", required=True)
    ap.add_argument("--reconcile", action="store_true", help="compare rule sets across files")
    a = ap.parse_args()
    nsource = norm(open(a.source, encoding="utf-8").read())
    allsets = {p: check_file(p, nsource) for p in a.rules}
    if a.reconcile and len(allsets) > 1:
        print("\n=== RECONCILE ===")
        counts = {p: len(r) for p, r in allsets.items()}
        print("  rule counts:", counts, "->", "MATCH" if len(set(counts.values()))==1 else "DIVERGENT")
        # divergence by canonical business key (para_ref + entity), model-agnostic
        def bkey(r): return (str(r.get("para_ref")), str(r.get("entity") or "").lower())
        universe = {}
        for p, rs in allsets.items():
            for r in rs: universe.setdefault(bkey(r), set()).add(p)
        for k, present in sorted(universe.items()):
            if len(present) != len(allsets):
                print(f"  only {sorted(present)} extracted rule {k}")

if __name__ == "__main__":
    main()
