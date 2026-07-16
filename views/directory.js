/* People & access - users and the policy access they hold.
   No HRMS-sourced data (presence / check-in / attendance) yet - that arrives with connectors. */
App.registerView('directory', {
  title: 'People Directory',
  render(ctx) {
    const rows = DB.employees.map(e => `
      <tr class="clickable" data-n="${e.name.toLowerCase()}" data-team="${e.team}" onclick="App.directoryView.profile('${e.id}')">
        <td><div class="cell-person">${App.ui.avatar(e,'sm')}<div><div class="cell-strong">${App.esc(e.name)}</div><div class="muted" style="font-size:12px">${App.esc(e.email)}</div></div></div></td>
        <td><span class="mono" style="font-size:12px;color:var(--muted)">${e.id}</span></td>
        <td>${App.esc(e.title)}</td>
        <td><span class="tag">${App.esc(e.team)}</span></td>
      </tr>`).join('');
    return `<div class="page">
      <div class="page__head"><div><h1>People Directory</h1><p>${DB.employees.length} people across ${DB.teams.length} teams.</p></div></div>
      <div class="info-banner">${App.icon('users')} <span>People and the access they hold. Live HRMS sync (joiners, leavers) arrives with connectors.</span></div>
      <div class="toolbar">
        <div class="search-input">${App.icon('search')}<input id="dirSearch" placeholder="Search by name or email…"/></div>
        <select class="select" id="dirTeam"><option value="">All teams</option>${DB.teams.map(t=>`<option>${t.name}</option>`).join('')}</select>
      </div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Emp ID</th><th>Title</th><th>Team</th></tr></thead><tbody id="dirBody">${rows}</tbody></table></div>
    </div>`;
  },
  mount(root, ctx) {
    const filter = () => {
      const q = (root.querySelector('#dirSearch').value || '').toLowerCase();
      const tm = root.querySelector('#dirTeam').value;
      root.querySelectorAll('#dirBody tr').forEach(tr => { tr.style.display = (tr.dataset.n.includes(q) && (!tm || tr.dataset.team === tm)) ? '' : 'none'; });
    };
    root.querySelector('#dirSearch').oninput = filter;
    root.querySelector('#dirTeam').onchange = filter;
    if (ctx.params && ctx.params.focus) setTimeout(() => App.directoryView.profile(ctx.params.focus), 120);
  }
});

App.directoryView = {
  profile(id) {
    const e = App.emp(id);
    const pu = DB.users.find(u => u.id === id);
    const role = pu ? DB.roleLabels[pu.role] : 'Not provisioned';
    const access = pu ? (pu.role === 'admin' ? 'All policies' : App.visiblePolicies(Object.assign({}, e, pu)).length + ' policies') : 'No access';
    App.openModal({
      title: e.name, sub: e.title + ' · ' + e.team,
      body: `<div class="minirow"><span class="muted">Employee ID</span><span class="spacer" style="flex:1"></span><b class="mono">${e.id}</b></div>
        <div class="minirow"><span class="muted">Email</span><span class="spacer" style="flex:1"></span><b>${App.esc(e.email)}</b></div>
        <div class="minirow"><span class="muted">Team</span><span class="spacer" style="flex:1"></span><b>${App.esc(e.team)}</b></div>
        <div class="minirow"><span class="muted">Role</span><span class="spacer" style="flex:1"></span><b>${App.esc(role)}</b></div>
        <div class="minirow"><span class="muted">Policy access</span><span class="spacer" style="flex:1"></span><b>${App.esc(access)}</b></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>`
    });
  }
};
