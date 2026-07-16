/* Access Control - permission-faithful retrieval config (the moat surface) */
App.registerView('access', {
  title: 'Access Control',
  render(ctx) {
    const sourceCard = c => `<div class="card card--pad"><div class="row gap-8" style="margin-bottom:6px">${App.icon(c.id==='keka'?'users':c.id==='jira'?'branch':c.id==='notion'?'book':c.id==='slack'?'chat':'shield')}<b style="font-size:13.5px">${App.esc(c.name)}</b></div>
      <div class="muted" style="font-size:12.5px">${App.esc(c.note)}</div>
      <div class="row gap-6 mt-8"><span class="pill pill--gray">${App.icon('key')} ${App.esc(c.auth)}</span></div></div>`;

    const polRows = DB.policies.map(p => {
      const parts = [`<span class="tag">${App.esc(p.category)}</span>`];
      if (p.access && p.access.everyone) parts.unshift('<span class="pill pill--green">All staff</span>');
      ((p.access && p.access.users)||[]).forEach(uid=>{const e=App.emp(uid);parts.push(`<span class="tag">${App.esc(e?e.name:uid)} (direct)</span>`);});
      const scope = parts.join(' ');
      return `<tr><td><div class="cell-strong">${App.esc(p.name)}${p.sensitive?' '+App.ui.pill('Confidential','red'):''}</div><div class="muted" style="font-size:12px">${App.esc(p.category)} · ${p.version}</div></td>
        <td><div class="row wrap gap-6">${scope}</div></td>
        <td><button class="btn btn--sm" onclick="App.accessView.edit('${p.id}')">${App.icon('edit')} Edit access</button></td></tr>`;
    }).join('');

    return `<div class="page">
      <div class="page__head"><div><h1>Access Control</h1><p>Define who can view and query each policy and source. Tara enforces these rules at retrieval time - it never returns a source a user can't already open.</p></div></div>
      <div class="info-banner">${App.icon('shield')} <span><strong>How access is derived:</strong> each connected source's native permissions are <strong>inherited</strong> automatically (Notion sharing, Jira roles, HRMS field visibility). The rules below are <strong>SPOC overrides &amp; source-level scoping</strong> on top of that.</span></div>

      <h3 style="margin:6px 0 12px;font-size:15px">Connected sources</h3>
      <div class="grid grid-3" style="margin-bottom:24px">${DB.connectors.filter(c=>c.status==='connected').map(sourceCard).join('')}</div>

      <h3 style="margin:6px 0 12px;font-size:15px">Policy access rules</h3>
      <div class="table-wrap" style="margin-bottom:24px"><table class="tbl"><thead><tr><th>Policy</th><th>Who can access</th><th></th></tr></thead><tbody>${polRows}</tbody></table></div>

      <div class="card"><div class="card__head">${App.icon('eye')}<h3>Access tester</h3><div class="spacer"></div><span class="muted" style="font-size:12px">Preview exactly what a persona can retrieve</span></div>
        <div class="card__body">
          <div class="grid grid-2" style="margin-bottom:14px">
            <div class="field" style="margin:0"><label>Persona</label><select class="select" id="atUser" style="width:100%">${DB.users.map(u=>{const e=App.emp(u.id);return `<option value="${u.id}">${App.esc(e.name)} - ${DB.roleLabels[u.role]}</option>`;}).join('')}</select></div>
            <div class="field" style="margin:0"><label>Policy</label><select class="select" id="atPol" style="width:100%">${DB.policies.map(p=>`<option value="${p.id}">${App.esc(p.name)}</option>`).join('')}</select></div>
          </div>
          <div id="atResult"></div>
        </div></div>
    </div>`;
  },
  mount(root) {
    const run = () => {
      const uid = root.querySelector('#atUser').value, pid = root.querySelector('#atPol').value;
      if (!uid || !pid || !App.emp(uid)) return;
      const persona = DB.users.find(u=>u.id===uid); const user = Object.assign({}, App.emp(uid), persona);
      const p = App.policy(pid); const ok = App.canViewPolicy(p, user);
      root.querySelector('#atResult').innerHTML = ok
        ? `<div class="lock-banner" style="background:var(--green-50);border-color:#bbf7d0;color:var(--green-700)">${App.icon('check')} <span><strong>${App.esc(App.emp(uid).name)}</strong> (${DB.roleLabels[persona.role]}) <strong>can</strong> view & query “${App.esc(p.name)}”. Tara will use it as a source.</span></div>`
        : `<div class="lock-banner">${App.icon('lock')} <span><strong>${App.esc(App.emp(uid).name)}</strong> (${DB.roleLabels[persona.role]}) <strong>cannot</strong> access “${App.esc(p.name)}”. Tara will refuse and mark the source as hidden.</span></div>`;
    };
    root.querySelector('#atUser').onchange = run;
    root.querySelector('#atPol').onchange = run;
    run();
  }
});

App.accessView = {
  edit(id) {
    const p = App.policy(id);
    // access is category-scoped; on top of that a policy can be shared company-wide or granted to named people
    const grantRows = DB.users.map(u => { const e = App.emp(u.id); const on = (p.access.users||[]).includes(u.id);
      return `<div class="togglerow"><div class="togglerow__txt"><b>${App.esc(e?e.name:u.id)}</b><span>${App.esc(DB.roleLabels[u.role]||u.role)}</span></div><div class="spacer"></div><button class="toggle ${on?'on':''}" onclick="this.classList.toggle('on')"></button></div>`;
    }).join('');
    App.openModal({
      title:'Edit access · '+p.name, sub:'Category scoping governs who sees this; add company-wide or per-person grants on top.', lg:true,
      body:`<div class="info-banner" style="margin-top:0">${App.icon('shield')} <span>This policy is in the <strong>${App.esc(p.category)}</strong> category. Anyone assigned that category can already view it - use the grants below to widen access.</span></div>
        <div class="togglerow"><div class="togglerow__txt"><b>All staff (company-wide)</b><span>Any authenticated employee can view &amp; query</span></div><div class="spacer"></div><button class="toggle ${p.access.everyone?'on':''}" onclick="this.classList.toggle('on')"></button></div>
        <div class="login__label mt-16">Direct grants (per person)</div>${grantRows}`,
      footer:`<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('Access rules updated (demo)')">Save access</button>`
    });
  }
};
