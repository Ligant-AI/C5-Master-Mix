#!/usr/bin/env python3
"""
C5 Master Mix: independent reimplementation for acceptance 3.

Written by Adacs from the URS v1.0 and docs/engine-io.md (the accepted engine
I/O contract, Task 6a review amendment included), WITHOUT reading the
JavaScript engine. Its purpose is to disagree with the engine wherever the
engine departs from the contract. Do not edit it to make it agree: a
difference is a finding to report.

Usage:
  python3 reimpl/c5_reimpl.py input.json            -> prints output JSON
  python3 reimpl/c5_reimpl.py --fixture FX.json     -> runs a fixture's input
Python 3.9 or later. Standard library only.
"""
import json, math, re, sys
from fractions import Fraction

ENGINE_VERSION = "0.1.0"
MU = "\u00b5"

# ---- units (contract section 1.2) -------------------------------------
# id: (kind, dimension, base unit, power of ten)
UNITS = {
    f"{MU}L": ("volume", "volume", f"{MU}L", 0),
    "mL": ("volume", "volume", f"{MU}L", 3),
    "cells": ("cells", "cells", "cells", 0),
    "\u00d7 10\u2076 cells": ("cells", "cells", "cells", 6),
    "ng": ("amount", "mass", f"{MU}g", -3),
    f"{MU}g": ("amount", "mass", f"{MU}g", 0),
    "mg": ("amount", "mass", f"{MU}g", 3),
    "pmol": ("amount", "molar", "pmol", 0),
    "nmol": ("amount", "molar", "pmol", 3),
    f"{MU}mol": ("amount", "molar", "pmol", 6),
    "IU": ("amount", "iu", "IU", 0),
    "U": ("amount", "u", "U", 0),
    "mg/mL": ("conc", "mass", f"{MU}g/{MU}L", 0),
    f"{MU}g/mL": ("conc", "mass", f"{MU}g/{MU}L", -3),
    "ng/mL": ("conc", "mass", f"{MU}g/{MU}L", -6),
    "g/L": ("conc", "mass", f"{MU}g/{MU}L", 0),
    "mg/L": ("conc", "mass", f"{MU}g/{MU}L", -3),
    "M": ("conc", "molar", f"pmol/{MU}L", 6),
    "mM": ("conc", "molar", f"pmol/{MU}L", 3),
    f"{MU}M": ("conc", "molar", f"pmol/{MU}L", 0),
    "nM": ("conc", "molar", f"pmol/{MU}L", -3),
    "pM": ("conc", "molar", f"pmol/{MU}L", -6),
    "IU/mL": ("conc", "iu", f"IU/{MU}L", -3),
    "U/mL": ("conc", "u", f"U/{MU}L", -3),
}

NUM_RE = re.compile(r"^[+\-\u2212]?(\d+(\.\d*)?)([eE][+\-\u2212]?\d+)?$")

def parse_exact(text):
    """Exact Fraction of a typed decimal, or None if invalid (contract 1.1)."""
    t = text.strip()
    if "," in t or not NUM_RE.match(t):
        return None
    t = t.replace("\u2212", "-")
    mant, _, exp = t.lower().partition("e")
    sign = -1 if mant.startswith("-") else 1
    mant = mant.lstrip("+-")
    whole, _, frac = mant.partition(".")
    digits = int((whole or "0") + (frac or "")) if (whole + frac) else 0
    value = Fraction(digits, 10 ** len(frac or ""))
    e = int(exp) if exp else 0
    value = value * (Fraction(10) ** e)
    return sign * value

def to_double(exact):
    """Nearest double to an exact rational (one rounding), or None if it
    overflows. float(Fraction) is correctly rounded."""
    try:
        d = float(exact)
    except OverflowError:
        return None
    return d

def canon(exact, per_unit):
    """Canonical integer under C5-UN-10, half away from zero.
    per_unit: resolution steps per base unit (1000 nL per uL, 1 per cell)."""
    x = exact * per_unit
    s = -1 if x < 0 else 1
    return s * math.floor(abs(x) + Fraction(1, 2))

def canon_double(d, per_unit):
    return canon(Fraction(d), per_unit)

# ---- typed field reading -----------------------------------------------
class Field:
    """state: blank | no-unit | invalid | unrepresentable | ok | not-recorded"""
    def __init__(self, obj, kinds):
        self.state, self.exact, self.double, self.unit = "blank", None, None, None
        if obj is None:
            return
        if obj.get("notRecorded"):
            self.state = "not-recorded"; return
        value = (obj.get("value") or "")
        if value.strip() == "":
            return
        unit = obj.get("unit") or ""
        if unit == "":
            self.state = "no-unit"; return
        if unit not in UNITS or UNITS[unit][0] not in kinds:
            raise ValueError(f"unit {unit!r} cannot come from the page here")
        ex = parse_exact(value)
        if ex is None:
            self.state = "invalid"; return
        kind, dim, base, p = UNITS[unit]
        exb = ex * (Fraction(10) ** p)
        d = to_double(exb)
        if d is None or math.isinf(d) or (d == 0 and exb != 0):
            self.state = "unrepresentable"; return
        self.state, self.exact, self.double, self.unit = "ok", exb, d, unit
        self.kind, self.dim, self.base = kind, dim, base

    @property
    def ok(self):
        return self.state == "ok"

def plain_number(text):
    """Dimensionless typed string (samples, percentage, additional tests)."""
    t = (text or "")
    if t.strip() == "":
        return "blank", None, None
    ex = parse_exact(t)
    if ex is None:
        return "invalid", None, None
    d = to_double(ex)
    if d is None or math.isinf(d) or (d == 0 and ex != 0):
        return "unrepresentable", None, None
    return "ok", ex, d

# ---- determine ---------------------------------------------------------
FLAG_ORDER = ["C5-FL-01", "C5-FL-02", "C5-FL-03", "C5-FL-04", "C5-FL-05",
              "C5-FL-07", "C5-FL-08", "C5-FL-09", "C5-FL-11", "C5-FL-12"]
HI_ORDER = ["C5-HI-01", "C5-HI-02", "C5-HI-03", "C5-HI-04", "C5-HI-05",
            "C5-HI-06", "C5-HI-08", "C5-HI-09", "C5-HI-10", "C5-HI-11",
            "PENDING-Q1", "PENDING-Q2", "PENDING-Q4"]

def determine(inp):
    incomplete, rejections = [], []
    def inc(field, reason, comp=None):
        e = {"field": field, "reason": reason}
        if comp is not None: e["component"] = comp
        incomplete.append(e)
    def rej(code, comp=None):
        e = {"code": code}
        if comp is not None: e["component"] = comp
        rejections.append(e)

    D = Field(inp.get("dispensed"), {"volume"})
    R = Field(inp.get("residual"), {"volume"})
    C = Field(inp.get("assayCells"), {"cells"})
    for name, f in (("dispensed", D), ("residual", R), ("assayCells", C)):
        if not f.ok: inc(name, f.state)
    s_state, n_exact, n = plain_number(inp.get("samples"))
    if s_state != "ok": inc("samples", s_state)

    ov = inp.get("overage") or {}
    form = ov.get("form") or ""
    ov_exact = ov_d = None
    if form == "":
        inc("overage.form", "not-selected")
    elif form == "dead-volume":
        OVF = Field({"value": ov.get("value"), "unit": ov.get("unit")}, {"volume"})
        if OVF.ok: ov_exact, ov_d = OVF.exact, OVF.double
        else: inc("overage.value", OVF.state)
    else:
        st, ov_exact, ov_d = plain_number(ov.get("value"))
        if st != "ok": inc("overage.value", st)

    dil = inp.get("diluent") or {}
    dil_not_recorded = bool(dil.get("notRecorded"))
    if not dil_not_recorded and (dil.get("text") or "").strip() == "":
        inc("diluent", "blank")
    mt = inp.get("minTransfer") or {}
    MT = Field({"value": mt.get("value"), "unit": mt.get("unit")}, {"volume"})
    if not MT.ok: inc("minTransfer", MT.state)
    CAP = Field(inp.get("capacity"), {"volume"})
    cap_declared = CAP.state != "blank"
    if cap_declared and not CAP.ok: inc("capacity", CAP.state)

    comps = inp.get("components") or []
    parsed = []
    for i, c in enumerate(comps, start=1):
        if (c.get("label") or "").strip() == "": inc("label", "blank", i)
        Q = Field(c.get("intended"), {"amount", "conc", "volume"})
        if not Q.ok: inc("intended", Q.state, i)
        stock_required = not (Q.ok and Q.kind == "volume")
        S = Field(c.get("stock"), {"conc"})
        if not S.ok and not (S.state == "blank" and not stock_required):
            inc("stock", S.state, i)
        SV = Field(c.get("establishedVolume"), {"volume"})
        if SV.state not in ("ok", "not-recorded"): inc("establishedVolume", SV.state, i)
        EC = Field(c.get("establishedCells"), {"cells"})
        if EC.state not in ("ok", "not-recorded"): inc("establishedCells", EC.state, i)
        prov = c.get("provenance") or ""
        if prov == "": inc("provenance", "not-selected", i)
        parsed.append(dict(i=i, Q=Q, S=S, SV=SV, EC=EC, prov=prov))

    # rejections, in table order, by component within a code
    if not comps: rej("C5-HI-01")
    if s_state == "ok" and (n_exact.denominator != 1 or n_exact < 1): rej("C5-HI-02")
    for p in parsed:
        if p["Q"].ok and p["Q"].exact <= 0: rej("C5-HI-03", p["i"])
        if p["S"].ok and p["S"].exact <= 0: rej("C5-HI-03", p["i"])
    if ov_exact is not None and ov_exact < 0: rej("C5-HI-04")
    for p in parsed:
        Q, S = p["Q"], p["S"]
        if Q.ok and S.ok and Q.kind in ("amount", "conc") and Q.dim != S.dim:
            rej("C5-HI-05", p["i"])
    if R.ok and R.exact < 0: rej("C5-HI-08")
    if C.ok and C.exact < 0: rej("C5-HI-09")
    if MT.ok and MT.exact <= 0: rej("C5-HI-10")
    if D.ok and D.exact <= 0: rej("C5-HI-11")
    for p in parsed:
        if p["Q"].ok and p["Q"].kind == "volume" and p["S"].state == "blank":
            rej("PENDING-Q2", p["i"])
    for p in parsed:
        q4 = (p["SV"].ok and p["SV"].exact <= 0) or (p["EC"].ok and p["EC"].exact < 0)
        if q4: rej("PENDING-Q4", p["i"])
    if CAP.ok and CAP.exact <= 0: rej("PENDING-Q4")

    # basis requirement (C5-CP-07), decided only on valid D > 0 and R >= 0
    basis = inp.get("basis") or ""
    basis_required = False
    if D.ok and R.ok and D.exact > 0 and R.exact >= 0:
        sva_c = canon(D.exact + R.exact, 1000)
        for p in parsed:
            if p["SV"].ok and p["SV"].exact > 0 and canon(p["SV"].exact, 1000) != sva_c:
                basis_required = True
    if basis_required and basis == "":
        inc("basis", "not-selected")

    if rejections:
        rejections.sort(key=lambda r: (HI_ORDER.index(r["code"]), r.get("component", 0)))
        return {"status": "rejected", "engineVersion": ENGINE_VERSION,
                "rejections": rejections, "incomplete": incomplete}
    if incomplete:
        return {"status": "incomplete", "engineVersion": ENGINE_VERSION,
                "rejections": [], "incomplete": incomplete}

    # ---- computation, in the contract's order (section 2.1) ----
    Dd, Rd = D.double, R.double
    sv_assay = Dd + Rd
    sva_c = canon(D.exact + R.exact, 1000)
    if form == "percentage":
        n_eff = n * (1 + ov_d / 100); overage_fraction = ov_d / 100
    elif form == "additional-tests":
        n_eff = n + ov_d; overage_fraction = ov_d / n
    else:
        n_eff = n + ov_d / Dd; overage_fraction = ov_d / (n * Dd)

    def overflow(field, comp=None):
        e = {"field": field, "reason": "unrepresentable"}
        if comp is not None: e["component"] = comp
        return {"status": "incomplete", "engineVersion": ENGINE_VERSION,
                "rejections": [], "incomplete": [e]}
    if not math.isfinite(n_eff) or not math.isfinite(overage_fraction):
        return overflow("overage.value")
    out_comps, sum_v, sum_V = [], 0.0, 0.0
    for p in parsed:
        Q, S, SV = p["Q"], p["S"], p["SV"]
        if Q.kind == "amount":
            frm, a = "amount", Q.double / S.double
        elif Q.kind == "conc":
            frm = "concentration"
            if SV.state == "ok":
                a = (Q.double * SV.double) / S.double
            else:
                # NADIRA ruling Q1 (8 Oct 2026): carry the entered concentration
                # into the assay, under either basis: a = (q x SV_assay) / c.
                a = (Q.double * sv_assay) / S.double
        else:
            frm, a = "stock-volume", Q.double
        recorded = SV.state == "ok"
        if not recorded:
            applied = "not-applied"
        elif basis:
            applied = basis
        else:
            applied = "not-required"
        equal = recorded and canon(SV.exact, 1000) == sva_c
        if applied == "preserve-concentration" and recorded:
            s = 1 if equal else sv_assay / SV.double
            scale = {"value": s, "exactlyOne": bool(equal)}
            v = a * s
        else:
            scale, v = None, a
        V = v * n_eff
        sum_v = sum_v + v
        sum_V = sum_V + V
        conc = None
        if S.ok:
            conc = {"value": (S.double * v) / sv_assay, "unit": S.base}
        if not recorded:
            ratio = {"withheld": True, "reason": "C5-FL-02"}
        elif applied == "preserve-amount":
            ratio = {"value": 1 if equal else SV.double / sv_assay}
        else:
            ratio = {"value": 1}
        checks = [a, v, V] + ([conc["value"]] if conc else []) + ([ratio["value"]] if "value" in ratio else [])
        if not all(math.isfinite(x) for x in checks):
            return overflow("intended", p["i"])
        out_comps.append(dict(p=p, index=p["i"], form=frm, basisApplied=applied,
            stockVolumePerTest_uL=a, scaleFactor=scale, volumePerTest_uL=v,
            volumeInCocktail_uL=V, concentrationInAssay=conc, ratio=ratio))

    if not math.isfinite(sum_v):
        return overflow("intended")

    D_c = canon(D.exact, 1000)
    sv_c = canon_double(sum_v, 1000)
    if sv_c > D_c:
        return {"status": "rejected", "engineVersion": ENGINE_VERSION,
                "rejections": [{"code": "C5-HI-06"}], "incomplete": []}
    fills = sv_c == D_c
    diluent_per_test = 0 if fills else Dd - sum_v
    total = Dd * n_eff
    diluent_total = 0 if fills else total - sum_V
    antibody_fraction = sum_V / total
    for x in (total, sum_V, diluent_total, antibody_fraction):
        if not math.isfinite(x):
            return overflow("dispensed")

    # ---- flags (section 2.2) ----
    flags = {}
    def add(code, comps_, **detail):
        flags[code] = dict({"code": code, "components": comps_}, **detail)
    fl01 = [c["index"] for c in out_comps if c["p"]["SV"].ok and canon(c["p"]["SV"].exact, 1000) != sva_c]
    if fl01: add("C5-FL-01", fl01)
    fl02 = [c["index"] for c in out_comps if c["p"]["SV"].state == "not-recorded"]
    if fl02: add("C5-FL-02", fl02)
    if ov_exact == 0: add("C5-FL-03", [])
    fl04 = [c["index"] for c in out_comps if c["p"]["prov"] in ("vendor", "not-recorded")]
    if fl04: add("C5-FL-04", fl04)
    mt_c = canon(MT.exact, 1000)
    fl05 = [c["index"] for c in out_comps if canon_double(c["volumeInCocktail_uL"], 1000) < mt_c]
    if fl05: add("C5-FL-05", fl05)
    if CAP.ok and canon_double(total, 1000) > canon(CAP.exact, 1000): add("C5-FL-07", [])
    rec = [c for c in out_comps if c["p"]["SV"].ok]
    groups = {}
    for c in rec:
        groups.setdefault(canon(c["p"]["SV"].exact, 1000), []).append(c["index"])
    if len(groups) >= 2:
        add("C5-FL-08", sorted(c["index"] for c in rec),
            volumes=[{"nL": k, "components": groups[k]} for k in sorted(groups)],
            unevaluated=fl02)
    if dil_not_recorded: add("C5-FL-09", [])
    ca_c = canon(C.exact, 1)
    fl11, apc = [], []
    for c in out_comps:
        EC = c["p"]["EC"]
        if EC.ok and canon(EC.exact, 1) != ca_c:
            fl11.append(c["index"])
            if C.exact == 0:
                apc.append({"component": c["index"], "withheld": True, "reason": "assay-cells-zero"})
            elif EC.exact == 0:
                apc.append({"component": c["index"], "withheld": True, "reason": "established-cells-zero"})
            else:
                ratio = EC.double / C.double
                if c["basisApplied"] == "preserve-concentration" and c["scaleFactor"] is not None:
                    f = c["scaleFactor"]["value"] * ratio
                else:
                    f = ratio
                if not math.isfinite(f):
                    return overflow("establishedCells", c["index"])
                apc.append({"component": c["index"], "factor": f})
    if fl11: add("C5-FL-11", fl11, amountPerCell=apc)
    fl12 = [c["index"] for c in out_comps if c["p"]["EC"].state == "not-recorded"]
    if fl12: add("C5-FL-12", fl12)

    keys = ["index", "form", "basisApplied", "stockVolumePerTest_uL", "scaleFactor",
            "volumePerTest_uL", "volumeInCocktail_uL", "concentrationInAssay", "ratio"]
    return {
        "status": "result", "engineVersion": ENGINE_VERSION,
        "basisRequired": basis_required,
        "values": {
            "svAssay_uL": sv_assay, "nEff": n_eff, "overageFraction": overage_fraction,
            "diluentPerTest_uL": diluent_per_test,
            "componentsFillDispensedVolume": fills,
            "diluentTotal_uL": diluent_total, "totalCocktail_uL": total,
            "antibodyFraction": antibody_fraction,
            "fl08Unevaluated": fl02,
            "components": [{k: c[k] for k in keys} for c in out_comps],
        },
        "flags": [flags[k] for k in FLAG_ORDER if k in flags],
    }

def _clean(o):
    """JSON: integral floats that are literal rule values stay numbers; -0 never appears."""
    if isinstance(o, float) and o == 0: return 0
    if isinstance(o, dict): return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, list): return [_clean(v) for v in o]
    return o

def main(argv):
    if len(argv) >= 2 and argv[0] == "--fixture":
        data = json.load(open(argv[1], encoding="utf-8"))["input"]
    elif argv:
        data = json.load(open(argv[0], encoding="utf-8"))
    else:
        data = json.load(sys.stdin)
    print(json.dumps(_clean(determine(data)), ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main(sys.argv[1:])
