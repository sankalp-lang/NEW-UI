/* User Management - manage PolicyOS users, roles, AI-feature & category access */
App.registerView('usermgmt', {
  title: 'User Management',
  render(ctx) {
    const u = ctx.user;

    const roleKind = { admin:'violet', policy_manager:'blue', user:'green' };

    const rows = DB.users.map(p => {
      const e = App.emp(p.id);
      if (!e) return '';
      const feats = [];
      if (p.features && p.features.polygpt)     feats.push('PolyGPT');
      if (p.features && p.features.compare)      feats.push('Compare');
      if (p.features && p.features.assessments)  feats.push('Assessments');
      const featTags = feats.length
        ? feats.map(f => `<span class="tag">${App.esc(f)}</span>`).join(' ')
        : '<span class="muted" style="font-size:12px">-</span>';
      return `<tr class="clickable" data-name="${App.esc(e.name.toLowerCase())} ${App.esc(e.email.toLowerCase())} ${App.esc(e.id.toLowerCase())}" data-role="${p.role}" onclick="App.usermgmtView.profile('${p.id}')">
        <td><span class="mono" style="font-size:12px;color:var(--muted)">${App.esc(e.id)}</span></td>
        <td><div class="cell-person">${App.ui.avatar(e,'sm')}<div><div class="cell-strong">${App.esc(e.name)}</div><div class="muted" style="font-size:12px">${App.esc(e.title)}</div></div></div></td>
        <td>${App.ui.pill(DB.roleLabels[p.role]||p.role, roleKind[p.role]||'gray')}${p.hrAdmin?' '+App.ui.pill('HR','teal'):''}</td>
        <td class="muted">${App.esc(e.email)}</td>
        <td>${App.ui.pill('Active','green',true)}</td>
        <td><span class="tag">${App.esc(e.team)}</span></td>
        <td onclick="event.stopPropagation()">${featTags}</td>
      </tr>`;
    }).join('');

    const canManage = u.role === 'admin';

    return `<div class="page">
      <div class="page__head"><div><h1>User Management</h1><p>Provision PolicyOS users, assign roles, and scope their AI features and policy categories. Access here mirrors what each user can retrieve through Tara.</p></div><div class="spacer"></div>
        ${canManage ? `<div class="splitbtn" style="position:relative;display:inline-flex">
          <button class="btn btn--primary" style="border-top-right-radius:0;border-bottom-right-radius:0" onclick="App.usermgmtView.addNew()">${App.icon('plus')} Manage Users</button>
          <button class="btn btn--primary" style="border-top-left-radius:0;border-bottom-left-radius:0;border-left:1px solid rgba(255,255,255,.25);padding-left:11px;padding-right:11px" onclick="App.usermgmtView.toggleMenu(event)" title="More options">${App.icon('chevron')}</button>
          <div id="umMenu" style="display:none"></div>
        </div>` : ''}
      </div>

      <div class="info-banner">${App.icon('shield')} <span><strong>${DB.users.length} active users</strong> · roles and feature flags below are enforced at retrieval - a user only ever queries the categories and sources their role permits.</span></div>

      <div class="toolbar">
        <div class="search-input">${App.icon('search')}<input id="umSearch" placeholder="Search by name, email or ID…"/></div>
        <select class="select" id="umRole"><option value="">All roles</option>${Object.keys(DB.roleLabels).map(r=>`<option value="${r}">${App.esc(DB.roleLabels[r])}</option>`).join('')}</select>
      </div>

      <div class="table-wrap"><table class="tbl"><thead><tr><th>Employee ID</th><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th>Team / Category</th><th>AI features</th></tr></thead><tbody id="umBody">${rows}</tbody></table></div>
    </div>`;
  },
  mount(root) {
    const filter = () => {
      const q = (root.querySelector('#umSearch').value || '').toLowerCase();
      const role = root.querySelector('#umRole').value;
      root.querySelectorAll('#umBody tr').forEach(tr => {
        const ok = tr.dataset.name.includes(q) && (!role || tr.dataset.role === role);
        tr.style.display = ok ? '' : 'none';
      });
    };
    root.querySelector('#umSearch').oninput = filter;
    root.querySelector('#umRole').onchange = filter;
  }
});

App.usermgmtView = {

  /* ---------- split-button menu ---------- */
  toggleMenu(e) {
    e.stopPropagation();
    const m = document.getElementById('umMenu');
    if (!m) return;
    if (m.style.display === 'block') { m.style.display = 'none'; return; }
    m.style.display = 'block';
    m.style.cssText = 'display:block;position:absolute;right:0;top:44px;width:230px;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-lg);padding:8px;z-index:50';
    const item = (icon, label, sub, fn) =>
      `<div class="cmdk__item" onclick="document.getElementById('umMenu').style.display='none';App.usermgmtView.${fn}()">${App.icon(icon)}<div style="flex:1"><div style="font-weight:600;font-size:13px">${label}</div><div style="font-size:11.5px;color:var(--muted)">${sub}</div></div></div>`;
    m.innerHTML =
      item('user', 'Add New Users', 'Create a single user', 'addNew') +
      item('up', 'Add Users in Bulk', 'Upload a CSV', 'addBulk') +
      item('edit', 'Modify Bulk Users', 'Edit roles & access in bulk', 'modifyBulk');
    setTimeout(() => document.addEventListener('click', function h() {
      const el = document.getElementById('umMenu'); if (el) el.style.display = 'none';
      document.removeEventListener('click', h);
    }), 0);
  },

  /* ---------- Add New Users ---------- */
  addNew() {
    const roleOpts = Object.keys(DB.roleLabels).map(r => `<option value="${r}">${App.esc(DB.roleLabels[r])}</option>`).join('');

    const featRow = (id, title, sub, on) =>
      `<div class="togglerow"><div class="togglerow__txt"><b>${title}</b><span>${sub}</span></div><div class="spacer"></div><button class="toggle ${on?'on':''}" onclick="this.classList.toggle('on')"></button></div>`;

    const catRow = c =>
      `<div class="togglerow"><div class="togglerow__txt"><b><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${c.color};margin-right:7px;vertical-align:middle"></span>${App.esc(c.name)}</b><span>${App.esc((c.subs||[]).join(', '))}</span></div><div class="spacer"></div><button class="toggle" onclick="this.classList.toggle('on')"></button></div>`;

    App.openModal({
      title: 'User Addition', sub: 'Create a PolicyOS user and scope their AI features and policy access.', lg: true,
      body: `
        <div class="grid grid-2">
          <div class="field" style="margin-bottom:0"><label>Employee Id <span class="req">*</span></label><input class="input" placeholder="e.g. THQ0182"/></div>
          <div class="field" style="margin-bottom:0"><label>Employee Email <span class="req">*</span></label><input class="input" placeholder="name@tartanhq.com"/></div>
        </div>
        <div class="grid grid-2 mt-16">
          <div class="field" style="margin-bottom:0"><label>Mobile Number <span class="req">*</span></label><input class="input" placeholder="+91 ••••• •••••"/></div>
          <div class="field" style="margin-bottom:0"><label>Name <span class="req">*</span></label><input class="input" placeholder="Full name"/></div>
        </div>
        <div class="field mt-16"><label>Role <span class="req">*</span></label><select class="select" style="width:100%">${roleOpts}</select><div class="hint">Role governs which screens and approval levels this user sees.</div></div>

        <div class="divider"></div>
        <div class="login__label">AI Feature Access</div>
        ${featRow('polygpt', 'PolyGPT', 'Answers policy questions in natural language', true)}
        ${featRow('compare', 'Compare Policies', 'Compare versions side-by-side', false)}
        ${featRow('assessments', 'Assessments', 'Create AI questionnaires from policies', false)}

        <div class="divider"></div>
        <div class="login__label">Policy &amp; category access</div>
        <p class="muted" style="font-size:12.5px;margin:-2px 0 6px">Grant which policy categories this user can view and query. This maps directly to retrieval-time RBAC.</p>
        ${DB.categories.map(catRow).join('')}
      `,
      footer: `<button class="btn" onclick="App.usermgmtView.addNew()">${App.icon('plus')} Add More</button>
        <div class="spacer" style="flex:1"></div>
        <button class="btn" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn--primary" onclick="App.closeModal();App.toast('User created &amp; invited (demo)')">${App.icon('check')} Submit</button>`
    });
  },

  /* ---------- Add Users in Bulk ---------- */
  addBulk() {
    App.openModal({
      title: 'Add Users in Bulk', sub: 'Upload a CSV to provision multiple users at once.', lg: true,
      body: `
        <div class="field"><label>User CSV <span class="req">*</span></label>
          <div class="pdf-ph" style="min-height:auto;padding:30px;text-align:center;cursor:pointer" onclick="App.toast('Select a CSV file (demo)','warn')">
            ${App.icon('up')}
            <div style="margin-top:10px;font-weight:600;font-size:13.5px">Drop your CSV here, or click to browse</div>
            <div class="muted" style="margin-top:4px;font-size:12.5px">Accepts .csv · up to 1,000 rows</div>
          </div>
          <div class="hint"><a onclick="App.toast('Sample CSV downloaded (demo)')" style="color:var(--brand-700);font-weight:600;cursor:pointer">${App.icon('download')} Download sample CSV</a></div>
        </div>

        <div class="info-banner" style="margin-top:4px">${App.icon('info')} <span><strong>Before you upload</strong></span></div>
        <div style="padding:2px 2px 0">
          <div class="minirow">${App.icon('check')}<span style="flex:1">Mandatory columns: <strong>Employee ID</strong>, <strong>Name</strong>, <strong>Email</strong>, <strong>Role</strong>, <strong>Product Category</strong>.</span></div>
          <div class="minirow">${App.icon('alert')}<span style="flex:1"><strong>Administrators cannot be bulk-added</strong> - admin access must be granted individually.</span></div>
          <div class="minirow">${App.icon('key')}<span style="flex:1">Each <strong>Employee ID</strong> and <strong>Email</strong> must be unique; duplicates are skipped.</span></div>
          <div class="minirow">${App.icon('layers')}<span style="flex:1">Product Category must match an existing category: ${DB.categories.map(c=>`<span class="tag">${App.esc(c.name)}</span>`).join(' ')}.</span></div>
        </div>
      `,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn--primary" onclick="App.closeModal();App.toast('Bulk users queued for import (demo)')">${App.icon('up')} Add Users</button>`
    });
  },

  /* ---------- Modify Bulk Users ---------- */
  modifyBulk() {
    App.openModal({
      title: 'Modify Bulk Users', sub: 'Apply a role or category change across multiple existing users.', lg: true,
      body: `
        <div class="field"><label>Select users</label>
          <div class="table-wrap" style="max-height:260px">
            <table class="tbl"><thead><tr><th style="width:36px"></th><th>Name</th><th>Current role</th></tr></thead><tbody>
            ${DB.users.map(p => { const e = App.emp(p.id); if(!e) return '';
              return `<tr><td><button class="toggle" onclick="this.classList.toggle('on')"></button></td>
                <td><div class="cell-person">${App.ui.avatar(e,'sm')}<span class="cell-strong">${App.esc(e.name)}</span></div></td>
                <td>${App.ui.pill(DB.roleLabels[p.role]||p.role,'gray')}</td></tr>`;
            }).join('')}
            </tbody></table>
          </div>
        </div>
        <div class="grid grid-2 mt-8">
          <div class="field" style="margin-bottom:0"><label>Set role to</label><select class="select" style="width:100%"><option value="">- No change -</option>${Object.keys(DB.roleLabels).map(r=>`<option value="${r}">${App.esc(DB.roleLabels[r])}</option>`).join('')}</select></div>
          <div class="field" style="margin-bottom:0"><label>Grant category</label><select class="select" style="width:100%"><option value="">- No change -</option>${DB.categories.map(c=>`<option>${App.esc(c.name)}</option>`).join('')}</select></div>
        </div>
      `,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn--primary" onclick="App.closeModal();App.toast('Bulk changes applied (demo)')">${App.icon('check')} Apply changes</button>`
    });
  },

  /* ---------- Row click → user profile / edit ---------- */
  profile(id) {
    const p = DB.users.find(x => x.id === id);
    const e = App.emp(id);
    if (!p || !e) return;
    const feats = [
      ['PolyGPT', p.features && p.features.polygpt, 'Answers policy questions'],
      ['Compare Policies', p.features && p.features.compare, 'Compare versions'],
      ['Assessments', p.features && p.features.assessments, 'Create AI questionnaires'],
      ['Tara Copilot', p.features && p.features.copilot, 'Cross-source company brain']
    ];
    const featRows = feats.map(([t, on, sub]) =>
      `<div class="minirow"><div style="flex:1"><b style="font-weight:600">${t}</b> <span class="muted" style="font-size:12px">· ${sub}</span></div>${on?App.ui.pill('Enabled','green',true):App.ui.pill('Off','gray')}</div>`
    ).join('');

    // categories this user can reach via the policies they can view
    const visCats = Array.from(new Set(App.visiblePolicies(Object.assign({}, e, p)).map(x => x.category)));
    const catTags = visCats.length
      ? visCats.map(c => `<span class="tag">${App.esc(c)}</span>`).join(' ')
      : '<span class="muted" style="font-size:12px">No category access</span>';

    App.openModal({
      title: e.name, sub: DB.roleLabels[p.role] + ' · ' + e.team,
      body: `<div class="row gap-12" style="margin-bottom:14px">${App.ui.avatar(e,'lg')}<div class="row gap-8">${App.ui.pill('Active','green',true)}${p.hrAdmin?App.ui.pill('HR Admin','teal'):''}<span class="muted" style="font-size:12px;align-self:center">${App.esc(e.title)}</span></div></div>
        <div class="minirow"><span class="muted">Employee ID</span><span class="spacer" style="flex:1"></span><b class="mono">${App.esc(e.id)}</b></div>
        <div class="minirow"><span class="muted">Email</span><span class="spacer" style="flex:1"></span><b>${App.esc(e.email)}</b></div>
        <div class="minirow"><span class="muted">Role</span><span class="spacer" style="flex:1"></span><b>${App.esc(DB.roleLabels[p.role])}</b></div>
        <div class="divider"></div>
        <b style="font-size:12.5px">AI feature access</b>${featRows}
        <div class="divider"></div>
        <b style="font-size:12.5px">Policy categories this user can query</b>
        <div class="row wrap gap-6 mt-8">${catTags}</div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>
        <button class="btn btn--primary" onclick="App.closeModal();App.usermgmtView.addNew()">${App.icon('edit')} Edit user</button>`
    });
  }
};
