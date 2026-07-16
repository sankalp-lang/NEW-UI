/* Categories - policy category management (Admin only) */
App.registerView('category', {
  title: 'Categories',
  render(ctx) {
    const u = ctx.user;
    if (u.role !== 'admin') {
      return `<div class="page">
        <div class="page__head"><div><h1>Categories</h1><p>Manage the policy taxonomy used across the repository.</p></div></div>
        <div class="lock-banner">${App.icon('lock')} <span><strong>Administrator access required.</strong> Category management is restricted to administrators. Ask your workspace admin if you need a new category or sub-category.</span></div>
      </div>`;
    }

    const totalSubs = DB.categories.reduce((n, c) => n + c.subs.length, 0);
    const polByCat = name => DB.policies.filter(p => p.category === name).length;

    const cards = DB.categories.map(c => {
      const enabled = c.enabled !== false;
      const subs = c.subs.length
        ? c.subs.map(s => `<span class="tag" style="display:inline-flex;align-items:center;gap:5px">${App.esc(s)}<button class="amd-pol__x" title="Remove sub-category" onclick="event.stopPropagation();App.categoryView.removeSub('${App.esc(c.name)}','${App.esc(s)}')">${App.icon('x')}</button></span>`).join(' ')
        : `<span class="muted" style="font-size:12.5px">No sub-categories yet</span>`;
      const pc = polByCat(c.name);
      return `<div class="card card--pad" data-cat="${c.name.toLowerCase()}" style="${enabled ? '' : 'opacity:.6'}">
        <div class="row gap-8" style="align-items:flex-start">
          <span style="width:11px;height:11px;border-radius:4px;background:${c.color};flex-shrink:0;margin-top:5px"></span>
          <div style="flex:1;min-width:0">
            <div class="row gap-8"><b style="font-size:14.5px">${App.esc(c.name)}</b>${enabled ? '' : App.ui.pill('Disabled', 'gray')}</div>
            <div class="muted" style="font-size:12px;margin-top:2px">${c.subs.length} sub-categor${c.subs.length === 1 ? 'y' : 'ies'} · ${pc} polic${pc === 1 ? 'y' : 'ies'}</div>
          </div>
          <button class="btn btn--sm" onclick="App.categoryView.edit('${App.esc(c.name)}')">${App.icon('edit')} Edit</button>
          <button class="toggle ${enabled ? 'on' : ''}" title="Enable / disable" onclick="App.categoryView.toggle(this,'${App.esc(c.name)}')"></button>
        </div>
        <div class="divider"></div>
        <div class="row wrap gap-6">${subs}</div>
      </div>`;
    }).join('');

    return `<div class="page">
      <div class="page__head"><div><h1>Categories</h1><p>Organise policies into categories and sub-categories. This taxonomy powers filtering, approval workflows and access scoping across the repository.</p></div><div class="spacer"></div>
        <button class="btn" onclick="App.categoryView.addSub()">${App.icon('plus')} Add Sub-Category</button>
        <button class="btn btn--primary" onclick="App.categoryView.add()">${App.icon('plus')} Add Category</button>
      </div>
      <div class="info-banner">${App.icon('layers')} <span><strong>${DB.categories.length} categories</strong> · ${totalSubs} sub-categories in use. Disabling a category hides it and its policies everywhere - repository, filters, dropdowns and Tara - while keeping the underlying data intact.</span></div>
      <div class="toolbar">
        <div class="search-input">${App.icon('search')}<input id="catSearch" placeholder="Search categories…"/></div>
      </div>
      <div class="grid grid-2" id="catGrid">${cards}</div>
    </div>`;
  },
  mount(root) {
    const search = root.querySelector('#catSearch');
    if (search) search.oninput = () => {
      const q = (search.value || '').toLowerCase();
      root.querySelectorAll('#catGrid .card').forEach(card => {
        card.style.display = card.dataset.cat.includes(q) ? '' : 'none';
      });
    };
  }
});

App.categoryView = {
  toggle(btn, name) {
    const c = DB.categories.find(x => x.name === name); if (!c) return;
    const now = c.enabled !== false;
    if (now) { App.categoryView.confirmDisable(name); return; }   // disabling needs confirmation
    c.enabled = true;
    App.toast(`“${name}” enabled - now visible`, 'ok');
    App.reload();
  },
  confirmDisable(name) {
    const pc = DB.policies.filter(p => p.category === name).length;
    App.openModal({
      title: 'Disable “' + name + '”?', sub: 'This hides the category everywhere until you re-enable it.',
      body: `<div class="lock-banner">${App.icon('alert')} <span>Are you sure you want to disable <strong>${App.esc(name)}</strong>? Disabling this will hide all related policies (<strong>${pc}</strong>) and its sub-categories everywhere - repository, filters, dropdowns and Tara. The underlying data is kept and you can re-enable it later.</span></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--danger" onclick="App.categoryView.doDisable('${App.esc(name)}')">${App.icon('x')} Disable category</button>`
    });
  },
  doDisable(name) {
    const c = DB.categories.find(x => x.name === name); if (c) c.enabled = false;
    App.closeModal();
    App.toast(`“${name}” disabled - hidden from filters, lists & Tara`, 'warn');
    App.reload();
  },
  removeSub(cat, sub) {
    const c = DB.categories.find(x => x.name === cat); if (c) c.subs = c.subs.filter(s => s !== sub);
    App.toast(`Removed “${sub}” from ${cat}`, 'warn');
    App.reload();
  },

  add() {
    App.openModal({
      title: 'Add Category',
      sub: 'Create a new top-level policy category.',
      body: `<div class="field"><label>Category Name <span class="req">*</span></label><input class="input" id="newCatName" placeholder="e.g. Gold Loan"/><div class="hint">Categories appear as filters in the repository and gate new-policy creation.</div></div>
        <div class="info-banner" style="margin-bottom:0">${App.icon('info')} <span><strong>A category once created cannot be deleted.</strong> You can disable it later, but historical policies must retain their category for audit.</span></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.categoryView.saveCat()">Save Category</button>`
    });
    setTimeout(() => { const i = document.getElementById('newCatName'); if (i) i.focus(); }, 120);
  },
  saveCat() {
    const i = document.getElementById('newCatName');
    const name = (i && i.value || '').trim();
    if (!name) { App.toast('Enter a category name', 'err'); if (i) i.focus(); return; }
    App.closeModal();
    App.toast(`Category “${name}” created (demo)`);
  },

  addSub() {
    App.openModal({
      title: 'Add Sub-Category',
      sub: 'Add a sub-category and link it to an existing category.',
      body: `<div class="field"><label>Sub-Category Name(s) <span class="req">*</span></label><input class="input" id="newSubName" placeholder="e.g. Education Loan, Gold Loan"/><div class="hint">Add several at once, separated by commas.</div></div>
        <div class="field" style="margin-bottom:0"><label>Link Category <span class="req">*</span></label><select class="select" id="newSubCat" style="width:100%">${DB.categories.map(c => `<option value="${App.esc(c.name)}">${App.esc(c.name)}</option>`).join('')}</select><div class="hint">The sub-categor${'ies'} will be nested under this parent category.</div></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.categoryView.saveSub()">Save Sub-Category</button>`
    });
    setTimeout(() => { const i = document.getElementById('newSubName'); if (i) i.focus(); }, 120);
  },
  saveSub() {
    const i = document.getElementById('newSubName');
    const sel = document.getElementById('newSubCat');
    const raw = (i && i.value || '').trim();
    if (!raw) { App.toast('Enter a sub-category name', 'err'); if (i) i.focus(); return; }
    const parent = sel ? sel.value : '';
    const pc = DB.categories.find(c => c.name === parent);
    const names = raw.split(',').map(s => s.trim()).filter(Boolean);
    // reject duplicates against the existing sub-categories AND within the batch (case-insensitive)
    const existing = (pc ? pc.subs : []).map(s => s.toLowerCase());
    const seen = {}; const dupes = [];
    names.forEach(n => { const k = n.toLowerCase(); if (existing.indexOf(k) >= 0 || seen[k]) dupes.push(n); seen[k] = 1; });
    if (dupes.length) { App.toast('Already exists in ' + parent + ': ' + dupes.join(', '), 'err'); if (i) i.focus(); return; }
    App.closeModal();
    App.toast(names.length + ` sub-categor${names.length === 1 ? 'y' : 'ies'} added to ${parent} (demo)`);
  },

  edit(name) {
    const c = DB.categories.find(x => x.name === name);
    if (!c) { App.toast('Category not found', 'err'); return; }
    const subRows = c.subs.length
      ? c.subs.map(s => `<div class="togglerow"><div class="togglerow__txt"><b>${App.esc(s)}</b></div><div class="spacer"></div><button class="toggle on" title="Enable / disable this sub-category" onclick="this.classList.toggle('on')"></button><button class="btn btn--sm btn--danger" style="margin-left:10px" onclick="App.toast('Removed “${App.esc(s)}” (demo)','warn')">${App.icon('trash')} Remove</button></div>`).join('')
      : App.ui.empty('layers', 'No sub-categories', 'Add one from the Categories page.');
    App.openModal({
      title: 'Edit Category · ' + c.name,
      sub: 'Rename the category or manage its sub-categories.',
      body: `<div class="field"><label>Category Name <span class="req">*</span></label><div class="row gap-8"><span style="width:13px;height:13px;border-radius:4px;background:${c.color};flex-shrink:0"></span><input class="input" id="editCatName" value="${App.esc(c.name)}"/></div></div>
        <div class="login__label">Sub-categories</div>
        ${subRows}`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('Category “${App.esc(c.name)}” updated (demo)')">Save Changes</button>`
    });
  }
};
