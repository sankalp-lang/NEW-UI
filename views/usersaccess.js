/* Users & access - merged People directory + User management + Access control (Admin only).
   Add users: individually · via CSV · or sync HRMS to find new joiners → approve & assign. */
App.registerView('usersaccess', {
  title: 'Users & access',
  render(ctx) {
    const u = ctx.user;
    if (u.role !== 'admin' && u.role !== 'policy_manager') {
      return `<div class="page"><div class="page__head"><div><h1>Users &amp; access</h1><p>People, roles and what each person can see.</p></div></div>
        <div class="lock-banner">${App.icon('lock')} <span><strong>Access required.</strong> User &amp; access management is for administrators and policy managers.</span></div></div>`;
    }
    const isAdmin = u.role === 'admin';
    // Admin gets both tabs (People + org-wide Access rules); a policy manager gets only their scoped People view.
    const tab = isAdmin ? ((App.state.usersAccess && App.state.usersAccess.tab) || 'people') : 'people';
    const tabBtn = (id, label) => `<div class="tab ${tab===id?'is-active':''}" onclick="App.usersAccessView.tab('${id}')">${label}</div>`;
    const addBtn = (isAdmin && tab==='people')
      ? `<div style="position:relative"><button class="btn btn--primary" onclick="App.usersAccessView.addMenu(event)">${App.icon('filter')} Manage Users ${App.icon('chevron')}</button><div id="uaAddMenu" style="display:none"></div></div>`
      : '';
    const intro = isAdmin
      ? 'Add, edit, and manage users to control who can access and work with your policies.'
      : 'The people you manage, their roles and what each of them can access. Org-wide administration stays with admins.';
    return `<div class="page">
      <div class="page__head"><div><h1>Users &amp; access</h1><p>${intro}</p></div><div class="spacer"></div>${addBtn}</div>
      ${isAdmin ? `<div class="tabs">${tabBtn('people','People &amp; users')}${tabBtn('access','Access rules')}</div>` : ''}
      <div id="uaBody">${tab==='access' ? App.usersAccessView.accessHtml() : App.usersAccessView.peopleHtml(u)}</div>
    </div>`;
  },
  mount(root, ctx) {
    const u = ctx.user;
    if (u.role !== 'admin' && u.role !== 'policy_manager') return;
    const tab = (u.role==='admin' && App.state.usersAccess && App.state.usersAccess.tab) || 'people';
    if (tab === 'access') App.usersAccessView.mountAccess(root); else App.usersAccessView.mountPeople(root);
  }
});

App.usersAccessView = {
  tab(t) { App.state.usersAccess = { tab: t }; App.reload(); },
  provisioned(id) { return DB.users.find(u => u.id === id); },

  /* ---------- People & users tab (columns mirror the production User Management table; scoped by role) ----------
     Columns: [select] · Employee ID · Employee Name · Role · Email · Status · Product Category (+N) · Date Added · AI Access · Action */
  _hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); },
  _dateAdded(e) { const D = ['18 March 2026', '19 March 2026', '04 April 2026', '22 May 2026', '09 June 2026', '22 June 2026']; return D[App.usersAccessView._hash(e.id) % D.length]; },
  _userCats(e, pu) {
    if (pu && pu.categories && pu.categories.length) return pu.categories;
    const cats = App.enabledCats().map(c => c.name); if (!cats.length) return [];
    const h = App.usersAccessView._hash(e.id); const n = (h % 2) + 1; const start = h % cats.length;
    const out = []; for (let i = 0; i < n; i++) out.push(cats[(start + i) % cats.length]); return out;
  },
  peopleHtml(user) {
    user = user || App.currentUser();
    const isAdmin = user.role === 'admin';
    const roster = App.managedEmployees(user);
    const teamsInScope = isAdmin ? DB.teams : DB.teams.filter(t => roster.some(e => e.team === t.name));
    const rows = roster.map(e => {
      const pu = App.usersAccessView.provisioned(e.id);
      const roleLabel = pu ? (DB.roleLabels[pu.role] || pu.role) : 'Staff User';
      const cl = App.usersAccessView._userCats(e, pu);
      const catCell = cl.length
        ? `<span style="color:var(--brand-600);font-weight:500">${App.esc(cl[0])}</span>${cl.length > 1 ? ` <span style="color:var(--brand-600);font-weight:600;margin-left:8px">+${cl.length - 1}</span>` : ''}`
        : '<span class="muted">N/A</span>';
      return `<tr class="clickable" data-n="${(e.name + ' ' + e.email + ' ' + e.id).toLowerCase()}" data-team="${App.esc(e.team)}" data-status="active" onclick="App.directoryView.profile('${e.id}')">
        <td onclick="event.stopPropagation()"><input type="checkbox" class="ua-check"/></td>
        <td><span class="mono" style="font-size:12px;color:var(--muted)">${App.esc(e.id)}</span></td>
        <td><span class="cell-strong" style="color:var(--brand-600)">${App.esc(e.name)}</span></td>
        <td>${App.esc(roleLabel)}</td>
        <td class="muted" style="font-size:12.5px">${App.esc(e.email)}</td>
        <td>${App.ui.pill('Active', 'green', true)}</td>
        <td>${catCell}</td>
        <td class="muted" style="font-size:12.5px">${App.usersAccessView._dateAdded(e)}</td>
        <td>Yes</td>
        <td onclick="event.stopPropagation()"><button class="btn btn--sm btn--ghost" title="Edit user" onclick="App.usersAccessView.editUser('${e.id}')">${App.icon('edit')}</button></td>
      </tr>`;
    }).join('');
    const banner = isAdmin
      ? `<strong>${roster.length}</strong> user${roster.length === 1 ? '' : 's'} across the organisation. Add, edit or bulk-manage from <strong>Manage Users</strong>.`
      : `You manage <strong>${roster.length}</strong> ${roster.length === 1 ? 'person' : 'people'} across ${teamsInScope.length} team${teamsInScope.length === 1 ? '' : 's'}. You see their roles and what each can access.`;
    return `<div class="info-banner">${App.icon('users')} <span>${banner}</span></div>
      <div class="toolbar">
        <div class="search-input">${App.icon('search')}<input id="uaSearch" placeholder="Search for Employee ID, Name or Email"/></div>
        <button class="btn" onclick="App.usersAccessView.toggleFilter()">${App.icon('filter')} Filter</button>
        <div id="uaFilters" class="row gap-8" style="display:none"><select class="select" id="uaTeam"><option value="">All teams</option>${teamsInScope.map(t => `<option>${App.esc(t.name)}</option>`).join('')}</select></div>
      </div>
      <div class="table-wrap"><table class="tbl"><thead><tr>
        <th style="width:34px"><input type="checkbox" class="ua-check" onclick="App.usersAccessView.toggleAll(this)"/></th>
        <th>Employee ID</th><th>Employee Name</th><th>Role</th><th>Email</th><th>Status</th><th>Product Category</th><th>Date Added</th><th>AI Access</th><th>Action</th>
      </tr></thead><tbody id="uaRows">${rows || '<tr><td colspan="10" class="muted" style="padding:16px">No users in your scope yet.</td></tr>'}</tbody></table></div>`;
  },
  toggleFilter() { const f = document.getElementById('uaFilters'); if (f) f.style.display = f.style.display === 'none' ? 'flex' : 'none'; },
  toggleAll(cb) { document.querySelectorAll('#uaRows .ua-check').forEach(x => { x.checked = cb.checked; }); },
  mountPeople(root) {
    const s = root.querySelector('#uaSearch'); if (!s) return;
    const f = () => {
      const q = (s.value || '').toLowerCase();
      const tmEl = root.querySelector('#uaTeam'); const tm = tmEl ? tmEl.value : '';
      root.querySelectorAll('#uaRows tr').forEach(tr => {
        if (!tr.dataset.n) return;
        tr.style.display = (tr.dataset.n.includes(q) && (!tm || tr.dataset.team === tm)) ? '' : 'none';
      });
    };
    s.oninput = f; const tmEl = root.querySelector('#uaTeam'); if (tmEl) tmEl.onchange = f;
  },
  editUser(id) {
    const e = App.emp(id); const pu = App.usersAccessView.provisioned(id); if (!e) return;
    App.openModal({
      title: 'Edit user · ' + e.name, sub: e.id + ' · ' + e.email, lg: true,
      body: `<div class="grid grid-2">
          <div class="field"><label>Role</label><select class="select" style="width:100%">${Object.keys(DB.roleLabels).map(r => `<option value="${r}"${pu && pu.role === r ? ' selected' : ''}>${DB.roleLabels[r]}</option>`).join('')}</select></div>
          <div class="field"><label>Status</label><select class="select" style="width:100%"><option>Active</option><option>Inactive</option></select></div></div>
        <div class="login__label" style="margin-top:6px">AI feature access</div>${App.usersAccessView._featRows()}
        <div class="login__label" style="margin-top:14px">Category access</div>${App.usersAccessView._catRows(pu ? pu.categories : null)}`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('User updated (demo)')">Save changes</button>`
    });
  },

  /* ---------- Manage Users (split menu: add individual / add in bulk / modify in bulk) ---------- */
  addMenu(e) {
    e.stopPropagation();
    const m = document.getElementById('uaAddMenu'); if (!m) return;
    if (m.style.display === 'block') { m.style.display = 'none'; return; }
    m.style.display = 'block';
    m.style.cssText = 'display:block;position:absolute;right:0;top:42px;width:264px;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-lg);padding:8px;z-index:50';
    const it = (ic, t, d, fn) => `<div class="cmdk__item" style="align-items:flex-start" onclick="${fn}"><span style="margin-top:2px">${App.icon(ic)}</span><div style="flex:1"><div style="font-weight:600;font-size:13px">${t}</div><div style="font-size:11.5px;color:var(--muted)">${d}</div></div></div>`;
    m.innerHTML = it('user', 'Add New Users', 'One person - set role, category &amp; AI access', 'App.usersAccessView.addIndividual()')
      + it('download', 'Add Users in Bulk', 'Import from a spreadsheet (team, role, category)', 'App.usersAccessView.addCsv()')
      + it('edit', 'Modify Bulk Users', 'Update roles &amp; access for many users at once', 'App.usersAccessView.modifyCsv()');
    setTimeout(() => document.addEventListener('click', function h() { const mm = document.getElementById('uaAddMenu'); if (mm) mm.style.display = 'none'; document.removeEventListener('click', h); }), 0);
  },
  modifyCsv() {
    App.openModal({
      title: 'Modify users in bulk', sub: 'Update roles, category and AI access for many users from a spreadsheet.',
      body: `<div class="field"><label>CSV file</label><div class="pdf-ph" style="min-height:auto;padding:24px;text-align:center;cursor:pointer" onclick="App.toast('File picker opens on the deployed app')">${App.icon('download')}<div class="muted" style="margin-top:8px;font-size:12.5px">Click to upload the edited CSV (&le; 20 MB)</div></div></div>
        <div class="info-banner" style="margin-bottom:0">${App.icon('info')} <span>Export the current users, edit <strong>Role, Category or AI Access</strong>, and re-upload. Employee ID is the match key; unchanged rows are skipped. <a style="color:var(--brand-600);cursor:pointer" onclick="App.toast('Current users exported (demo)')">Export current users</a>.</span></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('Bulk changes applied (demo)')">Apply changes</button>`
    });
  },
  _featRows() {
    const f = [['PolyGPT', 'Answer policy questions', true], ['Compare Policies', 'Side-by-side version diffs', true], ['Assessments', 'Create AI questionnaires', false]];
    return f.map(x => `<div class="togglerow"><div class="togglerow__txt"><b>${x[0]}</b><span>${x[1]}</span></div><div class="spacer"></div><button class="toggle ${x[2] ? 'on' : ''}" onclick="this.classList.toggle('on')"></button></div>`).join('');
  },
  _catRows(onNames) {
    return App.enabledCats().map(c => `<div class="togglerow"><div class="togglerow__txt"><b>${App.esc(c.name)}</b></div><div class="spacer"></div><button class="toggle ${(!onNames || onNames.includes(c.name)) ? 'on' : ''}" onclick="this.classList.toggle('on')"></button></div>`).join('');
  },
  addIndividual() {
    App.openModal({
      title: 'Add user', sub: 'Provision one person with a role and access.', lg: true,
      body: `<div class="grid grid-2"><div class="field"><label>Employee ID <span class="req">*</span></label><input class="input" placeholder="THQ0200"/></div><div class="field"><label>Work email <span class="req">*</span></label><input class="input" placeholder="name@tartanhq.com"/></div></div>
        <div class="grid grid-2"><div class="field"><label>Full name <span class="req">*</span></label><input class="input" placeholder="Full name"/></div>
        <div class="field"><label>Role <span class="req">*</span></label><select class="select" style="width:100%">${Object.keys(DB.roleLabels).map(r => `<option value="${r}"${r === 'user' ? ' selected' : ''}>${DB.roleLabels[r]}</option>`).join('')}</select></div></div>
        <div class="login__label" style="margin-top:6px">AI feature access</div>${App.usersAccessView._featRows()}
        <div class="login__label" style="margin-top:14px">Category access</div>${App.usersAccessView._catRows(null)}`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('User added (demo)')">Add user</button>`
    });
  },
  addCsv() {
    App.openModal({
      title: 'Import users from CSV', sub: 'Bulk-provision people from a spreadsheet.',
      body: `<div class="field"><label>CSV file</label><div class="pdf-ph" style="min-height:auto;padding:24px;text-align:center;cursor:pointer" onclick="App.toast('File picker opens on the deployed app')">${App.icon('download')}<div class="muted" style="margin-top:8px;font-size:12.5px">Click to upload CSV (≤ 20 MB)</div></div></div>
        <div class="info-banner" style="margin-bottom:0">${App.icon('info')} <span>Mandatory columns: <strong>Employee ID, Name, Email, Role, Category</strong>. Admins can't be bulk-added; IDs &amp; emails must be unique. <a style="color:var(--brand-600);cursor:pointer" onclick="App.toast('Sample CSV downloaded (demo)')">Download sample</a>.</span></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('Users imported (demo)')">Import users</button>`
    });
  },
  syncHrms() {
    const news = DB.employees.filter(e => !App.usersAccessView.provisioned(e.id)).slice(0, 6);
    const rows = news.map(e => `<div class="minirow" id="ua-new-${e.id}">${App.ui.avatar(e,'sm')}<div style="flex:1"><b style="font-weight:600">${App.esc(e.name)}</b><div class="muted" style="font-size:11.5px">${App.esc(e.title)} · ${App.esc(e.team)} · ${e.id}</div></div><button class="btn btn--sm btn--primary" onclick="App.usersAccessView.approve('${e.id}')">${App.icon('check')} Approve</button></div>`).join('');
    App.openModal({
      title: 'Sync from Keka HRMS', sub: 'New joiners found in HRMS, not yet provisioned in PolicyOS.', lg: true,
      body: `<div class="info-banner">${App.icon('plug')} <span>Synced <strong>Keka HRMS</strong> just now - <strong>${news.length}</strong> ${news.length === 1 ? 'person is' : 'people are'} in HRMS but not yet in PolicyOS. Approve each to assign a role &amp; access.</span></div>
        <div id="uaNewList">${rows || App.ui.empty('check', 'All synced', 'Everyone in HRMS is already provisioned.')}</div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Done</button>`
    });
  },
  approve(id) {
    const e = App.emp(id);
    App.openModal({
      title: 'Approve & assign · ' + e.name, sub: 'Set this new joiner\'s role and access before they get in.',
      body: `<div class="row gap-12" style="margin-bottom:14px">${App.ui.avatar(e,'lg')}<div><div style="font-weight:600">${App.esc(e.name)}</div><div class="muted" style="font-size:12.5px">${App.esc(e.title)} · ${App.esc(e.team)} · ${App.esc(e.email)}</div></div></div>
        <div class="field"><label>Role <span class="req">*</span></label><select class="select" id="uaApRole" style="width:100%">${Object.keys(DB.roleLabels).filter(r => r !== 'admin').map(r => `<option value="${r}"${r === 'user' ? ' selected' : ''}>${DB.roleLabels[r]}</option>`).join('')}</select></div>
        <div class="login__label">Category access</div>${App.usersAccessView._catRows(['HR', 'Compliance'])}`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.usersAccessView.doApprove('${id}')">${App.icon('check')} Provision</button>`
    });
  },
  doApprove(id) {
    const sel = document.getElementById('uaApRole'); const role = sel ? sel.value : 'user';
    if (!DB.users.some(u => u.id === id)) DB.users.push({ id, role, features: { polygpt: true, compare: false, assessments: true, copilot: true } });
    App.closeModal();
    App.toast(App.emp(id).name + ' provisioned as ' + DB.roleLabels[role]);
    App.reload();
  },

  /* ---------- Access rules tab (sources + policy matrix + tester) ---------- */
  accessHtml() {
    const sourceCard = c => `<div class="card card--pad"><div class="row gap-8" style="margin-bottom:6px">${App.icon(c.id === 'keka' || c.id === 'greythr' ? 'users' : c.id === 'jira' ? 'branch' : c.id === 'notion' ? 'book' : c.id === 'slack' ? 'chat' : 'shield')}<b style="font-size:13.5px">${App.esc(c.name)}</b></div><div class="muted" style="font-size:12.5px">${App.esc(c.note)}</div><div class="row gap-6 mt-8"><span class="pill pill--gray">${App.icon('key')} ${App.esc(c.auth)}</span></div></div>`;
    const pols = DB.policies.filter(p => App.catEnabled(p.category));
    const polRows = pols.map(p => {
      const parts = [`<span class="tag">${App.esc(p.category)}</span>`];
      if (p.access && p.access.everyone) parts.unshift('<span class="pill pill--green">All staff</span>');
      ((p.access && p.access.users) || []).forEach(uid => { const e = App.emp(uid); parts.push(`<span class="tag">${App.esc(e ? e.name : uid)} (direct)</span>`); });
      const scope = parts.join(' ');
      return `<tr><td><div class="cell-strong">${App.esc(p.name)}${p.sensitive ? ' ' + App.ui.pill('Confidential', 'red') : ''}</div><div class="muted" style="font-size:12px">${App.esc(p.category)} · ${p.version}</div></td><td><div class="row wrap gap-6">${scope}</div></td><td><button class="btn btn--sm" onclick="App.accessView.edit('${p.id}')">${App.icon('edit')} Edit</button></td></tr>`;
    }).join('');
    return `<div class="info-banner">${App.icon('shield')} <span><strong>How access is derived:</strong> category scoping over the policy library - a user sees policies in the categories assigned to them, plus any company-wide or per-person document grants. Tara enforces this at retrieval; it never returns a policy the user couldn't open.</span></div>
      <h3 style="margin:6px 0 12px;font-size:15px">Policy access rules</h3>
      <div class="table-wrap" style="margin-bottom:24px"><table class="tbl"><thead><tr><th>Policy</th><th>Who can access</th><th></th></tr></thead><tbody>${polRows}</tbody></table></div>
      <div class="card"><div class="card__head">${App.icon('eye')}<h3>Access tester</h3><div class="spacer"></div><span class="muted" style="font-size:12px">Preview what a persona can retrieve</span></div>
        <div class="card__body"><div class="grid grid-2" style="margin-bottom:14px">
          <div class="field" style="margin:0"><label>Persona</label><select class="select" id="uaTU" style="width:100%">${DB.users.map(u => { const e = App.emp(u.id); return `<option value="${u.id}">${App.esc(e.name)} - ${DB.roleLabels[u.role]}</option>`; }).join('')}</select></div>
          <div class="field" style="margin:0"><label>Policy</label><select class="select" id="uaTP" style="width:100%">${pols.map(p => `<option value="${p.id}">${App.esc(p.name)}</option>`).join('')}</select></div>
        </div><div id="uaTR"></div></div></div>`;
  },
  mountAccess(root) {
    const tu = root.querySelector('#uaTU'), tp = root.querySelector('#uaTP'); if (!tu || !tp) return;
    const run = () => {
      const uid = tu.value, pid = tp.value; if (!uid || !pid || !App.emp(uid)) return;
      const persona = DB.users.find(u => u.id === uid); const user = Object.assign({}, App.emp(uid), persona);
      const p = App.policy(pid); const ok = App.canViewPolicy(p, user);
      root.querySelector('#uaTR').innerHTML = ok
        ? `<div class="lock-banner" style="background:var(--green-50);border-color:#bcd3c2;color:var(--green-700)">${App.icon('check')} <span><strong>${App.esc(App.emp(uid).name)}</strong> can view &amp; query “${App.esc(p.name)}”. Tara will use it as a source.</span></div>`
        : `<div class="lock-banner">${App.icon('lock')} <span><strong>${App.esc(App.emp(uid).name)}</strong> cannot access “${App.esc(p.name)}” - Tara refuses and marks the source hidden.</span></div>`;
    };
    tu.onchange = run; tp.onchange = run; run();
  }
};
