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

// The same, typed as a user types: Playwright's fill (keystroke input events),
// selectOption and check on each control in turn. Slower; used where the check
// is about typing itself (acceptance 20, the network sentinel).
export async function typeInto(page, input) {
  const p = (name) => page.locator(`#panel-fields [data-field="${name}"]`);
  const q = async (name, f) => { await p(`${name}.value`).fill(f.value); await p(`${name}.unit`).selectOption(f.unit || ''); };
  await q('dispensed', input.dispensed);
  await q('residual', input.residual);
  await q('assayCells', input.assayCells);
  await p('samples').fill(input.samples);
  await p('overage.form').selectOption(input.overage.form || '');
  await p('overage.value').fill(input.overage.value || '');
  if (input.overage.form === 'dead-volume') await p('overage.unit').selectOption(input.overage.unit);
  await p('basis').selectOption(input.basis || '');
  if (input.diluent.notRecorded) await p('diluent.notRecorded').check();
  else await p('diluent.text').fill(input.diluent.text || '');
  if (!(input.minTransfer.defaulted && input.minTransfer.value === '2' && input.minTransfer.unit === 'µL')) await q('minTransfer', input.minTransfer);
  if (input.capacity && input.capacity.value) await q('capacity', input.capacity);
  while (await page.locator('#components-body tr').count() < input.components.length) await page.locator('#add-component').click();
  for (const [i, c] of input.components.entries()) {
    const f = (name) => page.locator(`#components-body tr[data-row="${i + 1}"] [data-field="${name}"]`);
    await f('label').fill(c.label);
    await f('intended.value').fill(c.intended.value); await f('intended.unit').selectOption(c.intended.unit);
    await f('stock.value').fill(c.stock.value); await f('stock.unit').selectOption(c.stock.unit);
    for (const k of ['establishedVolume', 'establishedCells']) {
      if (c[k].notRecorded) await f(`${k}.unit`).selectOption('not-recorded');
      else { await f(`${k}.value`).fill(c[k].value); await f(`${k}.unit`).selectOption(c[k].unit); }
    }
    await f('provenance').selectOption(c.provenance);
  }
}
