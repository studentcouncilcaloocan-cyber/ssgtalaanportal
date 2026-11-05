/* TALAAN v2 frontend integration — staging candidate, not production approved. */
(function(){
'use strict';
const staff = new Set(['Secretary','Class Sec','Teacher','Admin']);
const $ = id => document.getElementById(id);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role = () => (typeof currentSession_==='function' ? currentSession_().role : '') || currentRole;
const get = id => ($(id)?.value||'').trim();
const status = (message,error=false) => { const el=$('v2Status'); if(el){el.textContent=message;el.className=error?'v2-error':'v2-note';} };
const api = (action,params={}) => apiRequest(action,params);
const downloadBlob=(blob,name)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
let currentRows=[],currentEvents=[],preview=null,importRows=[];
function render(html,active){ renderTalaanMenu_(active); setPage_('<section class="v2-screen">'+html+'</section>'); }
function menuEnhance(){
 const r=role(),menu=$('talaanMenu'); if(!menu) return;
 if(r==='Student'){
   const head=menu.querySelector('.talaan-menu-head')?.outerHTML||'';
   menu.innerHTML=head+'<div class="talaan-menu-group">Personal</div>'+
     menuButton_('My Attendance',"talaanNavigate_('dashboard')",'menuDashboard',false)+
     '<div class="talaan-menu-group">Account</div>'+
     menuButton_('Settings',"talaanNavigate_('accountsettings')",'menuAccountSettings',false)+
     '<button class="danger" onclick="talaanLogout_()">Log Out</button>';
   return;
 }
 if(!staff.has(r))return;
 const anchor=menu.querySelector('.danger');if(!anchor)return;
 const section=document.createElement('div');section.className='talaan-menu-group';section.textContent='Records & Activities';anchor.before(section);
 const btn=(text,onclick)=>{const b=document.createElement('button');b.className='nav-button';b.type='button';b.textContent=text;b.onclick=onclick;anchor.before(b);};
 btn('✎ Edit Records',()=>window.v2Navigate('records'));
 btn('↓ Attendance Sheet',()=>window.v2Navigate('attendance-export'));
 btn('↓ Students with Warnings',()=>window.v2Navigate('warnings-export'));
 if(['Secretary','Admin'].includes(r))btn('＋ Add Activity',()=>window.v2Navigate('activity'));
}
const oldMenu=window.renderTalaanMenu_;
window.renderTalaanMenu_=function(active){oldMenu(active);menuEnhance();};
window.v2Navigate=async function(page){closeTalaanMenu_();if(page==='records')await showRecords();else if(page==='activity')await showActivity();else if(page==='attendance-export'||page==='warnings-export'){const kind=page==='attendance-export'?'attendance':'warnings';render('<div class="v2-head"><h2>'+ (kind==='attendance'?'Attendance Sheet':'Students with Warnings') +'</h2></div><div id="v2ExportHost"></div>','records');await window.v2ShowExport(kind);}};
async function showRecords(){
 if(!staff.has(role()))return;
 render('<div class="v2-head"><div><h2>Edit Records</h2><p>Manage students within your authorized sections. Attendance history is preserved.</p></div><button onclick="v2OpenEditor()">+ Add Student</button></div><div class="v2-controls"><input id="v2Search" placeholder="Search name, section, or TALAAN ID" oninput="v2FilterRows()"><select id="v2Year" onchange="v2FilterRows()"><option value="">All year levels</option><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option></select><button class="secondary" onclick="v2ImportOpen()">Import Excel</button><button class="secondary" onclick="v2ShowExport(\'records\')">Export Record</button></div><div id="v2Records" class="v2-table-wrap">Loading...</div><div id="v2Editor"></div><div id="v2Status" aria-live="polite"></div>','records');
 try{const d=await api('v2exportdata',{kind:'records'});currentRows=d.rows||[];currentEvents=d.events||[];window.v2FilterRows();}catch(e){status(e.message,true);}
}
// Report exports use the server's authorized dataset; never export an unscoped browser cache.
window.v2ShowExport=async function(kind='records'){
 if(!staff.has(role()) || !['records','attendance','warnings'].includes(kind))return;
 const host=$('v2ExportHost')||$('v2Editor')||document.createElement('div');
 if(!host.id){host.id='v2ExportHost';document.querySelector('.v2-screen')?.append(host);}
 host.innerHTML='<div class="v2-panel"><h3>Export '+esc(kind)+'</h3><p>Choose any combination of filters. Leaving a group unchecked includes all authorized values.</p><div id="v2ExportOptions">Loading available filters...</div><div id="v2ExportMessage" role="status"></div><button class="secondary" type="button" onclick="v2ExportClose()">Close</button></div>';
 try{
   const d=await api('v2exportdata',{kind:'records'});
   const unique=a=>[...new Set(a.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
   const years=unique(d.rows.map(r=>r.yearLevel)),sections=unique(d.rows.map(r=>r.section)),dates=unique((d.events||[]).map(e=>e.date));
   const group=(name,values)=>'<fieldset class="v2-filter-group"><legend>'+esc(name)+'</legend>'+(values.length?values.map(v=>'<label><input type="checkbox" data-v2-filter="'+esc(name)+'" value="'+esc(v)+'"> '+esc(v)+'</label>').join(''):'<span>None available</span>')+'</fieldset>';
   $('v2ExportOptions').innerHTML=group('years',years)+group('sections',sections)+group('dates',dates)+'<div class="v2-actions"><button type="button" onclick="v2DownloadReport(\'xlsx\',\''+kind+'\')">Download Excel (.xlsx)</button><button type="button" onclick="v2DownloadReport(\'docx\',\''+kind+'\')">Download Word (.docx)</button></div>';
 }catch(e){$('v2ExportOptions').textContent='Unable to load filters: '+e.message;}
 host.scrollIntoView({behavior:'smooth'});
};
window.v2ExportClose=function(){const el=$('v2ExportHost')||$('v2Editor');if(el)el.innerHTML='';};
window.v2DownloadReport=async function(format,kind){
 const message=$('v2ExportMessage');if(message)message.textContent='Preparing report...';
 try{
  const checked=key=>[...document.querySelectorAll('input[data-v2-filter="'+key+'"]:checked')].map(x=>x.value);
  const data=await api('v2exportdata',{kind,years:checked('years'),sections:checked('sections'),dates:checked('dates')});
  const events=data.events||[];
  const headers=['TALAAN ID','Student Name','Year Level','Section',...events.map(e=>e.title+' ('+e.date+')'),'Absences'];
  const rows=(data.rows||[]).map(r=>[r.studentId,r.name,r.yearLevel,r.section,...events.map((_,i)=>r.statuses?.[i]||'Not Yet Held'),r.absent??0]);
  const file='TALAAN-'+kind+'-'+new Date().toISOString().slice(0,10)+'.'+format;
  if(format==='xlsx'){
   if(!window.XLSX)throw Error('Excel export library is unavailable.');
   const wb=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([headers,...rows]);
   sheet['!cols']=headers.map((h,i)=>({wch:Math.min(45,Math.max(14,String(h).length+3,...rows.slice(0,50).map(r=>String(r[i]??'').length+2)))}));
   XLSX.utils.book_append_sheet(wb,sheet,'Report');
   XLSX.writeFile(wb,file,{bookType:'xlsx'});
  }else if(format==='docx'){
   if(!window.docx?.Document||!window.docx?.Packer)throw Error('Word export library is unavailable.');
   const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType}=window.docx;
   const cells=r=>new TableRow({children:r.map(v=>new TableCell({children:[new Paragraph({text:String(v??'')})]}))});
   const doc=new Document({sections:[{children:[new Paragraph({children:[new TextRun({text:'TALAAN — '+kind.toUpperCase(),bold:true})]}),new Paragraph({text:'Generated '+new Date().toLocaleString()}),new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[cells(headers),...rows.map(cells)]})]}]});
   downloadBlob(await Packer.toBlob(doc),file);
  }else throw Error('Unsupported format.');
  if(message)message.textContent='Report generated ('+rows.length+' students).';
 }catch(e){if(message)message.textContent='Export failed: '+e.message;}
};
window.v2FilterRows=function(){const q=get('v2Search').toLowerCase(),y=get('v2Year');const rows=currentRows.filter(r=>(!y||String(r.yearLevel)===y)&&(!q||[r.name,r.section,r.studentId].some(v=>String(v||'').toLowerCase().includes(q))));$('v2Records').innerHTML='<table class="v2-table"><thead><tr><th>Student</th><th>TALAAN ID</th><th>Year</th><th>Section</th><th>Manage</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><button class="v2-link" onclick="v2OpenStudent(\''+esc(r.studentId)+'\')">'+esc(r.name)+'</button></td><td>'+esc(r.studentId)+'</td><td>'+esc(r.yearLevel)+'</td><td>'+esc(r.section)+'</td><td><button class="secondary" onclick="v2OpenEditor(\''+esc(r.studentId)+'\')">Edit</button> <button class="secondary" onclick="v2Deactivate(\''+esc(r.studentId)+'\')">Deactivate</button></td></tr>').join('')+'</tbody></table>'+(rows.length?'':'<p>No matching records.</p>');};
window.v2OpenStudent=function(id){const st=currentRows.find(r=>r.studentId===id);if(!st)return;const d=$('v2Editor');d.innerHTML='<div class="v2-panel"><h3>'+esc(st.name)+'</h3><p>TALAAN ID: '+esc(st.studentId)+' · '+esc(st.section)+'</p><h4>Attendance by event</h4><div class="v2-table-wrap">'+(st.statuses||[]).map((v,i)=>'<p>'+esc(currentEvents[i]?.title||('Event '+(i+1)))+' ('+esc(currentEvents[i]?.date||'Date unavailable')+'): '+esc(v)+'</p>').join('')+'</div><button onclick="v2OpenEditor(\''+esc(id)+'\')">Edit Student</button></div>';d.scrollIntoView({behavior:'smooth'});};
window.v2OpenEditor=function(id){const st=currentRows.find(r=>r.studentId===id)||{};$('v2Editor').innerHTML='<form id="v2StudentForm" class="v2-panel" onsubmit="v2SaveStudent(event)"><h3>'+(id?'Edit Student':'Add Student')+'</h3><input type="hidden" id="v2Id" value="'+esc(id||'')+'"><label>Full name<input id="v2Name" required maxlength="150" value="'+esc(st.name||'')+'"></label><label>Year level<select id="v2EditYear" required>'+[1,2,3,4].map(y=>'<option value="'+y+'" '+(String(st.yearLevel)===String(y)?'selected':'')+'>'+y+'</option>').join('')+'</select></label><label>Section<input id="v2Section" required maxlength="40" value="'+esc(st.section||'')+'"></label><div class="v2-actions"><button type="submit">Save Student</button><button type="button" class="secondary" onclick="document.getElementById(\'v2Editor\').innerHTML=\'\'">Cancel</button></div></form>';$('v2Editor').scrollIntoView({behavior:'smooth'});};
window.v2SaveStudent=async function(ev){ev.preventDefault();const id=get('v2Id'),params={name:get('v2Name'),yearLevel:get('v2EditYear'),section:get('v2Section')};if(id)params.studentId=id;status('Saving...');try{const result=await api(id?'v2studentupdate':'v2studentcreate',params);if(result.enrollmentPin){alert('New student enrollment credentials — display once and share securely.\nTALAAN ID: '+result.studentId+'\nEnrollment PIN: '+result.enrollmentPin+'\nSave this PIN now; it cannot be retrieved later.');}await showRecords();status('Student saved.');}catch(e){status(e.message,true);}};
window.v2Deactivate=async function(id){if(!confirm('Deactivate this student? Attendance history will remain.'))return;try{await api('v2studentdelete',{studentId:id});await showRecords();status('Student deactivated.');}catch(e){status(e.message,true);}};
window.v2ImportOpen=function(){$('v2Editor').innerHTML='<div class="v2-panel"><h3>Excel roster import</h3><p>Upload an .xlsx file. Review all changes before confirming. Missing students are preserved.</p><input type="file" id="v2Excel" accept=".xlsx,.xls" onchange="v2ExcelSelected(event)"><div id="v2ImportPreview"></div></div>';};
window.v2ExcelSelected=async function(ev){const file=ev.target.files?.[0];if(!file)return;const target=$('v2ImportPreview');target.textContent='Reading workbook...';try{if(!window.XLSX)throw Error('Excel parser unavailable. Check network access.');const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});const sheet=workbook.Sheets[workbook.SheetNames[0]];const data=XLSX.utils.sheet_to_json(sheet,{defval:''});importRows=data.map(row=>{const o=Object.fromEntries(Object.entries(row).map(([k,v])=>[k.toLowerCase().replace(/[^a-z0-9]/g,''),String(v).trim()]));return {studentId:o.talaanid||o.studentid||'',name:o.name||o.studentname||o.fullname||'',section:o.section||'',yearLevel:o.yearlevel||o.year||''};});preview=null;const p=await api('v2rosterpreview',{rows:importRows});preview=p;target.innerHTML='<h4>Import preview</h4><p>New: '+esc(p.additions?.length||0)+' · Changed: '+esc(p.changes?.length||0)+' · Unchanged: '+esc(p.unchanged?.length||0)+' · Ambiguous: '+esc(p.ambiguous?.length||0)+'</p>'+(p.ambiguous?.length?'<p class="v2-error">Resolve ambiguous rows in Excel and upload again.</p>':'')+'<button '+(!p.canApply||p.ambiguous?.length?'disabled':'')+' onclick="v2ApplyImport()">Confirm and apply changes</button>'; }catch(e){target.textContent='Import error: '+e.message;}};
window.v2ApplyImport=async function(){if(!preview||!preview.canApply)return;if(!confirm('Apply these Excel roster changes? This modifies student records.'))return;try{const d=await api('v2rosterapply',{rows:importRows,confirm:true,confirmationToken:preview.confirmationToken});preview=null;if(d.additions?.length)alert('New student enrollment credentials (display once):\n'+d.additions.map(x=>JSON.stringify(x)).join('\n'));await showRecords();status('Excel import applied.');}catch(e){status(e.message,true);}};
async function showActivity(){if(!['Secretary','Admin'].includes(role()))return;render('<h2>Add Activity</h2><p>Announcements only. This does not create an attendance event.</p><form id="v2ActivityForm" class="v2-panel" onsubmit="v2SaveActivity(event)"><label>Title<input id="v2ActivityTitle" required maxlength="160"></label><label>Date<input id="v2ActivityDate" type="date" required></label><label>Time<input id="v2ActivityTime" type="time" required></label><label>Location<input id="v2ActivityLocation" required maxlength="200"></label><button type="submit">Publish Activity</button></form><h3>Published activities</h3><div id="v2ActivityList">Loading...</div><div id="v2Status"></div>','activity');await refreshActivities();}
async function refreshActivities(){try{const d=await api('v2activities');$('v2ActivityList').innerHTML=(d.activities||[]).map(a=>'<div class="v2-activity"><strong>'+esc(a.title)+'</strong><p>'+esc(a.date)+' · '+esc(a.time)+' · '+esc(a.location)+'</p><button class="secondary" onclick="v2DeleteActivity(\''+esc(a.id)+'\')">Remove</button></div>').join('')||'<p>No announcements yet.</p>';}catch(e){status(e.message,true);}}
window.v2SaveActivity=async function(ev){ev.preventDefault();try{await api('v2activityadd',{title:get('v2ActivityTitle'),date:get('v2ActivityDate'),time:get('v2ActivityTime'),location:get('v2ActivityLocation')});$('v2ActivityForm').reset();await refreshActivities();status('Activity published.');}catch(e){status(e.message,true);}};
window.v2DeleteActivity=async function(id){if(!confirm('Remove this activity announcement?'))return;try{await api('v2activitydelete',{id});await refreshActivities();status('Activity removed.');}catch(e){status(e.message,true);}};

// Students land on their own attendance rather than the global dashboard.
const v2OriginalDashboard = window.showDashboardSheet;
window.showDashboardSheet = function(){
 if(role()==='Student') {
   // Existing profile endpoint returns only the authenticated student's records.
   return showStudentProfile_().then(()=>{
     const heading=document.querySelector('.talaan-profile-card .section-heading');
     if(heading)heading.textContent='My Attendance';
     const idHeading=[...document.querySelectorAll('.talaan-profile-card .section-heading')].find(e=>e.textContent.includes('My TALAAN ID'));
     if(idHeading)idHeading.textContent='My TALAAN ID';
     const idButton=document.querySelector('.talaan-view-profile-id-button');
     if(idButton)idButton.textContent='View My TALAAN ID';
   });
 }
 return v2OriginalDashboard();
};
// Teachers choose existing year/section pairs in Settings; backend validates scope.
const v2OriginalSettings = window.showAccountSettings_;
window.showAccountSettings_ = async function(){
 await v2OriginalSettings();
 if(role()!=='Teacher')return;
 const container=document.querySelector('.talaan-account-settings-page');
 if(!container)return;
 const panel=document.createElement('section');panel.className='talaan-settings-card';
 panel.innerHTML='<h3>Assigned Year Levels & Sections</h3><p>Select the classes you handle, then save your selection.</p><div id="v2TeacherScopes">Loading sections...</div><button type="button" class="primary-button" id="v2SaveTeacherScopes">Save Assigned Sections</button><p id="v2TeacherScopeStatus" role="status"></p>';
 container.append(panel);
 try{
   const settings=await api('accountsettings');
   const known=(settings.settings?.availableTeacherScopes||settings.settings?.availableSections||[]);
   const pairs=known.map(x=>typeof x==='string'?null:{yearLevel:String(x.yearLevel),section:String(x.section)}).filter(x=>x&&x.section);
   const selected=currentSession_().teacherScopes||settings.settings?.teacherScopes||[];
   if(!pairs.length){$('v2TeacherScopes').textContent='Section choices are not available from the current backend. Ask an administrator to configure your sections.';$('v2SaveTeacherScopes').disabled=true;return;}
   const isSelected=x=>selected.some(y=>String(y.yearLevel)===x.yearLevel&&String(y.section).toLowerCase()===x.section.toLowerCase());
   $('v2TeacherScopes').innerHTML=pairs.map((x,i)=>'<label class="v2-scope-choice"><input type="checkbox" data-v2-teacher-scope="'+i+'" '+(isSelected(x)?'checked':'')+'> '+esc('Year '+x.yearLevel+' — '+x.section)+'</label>').join('');
   $('v2SaveTeacherScopes').onclick=async()=>{
     const chosen=pairs.filter((x,i)=>document.querySelector('input[data-v2-teacher-scope="'+i+'"]')?.checked);
     const msg=$('v2TeacherScopeStatus');msg.textContent='Saving...';
     try{const result=await api('updateaccountsettings',{teacherScopes:chosen});if(!result.success)throw Error(result.error||'Save failed');if(result.session&&typeof saveTalaanSession_==='function')saveTalaanSession_(talaanSession.token,result.session);msg.textContent='Assigned sections saved. Refresh the dashboard to update your totals.';}catch(e){msg.textContent='Unable to save: '+e.message;}
   };
 }catch(e){$('v2TeacherScopes').textContent='Unable to load sections: '+e.message;$('v2SaveTeacherScopes').disabled=true;}
};

})();
