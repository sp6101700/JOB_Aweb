'use strict';
/* Kestrel Logistics – IT Operations & Helpdesk Automation Portal
   FRONTEND ONLY. "Local simulation" actions run in this browser. Python / RabbitMQ / Agentix are
   external: this page only exchanges Excel files with them (see README.md). */

const KEY='kestrel_portal_v1';
const DEPTS=['IT','HR','Finance','Operations','Warehouse','Sales','Customer Support','Procurement'];
const REQ_TYPES=['New Joiner Setup','Access Request','Password Reset','Hardware Request','Offboarding'];
const EMP_STATUS=['Active','Pending','Inactive'];
const ACCESS_TYPES=['VPN','ERP / SAP','Email Distribution List','Shared Drive','CRM','Warehouse Management System','Admin Rights'];
const DEFAULT_ACCESS={IT:'Admin Rights',Finance:'ERP / SAP',Warehouse:'Warehouse Management System',Sales:'CRM'};
const TKT_CATS=['Hardware','Software','Network','Login Issues'];
const PRIORITIES=['Low','Medium','High','Critical'];
const TKT_STATUS=['Open','In Progress','Resolved'];
const KEYS=['id','first','last','email','dept','desig','joined','reqType','status'];
const EMP_COLS=['Employee ID','First Name','Last Name','Email','Department','Designation','Joining Date','Request Type','Status'];
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGES=[['dashboard','Dashboard'],['employees','Employee Management'],['excel','Excel Import / Export'],['login','1 · Login ID Creation'],['account','2 · Account Creation'],['access','3 · Access Requests'],['reset','4 · Password Reset'],['tickets','5 · Helpdesk Tickets'],['automation','Automation Control'],['logs','Automation Logs'],['reports','Reports']];

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=(n,l=4)=>String(n).padStart(l,'0');
const now=()=>new Date().toISOString();
const fmt=i=>i?new Date(i).toLocaleString():'';
const fullName=e=>e.first+' '+e.last;
const empById=id=>S.employees.find(e=>e.id===id);
const opts=(a,sel='')=>a.map(v=>`<option${v===sel?' selected':''}>${esc(v)}</option>`).join('');
const empOpts=(sel='')=>S.employees.map(e=>`<option value="${esc(e.id)}"${e.id===sel?' selected':''}>${esc(e.id)} – ${esc(fullName(e))}</option>`).join('');
const fld=(l,n,v='',t='text',x='')=>`<label>${l}<input name="${n}" type="${t}" value="${esc(v)}" ${x}></label>`;
const sel=(l,n,list,v='')=>`<label>${l}<select name="${n}">${opts(list,v)}</select></label>`;
const empSel=(l,n,v='')=>`<label>${l}<select name="${n}" required><option value="">Select employee…</option>${empOpts(v)}</select></label>`;
const BADGE={Success:'ok',Approved:'ok',Completed:'ok',Resolved:'ok',Active:'ok',Failed:'bad',Rejected:'bad',Inactive:'bad',Critical:'bad',Errored:'bad',Pending:'warn',Open:'warn',High:'warn','In Progress':'info'};
const badge=s=>`<span class="badge ${BADGE[s]||'info'}">${esc(s)}</span>`;
const table=(cols,rows,empty)=>rows.length?`<div class="tw"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<p class="empty">${empty}</p>`;
let tt;function toast(m,t='ok'){const el=$('#toast');el.textContent=m;el.className='show '+t;clearTimeout(tt);tt=setTimeout(()=>el.className='',4500);}
function openDlg(h){const d=$('#dlg');d.innerHTML=h;if(!d.open)d.showModal();}
function closeDlg(){const d=$('#dlg');if(d.open)d.close();}
const go=p=>{if(location.hash==='#'+p)route();else location.hash=p;};

/* ---------- state (localStorage) ---------- */
function seed(){
  const E=[]
  .map(a=>({id:a[0],first:a[1],last:a[2],email:(a[1]+'.'+a[2]).toLowerCase()+'@kestrellogistics.com',dept:a[3],desig:a[4],joined:a[5],reqType:a[6],status:a[7]}));
  const t=new Date(Date.now()-864e5).toISOString(),y=new Date().getFullYear();
  return {employees:E,logins:[],accounts:[],
    access:[{id:'ACC-0001',empId:'EMP-1003',name:'Priya Nair',dept:'Finance',type:'ERP / SAP',just:'Month-end closing needs ERP read access.',status:'Pending',time:t,decided:'',auto:false},
            {id:'ACC-0002',empId:'EMP-1006',name:'Arjun Deshmukh',dept:'Sales',type:'CRM',just:'Needs CRM access for new key accounts.',status:'Approved',time:t,decided:t,auto:false},
            {id:'ACC-0003',empId:'EMP-1004',name:'Vikram Singh',dept:'Warehouse',type:'Shared Drive',just:'Needs shared drive for dispatch sheets.',status:'Rejected',time:t,decided:t,auto:false}],
    resets:[],
    tickets:[{id:`TKT-${y}-0001`,empId:'EMP-1004',name:'Vikram Singh',cat:'Hardware',pri:'High',subj:'Handheld scanner not charging',desc:'Scanner at dock 3 will not charge.',status:'Open',time:t,upd:t},
             {id:`TKT-${y}-0002`,empId:'EMP-1002',name:'Rohan Mehta',cat:'Network',pri:'Medium',subj:'Wi-Fi drops in dispatch office',desc:'Connection drops every 10 minutes.',status:'In Progress',time:t,upd:t}],
    logs:[],jobs:[],activity:[{time:t,text:'Demo data loaded (10 employees)'}],settings:{lastImport:null},seq:{acc:3,tkt:2,rst:0,job:0,log:0}};
}
function load(){try{const r=JSON.parse(localStorage.getItem(KEY));if(r&&r.employees&&r.seq)return r;}catch(e){}return seed();}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){toast('Could not save to localStorage: '+e.message,'err');}}
function log(e,type,status,err=''){const n=e?((e.first||'')+' '+(e.last||'')).trim():'';S.logs.unshift({id:++S.seq.log,empId:e&&e.id||'—',name:n||'—',type,time:now(),status,error:err});S.logs=S.logs.slice(0,3000);}
function act(t){S.activity.unshift({time:now(),text:t});S.activity=S.activity.slice(0,50);}

/* ---------- validation ---------- */
function validateEmp(e){const er=[];
  if(!/^EMP-\d{3,6}$/.test(e.id))er.push('Employee ID must look like EMP-1001');
  if(!/^[A-Za-z][A-Za-z .'-]{0,39}$/.test(e.first))er.push('First name is required (letters only)');
  if(!/^[A-Za-z][A-Za-z .'-]{0,39}$/.test(e.last))er.push('Last name is required (letters only)');
  if(!EMAIL_RE.test(e.email))er.push('Email is invalid');
  else if(S.employees.some(x=>x.id!==e.id&&x.email.toLowerCase()===e.email.toLowerCase()))er.push('Email already used by another employee');
  if(!e.dept)er.push('Department is required');
  if(!e.desig||e.desig.length<2)er.push('Designation is required');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.joined)||isNaN(Date.parse(e.joined)))er.push('Joining date must be a valid date (YYYY-MM-DD)');
  if(!REQ_TYPES.includes(e.reqType))er.push('Request type must be one of: '+REQ_TYPES.join(', '));
  if(!EMP_STATUS.includes(e.status))er.push('Status must be Active, Pending or Inactive');
  return er;}

/* ---------- automation logic (runs in the browser = LOCAL SIMULATION) ---------- */
function genPw(){const U='ABCDEFGHJKLMNPQRSTUVWXYZ',L='abcdefghijkmnpqrstuvwxyz',D='23456789',Y='!@#$%&*',r=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n,pick=s=>s[r(s.length)],all=U+L+D+Y;
  const p=[pick(U),pick(L),pick(D),pick(Y)];while(p.length<12)p.push(pick(all));for(let i=p.length-1;i>0;i--){const j=r(i+1);[p[i],p[j]]=[p[j],p[i]];}return p.join('');}
function uniqueLogin(e){const c=s=>s.toLowerCase().replace(/[^a-z0-9]/g,''),b=c(e.first).charAt(0)+c(e.last);if(b.length<2)return '';
  const taken=new Set(S.logins.filter(x=>x.empId!==e.id).map(x=>x.login));let l=b,n=1;while(taken.has(l))l=b+(++n);return l;}
function runLogin(e){if(S.logins.some(x=>x.empId===e.id))return 'skipped';const l=uniqueLogin(e);
  if(!l){log(e,'Login ID Creation','Failed','Cannot derive a login ID from the employee name');return 'failed';}
  S.logins.push({empId:e.id,name:fullName(e),email:e.email,login:l,time:now()});log(e,'Login ID Creation','Success');return 'ok';}
function runAccount(e){const ex=S.accounts.find(a=>a.empId===e.id);if(ex&&ex.status==='Success')return 'skipped';
  const lg=S.logins.find(x=>x.empId===e.id);let err='';
  if(!EMAIL_RE.test(e.email))err='Invalid email address';
  else if(e.status==='Inactive')err='Employee is Inactive – account creation not permitted';
  else if(!lg)err='Login ID not generated yet (run Automation 1 first)';
  S.accounts=S.accounts.filter(a=>a.empId!==e.id);
  S.accounts.push({empId:e.id,name:fullName(e),login:lg?lg.login:'—',email:e.email,dept:e.dept,tempPw:err?'—':genPw(),status:err?'Failed':'Success',error:err,time:now()});
  log(e,'Account Creation',err?'Failed':'Success',err);return err?'failed':'ok';}
function runAccess(e,dept,type,just,auto){S.access.unshift({id:'ACC-'+pad(++S.seq.acc),empId:e.id,name:fullName(e),dept,type,just,status:'Pending',time:now(),decided:'',auto:!!auto});
  log(e,'Access Request','Success');act(`Access request for ${fullName(e)}: ${type}`);return 'ok';}
function runReset(e,reason,auto){const acc=S.accounts.find(a=>a.empId===e.id&&a.status==='Success'),err=acc?'':'No active IT account exists for this employee';
  const pw=err?'—':genPw();if(acc)acc.tempPw=pw;
  S.resets.unshift({id:'RST-'+pad(++S.seq.rst),empId:e.id,name:fullName(e),login:acc?acc.login:'—',reason,tempPw:pw,status:err?'Failed':'Completed',error:err,auto:!!auto,time:now()});
  log(e,'Password Reset',err?'Failed':'Success',err);act(`Password reset ${err?'failed':'completed'} for ${fullName(e)}`);return err?'failed':'ok';}
function runTicket(e,cat,pri,subj,desc,auto){S.tickets.unshift({id:`TKT-${new Date().getFullYear()}-${pad(++S.seq.tkt)}`,empId:e.id,name:fullName(e),cat,pri,subj,desc,status:'Open',time:now(),upd:now(),auto:!!auto});
  log(e,'Helpdesk Ticket','Success');act(`Ticket created for ${fullName(e)}: ${subj}`);return 'ok';}

const TASKS=[['login','1 · Login ID Creation'],['account','2 · Account Creation'],['access','3 · Access Request (employees with request type "Access Request")'],['reset','4 · Password Reset (request type "Password Reset")'],['ticket','5 · Helpdesk Ticket (request type "Hardware Request")']];
function runAll(tasks,source){
  if(!S.employees.length){toast('No employees to process','err');return null;}
  const job={id:'JOB-'+pad(++S.seq.job),source,started:now(),tasks,total:S.employees.length,ok:0,failed:0,skipped:0};
  S.employees.forEach(e=>{const r=[];
    if(tasks.includes('login'))r.push(runLogin(e));
    if(tasks.includes('account'))r.push(runAccount(e));
    if(tasks.includes('access')&&e.reqType==='Access Request'&&!S.access.some(a=>a.empId===e.id&&a.auto))r.push(runAccess(e,e.dept,DEFAULT_ACCESS[e.dept]||'VPN','Auto-generated from employee request type',true));
    if(tasks.includes('reset')&&e.reqType==='Password Reset'&&!S.resets.some(x=>x.empId===e.id&&x.auto))r.push(runReset(e,'Auto: employee request type',true));
    if(tasks.includes('ticket')&&e.reqType==='Hardware Request'&&!S.tickets.some(t=>t.empId===e.id&&t.auto))r.push(runTicket(e,'Hardware','Medium','Hardware request (auto)','Auto-generated from employee request type',true));
    r.forEach(x=>job[x==='ok'?'ok':x==='failed'?'failed':'skipped']++);});
  job.ended=now();S.jobs.unshift(job);act(`${job.id} finished (${source}): ${job.ok} ok, ${job.failed} failed, ${job.skipped} skipped`);save();return job;}

/* ---------- Excel helpers ---------- */
const needX=()=>{if(typeof XLSX==='undefined'){toast('SheetJS did not load – internet access to cdnjs.cloudflare.com is needed for Excel features','err');return false;}return true;};
function xl(file,sheets){if(!needX())return false;try{const wb=XLSX.utils.book_new();
  sheets.forEach(([n,c,r])=>{const ws=XLSX.utils.aoa_to_sheet([c,...r]);ws['!cols']=c.map((h,i)=>({wch:Math.min(45,Math.max(h.length,...r.map(x=>String(x[i]??'').length))+2)}));XLSX.utils.book_append_sheet(wb,ws,n.slice(0,31));});
  XLSX.writeFile(wb,file);return true;}catch(e){toast('Export failed: '+e.message,'err');return false;}}
async function readRows(f,pref){if(!needX())throw new Error('SheetJS not loaded');const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});
  const n=wb.SheetNames.find(x=>x===pref)||wb.SheetNames[0];if(!n)throw new Error('No sheet found');return XLSX.utils.sheet_to_json(wb.Sheets[n],{defval:''});}
const nk=h=>String(h).toLowerCase().replace(/[^a-z]/g,'');
function normDate(v){if(v instanceof Date&&!isNaN(v))return new Date(v.getTime()+432e5).toISOString().slice(0,10);
  const s=String(v).trim(),m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(m)return `${m[3]}-${pad(m[2],2)}-${pad(m[1],2)}`;return s;}
const ci=(list,v,d)=>{const s=String(v??'').trim();return s?(list.find(x=>x.toLowerCase()===s.toLowerCase())||s):d;};

const REPORTS={
 login:{t:'Employee Login ID Report',f:'Login_ID_Report.xlsx',c:['Employee ID','Employee Name','Email','Login ID','Generated At'],r:()=>S.logins.map(x=>[x.empId,x.name,x.email,x.login,fmt(x.time)])},
 account:{t:'Account Creation Report',f:'Account_Creation_Report.xlsx',c:['Employee ID','Employee Name','Login ID','Email','Department','Temporary Password','Status','Error Message','Created At'],r:()=>S.accounts.map(x=>[x.empId,x.name,x.login,x.email,x.dept,x.tempPw,x.status,x.error,fmt(x.time)])},
 access:{t:'Access Request Report',f:'Access_Request_Report.xlsx',c:['Request ID','Employee ID','Employee Name','Department','Access Type','Justification','Status','Submitted At','Decided At'],r:()=>S.access.map(x=>[x.id,x.empId,x.name,x.dept,x.type,x.just,x.status,fmt(x.time),fmt(x.decided)])},
 reset:{t:'Password Reset Report',f:'Password_Reset_Report.xlsx',c:['Reset ID','Employee ID','Employee Name','Login ID','Reason','Temporary Password','Status','Error Message','Requested At'],r:()=>S.resets.map(x=>[x.id,x.empId,x.name,x.login,x.reason,x.tempPw,x.status,x.error,fmt(x.time)])},
 ticket:{t:'Helpdesk Ticket Report',f:'Helpdesk_Ticket_Report.xlsx',c:['Ticket ID','Employee ID','Employee Name','Category','Priority','Subject','Description','Status','Created At','Updated At'],r:()=>S.tickets.map(x=>[x.id,x.empId,x.name,x.cat,x.pri,x.subj,x.desc,x.status,fmt(x.time),fmt(x.upd)])}};
const LOGCOLS=['Employee ID','Employee Name','Automation Type','Date and Time','Status','Result','Error Message'];
const logRows=L=>L.map(x=>[x.empId,x.name,x.type,fmt(x.time),x.status==='Success'?'Completed':'Errored',x.status,x.error]);
const empRowsX=()=>S.employees.map(e=>KEYS.map(k=>e[k]));
function dlReport(k){const R=REPORTS[k],rows=R.r();if(!rows.length){toast(`${R.t}: no records yet – generate some data first`,'err');return;}if(xl(R.f,[[R.t,R.c,rows]]))toast('Downloaded '+R.f);}
function dlFull(){const sh=[['Employees',EMP_COLS,empRowsX()],...Object.values(REPORTS).map(R=>[R.t.replace(' Report',''),R.c,R.r()]),['Automation Logs',LOGCOLS,logRows(S.logs)]];if(xl('Kestrel_IT_Automation_Report.xlsx',sh))toast('Full Excel report downloaded');}

/* ---------- pages ---------- */
let EQ='',PREVIEW=null,LF={type:'',status:'',q:''},pickMode='employees';
function stats(){return{pending:S.access.filter(a=>a.status==='Pending').length+S.tickets.filter(t=>t.status!=='Resolved').length,
  done:S.access.filter(a=>a.status==='Approved').length+S.resets.filter(r=>r.status==='Completed').length+S.tickets.filter(t=>t.status==='Resolved').length,
  failed:S.access.filter(a=>a.status==='Rejected').length+S.resets.filter(r=>r.status==='Failed').length+S.accounts.filter(a=>a.status==='Failed').length};}
function empTable(){const q=EQ.trim().toLowerCase(),L=S.employees.filter(e=>!q||KEYS.map(k=>e[k]).join(' ').toLowerCase().includes(q));
  return `<p class="note">Showing ${L.length} of ${S.employees.length} employees</p>`+table(['Employee ID','Name','Email','Department','Designation','Joined','Request Type','Status','Actions'],
   L.map(e=>[esc(e.id),esc(fullName(e)),esc(e.email),esc(e.dept),esc(e.desig),esc(e.joined),esc(e.reqType),badge(e.status),
   `<div class="btns"><button class="btn sm" data-act="viewEmp" data-id="${esc(e.id)}">View</button><button class="btn sm" data-act="editEmp" data-id="${esc(e.id)}">Edit</button><button class="btn sm danger" data-act="delEmp" data-id="${esc(e.id)}">Delete</button></div>`]),'No employees match.');}
const noEmp=()=>S.employees.length?'':'<p class="alert">Add or import employees first.</p>';
const bulkBar=(a,l)=>`<div class="btns"><button class="btn primary" data-act="${a}">${l}</button></div>`;

const VIEWS={
dashboard(){const s=stats();
 return `<section class="cards">${[['Total Employees',S.employees.length,''],['Pending Requests',s.pending,'amber'],['Completed Requests',s.done,'green'],['Failed Requests',s.failed,'red'],['Total Automation Jobs',S.jobs.length,'indigo']].map(([l,v,c])=>`<div class="card stat ${c}"><span>${l}</span><b>${v}</b></div>`).join('')}</section>
 <section class="grid2"><div class="panel"><h2>Recent Activities</h2>${S.activity.length?`<ul class="feed">${S.activity.slice(0,10).map(a=>`<li><time>${fmt(a.time)}</time>${esc(a.text)}</li>`).join('')}</ul>`:'<p class="empty">No activity yet.</p>'}</div>
 <div class="panel"><h2>Quick Actions</h2><div class="btns"><button class="btn primary" data-act="procAll">Process All Employees</button><a class="btn" href="#employees">Employees</a><a class="btn" href="#tickets">New Ticket</a><a class="btn" href="#automation">Automation Control</a></div>
 <p class="note">Requests = access requests + password resets + helpdesk tickets. “Failed” = rejected access requests + failed resets + failed account creations. Totals are read live from your saved data.</p></div></section>`;},
employees(){return `<div class="panel"><div class="bar"><input id="q" type="search" placeholder="Search employees…" value="${esc(EQ)}"><div class="btns"><button class="btn primary" data-act="addEmp">+ Add Employee</button><button class="btn" data-act="pickFile" data-id="employees">Upload Excel</button><button class="btn" data-act="exportEmp">Export to Excel</button></div></div><div id="empTbl">${empTable()}</div></div>`;},
excel(){const P=PREVIEW;let prev='<p class="empty">No file uploaded yet. Click “Upload Excel” and choose a .xlsx or .csv file (try employees_sample.xlsx).</p>';
 if(P){const ok=P.items.filter(i=>!i.errors.length).length;
  prev=`<p><b>${esc(P.name)}</b> – ${P.items.length} rows read: <span class="badge ok">${ok} valid</span> <span class="badge bad">${P.items.length-ok} invalid</span></p>`+
   table(['Row','Employee ID','Name','Email','Department','Designation','Joined','Request Type','Status','Validation'],P.items.map(i=>[i.n,esc(i.emp.id),esc(((i.emp.first||'')+' '+(i.emp.last||'')).trim()),esc(i.emp.email),esc(i.emp.dept),esc(i.emp.desig),esc(i.emp.joined),esc(i.emp.reqType),esc(i.emp.status),i.errors.length?`<span class="badge bad">Invalid</span><br><small>${i.errors.map(esc).join('<br>')}</small>`:badge('Success').replace('Success','Valid')]),'')+
   `<div class="btns end"><label class="chk"><input type="checkbox" id="repl"> Replace all existing employees</label><button class="btn" data-act="clearPrev">Discard</button><button class="btn primary" data-act="importPrev"${ok?'':' disabled'}>Import ${ok} valid record(s)</button></div>`;}
 return `<div class="panel"><h2>Upload Employee Excel / CSV</h2><p class="note">Required columns: ${EMP_COLS.slice(0,5).join(', ')}. Optional: Designation, Joining Date, Request Type, Status. All rows are read; existing Employee IDs are updated, new IDs are added.</p><div class="btns"><button class="btn primary" data-act="pickFile" data-id="employees">Upload Excel</button></div><h3>Uploaded records</h3>${prev}</div>
 <div class="panel"><h2>Export to Excel</h2><div class="btns"><button class="btn" data-act="exportEmp">Employees</button>${Object.entries(REPORTS).map(([k,R])=>`<button class="btn" data-act="dlReport" data-id="${k}">${R.t}</button>`).join('')}<button class="btn" data-act="exportLogs">Automation Logs</button><button class="btn primary" data-act="dlFull">Full Workbook (all sheets)</button></div></div>`;},
login(){return `<div class="panel"><h2>Automation 1 – Employee Login ID Creation</h2><p class="note">Rule: first initial + last name, lower case (Asha Rao → <code>arao</code>). Duplicates get a number (arao2).</p>${noEmp()}
 <form data-form="loginOne" class="fg">${empSel('Employee','emp')}<label>&nbsp;<button class="btn">Generate for selected</button></label></form>
 <div class="btns" style="margin-top:12px"><button class="btn primary" data-act="genLoginAll">Generate for ALL employees</button><button class="btn" data-act="dlReport" data-id="login">Export to Excel</button></div></div>
 <div class="panel"><h2>Generated Login IDs (${S.logins.length} of ${S.employees.length} employees)</h2>${table(['Employee ID','Name','Email','Login ID','Generated'],S.logins.map(x=>[esc(x.empId),esc(x.name),esc(x.email),`<code>${esc(x.login)}</code>`,fmt(x.time)]),'None generated yet.')}</div>`;},
account(){return `<div class="panel"><h2>Automation 2 – Employee Account Creation</h2><p class="note">Dummy accounts only. Fails if: login ID missing, email invalid, or employee is Inactive. Temporary passwords are random and for demo use.</p>${noEmp()}
 <form data-form="accountOne" class="fg">${empSel('Employee','emp')}<label>&nbsp;<button class="btn">Create for selected</button></label></form>
 <div class="btns" style="margin-top:12px"><button class="btn primary" data-act="genAccountAll">Create accounts for ALL employees</button><button class="btn" data-act="dlReport" data-id="account">Export to Excel</button></div></div>
 <div class="panel"><h2>Account Creation Status</h2>${table(['Employee ID','Name','Login ID','Department','Temp Password','Status','Error','Time'],S.accounts.map(x=>[esc(x.empId),esc(x.name),`<code>${esc(x.login)}</code>`,esc(x.dept),`<code>${esc(x.tempPw)}</code>`,badge(x.status),esc(x.error),fmt(x.time)]),'No accounts created yet.')}</div>`;},
access(){return `<div class="panel"><h2>Automation 3 – Access Request Management</h2>${noEmp()}<form data-form="access"><div class="fg">${empSel('Employee','emp')}${sel('Department','dept',DEPTS)}${sel('Access Type','type',ACCESS_TYPES)}<label class="full">Justification<textarea name="just" rows="2" placeholder="Why is this access needed? (min 10 characters)"></textarea></label></div><div class="btns end"><button class="btn primary">Submit Access Request</button><button type="button" class="btn" data-act="dlReport" data-id="access">Export to Excel</button></div></form></div>
 <div class="panel"><h2>Access Requests</h2>${table(['ID','Employee','Department','Access Type','Justification','Status','Submitted','Action'],S.access.map(x=>[esc(x.id),esc(x.name),esc(x.dept),esc(x.type),esc(x.just),badge(x.status),fmt(x.time),x.status==='Pending'?`<div class="btns"><button class="btn sm" data-act="approve" data-id="${x.id}">Approve</button><button class="btn sm danger" data-act="reject" data-id="${x.id}">Reject</button></div>`:'—']),'No requests.')}</div>`;},
reset(){return `<div class="panel"><h2>Automation 4 – Password Reset</h2><p class="note">Requires an existing successful account (Automation 2). The temporary password is a dummy value; no real system is changed.</p>${noEmp()}<form data-form="reset"><div class="fg">${empSel('Employee','emp')}<label class="full">Reason<input name="reason" placeholder="e.g. Forgot password"></label></div><div class="btns end"><button class="btn primary">Submit Reset Request</button><button type="button" class="btn" data-act="dlReport" data-id="reset">Export to Excel</button></div></form></div>
 <div class="panel"><h2>Password Reset Results</h2>${table(['ID','Employee','Login ID','Reason','Temp Password','Status','Error','Time'],S.resets.map(x=>[esc(x.id),esc(x.name),`<code>${esc(x.login)}</code>`,esc(x.reason),`<code>${esc(x.tempPw)}</code>`,badge(x.status),esc(x.error),fmt(x.time)]),'No reset requests.')}</div>`;},
tickets(){return `<div class="panel"><h2>Automation 5 – IT Helpdesk Tickets</h2>${noEmp()}<form data-form="ticket"><div class="fg">${empSel('Employee','emp')}${sel('Category','cat',TKT_CATS)}${sel('Priority','pri',PRIORITIES,'Medium')}<label class="full">Subject<input name="subj" maxlength="100"></label><label class="full">Description<textarea name="desc" rows="3" placeholder="min 10 characters"></textarea></label></div><div class="btns end"><button class="btn primary">Create Ticket</button><button type="button" class="btn" data-act="dlReport" data-id="ticket">Export to Excel</button></div></form></div>
 <div class="panel"><h2>Tickets</h2>${table(['Ticket ID','Employee','Category','Priority','Subject','Status','Created','Change Status'],S.tickets.map(x=>[esc(x.id),esc(x.name),esc(x.cat),badge(x.pri),`<b>${esc(x.subj)}</b><br><small>${esc(x.desc)}</small>`,badge(x.status),fmt(x.time),`<select data-chg="tkt" data-id="${x.id}">${opts(TKT_STATUS,x.status)}</select>`]),'No tickets.')}</div>`;},
automation(){const j=S.jobs[0],li=S.settings.lastImport;
 const FLOW=[['Website','Working (this page)','ok'],['Excel Employee Data','Working (import / export)','ok'],['Python Producer','External – NOT connected','off'],['RabbitMQ Queue','External – NOT connected','off'],['Python Consumer','External – NOT connected','off'],['Automation Processing','Browser simulation only','warn'],['Output Excel Report','Working (export / import)','ok']];
 return `<div class="panel"><h2>Data Flow</h2><div class="flow">${FLOW.map((n,i)=>`<div class="node ${n[2]}"><b>${n[0]}</b><small>${n[1]}</small></div>${i<FLOW.length-1?'<span class="arrow">→</span>':''}`).join('')}</div>
 <p class="alert"><b>Frontend vs backend:</b> a web page cannot talk to RabbitMQ or run Python by itself. The buttons below run a <b>local browser simulation</b> of the processing rules. The real pipeline is: export <code>employees_input.xlsx</code> → run <code>producer.py</code> → RabbitMQ → <code>consumer.py</code> → import the output Excel here. See README.md.</p></div>
 <div class="panel"><h2>Run Automation (local browser simulation)</h2><div class="tasks">${TASKS.map(t=>`<label class="chk"><input type="checkbox" class="tk" value="${t[0]}" checked> ${t[1]}</label>`).join('')}</div>
 <div class="btns"><button class="btn primary" data-act="startAuto">Start Automation (selected tasks)</button><button class="btn primary" data-act="procAll">Process All Employees (all 5 tasks)</button><button class="btn" data-act="viewResults">View Automation Results</button><button class="btn" data-act="dlFull">Download Excel Report</button></div>
 <p class="note">Every run processes ALL ${S.employees.length} employees. Re-running skips records that already exist.</p></div>
 <div class="panel"><h2>Python / RabbitMQ Hand-off (file based)</h2><div class="btns"><button class="btn" data-act="exportProducer">Export producer input (employees_input.xlsx)</button><button class="btn" data-act="pickFile" data-id="results">Import consumer output Excel</button></div>
 <p class="note">Last import from Python consumer: ${li?esc(li.file)+' – '+li.count+' rows at '+fmt(li.time):'never (no backend results have been imported)'}</p></div>
 <div class="panel"><h2>Latest Job</h2>${j?`<p><b>${j.id}</b> · ${esc(j.source)} · ${j.total} employees · <span class="badge ok">${j.ok} ok</span> <span class="badge bad">${j.failed} failed</span> <span class="badge info">${j.skipped} skipped</span> · ${fmt(j.ended)}</p>`:'<p class="empty">No jobs run yet.</p>'}
 <h3>Job history</h3>${table(['Job','Source','Employees','OK','Failed','Skipped','Finished'],S.jobs.map(x=>[x.id,esc(x.source),x.total,x.ok,x.failed,x.skipped,fmt(x.ended)]),'No jobs.')}</div>`;},
logs(){const types=[...new Set(S.logs.map(l=>l.type))];return `<div class="panel"><div class="bar"><div class="btns"><input id="lq" type="search" placeholder="Search logs…" value="${esc(LF.q)}"><select id="lt" style="width:auto"><option value="">All types</option>${opts(types,LF.type)}</select><select id="ls" style="width:auto"><option value="">All results</option>${opts(['Success','Failed'],LF.status)}</select></div><div class="btns"><button class="btn" data-act="exportLogs">Export to Excel</button><button class="btn danger" data-act="clearLogs">Clear logs</button></div></div><div id="logTbl">${logTable()}</div></div>`;},
reports(){return `<div class="panel"><div class="bar"><h2 style="margin:0">Reports</h2><button class="btn primary" data-act="dlFull">Download full workbook</button></div><div class="rgrid">${Object.entries(REPORTS).map(([k,R])=>`<div class="rcard"><h3 style="margin-top:0">${R.t}</h3><b>${R.r().length}</b><small class="note">records</small><div class="btns" style="margin-top:10px"><button class="btn sm" data-act="prevReport" data-id="${k}">Preview</button><button class="btn sm primary" data-act="dlReport" data-id="${k}">Download Excel</button></div></div>`).join('')}</div></div>`;}};
function logTable(){const q=LF.q.toLowerCase(),L=S.logs.filter(l=>(!LF.type||l.type===LF.type)&&(!LF.status||l.status===LF.status)&&(!q||Object.values(l).join(' ').toLowerCase().includes(q)));
  return `<p class="note">${L.length} of ${S.logs.length} entries</p>`+table(['Employee ID','Employee Name','Automation Type','Date and Time','Status','Result','Error Message'],L.slice(0,500).map(l=>[esc(l.empId),esc(l.name),esc(l.type),fmt(l.time),l.status==='Success'?'Completed':'Errored',badge(l.status),esc(l.error)]),'No log entries yet – run an automation.');}

/* ---------- router ---------- */
function route(){const p=(location.hash||'#dashboard').slice(1),pg=PAGES.find(x=>x[0]===p)||PAGES[0];
  $('#view').innerHTML=VIEWS[pg[0]]();$('#title').textContent=pg[1];document.title=pg[1]+' – Kestrel Logistics IT Portal';
  $('#nav').innerHTML=PAGES.map(x=>`<a href="#${x[0]}" class="${x[0]===pg[0]?'on':''}">${x[1]}</a>`).join('');document.body.classList.remove('nav-open');
  const q=$('#q');if(q)q.oninput=()=>{EQ=q.value;$('#empTbl').innerHTML=empTable();};
  if(pg[0]==='logs'){const f=()=>{LF={q:$('#lq').value,type:$('#lt').value,status:$('#ls').value};$('#logTbl').innerHTML=logTable();};['lq','lt','ls'].forEach(i=>$('#'+i).addEventListener('input',f));}
  if(pg[0]==='access'){const fm=$('[data-form=access]'),es=fm.elements.emp;es.onchange=()=>{const e=empById(es.value);if(e){fm.elements.dept.value=DEPTS.includes(e.dept)?e.dept:DEPTS[0];fm.elements.type.value=DEFAULT_ACCESS[e.dept]||'VPN';}};}
  window.scrollTo(0,0);}
window.addEventListener('hashchange',route);

/* ---------- employee dialogs ---------- */
function empForm(e){const n=!e;e=e||{id:'EMP-'+(Math.max(1000,...S.employees.map(x=>+x.id.replace(/\D/g,'')||0))+1),first:'',last:'',email:'',dept:DEPTS[0],desig:'',joined:now().slice(0,10),reqType:REQ_TYPES[0],status:'Active'};
  openDlg(`<form data-form="emp" data-orig="${n?'':esc(e.id)}"><h2>${n?'Add':'Edit'} Employee</h2><div class="fg">${fld('Employee ID','id',e.id,'text',n?'':'readonly')}${fld('First Name','first',e.first)}${fld('Last Name','last',e.last)}${fld('Email','email',e.email,'email')}${sel('Department','dept',DEPTS.includes(e.dept)?DEPTS:[...DEPTS,e.dept],e.dept)}${fld('Designation','desig',e.desig)}${fld('Joining Date','joined',e.joined,'date')}${sel('Request Type','reqType',REQ_TYPES,e.reqType)}${sel('Status','status',EMP_STATUS,e.status)}</div><div id="ferr"></div><div class="btns end"><button type="button" class="btn" data-act="closeDlg">Cancel</button><button class="btn primary">Save</button></div></form>`);}

/* ---------- click / change / submit handlers ---------- */
const after=m=>{save();route();if(m)toast(m);};
function decide(id,st){const a=S.access.find(x=>x.id===id);if(!a)return;a.status=st;a.decided=now();log(empById(a.empId)||{id:a.empId,first:a.name,last:''},'Access Decision','Success');act(`${a.id} ${st.toLowerCase()} (${a.name} – ${a.type})`);after(`${a.id} ${st.toLowerCase()}`);}
function bulk(fn,label){if(!S.employees.length)return toast('No employees to process','err');const c={ok:0,failed:0,skipped:0};S.employees.forEach(e=>c[fn(e)]++);act(`${label}: ${c.ok} ok, ${c.failed} failed, ${c.skipped} skipped`);after(`${label} for ${S.employees.length} employees – ${c.ok} ok, ${c.failed} failed, ${c.skipped} already done`);}
const ACT={
 closeDlg,addEmp:()=>empForm(),editEmp:id=>empForm(empById(id)),
 viewEmp(id){const e=empById(id);if(!e)return;const lg=S.logins.find(x=>x.empId===id),ac=S.accounts.find(x=>x.empId===id);
  openDlg(`<h2>${esc(fullName(e))}</h2><dl class="dl">${[['Employee ID',e.id],['Email',e.email],['Department',e.dept],['Designation',e.desig],['Joining Date',e.joined],['Request Type',e.reqType]].map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}<dt>Status</dt><dd>${badge(e.status)}</dd><dt>Login ID</dt><dd>${lg?`<code>${esc(lg.login)}</code>`:'Not generated'}</dd><dt>IT Account</dt><dd>${ac?badge(ac.status)+' '+esc(ac.error):'Not created'}</dd><dt>Access requests</dt><dd>${S.access.filter(x=>x.empId===id).length}</dd><dt>Password resets</dt><dd>${S.resets.filter(x=>x.empId===id).length}</dd><dt>Tickets</dt><dd>${S.tickets.filter(x=>x.empId===id).length}</dd></dl><div class="btns end"><button class="btn" data-act="closeDlg">Close</button></div>`);},
 delEmp(id){const e=empById(id);if(e&&confirm(`Delete ${fullName(e)} (${id})? Their existing login/account/ticket records are kept.`)){S.employees=S.employees.filter(x=>x.id!==id);act(`Employee ${id} deleted`);after('Employee deleted');}},
 pickFile(m){pickMode=m;$('#fileIn').click();},
 exportEmp(){if(!S.employees.length)return toast('No employees to export','err');if(xl('Employees.xlsx',[['Employees',EMP_COLS,empRowsX()]]))toast('Downloaded Employees.xlsx');},
 exportProducer(){if(!S.employees.length)return toast('No employees to export','err');if(xl('employees_input.xlsx',[['Employees',EMP_COLS,empRowsX()]]))toast('employees_input.xlsx downloaded – put it next to producer.py');},
 clearPrev(){PREVIEW=null;route();},
 importPrev(){const ok=PREVIEW.items.filter(i=>!i.errors.length);if(!ok.length)return;const rep=$('#repl')&&$('#repl').checked;
  if(rep&&!confirm('Replace ALL existing employees with the uploaded records?'))return;if(rep)S.employees=[];let add=0,upd=0;
  ok.forEach(i=>{const ex=empById(i.emp.id);if(ex){Object.assign(ex,i.emp);upd++;}else{S.employees.push(i.emp);add++;}log(i.emp,'Excel Import','Success');});
  PREVIEW.items.filter(i=>i.errors.length).forEach(i=>log(i.emp,'Excel Import','Failed',`Row ${i.n}: `+i.errors.join('; ')));
  act(`Excel import "${PREVIEW.name}": ${add} added, ${upd} updated, ${PREVIEW.items.length-ok.length} rejected`);const m=`Imported ${ok.length} records (${add} new, ${upd} updated)`;PREVIEW=null;after(m);},
 procAll(){const j=runAll(TASKS.map(t=>t[0]),'Process All Employees');if(j){route();toast(`${j.id}: ${j.ok} ok, ${j.failed} failed, ${j.skipped} skipped (local browser simulation)`,j.failed?'err':'ok');}},
 startAuto(){const t=[...document.querySelectorAll('.tk:checked')].map(x=>x.value);if(!t.length)return toast('Select at least one task','err');const j=runAll(t,'Start Automation');if(j){route();toast(`${j.id}: ${j.ok} ok, ${j.failed} failed, ${j.skipped} skipped (local browser simulation)`,j.failed?'err':'ok');}},
 viewResults:()=>go('logs'),dlFull,dlReport,
 prevReport(k){const R=REPORTS[k];openDlg(`<h2>${R.t}</h2>${table(R.c,R.r().slice(0,100).map(r=>r.map(esc)),'No records yet.')}<div class="btns end"><button class="btn" data-act="closeDlg">Close</button><button class="btn primary" data-act="dlReport" data-id="${k}">Download Excel</button></div>`);},
 genLoginAll:()=>bulk(runLogin,'Login ID creation'),genAccountAll:()=>bulk(runAccount,'Account creation'),
 approve:id=>decide(id,'Approved'),reject:id=>decide(id,'Rejected'),
 exportLogs(){if(!S.logs.length)return toast('No logs to export','err');if(xl('Automation_Logs.xlsx',[['Automation Logs',LOGCOLS,logRows(S.logs)]]))toast('Downloaded Automation_Logs.xlsx');},
 clearLogs(){if(confirm('Clear all automation logs?')){S.logs=[];after('Logs cleared');}}};
const CHG={tkt(id,v){const t=S.tickets.find(x=>x.id===id);if(!t)return;t.status=v;t.upd=now();log(empById(t.empId)||{id:t.empId,first:t.name,last:''},'Helpdesk Ticket','Success');act(`${t.id} → ${v}`);after(`${t.id} is now ${v}`);}};
const FORMS={
 emp(d,f){const orig=f.dataset.orig,e={id:(d.id||'').trim().toUpperCase(),first:d.first.trim(),last:d.last.trim(),email:d.email.trim(),dept:d.dept,desig:d.desig.trim(),joined:d.joined,reqType:d.reqType,status:d.status};
  const er=validateEmp(e);if(!orig&&empById(e.id))er.push('Employee ID already exists');
  if(er.length){$('#ferr').innerHTML=er.map(x=>'• '+esc(x)).join('<br>');return;}
  if(orig){Object.assign(empById(orig),e);act(`Employee ${e.id} updated`);}else{S.employees.push(e);act(`Employee ${e.id} (${fullName(e)}) added`);}closeDlg();after('Employee saved');},
 loginOne(d){const e=empById(d.emp);if(!e)return toast('Select an employee','err');const r=runLogin(e);if(r==='skipped')return toast(`${fullName(e)} already has login ID “${S.logins.find(x=>x.empId===e.id).login}”`,'err');after(r==='ok'?`Login ID created: ${S.logins.find(x=>x.empId===e.id).login}`:'Login ID creation failed – see logs');},
 accountOne(d){const e=empById(d.emp);if(!e)return toast('Select an employee','err');const r=runAccount(e);after(r==='skipped'?'Account already exists':r==='ok'?'Account created':'Account creation FAILED: '+S.accounts.find(a=>a.empId===e.id).error);},
 access(d){const e=empById(d.emp);if(!e)return toast('Select an employee','err');if((d.just||'').trim().length<10)return toast('Justification must be at least 10 characters','err');runAccess(e,d.dept,d.type,d.just.trim());after('Access request submitted – status Pending');},
 reset(d){const e=empById(d.emp);if(!e)return toast('Select an employee','err');if((d.reason||'').trim().length<3)return toast('Please enter a reason','err');const r=runReset(e,d.reason.trim());after(r==='ok'?'Reset completed – temporary password generated':'Reset FAILED: '+S.resets[0].error);},
 ticket(d){const e=empById(d.emp);if(!e)return toast('Select an employee','err');if((d.subj||'').trim().length<5)return toast('Subject must be at least 5 characters','err');if((d.desc||'').trim().length<10)return toast('Description must be at least 10 characters','err');runTicket(e,d.cat,d.pri,d.subj.trim(),d.desc.trim());after('Ticket created: '+S.tickets[0].id);}};
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b)return;try{ACT[b.dataset.act]?.(b.dataset.id,b);}catch(e){toast('Error: '+e.message,'err');console.error(e);}});
document.addEventListener('change',ev=>{const b=ev.target.closest('select[data-chg]');if(b)CHG[b.dataset.chg](b.dataset.id,b.value);});
document.addEventListener('submit',ev=>{ev.preventDefault();const f=ev.target,h=FORMS[f.dataset.form];if(!h)return;try{h(Object.fromEntries(new FormData(f)),f);}catch(e){toast('Error: '+e.message,'err');console.error(e);}});

/* ---------- file upload ---------- */
$('#fileIn').addEventListener('change',async ev=>{const f=ev.target.files[0];ev.target.value='';if(!f)return;
  if(!/\.(xlsx|csv)$/i.test(f.name))return toast('Only .xlsx and .csv files are accepted','err');
  if(f.size>5*1024*1024)return toast('File is larger than 5 MB','err');
  try{const rows=await readRows(f,pickMode==='results'?'Automation Results':'');if(!rows.length)return toast('The file contains no data rows','err');pickMode==='results'?importResults(rows,f.name):previewEmployees(rows,f.name);}
  catch(e){toast('Could not read file: '+e.message,'err');}});
function previewEmployees(rows,name){const map={employeeid:'id',firstname:'first',lastname:'last',email:'email',department:'dept',designation:'desig',joiningdate:'joined',requesttype:'reqType',status:'status'};
  const h=Object.keys(rows[0]).map(x=>[x,map[nk(x)]]),have=new Set(h.map(x=>x[1])),miss=['id','first','last','email','dept'].filter(k=>!have.has(k));
  if(miss.length)return toast('Missing required column(s): '+miss.map(k=>EMP_COLS[KEYS.indexOf(k)]).join(', '),'err');
  const seen=new Set(),items=rows.map((r,i)=>{const e={id:'',first:'',last:'',email:'',dept:'',desig:'',joined:'',reqType:'',status:''};h.forEach(([c,k])=>{if(k)e[k]=r[c];});
    ['first','last','email','dept','desig'].forEach(k=>e[k]=String(e[k]??'').trim());
    let id=String(e.id??'').trim().toUpperCase();if(/^\d+$/.test(id))id='EMP-'+id;e.id=id;e.joined=normDate(e.joined);
    e.reqType=ci(REQ_TYPES,e.reqType,REQ_TYPES[0]);e.status=ci(EMP_STATUS,e.status,'Active');
    const er=validateEmp(e);if(seen.has(e.id))er.push('Duplicate Employee ID in this file');seen.add(e.id);return{n:i+2,emp:e,errors:er};});
  PREVIEW={name,items};go('excel');if(location.hash==='#excel')route();toast(`${items.length} rows read from ${name}`);}
function importResults(rows,name){const map={employeeid:'id',loginid:'login',accountstatus:'st',temppassword:'pw',errormessage:'err'};let ok=0,bad=0;
  rows.forEach(r=>{const x={};Object.keys(r).forEach(c=>{const k=map[nk(c)];if(k)x[k]=String(r[c]).trim();});const e=empById(x.id);
    if(!e){bad++;log({id:x.id||'—',first:'(unknown)',last:''},'Python Consumer Result','Failed','Employee ID not found in portal');return;}
    const success=/^success/i.test(x.st||'');if(x.login){S.logins=S.logins.filter(l=>l.empId!==e.id);S.logins.push({empId:e.id,name:fullName(e),email:e.email,login:x.login,time:now()});}
    S.accounts=S.accounts.filter(a=>a.empId!==e.id);S.accounts.push({empId:e.id,name:fullName(e),login:x.login||'—',email:e.email,dept:e.dept,tempPw:success?(x.pw||'—'):'—',status:success?'Success':'Failed',error:success?'':(x.err||'Failed in consumer'),time:now()});
    log(e,'Python Consumer Result',success?'Success':'Failed',success?'':x.err||'Failed in consumer');success?ok++:bad++;});
  S.settings.lastImport={file:name,count:rows.length,time:now()};act(`Imported ${rows.length} Python consumer results (${ok} success, ${bad} failed)`);after(`Imported ${rows.length} consumer results: ${ok} success, ${bad} failed`);}

/* ---------- boot ---------- */
$('#menuBtn').onclick=()=>document.body.classList.toggle('nav-open');
$('#resetBtn').onclick=()=>{if(confirm('Reset all demo data to the original 10 employees?')){localStorage.removeItem(KEY);S=seed();PREVIEW=null;save();route();toast('Demo data reset');}};
if(!localStorage.getItem(KEY))save();
route();
