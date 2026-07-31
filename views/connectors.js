/* Connectors - the sources that power the company brain, plus who may use each tool.
   List → click a source → two tabs:
     Configuration     - how it's connected, what it ingests, the tools it exposes.
     Access management - TEAM BUCKETS from the HRMS (everyone on a team inherits the same
                         scopes) plus per-person overrides, with copy/paste for new joiners.
   Editing access is admin-only; App.access resolves team ∪ grants − revokes. */
App.registerView('connectors', {
  title: 'Connectors',
  enter() { App.connectorsView.detail = null; App.connectorsView.tab = 'config'; },
  render(ctx) {
    if (!App.canAccessView('connectors', ctx.user)) return App.lockedPage('Connectors', 'Connectors and access management are for administrators.');
    return App.connectorsView.detail ? App.connectorsView._detail(ctx) : App.connectorsView._list(ctx);
  }
});

App.connectorsView = {
  detail: null,          // connector id
  tab: 'config',         // 'config' | 'access'

  _refresh() {
    if (App.state.route !== 'connectors') return;      // never paint over whatever view is open now
    const root = document.getElementById('viewRoot'); if (!root) return;
    const v = App.views['connectors']; const ctx = { user: App.currentUser() };
    root.innerHTML = v.render(ctx);
  },
  open(id) { this.detail = id; this.tab = 'config'; this._refresh(); },
  back() { this.detail = null; this._refresh(); },
  setTab(t) { this.tab = t; this._refresh(); },

  /* ---------------- list ---------------- */
  _list(ctx) {
    const llmMeta = App.llm.modelMeta('primary');
    const live = App.connectedSources().length;

    const modelCard = `<div class="card" style="margin-bottom:22px">
      <div class="card__head">${App.icon('sparkles')}<h3>AI model</h3><div class="spacer"></div>
        <button class="btn btn--primary btn--sm" onclick="App.llm.openSetup()">${App.icon('zap')} ${llmMeta ? 'Manage model' : 'Connect a model'}</button></div>
      <div class="card__body">
        <p class="muted" style="font-size:13px;margin-bottom:12px">Bring your own key - Gemini, ChatGPT, Claude, Sarvam, Grok or Perplexity. On-prem and model-agnostic: the model only ever receives the slice of data the signed-in user is allowed to see.</p>
        <div class="minirow" style="border:1px solid var(--line);border-radius:10px;padding:12px 14px">
          ${llmMeta ? App.llm.logo(llmMeta.provider, 26) : App.icon('plug')}
          <div style="flex:1"><div style="font-weight:600">${llmMeta ? App.esc(llmMeta.modelLabel) : 'No model connected'}</div>
            <div class="muted" style="font-size:12px">${llmMeta ? 'Primary · ' + App.esc(llmMeta.providerLabel) : 'Running the offline demo engine'}</div></div>
          ${llmMeta ? App.ui.pill('Live', 'green', true) : App.ui.pill('Demo', 'gray')}
        </div>
      </div></div>`;

    const card = c => {
      const on = App.conn.isConnected(c.id);
      const tools = App.access.toolsFor(c.id);
      const writes = tools.filter(t => t.write).length;
      return `<button class="cn-card" onclick="App.connectorsView.open('${c.id}')">
        <div class="cn-card__h">${App.conn.logo(c.id, 34)}
          <div class="cn-card__nm"><b>${App.esc(c.name)}</b><span>${App.esc(c.kind)}</span></div>
          ${on ? App.ui.pill('Connected', 'green', true) : App.ui.pill('Available', 'gray')}</div>
        <div class="cn-card__note">${App.esc(c.note)}</div>
        <div class="cn-card__f">
          <span class="cn-card__cap">${tools.length} tool${tools.length === 1 ? '' : 's'}</span>
          ${writes ? `<span class="cn-tool cn-tool--write">${App.icon('edit')} ${writes} write</span>` : `<span class="cn-tool">${App.icon('eye')} read-only</span>`}
          <div style="flex:1"></div>
          <span class="muted" style="font-size:11.5px">${on ? App.esc(c.synced) : 'Not connected'}</span>
        </div></button>`;
    };

    return `<div class="page">
      <div class="page__head"><div><h1>Connectors</h1><p>Everything the assistant can reach, and who may use each tool. Sources keep their own permissions; on top of that, access is granted in team buckets pulled from your HRMS.</p></div></div>
      <div class="info-banner">${App.icon('lock')} <span><strong>${live} source${live === 1 ? '' : 's'} connected.</strong> The assistant can only use a tool when the source is connected <em>and</em> the signed-in person holds that scope - so the same question returns different answers to different people.</span></div>
      ${modelCard}
      <h3 style="margin:6px 0 12px;font-size:15px">Data sources</h3>
      <div class="grid grid-3">${DB.connectors.map(card).join('')}</div>
    </div>`;
  },

  /* ---------------- detail: hero + tabs ---------------- */
  _detail(ctx) {
    const id = this.detail; const c = DB.connectors.find(x => x.id === id);
    if (!c) { this.detail = null; return this._list(ctx); }
    const on = App.conn.isConnected(id); const st = App.conn.state(id);
    const tools = App.access.toolsFor(id);

    const hero = `<div class="cn-hero">${App.conn.logo(id, 46)}
      <div class="cn-hero__m"><h2>${App.esc(c.name)}</h2><p>${App.esc(c.note)}</p>
        <div class="cn-hero__meta">
          <span>${App.icon('database')} ${App.esc(c.kind)}</span>
          <span>${App.icon('key')} ${App.esc(c.auth)}</span>
          ${on ? `<span>${App.icon('clock')} ${App.esc(c.synced)}</span><span>${App.icon('users')} ${App.esc(c.count)}</span>` : ''}
        </div></div>
      ${on ? App.ui.pill('Connected', 'green', true) : App.ui.pill('Available', 'gray')}
      <button class="btn btn--sm ${on ? '' : 'btn--primary'}" onclick="App.conn.openSetup('${id}')">${App.icon(on ? 'edit' : 'plug')} ${on ? 'Manage' : 'Connect'}</button>
    </div>`;

    return `<div class="page">
      <div class="reg-bk" onclick="App.connectorsView.back()">${App.icon('arrow')} Back to connectors</div>
      ${hero}
      <div class="tabs">
        <div class="tab ${this.tab === 'config' ? 'is-active' : ''}" onclick="App.connectorsView.setTab('config')">Configuration</div>
        <div class="tab ${this.tab === 'access' ? 'is-active' : ''}" onclick="App.connectorsView.setTab('access')">Access management</div>
      </div>
      ${this.tab === 'config' ? this._config(c, on, st, tools) : this._access(c, tools, ctx.user)}
    </div>`;
  },

  _config(c, on, st, tools) {
    const method = st ? String(st.method || '').toUpperCase() : '-';
    return `<div class="grid grid-2" style="align-items:start;margin-bottom:20px">
        <div class="card"><div class="card__head">${App.icon('plug')}<h3>Connection</h3></div><div class="card__body">
          <div class="togglerow"><div class="togglerow__txt"><b>Status</b><span>${on ? 'Live - syncing on a schedule' : 'Not connected yet'}</span></div><div class="spacer"></div>${on ? App.ui.pill('Connected', 'green', true) : App.ui.pill('Available', 'gray')}</div>
          <div class="togglerow"><div class="togglerow__txt"><b>Method</b><span>${on ? 'Credentials stay in your environment' : App.esc(c.auth)}</span></div><div class="spacer"></div><span class="tag">${App.esc(on ? method : 'Choose on connect')}</span></div>
          <div class="togglerow"><div class="togglerow__txt"><b>Last sync</b><span>${on ? App.esc(c.count) + ' indexed' : 'Nothing indexed'}</span></div><div class="spacer"></div><span class="muted" style="font-size:12.5px">${on ? App.esc(c.synced) : '-'}</span></div>
          <div class="row gap-8" style="margin-top:14px">
            <button class="btn btn--sm ${on ? '' : 'btn--primary'}" onclick="App.conn.openSetup('${c.id}')">${App.icon(on ? 'edit' : 'plug')} ${on ? 'Edit connection' : 'Connect'}</button>
            ${on ? `<button class="btn btn--sm" onclick="App.toast('Test call succeeded - ${App.esc(c.name)} responded','ok')">${App.icon('zap')} Test</button>` : ''}
          </div>
        </div></div>
        <div class="card"><div class="card__head">${App.icon('shield')}<h3>How permissions work here</h3></div><div class="card__body">
          <p class="muted" style="font-size:13px;line-height:1.6">${App.esc(c.name)} keeps its own sharing rules - the assistant never sees more than the signed-in person can see in ${App.esc(c.name)} itself. On top of that, <strong>you</strong> decide which of the tools below each team may use.</p>
          <div class="row gap-8" style="margin-top:12px"><button class="btn btn--sm btn--primary" onclick="App.connectorsView.setTab('access')">${App.icon('users')} Manage access</button></div>
        </div></div>
      </div>
      <div class="card"><div class="card__head">${App.icon('code')}<h3>Tools this source exposes</h3><div class="spacer"></div><span class="muted" style="font-size:12px">${tools.length} total · ${tools.filter(t => t.write).length} can write</span></div>
        <div class="card__body" style="padding:6px 18px">
          ${tools.length ? tools.map(t => `<div class="cn-toolrow">
            <span class="cn-tool ${t.write ? 'cn-tool--write' : ''}">${App.icon(t.write ? 'edit' : 'eye')} ${t.write ? 'Write' : 'Read'}</span>
            <div class="cn-toolrow__m"><b>${App.esc(t.label)}</b> <code>${App.esc(t.id)}</code><span>${App.esc(t.note)}</span></div>
            ${App.ui.pill(t.risk === 'high' ? 'High risk' : t.risk === 'medium' ? 'Medium' : 'Low risk', t.risk === 'high' ? 'red' : t.risk === 'medium' ? 'amber' : 'gray')}
          </div>`).join('') : App.ui.empty('code', 'No tools defined', 'This source is catalogued but exposes no tools yet.')}
        </div></div>`;
  },

  /* ---------------- access management: team buckets + per-person overrides ---------------- */
  _access(c, tools, user) {
    const canEdit = user.role === 'admin';
    if (!tools.length) return App.ui.empty('users', 'Nothing to govern yet', 'This source exposes no tools.');

    const th = tools.map(t => `<th class="acc-th" title="${App.esc(t.note)}">${App.esc(t.label)}<div class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;margin-top:2px">${t.write ? 'write' : 'read'}</div></th>`).join('');
    const rows = DB.teams.map(tm => {
      const n = App.access.teamMembers(tm.name).length;
      const cells = tools.map(t => {
        const on = App.access.teamHas(tm.name, c.id, t.id);
        return `<td class="acc-td"><button class="acc-chk ${on ? 'is-on' : ''}" ${canEdit ? '' : 'disabled'} title="${on ? 'Granted to this team' : 'Not granted'}"
          onclick="App.connectorsView._toggleTeam('${tm.name.replace(/'/g, "\\'")}','${c.id}','${t.id}')">${App.icon('check')}</button></td>`;
      }).join('');
      return `<tr><td><div class="acc-team"><span class="acc-team__dot" style="background:${tm.color}"></span>
        <div class="acc-team__m"><b>${App.esc(tm.name)}</b><span>${n} ${n === 1 ? 'person' : 'people'} · lead ${App.esc(tm.lead)}</span></div></div></td>${cells}</tr>`;
    }).join('');

    // people carrying a per-person override on THIS connector
    const overrides = Object.keys(DB.userAccess || {}).map(uid => {
      const d = DB.userAccess[uid]; const g = (d.grant || {})[c.id] || []; const r = (d.revoke || {})[c.id] || [];
      if (!g.length && !r.length) return null;
      const e = App.emp(uid); if (!e) return null;
      return { e, g, r };
    }).filter(Boolean);

    const clip = App.access.clip;
    return `<div class="acc-bar">
        <span class="acc-bar__t">${App.icon('users')} Access is granted per <strong>team</strong> - everyone on a team inherits the same tools, so a new joiner is productive on day one. Per-person exceptions go below.</span>
        <div class="acc-legend">
          <span class="acc-badge acc-badge--inherit">inherited</span>
          <span class="acc-badge acc-badge--grant">granted</span>
          <span class="acc-badge acc-badge--revoke">revoked</span>
        </div>
      </div>
      ${canEdit ? '' : `<div class="info-banner">${App.icon('lock')} <span>Only administrators can change access. You're seeing the current grants read-only.</span></div>`}
      <div class="card" style="margin-bottom:22px"><div class="card__head">${App.icon('layers')}<h3>Team buckets</h3><div class="spacer"></div>
          <span class="muted" style="font-size:12px">${DB.teams.length} teams from ${App.esc((DB.connectors.find(x => x.kind === 'HRMS' && App.conn.isConnected(x.id)) || { name: 'your HRMS' }).name)}</span></div>
        <div class="table-wrap" style="border:none;border-radius:0"><table class="tbl acc-tbl"><thead><tr><th>Team</th>${th}</tr></thead><tbody>${rows}</tbody></table></div>
      </div>
      <div class="card"><div class="card__head">${App.icon('user')}<h3>Per-person overrides</h3><div class="spacer"></div>
          ${clip ? `<span class="muted" style="font-size:12px">Copied from ${App.esc(clip.name)}</span>` : ''}
          <button class="btn btn--sm" onclick="App.connectorsView._pickPerson()">${App.icon('plus')} Configure a person</button></div>
        <div class="card__body" style="padding:6px 18px">
          ${overrides.length ? overrides.map(o => `<div class="cn-toolrow">
              ${App.ui.avatar(o.e, 'sm')}
              <div class="cn-toolrow__m"><b>${App.esc(o.e.name)}</b> <code>${App.esc(o.e.team)}</code>
                <span>${o.g.length ? o.g.length + ' extra scope' + (o.g.length === 1 ? '' : 's') : ''}${o.g.length && o.r.length ? ' · ' : ''}${o.r.length ? o.r.length + ' revoked' : ''}</span></div>
              ${o.g.length ? `<span class="acc-badge acc-badge--grant">+${o.g.length}</span>` : ''}
              ${o.r.length ? `<span class="acc-badge acc-badge--revoke">−${o.r.length}</span>` : ''}
              <button class="btn btn--sm" onclick="App.connectorsView.permModal('${o.e.id}')">${App.icon('edit')} Edit</button>
            </div>`).join('') : App.ui.empty('check', 'No exceptions', 'Everyone gets exactly what their team bucket grants.')}
        </div></div>`;
  },

  _toggleTeam(team, connId, scopeId) {
    if (App.currentUser().role !== 'admin') { App.toast('Only administrators can change access', 'warn'); return; }
    const on = !App.access.teamHas(team, connId, scopeId);
    App.access.setTeamScope(team, connId, scopeId, on);
    const t = App.access.tool(scopeId);
    App.toast((on ? 'Granted “' : 'Removed “') + (t ? t.label : scopeId) + '” ' + (on ? 'to ' : 'from ') + team, 'ok');
    this._refresh();
  },

  _pickPerson() {
    const people = (DB.employees || []).slice(0, 60);
    App.openModal({ title: 'Configure a person', sub: 'Pick someone to give a per-person exception on top of their team bucket.', lg: true,
      body: `<div class="search-input" style="margin-bottom:12px">${App.icon('search')}<input id="permSearch" placeholder="Search people…" oninput="App.connectorsView._filterPeople()"/></div>
        <div class="reg-picklist" id="permPeople" style="max-height:54vh;overflow:auto">${people.map(e => `<button class="reg-pick" data-n="${App.esc(e.name.toLowerCase() + ' ' + e.team.toLowerCase())}" onclick="App.closeModal();App.connectorsView.permModal('${e.id}')">
          ${App.ui.avatar(e, 'sm')}<div style="flex:1;text-align:left"><b>${App.esc(e.name)}</b><div class="muted" style="font-size:12px">${App.esc(e.title)} · ${App.esc(e.team)}</div></div>
          <span class="tag">${App.access.countFor(e.id)} scopes</span></button>`).join('')}</div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>` });
  },
  _filterPeople() {
    const q = ((document.getElementById('permSearch') || {}).value || '').toLowerCase();
    document.querySelectorAll('#permPeople .reg-pick').forEach(el => { el.style.display = (el.dataset.n || '').indexOf(q) >= 0 ? '' : 'none'; });
  },

  /* ---------------- per-user permission editor (admin only; reused by User Management) ---------------- */
  permModal(empId) {
    const me = App.currentUser();
    if (me.role !== 'admin') { App.toast('Only administrators can configure permissions', 'warn'); return; }
    const e = App.emp(empId); if (!e) return;
    const persona = (DB.users || []).find(x => x.id === empId);
    const isAdmin = persona && persona.role === 'admin';
    const clip = App.access.clip;

    const body = `<div class="perm-head">${App.ui.avatar(e, 'lg')}
        <div class="perm-head__m"><b>${App.esc(e.name)}</b><span>${App.esc(e.title)} · ${App.esc(e.team)} · inherits the <strong>${App.esc(e.team)}</strong> bucket</span></div>
        ${isAdmin ? App.ui.pill('Administrator - full access', 'violet') : App.ui.pill(App.access.countFor(empId) + ' scopes', 'blue')}
      </div>
      ${isAdmin ? `<div class="info-banner" style="margin-top:14px">${App.icon('shield')} <span>Administrators hold every scope by role - there is nothing to override here.</span></div>` : `
      <div class="acc-bar" style="margin-top:14px">
        <span class="acc-bar__t">Click a scope to override the team default. <span class="acc-badge acc-badge--grant">granted</span> adds it, <span class="acc-badge acc-badge--revoke">revoked</span> withholds it.</span>
        <div class="acc-legend">
          <button class="btn btn--sm" onclick="App.connectorsView._copy('${empId}')">${App.icon('download')} Copy permissions</button>
          <button class="btn btn--sm" ${clip ? '' : 'disabled'} title="${clip ? 'Apply ' + App.esc(clip.name) + '\u2019s permissions' : 'Copy someone first'}" onclick="App.connectorsView._paste('${empId}')">${App.icon('plus')} Paste${clip ? ' from ' + App.esc(clip.name.split(' ')[0]) : ''}</button>
        </div>
      </div>
      ${DB.connectors.map(c => {
        const tools = App.access.toolsFor(c.id); if (!tools.length) return '';
        const live = App.conn.isConnected(c.id);
        return `<div class="perm-conn"><div class="perm-conn__h">${App.conn.logo(c.id, 20)}<b>${App.esc(c.name)}</b>
            ${live ? App.ui.pill('Connected', 'green', true) : App.ui.pill('Not connected', 'gray')}</div>
          <div class="perm-conn__b">${tools.map(t => {
            const m = App.access.mode(empId, c.id, t.id);
            const cls = m === 'grant' ? 'is-grant' : m === 'revoke' ? 'is-revoke' : m === 'inherit' ? 'is-on' : '';
            const lbl = m === 'grant' ? 'granted' : m === 'revoke' ? 'revoked' : m === 'inherit' ? 'inherited from ' + e.team : 'not granted';
            return `<div class="perm-row">
              <button class="acc-chk ${cls}" title="${App.esc(lbl)}" onclick="App.connectorsView._cycle('${empId}','${c.id}','${t.id}')">${App.icon(m === 'revoke' ? 'x' : 'check')}</button>
              <div class="perm-row__m"><b>${App.esc(t.label)}</b> <code>${App.esc(t.id)}</code></div>
              ${t.write ? `<span class="cn-tool cn-tool--write">${App.icon('edit')} write</span>` : ''}
              <span class="perm-src">${App.esc(lbl)}</span></div>`;
          }).join('')}</div></div>`;
      }).join('')}`}`;

    App.openModal({ title: 'Permissions', sub: 'Per-person access on top of the team bucket - administrators only.', lg: true, body: body,
      footer: `<button class="btn" onclick="App.closeModal()">Done</button>` });
  },
  _cycle(empId, connId, scopeId) {
    if (App.currentUser().role !== 'admin') return;
    App.access.cycle(empId, connId, scopeId);
    this.permModal(empId);                       // repaint the modal in place
    if (this.detail) this._refresh();
  },
  _copy(empId) {
    const c = App.access.copy(empId);
    App.toast('Copied ' + c.name + '\u2019s permissions - open another person and paste', 'ok');
    this.permModal(empId);
  },
  _paste(empId) {
    const n = App.access.paste(empId);
    const e = App.emp(empId);
    App.toast(n ? ('Applied ' + App.access.clip.name + '\u2019s permissions to ' + (e ? e.name : 'this person') + ' (' + n + ' change' + (n === 1 ? '' : 's') + ')') : 'Nothing to change - already identical', n ? 'ok' : 'warn');
    this.permModal(empId);
    if (this.detail) this._refresh();
  }
};
