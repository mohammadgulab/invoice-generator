// Small hash router app: invoice list, invoice form, clients.
(function () {
  const view = document.getElementById('view');
  const state = { config: { currency: 'SAR', vat_rate: 15 }, clients: [] };
  const STATUSES = ['Draft', 'Sent', 'Paid'];

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (m) => Money.format(m, state.config.currency);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed');
      err.details = data.details || [];
      throw err;
    }
    return data;
  }

  let toastTimer;
  function toast(msg, kind = 'ok') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = 'toast'), 2600);
  }

  const badge = (status) => `<span class="badge badge-${status.toLowerCase()}">${status}</span>`;
  const isOverdue = (inv) => inv.status === 'Sent' && inv.due_date < today();

  function setNav(name) {
    $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  }

  async function loadClients() {
    state.clients = await api('/api/clients');
    return state.clients;
  }

  // ---------- invoice list ----------
  const listState = { status: '', q: '' };

  async function renderList() {
    setNav('invoices');
    view.innerHTML = `
      <section class="page-head">
        <div>
          <h1>Invoices</h1>
          <p class="sub">Create, track and download your invoices.</p>
        </div>
      </section>
      <section class="stats" id="stats">${'<div class="stat skeleton"></div>'.repeat(4)}</section>
      <section class="card">
        <div class="toolbar">
          <div class="chips" role="tablist">
            ${['', ...STATUSES].map((s) => `<button class="chip ${listState.status === s ? 'active' : ''}" data-status="${s}">${s || 'All'}</button>`).join('')}
          </div>
          <label class="search">
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6"/><path d="M14 14l4 4"/></svg>
            <input type="search" placeholder="Search number or client" value="${esc(listState.q)}" aria-label="Search invoices" />
          </label>
        </div>
        <div id="invoice-table"></div>
      </section>`;

    $$('.chip', view).forEach((b) => b.addEventListener('click', () => {
      listState.status = b.dataset.status;
      $$('.chip', view).forEach((c) => c.classList.toggle('active', c === b));
      loadTable();
    }));
    let t;
    $('.search input', view).addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { listState.q = e.target.value.trim(); loadTable(); }, 200);
    });

    api('/api/invoices/stats').then((s) => {
      const outstanding = s.sent.total;
      $('#stats').innerHTML = `
        <div class="stat"><span class="stat-label">Outstanding</span><strong>${money(outstanding)}</strong><span class="stat-foot">${s.sent.count} sent invoice${s.sent.count === 1 ? '' : 's'}</span></div>
        <div class="stat"><span class="stat-label">Paid</span><strong class="ok">${money(s.paid.total)}</strong><span class="stat-foot">${s.paid.count} paid</span></div>
        <div class="stat"><span class="stat-label">Overdue</span><strong class="${s.overdue.count ? 'warn' : ''}">${money(s.overdue.total)}</strong><span class="stat-foot">${s.overdue.count} past due date</span></div>
        <div class="stat"><span class="stat-label">Drafts</span><strong>${s.draft.count}</strong><span class="stat-foot">${money(s.draft.total)} not sent yet</span></div>`;
    });
    loadTable();
  }

  async function loadTable() {
    const box = $('#invoice-table');
    if (!box) return;
    const params = new URLSearchParams();
    if (listState.status) params.set('status', listState.status);
    if (listState.q) params.set('q', listState.q);
    const rows = await api(`/api/invoices?${params}`);
    if (!rows.length) {
      box.innerHTML = `<div class="empty"><p>No invoices here yet.</p><a class="btn btn-primary" href="#/new">Create your first invoice</a></div>`;
      return;
    }
    box.innerHTML = `
      <table class="table">
        <thead><tr><th>Invoice</th><th>Client</th><th>Issued</th><th>Due</th><th>Status</th><th class="num">Total</th><th class="actions-col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr data-id="${r.id}">
              <td data-label="Invoice"><a class="inv-no" href="#/edit/${r.id}">${esc(r.number)}</a></td>
              <td data-label="Client"><div class="client-cell"><span class="avatar">${esc((r.client_company || r.client_name).slice(0, 1))}</span><div><strong>${esc(r.client_company || r.client_name)}</strong><small>${esc(r.client_company ? r.client_name : '')}</small></div></div></td>
              <td data-label="Issued">${fmtDate(r.issue_date)}</td>
              <td data-label="Due" class="${isOverdue(r) ? 'overdue' : ''}">${fmtDate(r.due_date)}${isOverdue(r) ? '<small class="overdue-tag">Overdue</small>' : ''}</td>
              <td data-label="Status">${badge(r.status)}</td>
              <td data-label="Total" class="num strong">${money(r.total)}</td>
              <td class="actions">
                <a class="btn btn-sm btn-ghost" href="#/edit/${r.id}">Edit</a>
                <a class="btn btn-sm btn-soft" href="/api/invoices/${r.id}/pdf" download>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10M6 9l4 4 4-4M4 16h12"/></svg>PDF</a>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ---------- invoice form ----------
  async function renderForm(id) {
    setNav('invoices');
    view.innerHTML = '<div class="card loading">Loading...</div>';
    const [clients, invoice] = await Promise.all([loadClients(), id ? api(`/api/invoices/${id}`) : null]);
    const issue = invoice ? invoice.issue_date : today();
    const vatRate = invoice ? invoice.vat_rate : state.config.vat_rate;

    view.innerHTML = `
      <section class="page-head">
        <div>
          <a href="#/" class="back">&larr; All invoices</a>
          <h1>${invoice ? `Edit ${esc(invoice.number)}` : 'New invoice'}</h1>
          <p class="sub">${invoice ? `Created ${fmtDate(invoice.created_at.slice(0, 10))}` : 'The invoice number is given automatically when you save.'}</p>
        </div>
        ${invoice ? badge(invoice.status) : ''}
      </section>
      <form id="invoice-form" class="form-layout" novalidate>
        <div class="form-main">
          <section class="card">
            <h2 class="card-title">Bill to</h2>
            <div class="client-picker">
              <label class="field grow"><span>Client *</span>
                <select name="client_id" required>
                  <option value="">Choose a client</option>
                  ${clients.map((c) => `<option value="${c.id}">${esc(c.company ? `${c.company} (${c.name})` : c.name)}</option>`).join('')}
                </select>
              </label>
              <button type="button" class="btn btn-soft" id="quick-client">+ New client</button>
            </div>
            <div class="client-preview" id="client-preview"></div>
          </section>

          <section class="card">
            <h2 class="card-title">Details</h2>
            <div class="grid-3">
              <label class="field"><span>Issue date *</span><input type="date" name="issue_date" required value="${issue}" /></label>
              <label class="field"><span>Due date *</span><input type="date" name="due_date" required value="${invoice ? invoice.due_date : addDays(issue, 14)}" /></label>
              <label class="field"><span>Status</span>
                <select name="status">${STATUSES.map((s) => `<option ${invoice && invoice.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
              </label>
            </div>
          </section>

          <section class="card">
            <div class="card-title-row">
              <h2 class="card-title">Line items</h2>
              <span class="muted small">Prices in ${esc(state.config.currency)}, before VAT</span>
            </div>
            <div class="items-head" aria-hidden="true">
              <span>Description</span><span>Qty</span><span>Unit price</span><span class="num">Amount</span><span></span>
            </div>
            <div id="items"></div>
            <button type="button" class="btn btn-dashed" id="add-item">+ Add line item</button>
          </section>

          <section class="card">
            <h2 class="card-title">Notes</h2>
            <label class="field"><span class="sr-only">Notes</span>
              <textarea name="notes" rows="3" maxlength="2000" placeholder="Payment terms, thank you note, project reference...">${esc(invoice ? invoice.notes : '')}</textarea>
            </label>
          </section>
        </div>

        <aside class="form-side">
          <section class="card summary">
            <h2 class="card-title">Summary</h2>
            <dl>
              <div><dt>Subtotal</dt><dd id="sum-subtotal">${money(0)}</dd></div>
              <div><dt>VAT (${vatRate}%)</dt><dd id="sum-vat">${money(0)}</dd></div>
              <div class="grand"><dt>Total</dt><dd id="sum-total">${money(0)}</dd></div>
            </dl>
            <p class="form-error" data-error hidden></p>
            <button type="submit" class="btn btn-primary btn-block" id="save-btn">${invoice ? 'Save changes' : 'Save invoice'}</button>
            <a class="btn btn-outline btn-block ${invoice ? '' : 'disabled'}" id="pdf-btn" ${invoice ? `href="/api/invoices/${invoice.id}/pdf" download` : 'aria-disabled="true"'}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10M6 9l4 4 4-4M4 16h12"/></svg> Download PDF</a>
            <p class="hint">${invoice ? 'Save first if you changed anything, then download.' : 'Save the invoice to enable the PDF download.'}</p>
            ${invoice ? '<button type="button" class="link-danger" id="delete-btn">Delete invoice</button>' : ''}
          </section>
        </aside>
      </form>`;

    const form = $('#invoice-form');
    const itemsBox = $('#items');
    const select = form.elements.client_id;
    if (invoice) select.value = String(invoice.client_id);

    function showClient() {
      const c = state.clients.find((x) => String(x.id) === select.value);
      $('#client-preview').innerHTML = c
        ? `<strong>${esc(c.company || c.name)}</strong>${c.company ? `<span>${esc(c.name)}</span>` : ''}${c.email ? `<span>${esc(c.email)}</span>` : ''}${c.address ? `<span>${esc(c.address).replace(/\n/g, ', ')}</span>` : ''}${c.vat_number ? `<span>VAT ${esc(c.vat_number)}</span>` : ''}`
        : '<span class="muted">No client selected yet.</span>';
    }
    select.addEventListener('change', showClient);
    showClient();

    function addRow(item = { description: '', quantity: 1, unit_price: '' }) {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <label class="field"><span class="m-label">Description</span><input name="description" placeholder="What did you do or sell?" value="${esc(item.description)}" maxlength="300" /></label>
        <label class="field"><span class="m-label">Qty</span><input name="quantity" type="number" min="0" step="any" inputmode="decimal" value="${esc(item.quantity)}" /></label>
        <label class="field"><span class="m-label">Unit price</span><input name="unit_price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${esc(item.unit_price)}" /></label>
        <div class="amount num"><span class="m-label">Amount</span><span data-amount>${money(0)}</span></div>
        <button type="button" class="icon-btn remove" aria-label="Remove line">&times;</button>`;
      row.querySelector('.remove').addEventListener('click', () => {
        if ($$('.item-row', itemsBox).length > 1) row.remove();
        else row.querySelectorAll('input').forEach((i) => (i.value = i.name === 'quantity' ? 1 : ''));
        recalc();
      });
      itemsBox.appendChild(row);
      return row;
    }

    function readItems() {
      return $$('.item-row', itemsBox).map((r) => ({
        description: r.querySelector('[name=description]').value.trim(),
        quantity: r.querySelector('[name=quantity]').value,
        unit_price: r.querySelector('[name=unit_price]').value.trim(),
      }));
    }

    function recalc() {
      const items = readItems();
      const t = Money.computeTotals(items, vatRate);
      $$('.item-row', itemsBox).forEach((r, i) => { r.querySelector('[data-amount]').textContent = t.amounts[i] === null ? '...' : money(t.amounts[i]); });
      $('#sum-subtotal').textContent = money(t.subtotal);
      $('#sum-vat').textContent = money(t.vat);
      $('#sum-total').textContent = money(t.total);
    }

    (invoice ? invoice.items.map((i) => ({ description: i.description, quantity: i.quantity, unit_price: (i.unit_price / 100).toFixed(2) })) : [{ description: '', quantity: 1, unit_price: '' }]).forEach((i) => addRow(i));
    recalc();
    itemsBox.addEventListener('input', recalc);
    $('#add-item').addEventListener('click', () => { addRow().querySelector('input').focus(); recalc(); });

    form.elements.issue_date.addEventListener('change', (e) => {
      if (!invoice && e.target.value) form.elements.due_date.value = addDays(e.target.value, 14);
    });

    $('#quick-client').addEventListener('click', () => openClientDialog(null, async (client) => {
      await loadClients();
      select.insertAdjacentHTML('beforeend', `<option value="${client.id}">${esc(client.company ? `${client.company} (${client.name})` : client.name)}</option>`);
      select.value = String(client.id);
      showClient();
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = $('[data-error]', form);
      errBox.hidden = true;
      $$('.invalid', form).forEach((el) => el.classList.remove('invalid'));
      const body = {
        client_id: select.value ? Number(select.value) : null,
        issue_date: form.elements.issue_date.value,
        due_date: form.elements.due_date.value,
        status: form.elements.status.value,
        notes: form.elements.notes.value,
        items: readItems().filter((i, idx, all) => all.length === 1 || i.description || i.unit_price),
      };
      const btn = $('#save-btn');
      btn.disabled = true;
      try {
        const saved = await api(invoice ? `/api/invoices/${invoice.id}` : '/api/invoices', { method: invoice ? 'PUT' : 'POST', body });
        toast(`${saved.number} saved`);
        if (!invoice) location.hash = `#/edit/${saved.id}`;
        else renderForm(saved.id);
      } catch (err) {
        errBox.innerHTML = `${esc(err.message)}${err.details.length ? `<ul>${err.details.map((d) => `<li>${esc(prettyField(d.field))}: ${esc(d.message)}</li>`).join('')}</ul>` : ''}`;
        errBox.hidden = false;
        err.details.forEach((d) => markField(form, d.field));
      } finally {
        btn.disabled = false;
      }
    });

    if (invoice) {
      $('#delete-btn').addEventListener('click', async () => {
        if (!confirm(`Delete ${invoice.number}? This cannot be undone.`)) return;
        await api(`/api/invoices/${invoice.id}`, { method: 'DELETE' });
        toast(`${invoice.number} deleted`);
        location.hash = '#/';
      });
    }
  }

  function prettyField(field) {
    const m = /^items\.(\d+)\.(\w+)$/.exec(field);
    if (m) return `Line ${Number(m[1]) + 1} ${m[2].replace('_', ' ')}`;
    return field.replace('_id', '').replace('_', ' ') || 'Form';
  }

  function markField(form, field) {
    const m = /^items\.(\d+)\.(\w+)$/.exec(field);
    let el;
    if (m) el = $$('.item-row', form)[Number(m[1])]?.querySelector(`[name=${m[2]}]`);
    else el = form.elements[field];
    if (el && el.classList) el.classList.add('invalid');
  }

  // ---------- clients ----------
  async function renderClients() {
    setNav('clients');
    const clients = await loadClients();
    view.innerHTML = `
      <section class="page-head">
        <div><h1>Clients</h1><p class="sub">${clients.length} client${clients.length === 1 ? '' : 's'} on file.</p></div>
        <button class="btn btn-primary" id="add-client">+ New client</button>
      </section>
      <section class="client-grid">
        ${clients.map((c) => `
          <article class="card client-card" data-id="${c.id}">
            <div class="client-cell"><span class="avatar lg">${esc((c.company || c.name).slice(0, 1))}</span>
              <div><strong>${esc(c.company || c.name)}</strong><small>${esc(c.company ? c.name : '')}</small></div></div>
            <ul class="client-meta">
              ${c.email ? `<li>${esc(c.email)}</li>` : ''}
              ${c.address ? `<li>${esc(c.address).replace(/\n/g, ', ')}</li>` : ''}
              <li>${c.vat_number ? `VAT ${esc(c.vat_number)}` : '<span class="muted">No VAT number</span>'}</li>
            </ul>
            <div class="card-actions">
              <button class="btn btn-sm btn-ghost" data-edit>Edit</button>
              <button class="btn btn-sm btn-ghost danger" data-delete>Delete</button>
            </div>
          </article>`).join('') || '<div class="card empty"><p>No clients yet.</p></div>'}
      </section>`;
    $('#add-client').addEventListener('click', () => openClientDialog(null, renderClients));
    $$('.client-card', view).forEach((card) => {
      const c = clients.find((x) => String(x.id) === card.dataset.id);
      card.querySelector('[data-edit]').addEventListener('click', () => openClientDialog(c, renderClients));
      card.querySelector('[data-delete]').addEventListener('click', async () => {
        if (!confirm(`Delete ${c.company || c.name}?`)) return;
        try {
          await api(`/api/clients/${c.id}`, { method: 'DELETE' });
          toast('Client deleted');
          renderClients();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }

  // ---------- client dialog ----------
  const dialog = document.getElementById('client-dialog');
  const clientForm = document.getElementById('client-form');
  let onClientSaved = null;
  let editingClient = null;

  function openClientDialog(client, onSaved) {
    editingClient = client;
    onClientSaved = onSaved;
    clientForm.reset();
    $('[data-error]', clientForm).hidden = true;
    $$('.invalid', clientForm).forEach((el) => el.classList.remove('invalid'));
    $('#client-dialog-title').textContent = client ? 'Edit client' : 'New client';
    if (client) ['name', 'company', 'email', 'address', 'vat_number'].forEach((f) => (clientForm.elements[f].value = client[f] || ''));
    dialog.showModal();
    clientForm.elements.name.focus();
  }
  $$('[data-close]', dialog).forEach((b) => b.addEventListener('click', () => dialog.close()));
  clientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(clientForm));
    const errBox = $('[data-error]', clientForm);
    try {
      const saved = await api(editingClient ? `/api/clients/${editingClient.id}` : '/api/clients', { method: editingClient ? 'PUT' : 'POST', body });
      dialog.close();
      toast(`${saved.company || saved.name} saved`);
      if (onClientSaved) onClientSaved(saved);
    } catch (err) {
      errBox.textContent = err.details.length ? err.details.map((d) => d.message).join('. ') : err.message;
      errBox.hidden = false;
      err.details.forEach((d) => clientForm.elements[d.field] && clientForm.elements[d.field].classList.add('invalid'));
    }
  });

  // ---------- router ----------
  async function route() {
    const hash = location.hash || '#/';
    let m;
    try {
      if (hash === '#/' || hash === '#') await renderList();
      else if (hash === '#/new') await renderForm(null);
      else if ((m = /^#\/edit\/(\d+)$/.exec(hash))) await renderForm(Number(m[1]));
      else if (hash === '#/clients') await renderClients();
      else view.innerHTML = '<div class="card empty"><h1>Page not found</h1><a class="btn btn-primary" href="#/">Back to invoices</a></div>';
    } catch (err) {
      view.innerHTML = `<div class="card empty"><h1>Something went wrong</h1><p>${esc(err.message)}</p><a class="btn btn-primary" href="#/">Back to invoices</a></div>`;
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  api('/api/config').then((c) => { state.config = c; }).catch(() => {}).finally(route);
})();
