# Independent reimplementation (supplied by Adacs; do not edit, do not read while writing the engine)

`c5_reimpl.py` implements `determine()` from URS v1.0 and the accepted engine I/O contract only. Python 3.9 or later, standard library only.

    python3 reimpl/c5_reimpl.py input.json
    python3 reimpl/c5_reimpl.py --fixture tests/fixtures/C5-FX-05a.json

It prints the contract's output object (§2 or §3). Typed numbers are read as exact rationals and converted with one correctly rounded step (Python's float of a Fraction), per Task 4 ruling 1. It reproduces the contract's worked example (§4.3, as amended) exactly.

If it disagrees with the engine, report the fixture, the field, both values and the difference. Either side may be wrong; Adacs rules.
