// Enter a contract input object (docs/engine-io.md §1.3) into the real page
// through its own controls: each value is set on the control a user would use,
// and the same input and change events a user's typing raises are dispatched,
// so the page's handlers run exactly as for a user. Shared by the headless
// checks and the layout measurement.
export async function fill(page, input) {
  await page.evaluate((input) => {
    const set = (el, value) => {
      if (el.type === 'checkbox') el.checked = value;
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const panel = (name) => document.querySelector(`#panel-fields [data-field="${name}"]`);
    const q = (name, f) => { set(panel(`${name}.value`), f.value); set(panel(`${name}.unit`), f.unit || ''); };
    q('dispensed', input.dispensed);
    q('residual', input.residual);
    q('assayCells', input.assayCells);
    set(panel('samples'), input.samples);
    set(panel('overage.form'), input.overage.form || '');
    set(panel('overage.value'), input.overage.value || '');
    if (input.overage.form === 'dead-volume') set(panel('overage.unit'), input.overage.unit || '');
    set(panel('basis'), input.basis || '');
    set(panel('diluent.notRecorded'), !!input.diluent.notRecorded);
    if (!input.diluent.notRecorded) set(panel('diluent.text'), input.diluent.text || '');
    if (!(input.minTransfer.defaulted && input.minTransfer.value === '2' && input.minTransfer.unit === 'µL')) q('minTransfer', input.minTransfer);
    q('capacity', input.capacity || { value: '', unit: '' });

    const body = document.getElementById('components-body');
    const add = document.getElementById('add-component');
    while (body.querySelectorAll('tr').length > input.components.length) body.querySelector('tr:last-child button[data-action="remove"]').click();
    while (body.querySelectorAll('tr').length < input.components.length) add.click();
    input.components.forEach((c, i) => {
      const tr = body.querySelector(`tr[data-row="${i + 1}"]`);
      const f = (name) => tr.querySelector(`[data-field="${name}"]`);
      set(f('label'), c.label);
      set(f('intended.value'), c.intended.value); set(f('intended.unit'), c.intended.unit);
      set(f('stock.value'), c.stock.value); set(f('stock.unit'), c.stock.unit);
      for (const k of ['establishedVolume', 'establishedCells']) {
        if (c[k].notRecorded) set(f(`${k}.unit`), 'not-recorded');
        else { set(f(`${k}.unit`), c[k].unit); set(f(`${k}.value`), c[k].value); }
      }
      set(f('provenance'), c.provenance);
    });
  }, input);
}
