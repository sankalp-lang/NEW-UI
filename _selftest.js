/* Headless self-test (run with jsc; NOT included by index.html).
   Stubs a minimal DOM, loads data.js + core.js + all views, then executes
   every view.render() for every persona and exercises App.askTara(). */

function makeEl() {
  var e = { innerHTML:'', textContent:'', value:'', scrollTop:0, style:{}, dataset:{} };
  e.classList = { toggle:function(){}, add:function(){}, remove:function(){}, contains:function(){return false;} };
  e.querySelector = function(){ return makeEl(); };
  e.querySelectorAll = function(){ return []; };
  e.addEventListener = function(){};
  e.removeEventListener = function(){};
  e.appendChild = function(){};
  e.removeChild = function(){};
  e.remove = function(){};
  e.focus = function(){};
  e.closest = function(){ return makeEl(); };
  e.setAttribute = function(){};
  e.getAttribute = function(){ return null; };
  return e;
}
var document = {
  getElementById:function(){ return makeEl(); },
  querySelector:function(){ return makeEl(); },
  querySelectorAll:function(){ return []; },
  addEventListener:function(){},
  createElement:function(){ return makeEl(); },
  body: makeEl()
};
var window = globalThis;
globalThis.window = window;
globalThis.document = document;
globalThis.setTimeout = function(){ return 0; };
globalThis.clearTimeout = function(){};
globalThis.console = { log:function(){}, error:function(){}, warn:function(){}, info:function(){} };
globalThis.localStorage = { _d:{}, getItem:function(k){ return this._d[k]||null; }, setItem:function(k,v){ this._d[k]=v; }, removeItem:function(k){ delete this._d[k]; } };
globalThis.fetch = function(){ return Promise.reject(new Error('no network in harness')); };

var rd = (typeof readFile !== 'undefined') ? readFile : read;
function load(p){ try { (0, eval)(rd(p)); return null; } catch(e){ return p + ' :: ' + e; } }

var loadErrors = [];
['data.js','core.js','llm.js','sim.js','pdf.js','perm.js','agent.js','tour.js'].forEach(function(f){ var e=load(f); if(e) loadErrors.push('LOAD '+e); });

var viewFiles = ['home','dashboard','policies','directory','access','usersaccess','rulesense',
  'approvals','regulatory','usermgmt','category','bredecoder','insightgen','assessments','connectors'];  /* PolyGPT removed */
viewFiles.forEach(function(v){ var e=load('views/'+v+'.js'); if(e) loadErrors.push('LOAD '+e); });

if (loadErrors.length) { print('LOAD ERRORS:\n' + loadErrors.join('\n')); throw 'stop'; }

var personas = DB.users.map(function(u){ return Object.assign({}, App.emp(u.id), u); });
var routes = Object.keys(App.views);
var renderFails = [], mountWarns = [];

personas.forEach(function(user){
  App.state.user = user;
  App.state.home = []; App.state.chat = [];
  routes.forEach(function(route){
    var ctx = { user:user, params:{} };
    try {
      var html = App.views[route].render(ctx);
      if (typeof html !== 'string' || !html.length) renderFails.push(route+' ['+user.role+']: render returned non-string');
    } catch(e) { renderFails.push(route+' ['+user.role+']: '+e); }
    if (App.views[route].mount) {
      try { App.views[route].mount(makeEl(), ctx); }
      catch(e){ mountWarns.push(route+' ['+user.role+']: '+e); }
    }
  });
});

var queries = ["who's in the engineering team", "who is working on policyos",
  "what is abhishek chaudhary working on", "is sankalp in office today", "who is in office today",
  "what's the leave policy", "personal loan eligibility criteria", "what's anmol's salary",
  "two wheeler ltv", "show me the team headcount", "asdf gibberish nonsense"];
var askFails = [];
personas.forEach(function(user){
  queries.forEach(function(q){
    try { var r = App.askTara(q, user); if(!r || typeof r.html!=='string') askFails.push('askTara ['+user.role+'] "'+q+'" bad shape'); }
    catch(e){ askFails.push('askTara ['+user.role+'] "'+q+'": '+e); }
  });
});

/* --- RBAC semantic assertions (the actual product thesis) --- */
var semFails = [];
function chk(cond, msg){ if(!cond) semFails.push(msg); }
var admin = personas.find(function(p){return p.id==='THQ0144';});   // Sankalp / admin (all categories)
var pmL   = personas.find(function(p){return p.id==='THQ0101';});   // Anmol / policy manager (Lending)
var pmC   = personas.find(function(p){return p.id==='THQ0165';});   // Subhrangshu / policy manager (Compliance)
var staff = personas.find(function(p){return p.id==='THQ0125';});   // Chirag / staff user (HR + a doc grant)
function locked(r){ return /don.t have access|no access|cannot access|hidden|restricted/i.test(r.html) || (r.sources||[]).some(function(s){return s.kind==='locked';}); }
// Category-scoped permission moat
var a1=App.askTara('personal loan eligibility criteria', staff); chk(locked(a1), 'RBAC: staff must be DENIED the personal loan policy (Lending)');
var a3=App.askTara('personal loan eligibility criteria', admin); chk(/700|cibil/i.test(a3.html), 'RBAC: admin must SEE personal loan facts');
var a7=App.askTara("what's the leave policy", staff);            chk(/leave|privilege|18/i.test(a7.html) && !locked(a7), 'RBAC: staff CAN see everyone-policy (leave)');
var aK=App.askTara('kyc and aml policy summary', staff);         chk(locked(aK), 'RBAC: staff DENIED KYC (Compliance category, not assigned to them)');
// category scoping between two policy managers
chk(App.visiblePolicies(pmL).some(function(p){return p.id==='P-PL';}) && !App.visiblePolicies(pmL).some(function(p){return p.id==='P-KYC';}), 'RBAC: Lending PM sees Personal Loan, NOT the Compliance-only KYC policy');
chk(App.visiblePolicies(pmC).some(function(p){return p.id==='P-KYC';}) && !App.visiblePolicies(pmC).some(function(p){return p.id==='P-PL';}), 'RBAC: Compliance PM sees KYC, NOT any Lending policy');
chk(App.canEditPolicy(App.policy('P-PL'), pmL) && !App.canEditPolicy(App.policy('P-PL'), pmC), 'RBAC: only the in-category PM can edit a policy');
chk(App.canEditPolicy(App.policy('P-PL'), admin) && !App.canEditPolicy(App.policy('P-LEAVE'), staff), 'RBAC: admin edits anything; staff never edits');
// document-level grant mechanism: adding a person to access.users flips one out-of-category policy visible
var _gp = App.policy('P-MSME'); var _gBefore = App.canViewPolicy(_gp, staff);
_gp.access.users.push('THQ0125'); var _gAfter = App.canViewPolicy(_gp, staff); _gp.access.users = _gp.access.users.filter(function(x){return x!=='THQ0125';});
chk(_gBefore===false && _gAfter===true, 'RBAC: a per-person document grant flips a single out-of-category policy visible');

// LLM real-model path: the CONTEXT handed to the model is itself permission-filtered (policies-only now)
var ctxAdmin = App.llm.buildContext(admin), ctxStaff = App.llm.buildContext(staff);
chk(/Personal Loan Credit Policy/.test(ctxAdmin), 'LLM context: admin context INCLUDES the personal-loan policy');
chk(!/Personal Loan Credit Policy/.test(ctxStaff), 'LLM context: staff context EXCLUDES the personal-loan policy (moat is real)');
chk(/## PEOPLE/.test(ctxAdmin), 'LLM context: a connected source enters the context when the user holds its read scope');
var P = App.llm.PROVIDERS;
chk(P.gemini.models.length===3 && P.openai.models.length===2 && P.anthropic.models.length===3 && P.sarvam.models.length===1 && P.grok.models.length===1 && P.perplexity.models.length===1,
  'LLM catalog: 3 Gemini / 2 ChatGPT / 3 Claude / 1 Sarvam / 1 Grok / 1 Perplexity');
chk(App.llm.configured() === false, 'LLM: nothing connected by default (no Claude default)');
chk(DB.connectors && DB.connectors.length >= 5, 'Connector data retained (parked) for later');
chk(typeof App.signIn==='function' && typeof App.doSignIn==='function' && typeof App.signFill==='function', 'Sign-in flow handlers present');
var bootErr=null; try { App.boot(); } catch(e){ bootErr=e; } chk(!bootErr, 'Landing (multi-section) renders without throwing: '+(bootErr||''));
var nm = App.navModel(admin);
chk(nm.pinned && nm.groups && nm.groups.length>=3, 'Sidebar: pinned items + collapsible groups');
chk(nm.groups.some(g=>g.title==='Administration' && g.items.some(i=>i.id==='usersaccess')) && !nm.groups.some(g=>g.items.some(i=>['directory','access','usermgmt'].indexOf(i.id)>=0)), 'Sidebar: People Directory + Access Control + User Management merged into one "Users & access"');
chk(typeof App.toggleSidebar==='function' && typeof App.renderNav==='function' && typeof App.playScene==='function' && App.scene && App.scene.boundary && App.scene.insight && App.scene.connect, 'Sidebar toggle + renderNav + 3 animated scenes present');
var cmdErr=null; try { App.cmd.items(); } catch(e){ cmdErr=e; } chk(!cmdErr, 'Command palette works with new nav shape: '+(cmdErr||''));

// Category disable hides policies everywhere (visiblePolicies + Tara)
var hrCat = DB.categories.find(function(c){return c.name==='HR';});
chk(!!hrCat, 'Categories: HR present (only Lending/HR/Compliance)');
chk(!DB.categories.some(function(c){return c.name==='Others';}), 'Categories: Others removed');
hrCat.enabled = false;
chk(!App.visiblePolicies(admin).some(function(p){return p.id==='P-LEAVE';}), 'Category disable: HR policies vanish from visiblePolicies');
var leaveAns = App.askTara("what's the leave policy", admin);
chk(!/privilege leave|18 \/ yr/i.test(leaveAns.html), 'Category disable: Tara no longer answers the disabled HR leave policy');
hrCat.enabled = true;
chk(App.visiblePolicies(admin).some(function(p){return p.id==='P-LEAVE';}), 'Category re-enable: HR leave policy returns');

// CONNECTORS LIVE — sources seeded from DB.connectors[].status; single version (no editions)
chk(App.hasSource('keka') === true && App.hasSource('jira') === true, 'Connectors: seeded sources report as connected');
chk(App.hasSource('gdrive') === false, 'Connectors: a source that is NOT connected reports false');
chk(typeof App.edition === 'undefined' && typeof App.setEdition === 'undefined', 'Editions removed — single version');
chk(!!App.views['connectors'], 'Connectors: view registered');
chk(App.navModel(admin).groups.some(function(g){return g.items.some(function(i){return i.id==='connectors';});}), 'Connectors: in admin nav');
chk(!App.navModel(pmL).groups.some(function(g){return g.items.some(function(i){return i.id==='connectors';});}) && !App.canAccessView('connectors', staff), 'Connectors: admin-only (not for policy manager or staff)');
// askTara is policy-centric: people / Jira questions fall through (no HRMS/Jira source surfaced)
var pplQ = App.askTara('who is in office today', admin);
chk(!(pplQ.sources||[]).some(function(s){return s.kind==='hrms';}), 'Policy-centric: people query does NOT surface an HRMS source');
var workQ = App.askTara('who is working on policyos', admin);
chk(!(workQ.sources||[]).some(function(s){return s.kind==='jira';}), 'Policy-centric: work query does NOT surface a Jira source');
chk(/leave|18 \/ yr/i.test(App.askTara("what's the leave policy", admin).html), 'Policy Q&A still works');
chk(/720|cibil/i.test(App.askTara('what if we raise the CIBIL cutoff to 720?', admin).html), 'What-if simulation still works');
// LLM context is permission-faithful per SOURCE too: no read scope → that source's block is absent
var ctx = App.llm.buildContext(admin);
chk(/WORK IN PROGRESS/.test(ctx) && /POLICIES/.test(ctx), 'LLM context: admin (holds every scope) gets policies + connected-source blocks');
App.access.setMode(staff.id, 'jira', 'jira.read_issues', 'revoke');
chk(!/WORK IN PROGRESS/.test(App.llm.buildContext(staff)), 'LLM context: a user without jira.read_issues gets NO Jira context even though Jira is connected');
App.access.setMode(staff.id, 'jira', 'jira.read_issues', 'inherit');
// suggested prompts are policy / BFSI focused (no HRMS/Jira)
var sp = App.suggestPrompts(admin);
chk(sp.some(function(p){return p.tag==='Lending';}) && !sp.some(function(p){return p.tag==='HRMS' || p.tag==='Jira';}), 'Prompts: admin gets BFSI/lending prompts (no HRMS/Jira)');
var spStaff = App.suggestPrompts(staff);
chk(spStaff.length>=2 && !spStaff.some(function(p){return p.tag==='Lending' || p.tag==='Compliance' || p.tag==='Simulate';}), 'Prompts: staff prompts are permission-faithful (no Lending/Compliance/Simulate)');

// Model config: selecting a model persists & shows even without a key (demo); a key makes it live
try { localStorage.setItem('policyos_llm_cfg', JSON.stringify({primary:{provider:'anthropic',model:'claude-opus-4-8',key:''}})); } catch(e){}
chk(App.llm.selected()===true && App.llm.configured()===false, 'Model: keyless selection is "selected" but not live');
chk(/Claude Opus 4\.8/.test(App.llm.statusLabel()) && /demo/.test(App.llm.statusLabel()), 'Model: header shows the chosen model (demo tag, no key)');
try { localStorage.setItem('policyos_llm_cfg', JSON.stringify({primary:{provider:'anthropic',model:'claude-opus-4-8',key:'sk-ant-x'}})); } catch(e){}
chk(App.llm.configured()===true && /Claude Opus 4\.8/.test(App.llm.statusLabel()) && !/demo/.test(App.llm.statusLabel()), 'Model: with a key the header shows it live (no demo tag)');
try { localStorage.setItem('policyos_llm_cfg','{}'); } catch(e){}
chk(/Demo mode/.test(App.llm.statusLabel()), 'Model: no selection falls back to Demo mode');

// Nav: admin-only Administration (Users & access + Categories); connectors parked; PM excluded
var navAdmin = App.navModel(admin), navPM = App.navModel(personas.find(function(p){return p.id==='THQ0101';}));
chk(navAdmin.groups.some(function(g){return g.title==='Administration' && g.items.some(function(i){return i.id==='usersaccess';});}), 'Admin sees "Users & access" under Administration');
chk(navAdmin.groups.some(function(g){return g.title==='Administration' && g.items.some(function(i){return i.id==='connectors';});}), 'Connectors sits under Administration for admin');
chk(navPM.groups.some(function(g){return g.title==='Administration' && g.items.length===1 && g.items[0].id==='usersaccess';}), 'Policy Manager Administration = User Management only (scoped), no Categories');
chk(navAdmin.groups.some(function(g){return g.title==='Org docs' && g.items.some(function(i){return i.id==='assessments';});}), 'Assessments lives under Org docs');
chk(navAdmin.groups.some(function(g){return g.title==='Org docs' && g.items.some(function(i){return i.id==='policies';});}), 'Policies now live under Org docs');
chk(App.navModel(staff).groups.some(function(g){return g.title==='Org docs' && g.items.some(function(i){return i.id==='policies';});}), 'Staff: Policies under Org docs too');
chk(navAdmin.groups.some(function(g){return g.items.some(function(i){return i.id==='regulatory' && i.label==='Governance Hub';});}), 'Nav: Regulatory module relabelled to Governance Hub');
// Compensation removed entirely + full-page PDF view
chk(App.canSeeComp() === false, 'Comp: canSeeComp() is false for everyone');
chk(typeof DB.compensation === 'undefined', 'Comp: per-person compensation data removed');
chk(!DB.policies.some(function(p){return p.id==='P-COMP';}), 'Comp: Compensation & Salary Bands policy removed from the library');
chk(!/compensation/i.test(App.llm.buildContext(admin)), 'Comp: no compensation anywhere in the LLM context');
var _salAns = App.askTara("what's anmol's salary", App.state.user = admin); chk(!/CTC|₹[0-9]/.test(_salAns.html), 'Comp: Tara returns no salary figures to anyone');
chk(typeof App.pdf.openFull === 'function' && typeof App.pdf.closeFull === 'function', 'PDF: full-page view (openFull) available');
chk(!navAdmin.groups.some(function(g){return g.items.some(function(i){return ['directory','access','usermgmt'].indexOf(i.id)>=0;});}), 'Old directory/access/usermgmt removed from nav');

// Feature 1 — Impact simulator
chk(!!DB.simParams && !!DB.simParams['P-PL'] && DB.testBase && DB.testBase.length >= 100, 'Simulator: simParams + test cohort present');
chk(typeof App.sim === 'object' && typeof App.sim.run === 'function', 'Simulator: App.sim engine present');
var simBase = App.sim.run('P-PL', {});
chk(simBase.applicable && simBase.flipped.length === 0 && simBase.gained.length === 0, 'Simulator: no override → no applicants flip');
var simTight = App.sim.run('P-PL', { minCibil: 760 });
chk(simTight.proposed.rate < simBase.base.rate && simTight.flipped.length > 0, 'Simulator: tightening CIBIL cutoff lowers approval rate + flips applicants');
chk(simTight.proposed.npa <= simBase.base.npa + 1e-9, 'Simulator: tightening cutoff does not raise projected NPA');
chk(App.sim.run('P-KYC', {}).applicable === false, 'Simulator: a non-credit policy is not simulable');
chk(typeof App.simView === 'object' && typeof App.simView.open === 'function' && typeof App.simView.propose === 'function', 'Simulator: App.simView modal present');

// Feature 2 — Regulatory radar
chk(!!DB.circulars && DB.circulars.length >= 3, 'Regulatory: circular feed present');
chk(DB.categories.find(function(c){return c.name==='Compliance';}).subs.indexOf('Regulatory Updates') >= 0, 'Regulatory: Compliance has the "Regulatory Updates" sub-category');
chk(App.navModel(admin).groups.some(function(g){return g.items.some(function(i){return i.id==='regulatory';});}), 'Regulatory: nav item present under Policy Management');
chk(typeof App.regulatoryView === 'object' && typeof App.regulatoryView.openEditor === 'function', 'Regulatory: view + redline editor present');

// ---- Document viewer (App.pdf) + page citations ----
chk(typeof App.pdf === 'object' && typeof App.pdf.cite === 'function' && typeof App.pdf.build === 'function', 'PDF: App.pdf viewer engine present');
var _pdoc = App.pdf.build('policy','P-PL');
chk(_pdoc && _pdoc.pages.length >= 3, 'PDF: policy paginates (purpose/params/rules/governance)');
chk(App.pdf.pageOf(_pdoc,'Minimum CIBIL score') === 2, 'PDF: a fact citation resolves to the parameters page');
chk(/p\.2/.test(App.pdf.cite('policy','P-PL','Minimum CIBIL score')) && /class="cite"/.test(App.pdf.cite('policy','P-PL','Minimum CIBIL score')), 'PDF: cite() chip carries the page number');
var _cdoc = App.pdf.build('circular','INC-RBI-58');
chk(_cdoc && _cdoc.pages.length >= 6, 'PDF: circular builds pages from clauses');

// ---- Regulatory: amendments → TWO-PDF editor (approve/reject/comment → DOWNLOAD, not Approvals) ----
chk(DB.amendments && DB.amendments.length >= 3, 'Regulatory: amendment releases present');
var _amd58 = DB.amendments.find(function(a){return a.id==='AMD-58';});
var _pols58 = {}; _amd58.changes.forEach(function(c){_pols58[c.policyId]=1;});
chk(Object.keys(_pols58).length >= 3, 'Regulatory: one amendment (AMD-58) affects multiple policies');
var _plChanges = App.regulatoryView._changesForPolicy('P-PL');
var _plAmds = {}; _plChanges.forEach(function(c){_plAmds[c.amendment.id]=1;});
chk(_plChanges.length >= 3 && Object.keys(_plAmds).length >= 2, 'Regulatory: one policy (P-PL) collects changes from multiple amendments');
chk(typeof App.regulatoryView.openEditor==='function' && typeof App.regulatoryView._downloadPdf==='function' && typeof App.regulatoryView._downloadWord==='function' && typeof App.regulatoryView._preview==='function' && typeof App.regulatoryView._previewDocHtml==='function' && typeof App.regulatoryView._confirmSend==='function', 'Regulatory: editor + preview + PDF/Word download + confirm-send all present');
chk(App.pdf.build('amendment','AMD-58').pages.length >= 2, 'PDF: amendment renders as a circular-style PDF (left pane)');
App.regulatoryView.openEditor('P-PL');
var _ed=null; try { _ed = App.regulatoryView._renderEditor(); } catch(e){ _ed = 'ERR '+e; }
chk(typeof _ed==='string' && /contenteditable/.test(_ed) && _ed.indexOf('Preview') >= 0, 'Regulatory: two-PDF editor renders (editable draft + Preview & export): '+String(_ed).slice(0,40));
var _c = _plChanges.slice(0,3).map(function(c){return c.id;});
App.regulatoryView._accept(_c[0]);                                   // approve AI suggestion
App.regulatoryView._setSuggest(_c[1],'48%'); App.regulatoryView._applySuggestion(_c[1]);  // reviewer's own wording in the PDF
App.regulatoryView._reject(_c[2]);
chk(App.regulatoryView.st(_c[0]).status==='accepted' && App.regulatoryView.st(_c[1]).status==='suggested' && App.regulatoryView.st(_c[2]).status==='rejected', 'Regulatory: approve / suggest-wording / reject states');
App.regulatoryView.st(_c[0]).comment = 'reviewed by compliance';
var _doc = App.regulatoryView._revisedDocHtml(App.policy('P-PL'));
chk(_doc.indexOf(_plChanges[0].suggested) >= 0 && _doc.indexOf('48%') >= 0, 'Regulatory: revised doc applies approved value AND reviewer suggestion');
chk(/reviewed by compliance/.test(_doc), 'Regulatory: reviewer comment included in the revised doc');
var _prev = App.regulatoryView._previewDocHtml(App.policy('P-PL'));
chk(/prev__doc/.test(_prev) && _prev.indexOf('48%') >= 0, 'Regulatory: Preview renders the revised policy with the applied changes');
// downloads (PDF + Word) do NOT route to Approvals
var _apprBefore = DB.approvals.length;
try { App.regulatoryView._downloadWord(); } catch(e){}
try { App.regulatoryView._downloadPdf(); } catch(e){}
chk(DB.approvals.length === _apprBefore, 'Regulatory: PDF/Word download does NOT route to Approvals (sign offline)');
// Send for approval DOES route approved + suggested changes, following the CHOSEN workflow (level-by-level)
App.regulatoryView._confirmSend('WF1');
chk(DB.approvals.length === _apprBefore + 2, 'Regulatory: Send-for-approval routes approved + suggested changes to Approvals');
chk(!!DB.approvals[0].sourceRef && /48%|720/.test(String(DB.approvals[0].change.to)), 'Regulatory: approval carries source ref + reviewer value');
chk(/Lending Policy Approval/.test(DB.approvals[0].workflow||'') && DB.approvals[0].status==='Pending L1', 'Regulatory: chosen workflow stamped on the request + starts at its first level');
chk(App.regulatoryView._audit.length > 0, 'Regulatory: audit log records the review actions');
App.regulatoryView.editor = null; App.regulatoryView._st = {}; App.regulatoryView._audit = [];

// Regulatory: auto-map toggle + per-release move-to-review + add/remove affected policies
App.regulatoryView.autorun = true; App.regulatoryView._amd = {};
var _amdId = DB.amendments[0].id;
var _reviewOn = App.regulatoryView._reviewPolicies().length;
chk(_reviewOn > 0, 'Regulatory: autorun ON populates the review queue automatically');
App.regulatoryView._toggleAutorun();
chk(App.regulatoryView.autorun === false && App.regulatoryView._reviewPolicies().length === 0, 'Regulatory: autorun OFF empties the queue until releases are moved in');
App.regulatoryView._promote(_amdId);
chk(App.regulatoryView._reviewPolicies().length > 0, 'Regulatory: moving a release to review adds its policies to the queue');
App.regulatoryView._dismiss(_amdId);
chk(App.regulatoryView._amd[_amdId].decided === 'out', 'Regulatory: a release can be dismissed');
App.regulatoryView._promote(_amdId);
var _pidsBefore = App.regulatoryView._effectivePolicyIds(DB.amendments[0]).length;
var _rmPid = DB.amendments[0].changes[0].policyId;
App.regulatoryView._removePolicy(_amdId, _rmPid);
chk(App.regulatoryView._effectivePolicyIds(DB.amendments[0]).indexOf(_rmPid) < 0, 'Regulatory: reviewer can remove an affected policy from a release');
var _origPids = DB.amendments[0].changes.map(function(c){return c.policyId;});
var _addPid = DB.policies.map(function(p){return p.id;}).find(function(id){ return _origPids.indexOf(id) < 0; });
var _addChBefore = App.regulatoryView._changesForPolicy(_addPid).length;
App.regulatoryView._addPolicy(_amdId, _addPid);
chk(App.regulatoryView._effectivePolicyIds(DB.amendments[0]).indexOf(_addPid) >= 0 && App.regulatoryView._changesForPolicy(_addPid).length === _addChBefore + 1, 'Regulatory: reviewer can add a new affected policy (with an editable manual change)');
// Phase-1 manual upload: adds a self-uploaded circular with AI-generated name + summary + EXTRACTED rules, and opens the extraction-review screen
var _amdBefore = DB.amendments.length;
App.regulatoryView._upFileName = 'RBI_circular.pdf';
try { App.regulatoryView._submitUpload(); } catch(e){}
var _upl = DB.amendments[0];
chk(DB.amendments.length === _amdBefore + 1 && _upl.source==='self' && !!_upl.title && !!_upl.summary && (_upl.extracted||[]).length>0 && (_upl.changes||[]).length===0, 'Regulatory: manual upload extracts rules (no policy changes until Compare) + opens Circular Detail');
chk(App.regulatoryView.detail && App.regulatoryView.detail.amdId===_upl.id, 'Regulatory: upload opens the Circular Detail extraction-review screen');
var _cd = App.regulatoryView._renderCircularDetail();
chk(/Circular Detail/.test(_cd) && /cdet-tbl/.test(_cd) && new RegExp(_upl.extracted[0].conceptKey).test(_cd), 'Regulatory: Circular Detail renders the extracted-rule table');
// reviewer confirms all, then Compare quotes the confirmed rules as NEW clauses onto the target policy → editor
App.regulatoryView._extApproveAll(_upl.id);
chk(_upl.extracted.every(function(r){return App.regulatoryView._extSt(r.id).status==='confirmed';}), 'Regulatory: Approve all confirms every extracted rule');
App.regulatoryView._extCompare(_upl.id);
chk(App.regulatoryView.detail===null && (_upl.changes||[]).length===_upl.extracted.length && _upl.changes[0].isNew===true && App.regulatoryView.editor && App.regulatoryView.editor.policyId===_upl.targetPolicy, 'Regulatory: Compare against policy quotes confirmed rules as changes and opens the editor');
DB.amendments.shift(); // undo the uploaded circular so later render tests are unaffected

App.regulatoryView.autorun = true; App.regulatoryView._amd = {}; App.regulatoryView.editor = null; App.regulatoryView.detail = null; App.regulatoryView._ext = {}; App.regulatoryView._st = {}; App.regulatoryView._audit = [];

/* ===== Connector access: team buckets ∪ grants − revokes, and the agentic assistant ===== */
(function(){
  var chirag = staff.id;                                    // Chirag Ameta - staff, HR team
  var emp = App.emp(chirag);
  // team bucket is the baseline
  var teamHas = App.access.teamHas(emp.team, 'notion', 'notion.search');
  chk(App.access.mode(chirag,'notion','notion.search') === (teamHas ? 'inherit' : 'off'), 'Access: a scope defaults to whatever the person\'s TEAM bucket says');
  // admins hold everything by role
  chk(App.access.mode(admin.id,'gmail','gmail.send_mail') === 'role' && App.access.has(admin,'gmail.send_mail'), 'Access: admin holds every scope by role');
  // grant then revoke a scope for one person
  App.access.setMode(chirag,'jira','jira.create_issue','grant');
  chk(App.access.has(chirag,'jira.create_issue'), 'Access: per-user GRANT adds a scope the team lacks');
  App.access.setMode(chirag,'jira','jira.create_issue','revoke');
  chk(!App.access.has(chirag,'jira.create_issue'), 'Access: per-user REVOKE wins over the team bucket');
  App.access.setMode(chirag,'jira','jira.create_issue','inherit');
  // usable() also needs the source connected
  chk(App.access.usable(admin,'jira.read_issues') === true, 'Access: usable() true when scope held AND source connected');
  chk(App.access.usable(admin,'gdrive.search') === false && /not connected/i.test(App.access.denyReason(admin,'gdrive.search')), 'Access: usable() false + explains WHY when the source is disconnected');
  // copy / paste permissions (new-joiner flow)
  var anmol = 'THQ0101';
  App.access.copy(anmol);
  chk(App.access.clip && App.access.clip.from === anmol, 'Access: copy captures a person\'s effective permissions');
  App.access.paste(chirag);
  var a1 = JSON.stringify(App.access.effectiveAll(anmol)), c1 = JSON.stringify(App.access.effectiveAll(chirag));
  chk(a1 === c1, 'Access: paste makes the target\'s effective permissions identical (new joiner cloned)');
  DB.userAccess[chirag] = { grant:{}, revoke:{} };           // reset

  // agentic assistant: plans, clarifies, gates on scope
  chk(typeof App.agent === 'object' && App.chat === App.agent, 'Agent: assistant present and wired to the shell panel');
  var pNav = App.agent._plan('take me to approvals', admin);
  chk(pNav && pNav.action && pNav.action.type === 'navigate' && pNav.action.args.route === 'approvals', 'Agent: "take me to approvals" plans a navigate action');
  var pAmb = App.agent._plan('create a jira issue', admin);
  chk(pAmb && pAmb.clarify && pAmb.clarify.opts.length >= 2, 'Agent: a missing project raises a multiple-choice question instead of guessing');
  var pJira = App.agent._plan('create a jira issue in TARA called fix the redline diff', admin);
  chk(pJira && pJira.action && pJira.action.type === 'jira_create' && pJira.action.args.project === 'TARA', 'Agent: naming the project plans the create-issue action');
  // running a write action requires the scope: staff cannot post to Slack unless their bucket allows it
  App.access.setMode(chirag,'slack','slack.post_message','revoke');
  chk(!App.access.usable(staff,'slack.post_message') && /does not include|not connected/i.test(App.access.denyReason(staff,'slack.post_message')), 'Agent: a revoked write scope blocks the action with a reason');
  App.access.setMode(chirag,'slack','slack.post_message','inherit');
  // the action actually mutates state when permitted
  var before = DB.jiraIssues.length;
  App.state.chat = [];
  App.agent.ask('create a jira issue in HV called verify EPFO fallback');
  var m = App.state.chat[App.state.chat.length-1];
  chk(m && m.act && m.act.status === 'proposed', 'Agent: a write action is PROPOSED first, never auto-run');
  App.agent.run(App.state.chat.length-1);
  chk(DB.jiraIssues.length === before + 1 && m.act.status === 'done', 'Agent: Run executes the action and reports the result');
  DB.jiraIssues.shift(); App.state.chat = [];

  /* ---- regressions found by adversarial review (2026-07-27) ---- */
  // 1. disconnect must actually stick, even for a source connected through the UI
  App.conn._draft = { id:'gmail', method:'api', key:'sk-live', url:'' };
  App.conn._save('gmail');
  chk(App.conn.isConnected('gmail') === true && App.access.usable(admin,'gmail.send_mail') === true, 'Conn: connecting a source through the UI makes it usable');
  App.conn.disconnect('gmail');
  chk(App.conn.isConnected('gmail') === false && App.access.usable(admin,'gmail.send_mail') === false && /not connected/i.test(App.access.denyReason(admin,'gmail.send_mail')), 'Conn: DISCONNECT sticks — a UI-connected source really goes offline (was a no-op)');
  chk(!(App.conn.all()['gmail'] && App.conn.all()['gmail'].key), 'Conn: disconnect also drops the stored credential');
  App.conn._draft = { id:'gmail', method:'api', key:'sk-live-2', url:'' }; App.conn._save('gmail');
  chk(App.conn.isConnected('gmail') === true, 'Conn: re-connecting after a disconnect works');
  App.conn.disconnect('gmail');
  // a rejected connect must NOT silently re-enable a disconnected source
  App.conn._draft = { id:'gmail', method:'api', key:'   ', url:'' }; App.conn._save('gmail');
  chk(App.conn.isConnected('gmail') === false, 'Conn: an empty credential does not resurrect a disconnected source');

  // 2. raise_change must never invent the new value
  var pv = App.agent._plan('amend the two-wheeler LTV to 85%', admin);
  chk(pv && pv.action && pv.action.args.to === '85%', 'Agent: uses the value the user actually said (85%, not a default)');
  var pv2 = App.agent._plan('raise the personal loan cibil cutoff to 900', admin);
  chk(pv2 && pv2.action && pv2.action.args.to === '900', 'Agent: accepts a valid CIBIL of 900 instead of substituting a percentage');
  var pv3 = App.agent._plan('raise the personal loan cibil cutoff', admin);
  chk(pv3 && pv3.clarify && /change to/i.test(pv3.clarify.q), 'Agent: no value stated → asks instead of guessing');
  // read-only questions must not become write proposals
  var pq = App.agent._plan('what is the change process for a lending policy', admin);
  chk(!(pq && pq.action && pq.action.type === 'raise_change'), 'Agent: a question about policy change does NOT propose a change');
  var pw = App.agent._plan('what if we raise the personal loan cibil cutoff to 760', admin);
  chk(pw && pw.action && pw.action.type === 'simulate', 'Agent: "what if" routes to the simulator, not to raising a change');

  // 3. word boundaries: "profile" must not trigger the file/create verbs
  var pp = App.agent._plan('where do I find my profile', admin);
  chk(!(pp && pp.action), 'Agent: "profile" no longer trips the \'file\' verb');

  // 4. assessments: assign the one that was named
  var pa = App.agent._plan('assign the Information Security Refresher to Engineering', admin);
  chk(pa && pa.action && pa.action.args.assessmentId === (DB.assessments.find(function(x){return /Information Security/.test(x.name);})||{}).id, 'Agent: assigns the assessment the user named (not always the first row)');

  // 5. email: never guess a recipient from a stray first name
  var pm = App.agent._plan('send an email about the leave policy', admin);
  chk(pm && pm.clarify, 'Agent: no address given → asks who, never guesses a recipient');

  // 6. raise_change needs EDIT rights, not just visibility
  var pmC = personas.find(function(p){return p.id==='THQ0165';});   // Compliance PM
  var pe = App.agent._plan('raise a change on the personal loan cibil to 720', pmC);
  chk(!(pe && pe.action && pe.action.type === 'raise_change'), 'Agent: a manager without edit rights on that category cannot raise a change on it');

  // 7. Jira keys never collide with seeded ones
  var seeded = DB.jiraIssues.filter(function(i){return i.project==='TARA';}).map(function(i){return i.key;});
  App.state.chat = []; App.agent.ask('create a jira issue in TARA called dedupe key check');
  App.agent.run(App.state.chat.length-1);
  chk(seeded.indexOf(DB.jiraIssues[0].key) < 0, 'Agent: a new Jira key does not collide with an existing one');
  DB.jiraIssues.shift(); App.state.chat = [];

  // 8. paste() reports a truthful count
  App.access.copy('THQ0101'); var n1 = App.access.paste('THQ0125'); var n2 = App.access.paste('THQ0125');
  chk(n1 > 0 && n2 === 0, 'Access: paste reports how many scopes moved, and 0 when already identical');
  DB.userAccess['THQ0125'] = { grant:{}, revoke:{} };
})();

// "Ask Tara" fully removed: no nav item, no floating bot button, no contextual buttons
chk(!App.navModel(admin).pinned.concat(App.navModel(admin).groups.flatMap(function(g){return g.items;})).some(function(i){return i.id==='copilot';}), 'Sidebar: no "Ask Tara" nav item for admin/manager');
chk(!App.navModel(staff).pinned.some(function(i){return i.id==='copilot';}), 'Sidebar: no "Ask Tara" nav item for staff');
(function(){
  var hit = [];
  ['home','policies','assessments','approvals','insightgen','dashboard'].forEach(function(r){
    try { var h = App.views[r].render({user:admin}); if (typeof h==='string' && /Ask Tara/.test(h)) hit.push(r); } catch(e){}
  });
  chk(hit.length===0, 'No "Ask Tara" text in rendered views (found in: '+hit.join(', ')+')');
})();

// Tara what-if hook routes to the simulator (RBAC-scoped)
var simAns = App.askTara('what if we raise the personal loan cibil cutoff to 760', admin);
chk(/approval rate|impact simulation/i.test(simAns.html), 'Tara: what-if query routes to impact simulation for admin');
var simDenied = App.askTara('what if we raise the personal loan cibil cutoff to 760', staff);
chk(!/approval rate|impact simulation/i.test(simDenied.html), 'Tara: staff (no PL access) does NOT get the simulation');

// Assessments — staff takes a test, admin sees the score
chk(typeof App.assessmentsView.take === 'function' && typeof App.assessmentsView.submit === 'function' && typeof App.assessmentsView._subs === 'function', 'Assessments: staff take/submit + submission store present');
chk(!App.assessmentsView._subForUser('AS1','THQ0125'), 'Assessments: staff has no submission before taking');
App.assessmentsView._subs('AS1').push({ userId:'THQ0125', score:80, correct:4, total:5, attempted:5, passed:true, answers:[], date:'21 Jun 2026' });
chk(!!App.assessmentsView._subForUser('AS1','THQ0125') && App.assessmentsView._subForUser('AS1','THQ0125').score===80, 'Assessments: staff submission recorded & retrievable (admin can read it)');
var asErr=null; App.state.user=admin; try { App.assessmentsView.open('AS1'); App.closeModal(); } catch(e){ asErr=e; }
chk(!asErr, 'Assessments: admin detail renders with the real staff submission: '+(asErr||''));

// Assessments: staff still cannot see a Lending quiz (RBAC gating retained on the My Assessments page)
chk(!App.visiblePolicies(staff).some(function(p){return p.category==='Lending';}), 'Assessments: staff cannot see Lending, so the Lending quiz stays gated off');

// ===== Production parity (UI carries the same information/flow as policy-fe) =====
// Category: disable needs confirmation; sub-categories removable inline; duplicate names rejected
chk(typeof App.categoryView.confirmDisable==='function' && typeof App.categoryView.doDisable==='function' && typeof App.categoryView.removeSub==='function', 'Category: confirm-disable + inline sub-remove present');
var _hrC = DB.categories.find(function(c){return c.name==='HR';});
App.categoryView.toggle(null,'HR');
chk(_hrC.enabled !== false, 'Category: toggling an enabled category does NOT disable without confirmation');
App.categoryView.doDisable('HR');
chk(_hrC.enabled === false, 'Category: doDisable() disables after confirmation');
_hrC.enabled = true;
// Assessments: results tab carries per-row Remind + status filter + user search; schedule is editable
App.state.user = admin;
App.assessmentsView.open('AS1');
var _det = App.assessmentsView._detail;
chk(_det && /Remind/.test(_det.resultsTab) && /asResStatus/.test(_det.resultsTab) && /asResSearch/.test(_det.resultsTab), 'Assessments: results tab has per-row Remind + status filter + user search');
chk(typeof App.assessmentsView.editSchedule==='function', 'Assessments: edit end-date/passing-score modal present');
App.closeModal();
// RuleSense: versions + compare, language-aware codegen, variable map with type/description
// Version history + working compare (shared App.versions; used by RuleSense + Policies table)
chk(typeof App.versions==='object' && typeof App.versions.list==='function' && typeof App.versions.open==='function' && typeof App.versions.chipsHtml==='function', 'Versions: shared engine (list/open/chips) present');
var _vlist = App.versions.list('P-PL');
chk(_vlist.length>=2 && _vlist[_vlist.length-1].status==='Active' && _vlist.every(function(v){return Array.isArray(v.rules);}), 'Versions: P-PL has a multi-version trail ending Active, each with rules');
var _vd = App.versions._diffHtml('P-PL', _vlist[0].v, _vlist[_vlist.length-1].v);
chk(/rule.? changed/.test(_vd) && /diff-del/.test(_vd) && /diff-add/.test(_vd), 'Versions: compare shows a real rule-by-rule diff between two versions');
chk(/mono/.test(App.versions.chipsHtml('P-PL')), 'Versions: RuleSense version chips render');
// P-ISEC's rule[0] has no digit; the diff must still be non-empty (fix targets the first numeric rule)
var _iv = App.versions.list('P-ISEC');
chk(/rule.? changed/.test(App.versions._diffHtml('P-ISEC', _iv[0].v, _iv[_iv.length-1].v)), 'Versions: policies whose first rule has no number still produce a real diff');
// superseded version dates are chronological (older = earlier), not reversed
var _pv = App.versions.list('P-PL');
var _dv = function(s){ var M={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11}; var m=/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/.exec(s||''); return m?(+m[3])*372+(M[m[2]]||0)*31+(+m[1]):0; };
chk(_dv(_pv[0].date) < _dv(_pv[_pv.length-1].date), 'Versions: oldest version dated before the current one (chronological)');
chk(/def<\/span> decide|Python/.test(App.rulesenseView.codeFor(App.policy('P-PL'),'Python')) && /com\.tartan\.bre|Drools/.test(App.rulesenseView.codeFor(App.policy('P-PL'),'Drools (DRL)')) && /public class/.test(App.rulesenseView.codeFor(App.policy('P-PL'),'Java')), 'RuleSense: code generation follows the selected language (Python/Drools/Java)');
chk(/Compare versions/.test(App.rulesenseView.editorHtml(App.policy('P-PL'), admin)), 'RuleSense: editor shows the version row + compare');
var _vm = App.rulesenseView.varMap(App.policy('P-PL'));
chk(_vm.some(function(m){return m.dest && m.type && m.desc;}), 'RuleSense: variable map carries data type + description');
// PolyGPT removed; Home is the chat surface now
chk(!App.views['polygpt'], 'PolyGPT view removed');
chk(typeof App.views['home']==='object' && typeof App.home==='object' && typeof App.home.ask==='function', 'Home: chat view + controller present');
App.state.home = [];
var _homeEmpty = App.views['home'].render({user:admin});
chk(/homehero/.test(_homeEmpty) && /Ask your policies/.test(_homeEmpty), 'Home: empty state shows the ask hero');
App.state.home.push({role:'user',text:'test'},{role:'ai',html:'<p>hi</p>',sources:[]});
var _homeChat = App.views['home'].render({user:admin});
chk(/home__thread/.test(_homeChat) && /New chat/.test(_homeChat), 'Home: with messages shows the conversation + follow-up bar');
App.state.home = [];

// Regulatory feed: authority/date filter + 10-per-page pagination + informational releases + PDF open
App.state.user = admin; App.regulatoryView.autorun = true; App.regulatoryView._amd = {}; App.regulatoryView._relFilter = { auth:'', month:'' };
chk((DB.amendments||[]).length >= 14, 'Regulatory: broader release feed (>=14 circulars)');
var _auths = App.regulatoryView._relAuthorities();
chk(_auths.indexOf('RBI')>=0 && _auths.indexOf('SEBI')>=0 && _auths.indexOf('Self-uploaded')>=0, 'Regulatory: authority filter covers RBI / SEBI / Self-uploaded');
chk(App.regulatoryView._relMonths().length >= 3, 'Regulatory: date filter offers multiple months');
var _regHtml = App.views['regulatory'].render({user:admin});
chk(/See previous uploads/.test(_regHtml), 'Regulatory: shows "See previous uploads" when >10 releases');
chk((_regHtml.match(/reg-rel__title/g)||[]).length <= 10, 'Regulatory: only 10 releases shown on the page');
chk(/openFull\('amendment'/.test(_regHtml), 'Regulatory: release opens the circular PDF in a big overlay');
chk(typeof App.regulatoryView.allReleasesModal==='function' && typeof App.regulatoryView._filterAllRel==='function', 'Regulatory: "all uploads" window + its filter present');
var _amdInfo = DB.amendments.find(function(a){return a.changes && a.changes.length===0;});
chk(!!_amdInfo && App.regulatoryView._visibleRelease(_amdInfo), 'Regulatory: informational (0-change) circulars still show in the feed');
chk(App.pdf.build('amendment', _amdInfo.id).pages.length >= 2, 'Regulatory: informational circular still builds a readable PDF');
App.regulatoryView._relFilter = { auth:'SEBI', month:'' };
var _regSebi = App.views['regulatory'].render({user:admin});
chk(!/Master Direction/.test(_regSebi), 'Regulatory: authority filter narrows the feed (SEBI only - RBI Master Direction card gone)');
App.regulatoryView._relFilter = { auth:'', month:'' };

// Policies table mirrors production Policy Management columns + flow
App.state.user = admin;
var _polHtml = App.views['policies'].render({user:admin});
chk(/Policy Management/.test(_polHtml) && /Manage, view, and edit/.test(_polHtml), 'Policies: production heading + subtitle');
chk(/Policy Owner/.test(_polHtml) && /Sub Category/.test(_polHtml) && /Created On/.test(_polHtml) && /Last Modified On/.test(_polHtml) && /Policy Name/.test(_polHtml), 'Policies: production columns present (Owner/Sub Category/Created/Last Modified)');
chk(typeof App.policiesView.toggleFilter==='function' && typeof App.policiesView.toggleAll==='function', 'Policies: filter toggle + select-all present');

// Add policy → choose approval workflow + confirm/edit its stages → routes to Approvals
App.state.user = admin;
var _ap0 = DB.approvals.length;
App.policiesView.add();
App.state.addPolicy.details = { name:'Gold Loan Policy', category:'Lending', sub:'Gold Loan', desc:'New secured gold loan.' };
App.policiesView._loadWf('WF1');
chk(App.state.addPolicy.stages.length>=1 && App.state.addPolicy.stages.every(function(s){return Array.isArray(s.approvers) && (s.criteria==='All'||s.criteria==='Anyone');}), 'AddPolicy: choosing a workflow loads editable stages (approvers + All/Anyone)');
App.policiesView._addAddStage();
chk(App.state.addPolicy.stages.length>=2, 'AddPolicy: reviewer can add an approval stage');
App.policiesView._addSetCrit(0,'All'); chk(App.state.addPolicy.stages[0].criteria==='All', 'AddPolicy: stage criteria toggles All / Anyone');
App.state.addPolicy.stages.forEach(function(s){ if(!s.approvers.length) s.approvers.push('THQ0144'); });
App.policiesView._addSubmit();
chk(DB.approvals.length===_ap0+1, 'AddPolicy: submit routes a New Policy request into Approvals');
var _req = DB.approvals[0];
chk(_req.type==='New Policy' && _req.status==='Pending L1' && Array.isArray(_req.stages) && _req.stages.length>=2 && !!_req.workflow, 'AddPolicy: request carries the chosen workflow + its stages, starting at stage 1');
var _apErr=null; try { App.approvalsView.open(_req.id); App.closeModal(); } catch(e){ _apErr=e; }
chk(!_apErr, 'Approvals: New Policy request detail renders its custom stages (null policy safe): '+(_apErr||''));
DB.approvals.shift(); App.state.addPolicy = null; App.state.user = admin;

// Regulatory editor: "Simulate impact" of the regulatory change, beside Preview & export
App.state.user = admin; App.regulatoryView.editor = null; App.regulatoryView._st = {};
App.regulatoryView.openEditor('P-PL');
var _regEd = App.regulatoryView._renderEditor();
chk(/Simulate impact/.test(_regEd) && _regEd.indexOf('Simulate impact') < _regEd.indexOf('Preview'), 'Regulatory: Simulate-impact button sits beside Preview & export (simulable policy)');
chk(typeof App.regulatoryView._simulate==='function' && typeof App.regulatoryView._simOverride==='function', 'Regulatory: simulate handler + override merge present');
var _ov = App.regulatoryView._simOverride('P-PL');
chk(_ov && (_ov.minCibil || _ov.maxFoir), 'Regulatory: sim override merges the (non-rejected) regulatory changes');
App.regulatoryView.openEditor('P-KYC');
chk(!/Simulate impact/.test(App.regulatoryView._renderEditor()), 'Regulatory: no Simulate button for a non-simulable policy (KYC)');
App.regulatoryView.editor = null; App.regulatoryView._st = {};

// InsightGen: add / connect more data sources (SQL / Postgres / Mongo / warehouse / upload)
App.state.user = admin;
chk(/Add data source/.test(App.views['insightgen'].render({user:admin})), 'InsightGen: "Add data source" control present');
chk(typeof App.insightgenView.addSource==='function' && typeof App.insightgenView._connectSource==='function' && typeof App.insightgenView._doConnect==='function', 'InsightGen: connect-source handlers present');
var _db0 = App.insightgenView.DBS.length;
App.insightgenView._state();
(function(){ var g=document.getElementById; document.getElementById=function(id){ return id==='dsName'?{value:'Collections replica'}:g.call(document,id); }; App.insightgenView._doConnect('PostgreSQL'); document.getElementById=g; })();
chk(App.insightgenView.DBS.length===_db0+1 && App.insightgenView.DBS.indexOf('Collections replica')>=0, 'InsightGen: connecting a source adds it to the queryable databases');

// Guided product tour: one step per module the role can actually open
chk(typeof App.tour === 'object' && typeof App.tour.start === 'function', 'Tour: engine present');
(function(){
  var route = function (s) { return s.route || null; };
  [['admin', admin], ['policy_manager', pmL], ['user', staff]].forEach(function (pair) {
    var role = pair[0], u = pair[1], steps = App.tour.stepsFor(u);
    var navIds = App.navModel(u).pinned.concat(App.navModel(u).groups.reduce(function(a,g){return a.concat(g.items);},[])).map(function(i){return i.id;});
    var stepIds = steps.map(route).filter(Boolean);
    // every module in that person's sidebar gets a step, in sidebar order, and nothing else does
    chk(JSON.stringify(stepIds) === JSON.stringify(navIds), 'Tour [' + role + ']: one step per sidebar module, in order');
    // never a step for something the role cannot open
    chk(stepIds.every(function (id) { return App.canAccessView(id, u); }), 'Tour [' + role + ']: no step points at a module this role cannot open');
    // the command palette step is gone
    chk(!steps.some(function (s) { return /⌘K|command palette/i.test((s.title || '') + (s.body || '')); }), 'Tour [' + role + ']: no command-palette step');
    // last step is the finish card, and it offers no module shortcuts
    var last = steps[steps.length - 1];
    chk(last.finish === true && !/tour-nextcard|tour-next/.test(last.body || ''), 'Tour [' + role + ']: final step is Done/Back only, no module options');
    // copy is tight and free of em dashes
    var bad = steps.filter(function (s) { var w = String(s.body || '').split(/\s+/).filter(Boolean).length; return w < 18 || w > 32 || /—|–| - /.test(s.body || ''); });
    chk(bad.length === 0, 'Tour [' + role + ']: every description is 20-30 words with no dashes' + (bad.length ? ' (bad: ' + bad.map(function(b){return b.title;}).join(', ') + ')' : ''));
  });
  // a staff user sees fewer steps than an admin, and never the admin-only sections
  var sIds = App.tour.stepsFor(staff).map(route).filter(Boolean);
  chk(App.tour.stepsFor(staff).length < App.tour.stepsFor(admin).length, 'Tour: staff walkthrough is shorter than the admin one');
  chk(['approvals','regulatory','insightgen','usersaccess','connectors','category'].every(function(id){return sIds.indexOf(id)<0;}), 'Tour: staff never sees admin or manager sections');
  // group-bearing steps carry the sidebar group so a collapsed group can be opened first
  chk(App.tour.stepsFor(admin).filter(function(s){return s.group;}).length > 0, 'Tour: steps inside a sidebar group record that group');
  // every module step opens its page and points at something ON that page (not at the sidebar)
  var mods = App.tour.stepsFor(admin).filter(route);
  chk(mods.every(function(s){ return Array.isArray(s.sels) && s.sels.length > 0 && !s.sels.some(function(x){ return /nav__item|sidebar/.test(x); }); }), 'Tour: module steps anchor to page content, never to the sidebar row');
  chk(mods.every(function(s){ return App.tour.ANCHOR[s.route]; }), 'Tour: every module has a declared page anchor');
  chk(typeof App.tour._target === 'function', 'Tour: anchor resolver present (first selector that exists wins)');
})();

// ===== RBAC PRD matrix: three roles, sidebar/view gating, dashboard quick actions =====
chk(Object.keys(DB.roleLabels).length===3 && DB.roleLabels.admin && DB.roleLabels.policy_manager && DB.roleLabels.user, 'Roles: exactly three (admin, policy_manager, user)');
chk(!DB.roleLabels.risk_approver && !DB.roleLabels.assessment_manager, 'Roles: risk_approver / assessment_manager removed');
chk(DB.users.every(function(u){return ['admin','policy_manager','user'].indexOf(u.role)>=0;}), 'Users: every persona is one of the three roles');
chk(DB.users.every(function(u){return Array.isArray(u.categories);}), 'Users: every persona has assigned categories (category scoping)');
// Home + Dashboard are the two pinned surfaces; PolyGPT is gone
chk(App.navModel(admin).pinned.some(function(i){return i.id==='home';}) && App.navModel(admin).pinned.some(function(i){return i.id==='dashboard';}), 'Sidebar: Home + Dashboard pinned');
chk(!App.navModel(admin).groups.concat().some(function(g){return g.items.some(function(i){return i.id==='polygpt';});}) && !App.navModel(staff).groups.some(function(g){return g.items.some(function(i){return i.id==='polygpt';});}), 'Sidebar: PolyGPT removed for every role');
// staff sidebar: Policy Management has the AI tools RuleSense + BRE Decoder (no PolyGPT) + Company Brain
chk(App.navModel(staff).groups.some(function(g){return g.title==='Policy Management' && ['rulesense','bredecoder'].every(function(id){return g.items.some(function(i){return i.id===id;});});}), 'Sidebar: staff Policy Management has RuleSense + BRE Decoder');
chk(!App.navModel(staff).groups.some(function(g){return g.items.some(function(i){return ['approvals','regulatory','insightgen','usersaccess','category'].indexOf(i.id)>=0;});}), 'Sidebar: staff still has NO Approvals/Regulatory/InsightGen/UserMgmt/Categories');
// view-level access gating (canAccessView)
['approvals','regulatory','insightgen','usersaccess','category'].forEach(function(r){
  chk(!App.canAccessView(r, staff), 'Access: staff cannot open '+r);
});
['home','rulesense','bredecoder'].forEach(function(r){
  chk(App.canAccessView(r, staff), 'Access: staff CAN open '+r);
});
['rulesense','approvals','regulatory','bredecoder','insightgen'].forEach(function(r){
  chk(App.canAccessView(r, pmL), 'Access: policy manager can open '+r);
});
chk(App.canAccessView('usersaccess', pmL) && !App.canAccessView('category', pmL), 'Access: policy manager CAN open User Management (scoped) but NOT Categories');
chk(['home','dashboard','rulesense','approvals','regulatory','bredecoder','insightgen','usersaccess','category','policies','assessments'].every(function(r){return App.canAccessView(r, admin);}), 'Access: admin can open every view');
chk(App.canAccessView('home', staff) && App.canAccessView('dashboard', staff) && App.canAccessView('policies', staff) && App.canAccessView('assessments', staff), 'Access: staff can open Home, Dashboard, Policies, Assessments');
// regulatory scoped to a PM category: Compliance PM sees KYC amendment, not Lending ones
App.state.user = pmC;
var regC = App.views['regulatory'].render({user:pmC});
chk(!/Personal Loan Credit Policy/.test(regC) && /KYC/.test(regC), 'Regulatory: Compliance PM sees only Compliance releases (KYC), not Lending');
App.state.user = staff;
var regStaff = App.views['regulatory'].render({user:staff});
chk(/do not have access|not have access/i.test(regStaff), 'Regulatory: staff is locked out of the module');
// dashboard: role-scoped stat strip + quick starts + widgets, all computed (no invented counts).
// helper: the quick-starts row is everything before the two-column widget area (dsh__cols).
var quickOf = function(html){ return html.split('dsh__cols')[0]; };
App.state.user = admin;
var dashAdmin = App.views['dashboard'].render({user:admin});
// admin quick starts route to Policies/Approvals/Regulatory/Assessments (User Mgmt + Categories live in the sidebar, not here)
chk(/navigate\('policies'\)/.test(quickOf(dashAdmin)) && /navigate\('approvals'\)/.test(quickOf(dashAdmin)) && /navigate\('regulatory'\)/.test(quickOf(dashAdmin)) && /navigate\('assessments'\)/.test(quickOf(dashAdmin)), 'Dashboard: admin quick starts = Policies, Approvals, Regulatory, Assessments');
chk(!/navigate\('insightgen'\)/.test(quickOf(dashAdmin)), 'Dashboard: InsightGen is NOT a quick-start tile for admin');
chk(/Quick starts/.test(dashAdmin) && /Regulatory gaps to review/.test(dashAdmin) && /Policies by category/.test(dashAdmin) && !/Recent attestations/.test(dashAdmin), 'Dashboard: admin shows Quick starts + Regulatory gaps + category breakdown');
// stat strip is wired to the live RBAC helpers (values match visiblePolicies/activePolicies/approvals exactly)
chk(new RegExp('dsh__sv">'+App.activePoliciesInScope(admin).length+'<').test(dashAdmin) && new RegExp('dsh__sv">'+App.approvalsView.visibleRequests(admin).length+'<').test(dashAdmin), 'Dashboard: admin stat strip shows live computed counts');
var dashPM = App.views['dashboard'].render({user:pmL});
chk(!/navigate\('insightgen'\)/.test(quickOf(dashPM)), 'Dashboard: InsightGen is NOT a quick-start tile for policy manager');
chk(/navigate\('rulesense'\)/.test(quickOf(dashPM)) && /navigate\('regulatory'\)/.test(quickOf(dashPM)) && /navigate\('approvals'\)/.test(quickOf(dashPM)), 'Dashboard: PM quick starts = Regulatory, RuleSense, Approvals');
chk(/Awaiting you/.test(dashPM) && /Approvals awaiting you/.test(dashPM), 'Dashboard: PM sees scoped approvals ("Awaiting you")');
// Lending PM full-width is the risk snapshot, which may deep-link into InsightGen (allowed outside the quick-start row)
chk(/Risk & regulatory snapshot/.test(dashPM) && /navigate\('insightgen'\)/.test(dashPM), 'Dashboard: Lending PM gets a risk snapshot that links to InsightGen');
var dashStaff = App.views['dashboard'].render({user:staff});
chk(/Policies you can access/.test(dashStaff) && /My assessments/i.test(dashStaff), 'Dashboard: staff sees the simplified view');
chk(!/navigate\('approvals'\)/.test(dashStaff) && !/navigate\('regulatory'\)/.test(dashStaff), 'Dashboard: staff dashboard has no approvals/regulatory actions');
// Assessments manager list is category-scoped: a Lending PM does not see a Compliance (KYC) assessment
App.state.user = pmL;
var asL = App.views['assessments'].render({user:pmL});
chk(!/KYC/.test(asL), 'Assessments: Lending PM list excludes Compliance (KYC) assessments');
var asAdmin = App.views['assessments'].render({user:admin});
chk(/KYC/.test(asAdmin), 'Assessments: admin sees all assessments incl KYC');
// sidebar label is "Home" for every role (not "Dashboard" for managers)
chk(App.navModel(admin).pinned[0].label==='Home' && App.navModel(pmL).pinned[0].label==='Home' && App.navModel(staff).pinned[0].label==='Home', 'Sidebar: main item is "Home" for all three roles');
// User Management scoping: admin = whole org; PM = only the people they manage; staff = none
chk(App.managedEmployees(admin).length === DB.employees.length, 'UserMgmt: admin manages the whole org');
chk(App.managedEmployees(staff).length === 0, 'UserMgmt: staff manages no one');
var mgL = App.managedEmployees(pmL);
chk(mgL.length > 0 && mgL.length < DB.employees.length && mgL.every(function(e){return (pmL.manages||[pmL.team]).indexOf(e.team)>=0;}), 'UserMgmt: policy manager roster is scoped to their team(s) only');
chk(mgL.some(function(e){return e.id==='THQ0101';}) && !mgL.some(function(e){return e.id==='THQ0144';}), 'UserMgmt: PM sees their own team, NOT the admin/founders');
chk(App.navModel(pmL).groups.some(function(g){return g.title==='Administration' && g.items.some(function(i){return i.id==='usersaccess';}) && !g.items.some(function(i){return i.id==='category';});}), 'Sidebar: PM Administration group has User Management but NOT Categories');
App.state.usersAccess = {tab:'people'};
App.state.user = pmL;
var uaPM = App.views['usersaccess'].render({user:pmL});
var outsider = DB.employees.find(function(e){return (pmL.manages||[]).indexOf(e.team)<0;});
chk(uaPM.indexOf(outsider.name) < 0 && !/Access rules/.test(uaPM) && !/Manage Users/.test(uaPM), 'UserMgmt: PM view is scoped (no out-of-team person, no Access-rules tab, no Manage Users button)');
App.state.user = admin;
var uaAdmin = App.views['usersaccess'].render({user:admin});
chk(uaAdmin.indexOf(outsider.name) >= 0 && /Access rules/.test(uaAdmin), 'UserMgmt: admin view shows the whole org + the Access-rules tab');
chk(/Manage Users/.test(uaAdmin) && /Product Category/.test(uaAdmin) && /Date Added/.test(uaAdmin) && /AI Access/.test(uaAdmin) && /Employee ID/.test(uaAdmin) && /Add, edit, and manage users/.test(uaAdmin), 'UserMgmt: admin table carries the production columns + Manage Users menu + production copy');
App.state.user = admin;

print('=== RBAC semantics ===');
print(semFails.length ? 'SEMANTIC FAILS:\n'+semFails.join('\n') : 'RBAC semantics OK (deny + allow paths verified)');
print('=== render: '+routes.length+' views x '+personas.length+' personas ===');
print(renderFails.length ? 'RENDER FAILS:\n'+renderFails.join('\n') : 'render OK');
print('=== askTara: '+queries.length+' queries x '+personas.length+' personas ===');
print(askFails.length ? 'ASK FAILS:\n'+askFails.join('\n') : 'askTara OK');
print('=== mount (warnings only; stub values may differ from real DOM) ===');
print(mountWarns.length ? 'MOUNT WARNINGS:\n'+mountWarns.join('\n') : 'mount OK');
print('=== views registered: '+routes.join(', ')+' ===');
