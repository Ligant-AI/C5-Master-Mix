// A validator for the subset of JSON Schema (2020-12) that
// docs/schema/c5-master-mix-1.0.0-draft.schema.json uses: type (including
// integer and null), const, enum, minimum, properties, required,
// additionalProperties: false, items, oneOf, and local $ref to #/$defs/....
// Any other keyword is refused, so the schema cannot silently use one this
// validator ignores. Node only; no dependency (Tasks 7b to 10 brief, §2).
const KNOWN = new Set(['$schema', '$id', 'title', 'description', '$defs', '$ref', 'type', 'const', 'enum', 'minimum', 'properties', 'required', 'additionalProperties', 'items', 'oneOf']);

const typeOk = (t, x) => ({
  object: x !== null && typeof x === 'object' && !Array.isArray(x),
  array: Array.isArray(x),
  string: typeof x === 'string',
  number: typeof x === 'number' && Number.isFinite(x),
  integer: Number.isInteger(x),
  boolean: typeof x === 'boolean',
  null: x === null,
}[t]);

export function validate(root, value) {
  const errors = [];
  const check = (s, x, p) => {
    for (const k of Object.keys(s)) if (!KNOWN.has(k)) throw new Error(`schema keyword "${k}" at ${p} is not supported`);
    if (s.$ref) {
      const m = /^#\/\$defs\/(.+)$/.exec(s.$ref);
      if (!m || !root.$defs[m[1]]) throw new Error(`unresolvable $ref ${s.$ref}`);
      return check(root.$defs[m[1]], x, p);
    }
    const before = errors.length;
    if (s.type && !typeOk(s.type, x)) errors.push(`${p}: expected ${s.type}, got ${JSON.stringify(x)}`);
    if ('const' in s && x !== s.const) errors.push(`${p}: expected ${JSON.stringify(s.const)}, got ${JSON.stringify(x)}`);
    if (s.enum && !s.enum.includes(x)) errors.push(`${p}: ${JSON.stringify(x)} not in ${JSON.stringify(s.enum)}`);
    if ('minimum' in s && typeof x === 'number' && x < s.minimum) errors.push(`${p}: ${x} below ${s.minimum}`);
    const isObj = x !== null && typeof x === 'object' && !Array.isArray(x);
    if (isObj) {
      for (const r of s.required || []) if (!(r in x)) errors.push(`${p}: missing "${r}"`);
      for (const [k, v] of Object.entries(x)) {
        if (s.properties && k in s.properties) check(s.properties[k], v, `${p}.${k}`);
        else if (s.additionalProperties === false) errors.push(`${p}: unexpected "${k}"`);
      }
    }
    if (Array.isArray(x) && s.items) x.forEach((y, i) => check(s.items, y, `${p}[${i}]`));
    if (s.oneOf) {
      const passing = s.oneOf.filter((b) => {
        const saved = errors.length;
        check(b, x, p);
        const ok = errors.length === saved;
        errors.length = saved;
        return ok;
      }).length;
      if (passing !== 1) errors.push(`${p}: matches ${passing} of the oneOf branches, not exactly 1`);
    }
    return errors.length === before;
  };
  check(root, value, '$');
  return errors;
}
