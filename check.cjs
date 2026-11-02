const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const elements=new Map(),el=s=>{if(!elements.has(s))elements.set(s,{textContent:'',innerHTML:'',dataset:{},classList:{add(){},remove(){}},addEventListener(){},showModal(){},close(){}});return elements.get(s)};
const ctx=vm.createContext({console,Intl,Date,JSON,structuredClone,crypto:require('node:crypto').webcrypto,localStorage:{getItem(){return null},setItem(){}},document:{querySelector:el,querySelectorAll(){return[]},addEventListener(){}},setTimeout(){},clearTimeout(){},FormData:class{constructor(data){this.data=data}get(k){return this.data[k]}has(k){return Object.hasOwn(this.data,k)}}});
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
assert.equal(run("monday('2026-11-08')"),'2026-11-02');
assert.equal(run("JSON.stringify(nextPos(6,4))"),'[6,5]');
assert.equal(run("JSON.stringify(nextPos(6,5))"),'[7,1]');
assert.equal(run("plannedClass(child('jaehun'),'2026-11-02').title"),'5권 3차시 · 5권 4차시');
assert.equal(run("plannedClass(child('jaehun'),'2026-11-06').title"),'6권 1차시 · 6권 2차시 · 6권 3차시');
assert.equal(run("plannedClass(child('yujin'),'2026-11-03').title"),'6권 1차시 · 6권 2차시 · 6권 3차시 · 6권 4차시');
run("planModal('2026-11-02')");
const data={start:'2026-11-02'};for(const id of ['yejin','yujin','jaehun']){data['mode_'+id]=id==='jaehun'?'go':'pause';data['review_'+id]='6권 복습';data['book_'+id]='6';data['lesson_'+id]='2';data['online_'+id]='on';data['sheet_'+id]='on'}
ctx.testData=data;run("document.querySelector('#modalForm').onsubmit({preventDefault(){},target:testData})");
assert.equal(run("state.weeks['2026-11-02'].tasks.filter(t=>t.child==='yejin'&&t.type==='book').length"),0);
assert.equal(run("state.weeks['2026-11-02'].tasks.filter(t=>t.child==='jaehun'&&t.type==='book').length"),5);
assert.equal(run("state.weeks['2026-11-02'].tasks.filter(t=>t.child==='jaehun'&&t.type==='book').map(t=>t.title).join('|')"),'6권 2차시|6권 3차시|6권 4차시|6권 5차시 · 전체 복습|7권 1차시');
assert.equal(run("state.logs.length"),0);
run("view='today';render();view='records';render();view='settings';render()");
console.log('PASS: week boundaries, five-lesson progression, real class anchors, paused study, weekly planning, separate completion records, all views.');
// Finishing at a different position must drive already-created and new forecasts.
run("state.weeks['2026-11-09']={confirmed:true,tasks:[{id:'future-class',child:'jaehun',date:'2026-11-09',type:'class',title:'old prediction',done:false},{id:'future-dad',child:'jaehun',date:'2026-11-09',type:'dad',title:'old preparation',done:false},{id:'future-homework',child:'jaehun',date:'2026-11-09',type:'online',title:'keep homework',done:false}]};logModal('jaehun',undefined,'2026-11-02')");
ctx.completion={date:'2026-11-02',endBook:'6',endLesson:'1',note:'실제 진행'};
run("document.querySelector('#modalForm').onsubmit({preventDefault(){},target:completion})");
assert.equal(run("classLog('jaehun','2026-11-02').endLesson"),1);
assert.equal(run("plannedClass(child('jaehun'),'2026-11-06').title"),'6권 2차시 · 6권 3차시 · 6권 4차시');
assert.equal(run("plannedClass(child('jaehun'),'2026-11-09').title"),'7권 1차시 · 7권 2차시 · 7권 3차시');
assert.equal(run("state.weeks['2026-11-09'].tasks[0].title"),'7권 1차시 · 7권 2차시 · 7권 3차시');
assert.equal(run("state.weeks['2026-11-09'].tasks[1].title"),'7권 1차시 · 7권 2차시 · 7권 3차시 · 수업 준비');
assert.equal(run("state.weeks['2026-11-09'].tasks[2].title"),'keep homework');
assert.equal(run("state.weeks['2026-11-09'].confirmed"),true);
// Correction replaces the day's record; it must not advance the forecast twice.
run("logModal('jaehun',undefined,'2026-11-02')");ctx.completion.endLesson='4';
run("document.querySelector('#modalForm').onsubmit({preventDefault(){},target:completion})");
assert.equal(run("state.logs.filter(l=>l.child==='jaehun'&&l.type==='class'&&l.date==='2026-11-02').length"),1);
assert.equal(run("plannedClass(child('jaehun'),'2026-11-06').title"),'7권 1차시 · 7권 2차시 · 7권 3차시');
assert.equal(run("classDayHTML(child('yejin'),'2026-11-03',[]).includes('수업 완료 입력')"),true);
assert.equal(run("classDayHTML(child('yejin'),'2026-11-04',[])"),'');
assert.equal(run("classDayHTML(child('jaehun'),'2026-11-02',[]).includes('수업 완료</span>')"),true);
// A legacy text record stays intact and can be upgraded through the same modal.
run("state.logs.push({id:'legacy',child:'yujin',type:'class',date:'2026-10-27',title:'기존 기록'});renderRecords()");
assert.equal(run("state.logs.find(l=>l.id==='legacy').title"),'기존 기록');
console.log('PASS: actual end position, existing future plan refresh, preparation refresh, book rollover, correction without duplicates, lesson tags without a plan, legacy records.');
