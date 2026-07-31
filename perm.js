/* ============================================================
   perm.js - connector access control + the "sources" layer.

   Access is granted in TEAM BUCKETS pulled from the HRMS: everyone on a team inherits the
   same tool scopes per connector, so a new joiner is productive on day one. On top of that an
   admin can set PER-USER overrides (grant an extra scope, or revoke one the team has), and can
   COPY one person's effective permissions and PASTE them onto another (new-joiner flow).

     effective = team bucket  ∪  grants  −  revokes          (admins get every scope)

   A scope is only USABLE if the connector is actually connected. DB.connectors[].status seeds
   the demo as connected; an explicit connect/disconnect in the UI always wins.
   ============================================================ */
(function () {
  const App = window.App;

  /* ---------------- connection state: seeded from data, overridable by the user ---------------- */
  const OFF_KEY = 'policyos_conn_off';
  const _off = (function () { try { return JSON.parse(localStorage.getItem(OFF_KEY) || '{}') || {}; } catch (e) { return {}; } })();
  const saveOff = () => { try { localStorage.setItem(OFF_KEY, JSON.stringify(_off)); } catch (e) {} };

  App.conn.state = function (id) {
    if (_off[id]) return null;                                  // an explicit disconnect always wins
    const cfg = App.conn.all()[id];
    if (cfg && cfg.connected) return cfg;                       // explicitly connected in the UI
    const c = (DB.connectors || []).find(x => x.id === id);
    if (c && c.status === 'connected') {                        // seeded demo connection
      const oauth = String(c.auth || '').toLowerCase().indexOf('oauth') >= 0;
      return { connected: true, method: oauth ? 'oauth' : 'api', key: '', url: '', seeded: true };
    }
    return null;
  };
  const _save = App.conn._save, _disconnect = App.conn.disconnect;
  // clear the suppression only when the credential is actually valid (the original bails on an empty one)
  App.conn._save = function (id) {
    const d = App.conn._draft || {};
    const ok = (d.method === 'mcp') ? !!String(d.url || '').trim() : !!String(d.key || '').trim();
    if (ok) { delete _off[id]; saveOff(); }
    return _save.call(App.conn, id);
  };
  App.conn.disconnect = function (id) {
    _off[id] = 1; saveOff();
    const c = (DB.connectors || []).find(x => x.id === id);
    const t = App.toast; App.toast = function () {};             // the original emits a generic toast; use a named one
    try { _disconnect.call(App.conn, id); } finally { App.toast = t; }   // drops the stored credential too
    App.toast((c ? c.name : 'Source') + ' disconnected');
  };

  /* ---------------- the access engine ---------------- */
  const A = {
    /* --- catalog --- */
    toolsFor(connId) { return ((DB.connectorTools || {})[connId] || []).slice(); },
    tool(scopeId) {
      const cat = DB.connectorTools || {};
      for (const k in cat) { const t = cat[k].find(x => x.id === scopeId); if (t) return Object.assign({ connId: k }, t); }
      return null;
    },
    connOf(scopeId) { return String(scopeId || '').split('.')[0]; },
    writeTools(connId) { return A.toolsFor(connId).filter(t => t.write); },

    /* --- team buckets --- */
    teamScopes(team, connId) { const t = (DB.teamAccess || {})[team] || {}; return (t[connId] || []).slice(); },
    teamHas(team, connId, scopeId) { return A.teamScopes(team, connId).indexOf(scopeId) >= 0; },
    setTeamScope(team, connId, scopeId, on) {
      if (!DB.teamAccess[team]) DB.teamAccess[team] = {};
      const list = DB.teamAccess[team][connId] || (DB.teamAccess[team][connId] = []);
      const i = list.indexOf(scopeId);
      if (on && i < 0) list.push(scopeId);
      if (!on && i >= 0) list.splice(i, 1);
      return on;
    },
    teamMembers(team) { return (DB.employees || []).filter(e => e.team === team); },

    /* --- per-user overrides --- */
    delta(empId) {
      if (!DB.userAccess[empId]) DB.userAccess[empId] = { grant: {}, revoke: {} };
      const d = DB.userAccess[empId]; if (!d.grant) d.grant = {}; if (!d.revoke) d.revoke = {};
      return d;
    },
    // 'role' (admin), 'inherit' (from team), 'grant' (per-user add), 'revoke' (per-user block), 'off'
    mode(empId, connId, scopeId) {
      const persona = (DB.users || []).find(x => x.id === empId);
      if (persona && persona.role === 'admin') return 'role';
      const emp = App.emp(empId); const d = A.delta(empId);
      if (((d.revoke || {})[connId] || []).indexOf(scopeId) >= 0) return 'revoke';
      if (((d.grant || {})[connId] || []).indexOf(scopeId) >= 0) return 'grant';
      if (emp && A.teamHas(emp.team, connId, scopeId)) return 'inherit';
      return 'off';
    },
    setMode(empId, connId, scopeId, mode) {
      const d = A.delta(empId);
      const g = d.grant[connId] || (d.grant[connId] = []);
      const r = d.revoke[connId] || (d.revoke[connId] = []);
      const pull = (arr) => { const i = arr.indexOf(scopeId); if (i >= 0) arr.splice(i, 1); };
      pull(g); pull(r);
      if (mode === 'grant') g.push(scopeId);
      if (mode === 'revoke') r.push(scopeId);
      return mode;
    },
    // one click cycles between "as the team has it" and an explicit per-user override
    cycle(empId, connId, scopeId) {
      const m = A.mode(empId, connId, scopeId);
      if (m === 'role') return 'role';
      const next = (m === 'inherit') ? 'revoke' : (m === 'revoke') ? 'inherit' : (m === 'off') ? 'grant' : 'off';
      A.setMode(empId, connId, scopeId, (next === 'inherit' || next === 'off') ? 'inherit' : next);
      return next;
    },

    /* --- effective permissions --- */
    effective(empId, connId) {
      const tools = A.toolsFor(connId); const out = [];
      tools.forEach(t => { const m = A.mode(empId, connId, t.id); if (m === 'role' || m === 'inherit' || m === 'grant') out.push({ id: t.id, src: m }); });
      return out;
    },
    effectiveAll(empId) {
      const out = {};
      Object.keys(DB.connectorTools || {}).forEach(cid => { const e = A.effective(empId, cid); if (e.length) out[cid] = e.map(x => x.id); });
      return out;
    },
    countFor(empId) { let n = 0; Object.keys(DB.connectorTools || {}).forEach(cid => { n += A.effective(empId, cid).length; }); return n; },
    // does this person hold the scope? (ignores whether the source is live)
    has(user, scopeId) {
      const id = (user && user.id) || user; if (!id) return false;
      return A.effective(id, A.connOf(scopeId)).some(x => x.id === scopeId);
    },
    // can the assistant actually run it right now? (scope held AND source connected)
    usable(user, scopeId) { return A.has(user, scopeId) && App.conn.isConnected(A.connOf(scopeId)); },
    denyReason(user, scopeId) {
      const t = A.tool(scopeId); const cid = A.connOf(scopeId);
      const c = (DB.connectors || []).find(x => x.id === cid);
      const nm = c ? c.name : cid;
      if (!App.conn.isConnected(cid)) return nm + ' is not connected. Connect it in Connectors first.';
      if (!A.has(user, scopeId)) return 'Your access to ' + nm + ' does not include “' + (t ? t.label : scopeId) + '”. An administrator can grant it in Connectors › Access management.';
      return '';
    },

    /* --- copy / paste permissions (new-joiner flow) --- */
    clip: null,
    copy(empId) {
      const emp = App.emp(empId);
      A.clip = { from: empId, name: emp ? emp.name : empId, perms: A.effectiveAll(empId) };
      return A.clip;
    },
    // make the target's EFFECTIVE set match the clipboard, expressed as per-user deltas over their own team
    paste(empId) {
      if (!A.clip) return 0;
      const emp = App.emp(empId); if (!emp) return 0;
      const before = A.effectiveAll(empId);                         // compare EFFECTIVE sets, not deltas
      const d = A.delta(empId); d.grant = {}; d.revoke = {};
      Object.keys(DB.connectorTools || {}).forEach(cid => {
        const want = (A.clip.perms[cid] || []);
        A.toolsFor(cid).forEach(t => {
          const inTeam = A.teamHas(emp.team, cid, t.id);
          const wanted = want.indexOf(t.id) >= 0;
          if (wanted && !inTeam) A.setMode(empId, cid, t.id, 'grant');
          else if (!wanted && inTeam) A.setMode(empId, cid, t.id, 'revoke');
        });
      });
      const after = A.effectiveAll(empId);
      let n = 0;                                                    // how many scopes actually moved
      Object.keys(DB.connectorTools || {}).forEach(cid => {
        const b = before[cid] || [], a = after[cid] || [];
        b.forEach(x => { if (a.indexOf(x) < 0) n++; });
        a.forEach(x => { if (b.indexOf(x) < 0) n++; });
      });
      return n;
    },

    /* --- what the assistant can reach for this person (drives the brain surface) --- */
    reach(user) {
      const out = [];
      (DB.connectors || []).forEach(c => {
        if (!App.conn.isConnected(c.id)) return;
        const eff = A.effective((user && user.id) || user, c.id);
        if (eff.length) out.push({ id: c.id, name: c.name, kind: c.kind, scopes: eff.map(x => x.id) });
      });
      return out;
    }
  };
  App.access = A;

  /* ---------------- sources layer (previously parked) ----------------
     What the assistant can see. Policies are always in scope (native RBAC); connected
     sources add to that, and each one still enforces its own permissions at retrieval. */
  App.connectedSources = () => (DB.connectors || []).filter(c => App.conn.isConnected(c.id));
  App.hasSource = (id) => App.conn.isConnected(id);
  App.sourceLabels = () => App.connectedSources().map(c => c.name);
  App.sourceNouns = () => {
    const n = ['your policies', 'eligibility', 'regulations'];
    if (App.hasSource('keka') || App.hasSource('greythr')) n.unshift('people');
    if (App.hasSource('jira')) n.push('project work');
    if (App.hasSource('notion')) n.push('docs');
    return n;
  };
  App.sourceNounList = (join) => {
    const n = App.sourceNouns().slice(0, 3); const j = join || 'and';
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' ' + j + ' ' + n[n.length - 1] : n[0];
  };
  App.sourcePhrase = () => {
    const labs = App.sourceLabels();
    if (!labs.length) return 'your policy library';
    const shown = labs.slice(0, 3);
    return 'your policy library, ' + shown.join(', ') + (labs.length > 3 ? ' and ' + (labs.length - 3) + ' more' : '');
  };
  App.sourceChips = () => {
    const chips = [`<span class="src-chip policy">${App.icon('shield')} Policies</span>`];
    App.connectedSources().slice(0, 5).forEach(c => { chips.push(`<span class="src-chip">${App.conn.logo(c.id, 13)} ${App.esc(c.name)}</span>`); });
    return chips.join('');
  };
})();
