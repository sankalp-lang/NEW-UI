/* ============================================================
   PolicyOS · Tara - Mock data (no backend, no DB, no creds)
   Everything the prototype "knows" lives here.
   ============================================================ */
window.DB = (function () {

  /* ---------- HRMS: employee directory (synced from Keka) ---------- */
  // presence: 'office' | 'remote' | 'leave'
  const employees = [
    { id:'THQ0001', name:'Pramey Jain',            email:'pramey@tartanhq.com',            team:"Founder's Office", title:'CEO & Co-founder',        presence:'office', checkin:'9:05 AM' },
    { id:'THQ0002', name:'Meet Semlani',           email:'meet@tartanhq.com',              team:"Founder's Office", title:'COO & Co-founder',        presence:'office', checkin:'9:18 AM' },
    { id:'THQ0165', name:'Subhrangshu Chattopadhyay', email:'subhrangshu@tartanhq.com',    team:"Founder's Office", title:'CBO & Co-founder',        presence:'remote', checkin:'-' },
    { id:'THQ0144', name:'Sankalp Chandra',        email:'sankalp@tartanhq.com',           team:"Founder's Office", title:'Product & Strategy',      presence:'office', checkin:'9:42 AM' },
    { id:'THQ0157', name:'Aditya Gaur',            email:'aditya.gaur@tartanhq.com',       team:"Founder's Office", title:'Chief of Staff',          presence:'office', checkin:'9:30 AM' },
    { id:'THQ0101', name:'Anmol Jain',             email:'anmol@tartanhq.com',             team:'Product',          title:'Policy Product Manager',  presence:'office', checkin:'9:55 AM' },
    { id:'THQ0100', name:'Raghav Sikri',           email:'raghav@tartanhq.com',            team:'Product',          title:'Product Analyst',         presence:'remote', checkin:'-' },
    { id:'THQ0179', name:'Saanvi Ganjoo',          email:'saanvi@tartanhq.com',            team:'Product',          title:'Associate PM',            presence:'office', checkin:'10:02 AM' },
    { id:'THQ0118', name:'Abhishek Chaudhary',     email:'abhishek.chaudhary@tartanhq.com',team:'Engineering',      title:'AI Engineer',             presence:'office', checkin:'10:11 AM' },
    { id:'THQ0128', name:'Dhaval Bhardwaj',        email:'dhaval@tartanhq.com',            team:'Engineering',      title:'Engineering Lead',        presence:'office', checkin:'9:48 AM' },
    { id:'THQ0133', name:'Siddhartha Anand',       email:'siddhartha.anand@tartanhq.com',  team:'Engineering',      title:'Full-stack Engineer',     presence:'office', checkin:'10:20 AM' },
    { id:'THQ0131', name:'Shreesh Tiwari',         email:'shreesh@tartanhq.com',           team:'Engineering',      title:'Backend Engineer',        presence:'remote', checkin:'-' },
    { id:'THQ0146', name:'Abhishek Majhi',         email:'abhishek.majhi@tartanhq.com',    team:'Engineering',      title:'Backend Engineer',        presence:'office', checkin:'9:51 AM' },
    { id:'THQ0091', name:'Geetansh Garg',          email:'geetansh@tartanhq.com',          team:'Engineering',      title:'Backend Engineer',        presence:'office', checkin:'10:05 AM' },
    { id:'THQ0092', name:'Jemis Variya',           email:'jemis@tartanhq.com',             team:'Engineering',      title:'Frontend Engineer',       presence:'office', checkin:'9:40 AM' },
    { id:'THQ0093', name:'Harshil Kachhadiya',     email:'harshil@tartanhq.com',           team:'Engineering',      title:'Engineer',                presence:'leave',  checkin:'On leave' },
    { id:'THQ0104', name:'Mohmmad Naushad',        email:'naushad@tartanhq.com',           team:'Engineering',      title:'Engineer',                presence:'office', checkin:'10:08 AM' },
    { id:'THQ0124', name:'Akash Rai',              email:'akash@tartanhq.com',             team:'Engineering',      title:'DevOps Engineer',         presence:'office', checkin:'9:33 AM' },
    { id:'THQ0140', name:'Nitin Kumar',            email:'nitin.kumar@tartanhq.com',       team:'Engineering',      title:'Engineer',                presence:'remote', checkin:'-' },
    { id:'THQ0142', name:'Gurnawaz Singh',         email:'gurnawaz@tartanhq.com',          team:'Engineering',      title:'Engineer',                presence:'office', checkin:'10:14 AM' },
    { id:'THQ0147', name:'Vishal Bhardwaj',        email:'vishal@tartanhq.com',            team:'Engineering',      title:'Engineer',                presence:'office', checkin:'9:58 AM' },
    { id:'THQ0148', name:'Vikram',                 email:'vikram.s@tartanhq.com',          team:'Engineering',      title:'Engineer',                presence:'office', checkin:'10:25 AM' },
    { id:'THQ0149', name:'Ritik',                  email:'ritik@tartanhq.com',             team:'Engineering',      title:'Engineer',                presence:'leave',  checkin:'On leave' },
    { id:'THQ0159', name:'Ishan Srivastava',       email:'ishan@tartanhq.com',             team:'Engineering',      title:'Engineer',                presence:'office', checkin:'9:47 AM' },
    { id:'THQ0162', name:'Mukul Pandit',           email:'mukul@tartanhq.com',             team:'Engineering',      title:'Engineer',                presence:'remote', checkin:'-' },
    { id:'THQ0169', name:'Rajat Kumar',            email:'rajat@tartanhq.com',             team:'Engineering',      title:'Engineer',                presence:'office', checkin:'10:00 AM' },
    { id:'THQ0168', name:'Sahil Yadav',            email:'sahil@tartanhq.com',             team:'Engineering',      title:'Engineer',                presence:'office', checkin:'9:52 AM' },
    { id:'THQ0172', name:'Pranav Awasthi',         email:'pranav@tartanhq.com',            team:'Engineering',      title:'Engineer',                presence:'office', checkin:'10:09 AM' },
    { id:'THQ0176', name:'Balram Kumar',           email:'balram@tartanhq.com',            team:'Engineering',      title:'Engineer',                presence:'remote', checkin:'-' },
    { id:'THQ0178', name:'Rohit Nagesh Suryawanshi', email:'rohit@tartanhq.com',          team:'Engineering',      title:'QA Engineer',             presence:'office', checkin:'9:44 AM' },
    { id:'THQ0135', name:'Shivam Mishra',          email:'shivam.mishra@tartanhq.com',     team:'Engineering',      title:'Engineer',                presence:'office', checkin:'10:18 AM' },
    { id:'THQC103', name:'Prateek Kumar',          email:'prateek@tartanhq.com',           team:'Engineering',      title:'Engineer',                presence:'office', checkin:'10:30 AM' },
    { id:'THQC110', name:'Manish Manglesh',        email:'manish@tartanhq.com',            team:'Engineering',      title:'Engineer',                presence:'remote', checkin:'-' },
    { id:'THQC0110', name:'Ahad Nadeem',           email:'ahad@tartanhq.com',              team:'Engineering',      title:'Engineering Intern',      presence:'office', checkin:'10:40 AM' },
    { id:'THQC105', name:'Parv Goel',              email:'parv@tartanhq.com',              team:'Engineering',      title:'Engineering Intern',      presence:'office', checkin:'10:35 AM' },
    { id:'THQC109', name:'Ashish',                 email:'ashusingh954011@gmail.com',      team:'Engineering',      title:'Engineering Intern',      presence:'leave',  checkin:'On leave' },
    { id:'THQ0108', name:'Harshita Gupta',         email:'harshita@tartanhq.com',          team:'Design',           title:'Product Designer',        presence:'office', checkin:'9:59 AM' },
    { id:'THQ0141', name:'Tanisha',                email:'tanisha@tartanhq.com',           team:'Design',           title:'UI Designer',             presence:'office', checkin:'10:12 AM' },
    { id:'THQC0113', name:'Keya Paul',             email:'keya@tartanhq.com',              team:'Design',           title:'Design Intern',           presence:'office', checkin:'10:33 AM' },
    { id:'THQC106', name:'Manya Garg',             email:'manya@tartanhq.com',             team:'Design',           title:'Design Intern',           presence:'remote', checkin:'-' },
    { id:'THQC080', name:'Prashant Prabhakara Gupta', email:'prashant@tartanhq.com',       team:'Sales',            title:'VP Sales',                presence:'office', checkin:'9:22 AM' },
    { id:'THQ0175', name:'Tushar Kohli',           email:'tushar@tartanhq.com',            team:'Sales',            title:'Sales Lead',              presence:'office', checkin:'9:36 AM' },
    { id:'THQ0139', name:'Sakar Baxi',             email:'sakar@tartanhq.com',             team:'Sales',            title:'Sales Manager',           presence:'remote', checkin:'-' },
    { id:'THQ0117', name:'Prashanta Guha',         email:'prashanta.guha@tartanhq.com',    team:'Sales',            title:'Enterprise Sales',        presence:'office', checkin:'9:49 AM' },
    { id:'THQ0160', name:'Smriti Singh',           email:'smriti@tartanhq.com',            team:'Sales',            title:'Account Executive',       presence:'office', checkin:'10:03 AM' },
    { id:'THQ0156', name:'Abhimanyu',              email:'abhimanyu@tartanhq.com',         team:'Sales',            title:'Sales Associate',         presence:'office', checkin:'10:21 AM' },
    { id:'THQC107', name:'Khushi Goyal',           email:'khushi@tartanhq.com',            team:'Sales',            title:'Sales Intern',            presence:'office', checkin:'10:38 AM' },
    { id:'THQ0164', name:'Rohan Mahajan',          email:'rohan@tartanhq.com',             team:'Marketing',        title:'Content & Brand Lead',    presence:'office', checkin:'10:06 AM' },
    { id:'THQ0170', name:'Rajat Rathore',          email:'rajat.rathore@tartanhq.com',     team:'Marketing',        title:'Growth Marketer',         presence:'office', checkin:'9:54 AM' },
    { id:'THQ0138', name:'Disha Arya',             email:'disha@tartanhq.com',             team:'Marketing',        title:'Marketing Associate',     presence:'remote', checkin:'-' },
    { id:'THQC101', name:'Ayushi Shukla',          email:'ayushi@tartanhq.com',            team:'Marketing',        title:'Marketing Associate',     presence:'office', checkin:'10:16 AM' },
    { id:'THQC0114', name:'Tanvi Jindal',          email:'tanvi@tartanhq.com',             team:'Marketing',        title:'Marketing Intern',        presence:'office', checkin:'10:41 AM' },
    { id:'THQ0125', name:'Chirag Ameta',           email:'chirag@tartanhq.com',            team:'Customer Success', title:'Customer Success Manager',presence:'office', checkin:'9:28 AM' },
    { id:'THQ0180', name:'Smruti Bhawalkar',       email:'smruti@tartanhq.com',            team:'Customer Success', title:'CS Manager',              presence:'office', checkin:'9:46 AM' },
    { id:'THQ0136', name:'Himanshu Rawat',         email:'himanshu.rawat@tartanhq.com',    team:'Customer Success', title:'Support Engineer',        presence:'office', checkin:'9:39 AM' },
    { id:'THQ0122', name:'Priyanka Ghansela',      email:'priyanka.ghansela@tartanhq.com', team:'Customer Success', title:'CS Associate',            presence:'remote', checkin:'-' },
    { id:'THQ0173', name:'Ritika Deopa',           email:'ritika@tartanhq.com',            team:'Customer Success', title:'CS Associate',            presence:'office', checkin:'10:07 AM' },
    { id:'THQC0115', name:'Deeksha Singh',         email:'deeksha@tartanhq.com',           team:'Customer Success', title:'CS Intern',               presence:'office', checkin:'10:37 AM' },
    { id:'THQ0145', name:'Putul Dwarik',           email:'putul@tartanhq.com',             team:'People & Talent',  title:'HR & Ops Lead',           presence:'office', checkin:'9:25 AM' },
    { id:'THQ0171', name:'Radhika Bhatt',          email:'radhika@tartanhq.com',           team:'People & Talent',  title:'Talent Associate',        presence:'office', checkin:'9:57 AM' },
    { id:'THQC0174', name:'Aastha Sehgal',         email:'aastha@tartanhq.com',            team:'People & Talent',  title:'People Intern',           presence:'office', checkin:'10:29 AM' },
    { id:'THQ0167', name:'Ashutosh Bhatt',         email:'ashutosh.bhatt@tartanhq.com',    team:'Finance',          title:'Finance Analyst',         presence:'office', checkin:'9:41 AM' },
    { id:'THQ0177', name:'Pankaj Kumar Singh',     email:'pankaj@tartanhq.com',            team:'Finance',          title:'Finance Associate',       presence:'remote', checkin:'-' },
    { id:'THQDUM0001', name:'Talent HQ',           email:'talent@tartanhq.com',            team:'People & Talent',  title:'System Account',          presence:'remote', checkin:'-' },
    { id:'THQDUM0002', name:'Sushma Sahore',       email:'gst@spdsllp.com',                team:'Finance',          title:'GST / Compliance (Vendor)', presence:'remote', checkin:'-' }
  ];

  // compensation data removed entirely - not visible to anyone

  const teams = [
    { name:"Founder's Office", lead:'Pramey Jain',      color:'#4f46e5' },
    { name:'Engineering',      lead:'Dhaval Bhardwaj',  color:'#0891b2' },
    { name:'Product',          lead:'Anmol Jain',       color:'#7c3aed' },
    { name:'Design',           lead:'Harshita Gupta',   color:'#db2777' },
    { name:'Sales',            lead:'Prashant Gupta',   color:'#059669' },
    { name:'Marketing',        lead:'Rohan Mahajan',    color:'#d97706' },
    { name:'Customer Success', lead:'Smruti Bhawalkar', color:'#2563eb' },
    { name:'People & Talent',  lead:'Putul Dwarik',     color:'#e11d48' },
    { name:'Finance',          lead:'Ashutosh Bhatt',   color:'#475569' }
  ];

  /* ---------- JIRA: projects + issues (synced) ---------- */
  const jiraProjects = [
    { key:'TARA', name:'PolicyOS / Tara' },
    { key:'HS',   name:'HyperSync' },
    { key:'HV',   name:'HyperVerify' },
    { key:'GHRS', name:'Group HR System' },
    { key:'CLAW', name:'Open Claw (Company Brain)' },
    { key:'PLAT', name:'Platform & Infra' }
  ];
  const jiraIssues = [
    { key:'TARA-101', title:'Revised PolicyOS - permission-faithful RBAC + Tara copilot', assignee:'THQ0144', project:'TARA', status:'In Progress', sprint:'Sprint 24', updated:'2h ago' },
    { key:'TARA-104', title:'Per-user permission inheritance engine (ACL sync from sources)', assignee:'THQ0118', project:'TARA', status:'In Progress', sprint:'Sprint 24', updated:'40m ago' },
    { key:'TARA-110', title:'Migrate approval workflows to new access model', assignee:'THQ0101', project:'TARA', status:'In Review', sprint:'Sprint 24', updated:'1d ago' },
    { key:'TARA-118', title:'Unified command bar + intent routing (chat → action)', assignee:'THQ0092', project:'TARA', status:'In Progress', sprint:'Sprint 24', updated:'5h ago' },
    { key:'TARA-121', title:'Identity resolution graph across Notion/Jira/HRMS', assignee:'THQ0133', project:'TARA', status:'Backlog', sprint:'Sprint 25', updated:'3d ago' },
    { key:'CLAW-12',  title:'MCP tool-calling layer for write actions (per-user OAuth)', assignee:'THQ0118', project:'CLAW', status:'In Progress', sprint:'Sprint 24', updated:'6h ago' },
    { key:'CLAW-18',  title:'Connect 5 internal systems (Keka, Jira, Notion, Slack, GDrive)', assignee:'THQ0128', project:'CLAW', status:'In Review', sprint:'Sprint 24', updated:'1d ago' },
    { key:'HS-204',   title:'Darwinbox connector - payroll field mapping', assignee:'THQ0131', project:'HS', status:'In Progress', sprint:'Sprint 24', updated:'3h ago' },
    { key:'HS-209',   title:'MakeMyTrip insurance flow - go-live checklist', assignee:'THQ0146', project:'HS', status:'In Review', sprint:'Sprint 24', updated:'8h ago' },
    { key:'HS-211',   title:'HDFC HyperSync onboarding - SPA & rate card', assignee:'THQ0117', project:'HS', status:'Backlog', sprint:'Sprint 25', updated:'2d ago' },
    { key:'HV-88',    title:'EPFO/UAN live verification latency fix', assignee:'THQ0091', project:'HV', status:'In Progress', sprint:'Sprint 24', updated:'4h ago' },
    { key:'HV-92',    title:'DigiLocker + Aadhaar OCR pipeline', assignee:'THQ0104', project:'HV', status:'Done', sprint:'Sprint 23', updated:'5d ago' },
    { key:'GHRS-31',  title:'Enrollment & endorsement automation', assignee:'THQ0179', project:'GHRS', status:'In Progress', sprint:'Sprint 24', updated:'1d ago' },
    { key:'PLAT-50',  title:'On-prem deployment image + BYO-LLM gateway', assignee:'THQ0124', project:'PLAT', status:'In Progress', sprint:'Sprint 24', updated:'7h ago' },
    { key:'PLAT-54',  title:'Audit-log service for all agent actions', assignee:'THQ0133', project:'PLAT', status:'Backlog', sprint:'Sprint 25', updated:'3d ago' },
    { key:'HV-95',    title:'KYB / GSTN business verification module', assignee:'THQ0104', project:'HV', status:'In Review', sprint:'Sprint 24', updated:'1d ago' }
  ];

  /* ---------- Policy categories ---------- */
  const categories = [
    { name:'Lending',    subs:['Personal Loan','Two-Wheeler','MSME','Home Loan','Collections'], color:'#2f49c4', enabled:true },
    { name:'HR',         subs:['Leave','Travel & Expense'],                       color:'#5e4d83', enabled:true },
    { name:'Compliance', subs:['KYC / AML','Information Security','Regulatory Updates'],          color:'#3a7479', enabled:true }
  ];

  /* ---------- Policies (permission-faithful, CATEGORY-SCOPED per the RBAC PRD) ----------
     A viewer may see a policy if ANY match:
       - user.role === 'admin'  (admin effectively has every category)
       - the policy's category is in the user's assigned categories
       - access.everyone === true  (company-wide document grant)
       - user.id in access.users  (per-person document grant)
     Turning a category off hides its policies everywhere for everyone.
  */
  const policies = [
    { id:'P-PL',  name:'Personal Loan Credit Policy', category:'Lending', sub:'Personal Loan', owner:'THQ0101', status:'Active', version:'v3.2', updated:'12 Jun 2026', sensitive:false,
      access:{ everyone:false, users:[] },
      summary:'Unsecured personal loan underwriting policy. Defines eligibility, bureau cutoffs, FOIR limits, documentation and approval matrix.',
      facts:{ 'Minimum CIBIL score':'700', 'Age band':'23–58 years', 'Max FOIR':'55%', 'Ticket size':'₹50K – ₹15L', 'Min monthly income':'₹25,000', 'Tenure':'12–60 months' },
      rules:['IF cibil_score < 700 THEN reject','IF age < 23 OR age > 58 THEN reject','IF foir > 0.55 THEN refer to L2','IF monthly_income < 25000 THEN reject'] },
    { id:'P-2W',  name:'Two-Wheeler Loan Policy', category:'Lending', sub:'Two-Wheeler', owner:'THQ0101', status:'Active', version:'v2.0', updated:'02 Jun 2026', sensitive:false,
      access:{ everyone:false, users:[] },
      summary:'Two-wheeler financing policy. LTV up to 90%, salaried and self-employed segments.',
      facts:{ 'Minimum CIBIL score':'680', 'Age band':'21–60 years', 'Max LTV':'90%', 'Ticket size':'₹40K – ₹2L', 'Tenure':'12–36 months' },
      rules:['IF cibil_score < 680 THEN reject','IF ltv > 0.90 THEN reject','IF age < 21 THEN reject'] },
    { id:'P-MSME',name:'MSME Lending Policy', category:'Lending', sub:'MSME', owner:'THQ0101', status:'Active', version:'v1.4', updated:'28 May 2026', sensitive:false,
      access:{ everyone:false, users:[] },
      summary:'Secured MSME lending policy. Business vintage, GST turnover and constitution checks.',
      facts:{ 'Minimum CIBIL / CMR':'CMR ≤ 6', 'Business vintage':'≥ 3 years', 'Min age of promoter':'27 years', 'GST turnover':'≥ ₹40L', 'Constitution':'Proprietor / Partnership / LLP / Pvt Ltd' },
      rules:['IF business_vintage_years < 3 THEN reject','IF promoter_age < 27 THEN reject','IF gst_turnover < 4000000 THEN refer'] },
    { id:'P-HL',  name:'Home Loan Policy', category:'Lending', sub:'Home Loan', owner:'THQ0101', status:'Active', version:'v4.1', updated:'09 Jun 2026', sensitive:false,
      access:{ everyone:false, users:[] },
      summary:'Home loan underwriting. LTV slabs, property valuation and legal/technical clearance.',
      facts:{ 'Minimum CIBIL score':'720', 'Age band':'25–65 years', 'Max LTV':'80%', 'Tenure':'up to 30 years' },
      rules:['IF cibil_score < 720 THEN reject','IF ltv > 0.80 THEN reject'] },
    { id:'P-COLL',name:'Collections & Recovery Policy', category:'Lending', sub:'Collections', owner:'THQ0101', status:'Active', version:'v2.3', updated:'30 May 2026', sensitive:false,
      access:{ everyone:false, users:[] },
      summary:'Delinquency bucketing, recovery actions and legal recourse for NPA accounts.',
      facts:{ 'Soft bucket':'0–30 DPD', 'Hard bucket':'90+ DPD', 'Legal trigger':'180 DPD' },
      rules:['IF dpd > 90 THEN move to hard bucket','IF dpd > 180 THEN initiate legal'] },
    { id:'P-KYC', name:'KYC & AML Policy', category:'Compliance', sub:'KYC / AML', owner:'THQ0165', status:'Active', version:'v5.0', updated:'15 Jun 2026', sensitive:false,
      access:{ everyone:false, users:[] },
      summary:'Customer due diligence, PEP screening, transaction monitoring and STR/CTR reporting per RBI Master Directions.',
      facts:{ 'CDD':'Mandatory at onboarding', 'Re-KYC':'High-risk: 2 yrs', 'PEP screening':'Required', 'STR filing':'Within 7 days' },
      rules:['IF customer_pep = true THEN enhanced_due_diligence','IF txn flagged THEN file STR within 7 days'] },
    { id:'P-ISEC',name:'Information Security Policy', category:'Compliance', sub:'Information Security', owner:'THQ0124', status:'Active', version:'v3.1', updated:'10 Jun 2026', sensitive:false,
      access:{ everyone:true, roles:[], teams:[], users:[] },
      summary:'Acceptable use, access control, data classification, device and incident-response standards for all staff.',
      facts:{ 'MFA':'Mandatory', 'Data at rest':'AES-256', 'Laptop encryption':'Required', 'Incident report':'Within 24 hrs' },
      rules:['IF device unmanaged THEN block access','IF incident THEN report within 24h'] },
    { id:'P-LEAVE',name:'Employee Leave Policy', category:'HR', sub:'Leave', owner:'THQ0145', status:'Active', version:'v2.2', updated:'01 Jun 2026', sensitive:false,
      access:{ everyone:true, roles:[], teams:[], users:[] },
      summary:'Leave entitlements and process for all employees: privilege, casual, sick and parental leave.',
      facts:{ 'Privilege leave':'18 / yr', 'Casual leave':'8 / yr', 'Sick leave':'10 / yr', 'Parental (maternity)':'26 weeks', 'Parental (paternity)':'2 weeks', 'Carry-forward':'up to 30 days' },
      rules:['IF leave_balance <= 0 THEN mark loss-of-pay','IF sick_leave > 2 consecutive THEN medical certificate required'] },
    { id:'P-TRAVEL',name:'Travel & Expense Policy', category:'HR', sub:'Travel & Expense', owner:'THQ0145', status:'Active', version:'v1.6', updated:'20 May 2026', sensitive:false,
      access:{ everyone:true, roles:[], teams:[], users:[] },
      summary:'Domestic and international travel approvals, per-diems, and reimbursement timelines.',
      facts:{ 'Domestic hotel cap':'₹5,000 / night', 'Per-diem (metro)':'₹1,500 / day', 'Approval':'Manager + Finance', 'Reimbursement':'Within 7 working days' },
      rules:['IF expense > 5000 THEN manager approval required','IF international THEN founder approval'] }
  ];

  /* ---------- Login personas (no passwords - pick & go) ----------
     Exactly three roles (per the RBAC PRD): admin | policy_manager | user.
     Access is CATEGORY-SCOPED: `categories` lists the policy categories a user may see.
     Admin effectively has all categories. Policy Manager approver (checker) duties live in that role.
     Two managers are scoped to different categories so category scoping is visible end to end. */
  const users = [
    { id:'THQ0144', role:'admin',          categories:['Lending','HR','Compliance'] },   // Sankalp - runs the platform, sees all
    // Policy managers: `categories` = policy content they own; `manages` = the TEAMS whose people they oversee
    // (that is who they see in User Management - scoped, not the whole org like admin).
    { id:'THQ0101', role:'policy_manager', categories:['Lending'],    manages:['Product'] },                 // Anmol - Product team
    { id:'THQ0165', role:'policy_manager', categories:['Compliance'], manages:['Customer Success','Sales'] },// Subhrangshu (CBO) - CS + Sales
    { id:'THQ0125', role:'user',           categories:['HR'] }                            // Chirag - staff; reads HR + all-staff docs
  ];
  const roleLabels = {
    admin:'Administrator', policy_manager:'Policy Manager', user:'Staff User'
  };

  /* ---------- Approval workflows ---------- */
  const workflows = [
    { id:'WF1', name:'Lending Policy Approval', milestone:'Policy Management', category:'Lending', status:'Active',
      levels:[ { n:1, users:['THQ0101'], criteria:'Anyone' }, { n:2, users:['THQ0165','THQ0144'], criteria:'All' } ], created:'12 Mar 2026' },
    { id:'WF2', name:'HR Policy Approval', milestone:'Policy Management', category:'HR', status:'Active',
      levels:[ { n:1, users:['THQ0145'], criteria:'Anyone' }, { n:2, users:['THQ0002'], criteria:'Anyone' } ], created:'02 Apr 2026' },
    { id:'WF3', name:'Compliance Policy Approval', milestone:'Policy Management', category:'Compliance', status:'Active',
      levels:[ { n:1, users:['THQ0165'], criteria:'Anyone' }, { n:2, users:['THQ0144'], criteria:'Anyone' } ], created:'18 Apr 2026' }
  ];

  /* ---------- Pending approval requests ---------- */
  const approvals = [
    { id:'REQ-1041', name:'Personal Loan Credit Policy - v3.2 → v3.3', type:'Policy Change', policy:'P-PL', requestedBy:'THQ0101', on:'16 Jun 2026', priority:'High', status:'Pending L2',
      change:{ field:'Minimum CIBIL score', from:'700', to:'720' }, rationale:'Early-bucket delinquency up 1.8% in sub-700 cohort; tightening cutoff projected to cut NPA by ~0.6%.',
      complianceFlag:null },
    { id:'REQ-1039', name:'KYC & AML Policy - v5.0 → v5.1', type:'Policy Change', policy:'P-KYC', requestedBy:'THQ0165', on:'15 Jun 2026', priority:'High', status:'Pending L1',
      change:{ field:'Re-KYC cycle (high-risk)', from:'2 years', to:'1 year' }, rationale:'Align with latest RBI Master Direction amendment on periodic updation.',
      complianceFlag:'Matches RBI circular RBI/2026-27/41 (May 2026) - recommended.' },
    { id:'REQ-1036', name:'Two-Wheeler Loan Policy - v2.0 → v2.1', type:'Policy Change', policy:'P-2W', requestedBy:'THQ0101', on:'14 Jun 2026', priority:'Medium', status:'Pending L1',
      change:{ field:'Max LTV', from:'90%', to:'85%' }, rationale:'Reduce LGD on repossession; competitor benchmarking shows 85% is market norm.',
      complianceFlag:null }
  ];

  /* ---------- Assessments ---------- */
  const assessments = [
    { id:'AS1', name:'KYC & AML Awareness - Q2', category:'Compliance', start:'10 Jun 2026', end:'25 Jun 2026', passing:80, participants:64, done:41, status:'Active' },
    { id:'AS2', name:'Personal Loan Policy Quiz', category:'Lending', start:'05 Jun 2026', end:'20 Jun 2026', passing:70, participants:18, done:12, status:'Active' },
    { id:'AS3', name:'Information Security Refresher', category:'Compliance', start:'01 Jul 2026', end:'15 Jul 2026', passing:75, participants:64, done:0, status:'Draft' },
    { id:'AS4', name:'Leave Policy Onboarding Check', category:'HR', start:'20 May 2026', end:'30 May 2026', passing:60, participants:12, done:12, status:'Completed' }
  ];

  /* ---------- InsightGen (text-to-SQL + proactive insights) ---------- */
  const insights = [
    { id:'I1', priority:'High', cat:'Risk', metric:'6.6%', title:'NPA Rate Above Threshold', desc:'Personal Loan NPA crossed the 6% internal threshold this quarter, driven by the sub-700 CIBIL cohort.',
      sql:"SELECT product, ROUND(100.0*SUM(CASE WHEN dpd>90 THEN 1 ELSE 0 END)/COUNT(*),1) AS npa_pct\nFROM loan_book GROUP BY product HAVING npa_pct > 6;" },
    { id:'I2', priority:'Medium', cat:'Operations', metric:'57%', title:'High Application Rejection Rate', desc:'57% of personal loan applications are rejected; low bureau score and high FOIR dominate.',
      sql:"SELECT rejection_reason, COUNT(*) c FROM loan_applications\nWHERE status='Rejected' GROUP BY rejection_reason ORDER BY c DESC;" },
    { id:'I3', priority:'Medium', cat:'Operations', metric:'10.6%', title:'Low Conversion at Thane Branch', desc:'Thane branch login-to-disbursal conversion is 10.6%, well below the 18% network average.',
      sql:"SELECT branch, ROUND(100.0*disbursed/logins,1) conv FROM branch_funnel\nWHERE branch='Thane';" }
  ];
  const rejectionReasons = [
    { reason:'Low bureau score', count:373 }, { reason:'High FOIR', count:246 },
    { reason:'Age outside policy range', count:190 }, { reason:'Insufficient income', count:188 },
    { reason:'Insufficient employment tenure', count:73 }, { reason:'High existing obligations', count:60 },
    { reason:'High recent bureau inquiries', count:5 }
  ];

  /* ---------- Connectors (sources for permission-faithful retrieval) ---------- */
  const connectors = [
    { id:'keka',   name:'Keka HRMS',        kind:'HRMS',      status:'connected', synced:'Synced 8 min ago',  count:'67 employees', note:'People, teams, presence, compensation (gated)', auth:'OAuth · acts per user' },
    { id:'greythr',name:'greytHR',          kind:'HRMS',      status:'available', synced:'Not connected',     count:'-', note:'Alternate HRMS - payroll, attendance, leave', auth:'API key / OAuth' },
    { id:'jira',   name:'Jira',             kind:'Project',   status:'connected', synced:'Synced 3 min ago',  count:'16 active issues', note:'Projects, issues, assignees, sprints', auth:'OAuth · acts per user' },
    { id:'notion', name:'Notion',           kind:'Docs / KB', status:'connected', synced:'Synced 22 min ago', count:'318 pages', note:'Inherits Notion page-level sharing', auth:'OAuth · acts per user' },
    { id:'slack',  name:'Slack',            kind:'Messaging', status:'connected', synced:'Synced 1 min ago',  count:'42 channels', note:'Public + permitted private channels only', auth:'OAuth · acts per user' },
    { id:'policyos', name:'PolicyOS Repository', kind:'Policies', status:'connected', synced:'Live', count:'10 policies', note:'Category + role-scoped access', auth:'Native RBAC' },
    { id:'gdrive', name:'Google Drive',     kind:'Files',     status:'available', synced:'Not connected',     count:'-', note:'Folder/file ACL inheritance', auth:'-' },
    { id:'gmail',  name:'Gmail',            kind:'Email',     status:'available', synced:'Not connected',     count:'-', note:'Write action: send mail as user', auth:'-' }
  ];

  const company = { name:'Tartan HQ', workspace:'TartanHQ', llm:'Bring-your-own (currently: Claude · on-prem gateway)' };

  /* ---------- Simulator: numeric eligibility knobs per credit/origination policy ---------- */
  const simParams = {
    'P-PL':   { minCibil:700, minAge:23, maxAge:58, maxFoir:0.55 },
    'P-2W':   { minCibil:680, minAge:21, maxAge:60, maxLtv:0.90 },
    'P-MSME': { minAge:27 },
    'P-HL':   { minCibil:720, minAge:25, maxAge:65, maxLtv:0.80 }
  };

  /* ---------- Anonymized synthetic test cohort (deterministic; no PII) ---------- */
  const testBase = (function () {
    let s = 987654321;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const rows = [];
    for (let i = 0; i < 220; i++) {
      const cibil = 600 + Math.floor(rnd() * 261);            // 600–860
      const age = 21 + Math.floor(rnd() * 45);                // 21–65
      const foir = Math.round(28 + rnd() * 47) / 100;         // 0.28–0.75
      const ltv = Math.round(60 + rnd() * 35) / 100;          // 0.60–0.95
      const income = 15000 + Math.floor(rnd() * 120000);
      const risk = (720 - cibil) / 140 + (foir - 0.5) * 1.2;  // lower CIBIL / higher FOIR → riskier
      const defaulted = rnd() < Math.max(0.01, Math.min(0.55, 0.07 + risk * 0.10));
      rows.push({ id: 'APP' + (1001 + i), cibil, age, foir, ltv, income, defaulted });
    }
    return rows;
  })();

  /* ---------- Regulatory feed (Compliance › Regulatory Updates) ---------- */
  const circulars = [
    { id:'CIR-36', regulator:'RBI', ref:'RBI/2026-27/36', title:'Higher provisioning on unsecured retail exposure', date:'09 May 2026', status:'New',
      affects:'P-PL', field:'Minimum CIBIL score', current:'700', mandated:'720',
      summary:'Revised risk-weights raise capital cost on sub-720 unsecured retail. Aligning the bureau cutoff reduces capital drag and early-bucket delinquency.',
      suggestion:'Raise the Personal Loan minimum CIBIL cutoff from 700 to 720 to align with the revised risk-weights.',
      simOverride:{ minCibil:720 } },
    { id:'CIR-41', regulator:'RBI', ref:'RBI/2026-27/41', title:'Periodic KYC updation - revised timelines', date:'02 Jun 2026', status:'New',
      affects:'P-KYC', field:'Re-KYC cycle (high-risk)', current:'2 years', mandated:'1 year',
      summary:'High-risk customers must undergo periodic KYC updation at least once every 12 months (previously 24).',
      suggestion:'Tighten the high-risk Re-KYC cycle in the KYC & AML Policy from 2 years to 1 year.', simOverride:null },
    { id:'CIR-39', regulator:'RBI', ref:'RBI/2026-27/39', title:'Digital lending - cooling-off period', date:'21 May 2026', status:'Reviewed',
      affects:'P-PL', field:'Cooling-off / look-up period', current:'Not specified', mandated:'3 days',
      summary:'Borrowers must get a 3-day cooling-off window to exit a digital loan without penalty.',
      suggestion:'Add a 3-day cooling-off clause to the Personal Loan Credit Policy disbursal section.', simOverride:null },
    { id:'SEBI-12', regulator:'SEBI', ref:'SEBI/HO/2026/12', title:'Outsourcing of regulated activities', date:'28 Apr 2026', status:'No gap',
      affects:'P-ISEC', field:'Vendor access review', current:'Annual', mandated:'Annual',
      summary:'Periodic review of outsourced/vendor access. Your Information Security Policy already satisfies this.',
      suggestion:null, simOverride:null }
  ];

  /* ---------- Incoming (manually uploaded) circulars - the manual-ingest counterpart to the auto feed.
     NBFCs face far more regulation than can be embedded, so a compliance owner uploads the PDF and
     Tara checks it against the WHOLE policy library. One circular usually touches several policies;
     each clause carries the page it sits on (for citation) and the per-policy redline it implies. ---------- */
  const incomingCirculars = [
    { id:'INC-RBI-58', regulator:'RBI', ref:'RBI/2026-27/58', title:'Master Direction – Responsible Lending Conduct (Retail & MSME)',
      date:'18 Jun 2026', pages:7, file:'RBI_MD_Responsible_Lending_2026.pdf',
      summary:'Consolidated direction tightening unsecured retail underwriting, LTV discipline on secured retail, MSME credit-decision turnaround and borrower cooling-off. Supersedes select earlier circulars and applies to all NBFCs from the next quarter.',
      clauses:[
        { id:'C1', page:2, ref:'¶2.3', topic:'Unsecured retail bureau floor',
          text:'Lenders shall not originate unsecured personal credit to borrowers with a bureau score below 720, save for fully-secured or staff exposures.',
          impact:[ { policyId:'P-PL', anchor:'Minimum CIBIL score', current:'700', suggested:'720',
                     rationale:'Clause ¶2.3 sets a hard 720 floor for unsecured personal credit; the policy floor of 700 is below the mandate.', sim:{ minCibil:720 } } ] },
        { id:'C2', page:3, ref:'¶3.1', topic:'Personal-loan FOIR ceiling',
          text:'Fixed-obligation-to-income ratio (FOIR) for unsecured personal credit shall not exceed 50% at origination.',
          impact:[ { policyId:'P-PL', anchor:'Max FOIR', current:'55%', suggested:'50%',
                     rationale:'Clause ¶3.1 caps FOIR at 50%; the policy permits 55%.', sim:{ maxFoir:0.50 } } ] },
        { id:'C3', page:4, ref:'¶4.2', topic:'Digital-loan cooling-off period',
          text:'Every digital loan shall carry a borrower cooling-off period of not less than three (3) days from disbursal, with exit allowed without penalty.',
          impact:[ { policyId:'P-PL', anchor:'Cooling-off period', isNew:true, current:'No cooling-off clause', suggested:'Add 3-day cooling-off (no-penalty exit)',
                     rationale:'Clause ¶4.2 mandates a 3-day cooling-off window; the Personal Loan policy is currently silent on it.' } ] },
        { id:'C4', page:5, ref:'¶5.4', topic:'Secured retail LTV discipline',
          text:'Loan-to-value on two-wheeler advances shall be capped at 85% of on-road value.',
          impact:[ { policyId:'P-2W', anchor:'Max LTV', current:'90%', suggested:'85%',
                     rationale:'Clause ¶5.4 caps two-wheeler LTV at 85%; the policy permits 90%.', sim:{ maxLtv:0.85 } } ] },
        { id:'C5', page:6, ref:'¶6.1', topic:'MSME credit-decision turnaround',
          text:'A documented credit decision on MSME applications shall be communicated to the applicant within fourteen (14) calendar days.',
          impact:[ { policyId:'P-MSME', anchor:'Credit-decision turnaround', isNew:true, current:'No decision TAT defined', suggested:'14-day decision TAT',
                     rationale:'Clause ¶6.1 requires a 14-day decision TAT; the MSME policy defines none.' } ] },
        { id:'C6', page:6, ref:'¶6.5', topic:'Periodic KYC cadence',
          text:'Periodic KYC for high-risk customers shall be carried out at least once every 12 months.',
          impact:[ { policyId:'P-KYC', anchor:'Re-KYC', current:'High-risk: 2 yrs', suggested:'High-risk: 1 yr',
                     rationale:'Clause ¶6.5 shortens high-risk re-KYC to 12 months; consistent with the in-flight KYC change.' } ] }
      ] },
    { id:'INC-SEBI-19', regulator:'SEBI', ref:'SEBI/HO/2026/19', title:'Cyber Resilience & Vendor Access Controls',
      date:'12 Jun 2026', pages:4, file:'SEBI_Cyber_Resilience_2026.pdf',
      summary:'Strengthens periodic access reviews and multi-factor authentication for regulated entities and their outsourced vendors.',
      clauses:[
        { id:'C1', page:2, ref:'¶2.1', topic:'Vendor access review cadence',
          text:'Access granted to outsourced vendors shall be reviewed at least semi-annually and revoked on contract exit.',
          impact:[ { policyId:'P-ISEC', anchor:'Vendor access review', isNew:true, current:'Annual vendor access review', suggested:'Semi-annual vendor access review',
                     rationale:'Clause ¶2.1 requires semi-annual vendor access reviews; the policy does this annually.' } ] },
        { id:'C2', page:3, ref:'¶3.2', topic:'MFA on privileged access',
          text:'Multi-factor authentication shall be mandatory for all privileged and remote access.',
          impact:[ { policyId:'P-ISEC', anchor:'MFA', current:'Mandatory', suggested:'Mandatory (already compliant)',
                     rationale:'The Information Security policy already mandates MFA - no change required.', noGap:true } ] }
      ] }
  ];

  /* ---------- Regulatory amendments (new releases from authorities → suggested policy changes) ----------
     One amendment can touch MANY policies; one policy can collect changes from MANY amendments.
     Each change targets a policy 'section' (a fact key, or isNew for an added clause). ---------- */
  const amendments = [
    { id:'AMD-58', regulator:'RBI', ref:'RBI/2026-27/58', title:'Master Direction – Responsible Lending Conduct', date:'18 Jun 2026', status:'New',
      summary:'Tightens unsecured-retail underwriting and secured-retail LTV discipline; adds an MSME credit-decision turnaround.',
      changes:[
        { id:'CH-58-1', policyId:'P-PL', clauseRef:'¶2.3', section:'Minimum CIBIL score', current:'700', suggested:'720',
          rationale:'Clause ¶2.3 sets a hard 720 floor for unsecured personal credit; the policy floor of 700 is below the mandate.', sim:{ minCibil:720 } },
        { id:'CH-58-2', policyId:'P-PL', clauseRef:'¶3.1', section:'Max FOIR', current:'55%', suggested:'50%',
          rationale:'Clause ¶3.1 caps FOIR at 50% at origination; the policy permits 55%.', sim:{ maxFoir:0.50 } },
        { id:'CH-58-3', policyId:'P-2W', clauseRef:'¶5.4', section:'Max LTV', current:'90%', suggested:'85%',
          rationale:'Clause ¶5.4 caps two-wheeler LTV at 85% of on-road value.', sim:{ maxLtv:0.85 } },
        { id:'CH-58-4', policyId:'P-MSME', clauseRef:'¶6.1', section:'Credit-decision turnaround', current:'No TAT defined', suggested:'14-day decision TAT', isNew:true,
          rationale:'Clause ¶6.1 requires a documented credit decision within 14 calendar days.' }
      ] },
    { id:'AMD-39', regulator:'RBI', ref:'RBI/2026-27/39', title:'Digital Lending – Cooling-off Period', date:'21 May 2026', status:'New',
      summary:'Mandates a 3-day borrower cooling-off window on every digital loan.',
      changes:[
        { id:'CH-39-1', policyId:'P-PL', clauseRef:'¶4.2', section:'Cooling-off period', current:'No cooling-off clause', suggested:'Add 3-day cooling-off (no-penalty exit)', isNew:true,
          rationale:'Clause ¶4.2 mandates a 3-day cooling-off window; the Personal Loan policy is currently silent on it.' }
      ] },
    { id:'AMD-41', regulator:'RBI', ref:'RBI/2026-27/41', title:'Periodic KYC – Revised Timelines', date:'02 Jun 2026', status:'New',
      summary:'High-risk customers must undergo periodic KYC updation at least once every 12 months.',
      changes:[
        { id:'CH-41-1', policyId:'P-KYC', clauseRef:'¶6.5', section:'Re-KYC', current:'High-risk: 2 yrs', suggested:'High-risk: 1 yr',
          rationale:'Shortens the high-risk re-KYC cycle from 24 to 12 months.' }
      ] },
    { id:'AMD-S19', regulator:'SEBI', ref:'SEBI/HO/2026/19', title:'Cyber Resilience & Vendor Access Controls', date:'12 Jun 2026', status:'New',
      summary:'Strengthens periodic access reviews for outsourced vendors of regulated entities.',
      changes:[
        { id:'CH-S19-1', policyId:'P-ISEC', clauseRef:'¶2.1', section:'Vendor access review', current:'Annual', suggested:'Semi-annual', isNew:true,
          rationale:'Clause ¶2.1 requires vendor access to be reviewed at least semi-annually.' }
      ] },
    // ---- broader release feed (mix of RBI / SEBI / IRDAI / MCA / self-uploaded; some informational) ----
    { id:'AMD-51', regulator:'RBI', ref:'RBI/2026-27/51', title:'Fair Practices Code - Grievance Redressal SLAs', date:'09 Jun 2026', status:'New',
      summary:'Tightens turnaround times for customer grievance resolution across lending products.',
      changes:[ { id:'CH-51-1', policyId:'P-COLL', clauseRef:'¶7.2', section:'Grievance SLA', current:'30 days', suggested:'21 days',
        rationale:'Clause ¶7.2 caps grievance resolution at 21 days.' } ] },
    { id:'AMD-47', regulator:'RBI', ref:'RBI/2026-27/47', title:'Key Facts Statement - Standardised Format', date:'28 May 2026', status:'New',
      summary:'Mandates a standardised Key Facts Statement (KFS) with the all-inclusive APR for retail loans.',
      changes:[ { id:'CH-47-1', policyId:'P-HL', clauseRef:'¶3.4', section:'KFS disclosure', current:'Not specified', suggested:'Mandatory KFS with APR', isNew:true,
        rationale:'Clause ¶3.4 requires a KFS with the all-in APR at sanction.' } ] },
    { id:'AMD-44', regulator:'RBI', ref:'RBI/2026-27/44', title:'Penal Charges on Loan Accounts', date:'14 May 2026', status:'New',
      summary:'Penal charges must be reasonable, disclosed, and not capitalised into the principal.', scope:'Applies to all retail lending products. Review penal-charge clauses; no automatic parameter change mapped.', changes:[] },
    { id:'AMD-IR07', regulator:'IRDAI', ref:'IRDAI/2026/07', title:'Bancassurance - Suitability & Disclosure', date:'02 May 2026', status:'New',
      summary:'Sets suitability assessment and disclosure norms for insurance distributed with credit.', scope:'Relevant if insurance is cross-sold with loans. Informational for the current policy set.', changes:[] },
    { id:'AMD-IR05', regulator:'IRDAI', ref:'IRDAI/2026/05', title:'Group Credit Life - Claims Turnaround', date:'19 Apr 2026', status:'New',
      summary:'Shortens claims settlement turnaround for group credit-life cover.', scope:'Informational - no lending-policy parameter mapped.', changes:[] },
    { id:'AMD-S14', regulator:'SEBI', ref:'SEBI/HO/2026/14', title:'Outsourcing of Regulated Activities', date:'22 Apr 2026', status:'New',
      summary:'Board-approved outsourcing policy and material-outsourcing register required.',
      changes:[ { id:'CH-S14-1', policyId:'P-ISEC', clauseRef:'¶4.3', section:'Material outsourcing register', current:'Not maintained', suggested:'Board-reviewed register', isNew:true,
        rationale:'Clause ¶4.3 requires a board-reviewed material-outsourcing register.' } ] },
    { id:'AMD-M03', regulator:'MCA', ref:'MCA/CSR/2026/03', title:'CSR Reporting - Revised Disclosures', date:'05 Apr 2026', status:'New',
      summary:'Revised CSR spend disclosure format in the board report.', scope:'Corporate governance; informational for the policy library.', changes:[] },
    { id:'AMD-36', regulator:'RBI', ref:'RBI/2026-27/36', title:'Provisioning on Unsecured Retail Exposure', date:'09 May 2026', status:'New',
      summary:'Higher standard-asset provisioning on unsecured retail exposure.', scope:'Finance/risk provisioning change; review capital impact. No underwriting parameter mapped.', changes:[] },
    { id:'AMD-U01', regulator:'Internal', source:'self', ref:'TARTAN/CIRC/2026/01', title:'Travel & Expense - Revised Per-Diem Caps', date:'12 Mar 2026', status:'New',
      summary:'Internally uploaded circular revising domestic per-diem limits.',
      changes:[ { id:'CH-U01-1', policyId:'P-TRAVEL', clauseRef:'§2', section:'Per-diem (metro)', current:'₹1,500 / day', suggested:'₹1,800 / day',
        rationale:'Internal revision to metro per-diem cap effective Q2.' } ] },
    { id:'AMD-U02', regulator:'Internal', source:'self', ref:'TARTAN/CIRC/2026/02', title:'Leave Policy - Parental Leave Update', date:'26 Feb 2026', status:'New',
      summary:'Internally uploaded note extending paternity leave.', scope:'HR policy update; routed for awareness.', changes:[] },
    { id:'AMD-S09', regulator:'SEBI', ref:'SEBI/HO/2026/09', title:'Cyber Incident Reporting Window', date:'31 Mar 2026', status:'New',
      summary:'Reportable cyber incidents must be notified within 6 hours of detection.',
      changes:[ { id:'CH-S09-1', policyId:'P-ISEC', clauseRef:'¶5.2', section:'Incident report', current:'Within 24 hrs', suggested:'Within 6 hrs',
        rationale:'Clause ¶5.2 shortens the incident-reporting window to 6 hours.' } ] },
    { id:'AMD-31', regulator:'RBI', ref:'RBI/2026-27/31', title:'Co-Lending Arrangements - Disclosure', date:'18 Feb 2026', status:'New',
      summary:'Enhanced disclosure and default-sharing norms for co-lending.', scope:'Applies if co-lending is used; informational for the current library.', changes:[] }
  ];

  return { employees, teams, jiraProjects, jiraIssues, categories, policies,
           users, roleLabels, workflows, approvals, assessments, insights, rejectionReasons,
           connectors, company, simParams, testBase, circulars, incomingCirculars, amendments };
})();
