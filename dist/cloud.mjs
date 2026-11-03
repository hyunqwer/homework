import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithRedirect,getRedirectResult,signOut,browserLocalPersistence,setPersistence} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore,doc,onSnapshot,getDocFromServer,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.mjs';
import {PlannerSync} from './cloud-core.mjs';

const el=id=>document.getElementById(id),bridge=globalThis.plannerBridge;
const KEY='samnammae-english-v1',BACKUP=KEY+'-before-cloud',PENDING=KEY+'-cloud-pending';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),ref=doc(db,'families','samnammae');
const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
const localOrigin=['localhost','127.0.0.1'].includes(location.hostname);
let engine=null,unsubscribe=null,epoch=0,localMode=false,lastRemote=null;
const original=localStorage.getItem(BACKUP)||localStorage.getItem(KEY)||bridge.read();
function backup(){if(!localStorage.getItem(BACKUP))localStorage.setItem(BACKUP,original);}
function status(text){el('cloudStatus').textContent=text;el('saveState').textContent=text;el('cloudStorageState').textContent=text;}
function unlock(){el('cloudGate').hidden=true;document.querySelectorAll('aside,main').forEach(n=>n.inert=false);}
function gate(title,message,actions=[]){
  el('gateTitle').textContent=title;el('gateMessage').textContent=message;el('gateActions').replaceChildren();
  actions.forEach(([text,action,primary])=>{const b=document.createElement('button');b.type='button';b.textContent=text;if(primary)b.className='primary';b.onclick=action;el('gateActions').append(b);});
  el('cloudGate').hidden=false;document.querySelectorAll('aside,main').forEach(n=>n.inert=true);
}
function errorText(e){
  const code=e?.code||'';
  if(code.includes('permission-denied'))return '이 구글 계정은 가족 기록에 접근할 수 없습니다. 프로젝트 관리자 계정으로 로그인해 주세요.';
  if(code.includes('unauthorized-domain'))return '이 접속 주소의 구글 로그인이 아직 허용되지 않았습니다. 배포된 웹 주소에서 로그인해 주세요.';
  if(code.includes('operation-not-allowed')||code.includes('configuration-not-found'))return 'Firebase의 Google 로그인 설정이 아직 완료되지 않았습니다.';
  if(code.includes('popup-blocked'))return '로그인 팝업이 차단됐습니다. 팝업을 허용하거나 전체 화면 로그인을 선택해 주세요.';
  if(code.includes('popup-closed')||code.includes('cancelled-popup'))return '로그인 창을 닫았습니다. 다시 로그인할 수 있어요.';
  return '연결을 완료하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
}
function download(payload,name='삼남매영어-기기기록'){
  const url=URL.createObjectURL(new Blob([payload],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${name}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function signedOut(message='구글 로그인 후 같은 계정으로 PC·휴대폰에서 학습 기록을 함께 사용하세요.'){
  status('○ 로그인 필요');
  const actions=[['구글 로그인',login,true],['기존 기록 백업',()=>download(original)]];
  if(localOrigin)actions.push(['로컬에서 계속 사용',()=>{localMode=true;unlock();status('● 이 기기에만 저장');}]);
  gate('우리 집 영어, 어디서든 이어서.',message,actions);
}
async function login(){
  localMode=false;
  try{await signInWithRedirect(auth,provider);}catch(e){
    const actions=[['다시 로그인',login,true],['전체 화면으로 로그인',()=>signInWithRedirect(auth,provider).catch(fail)]];
    gate('로그인 확인',errorText(e),actions);
  }
}
function fail(e){status('연결 실패 · 기기 기록 보존');el('cloudRetry').hidden=false;gate('기록은 기기에 보관 중입니다',errorText(e),[['다시 연결',retry,true],['기기 기록 백업',()=>download(bridge.read())],['계정 변경',logout]]);}
async function logout(){
  if(engine?.busy){bridge.notice('클라우드 저장을 마친 뒤 로그아웃해 주세요.');return;}
  await signOut(auth).catch(fail);
}
function remoteValue(snapshot){
  if(!snapshot.exists())return null;
  const data=snapshot.data();
  if(!Number.isInteger(data.revision)||data.revision<1||!bridge.valid(data.payload))throw Error('잘못된 클라우드 기록');
  return data;
}
function onSync(kind,e){
  el('cloudRetry').hidden=true;
  if(kind==='saving'){status('↻ 클라우드 저장 중');return;}
  if(kind==='synced'){status('● 클라우드 저장됨');unlock();return;}
  if(kind==='empty'){
    status('첫 연결 · 기록 선택');
    gate('처음 연결하는 기기예요','현재 기기의 기록 또는 처음 알려주신 기본 설정으로 클라우드 기록을 시작할 수 있어요. 다른 기기에 있는 기록은 그 기기에서 백업한 뒤 가져오세요.',[
      ['이 기기의 기록으로 시작',()=>engine.save(bridge.read()),true],
      ['기본 설정으로 시작',()=>engine.save(bridge.initial())],
      ['기존 백업 불러오기',()=>el('importFile').click()],
      ['기기 기록 백업',()=>download(original)]
    ]);return;
  }
  if(kind==='conflict'){
    status('다른 기기의 변경 확인 필요');
    gate('다른 기기에서도 수정됐어요','이 기기의 변경 내용을 백업한 다음 최신 클라우드 기록을 불러오세요. 두 기록을 자동으로 덮어쓰지 않았습니다.',[
      ['이 기기 변경 백업',()=>download(bridge.read(),'삼남매영어-충돌백업'),true],
      ['최신 클라우드 기록 사용',()=>{
        gate('최신 기록을 불러올까요?','이 기기의 미전송 변경은 별도 백업 파일로 먼저 저장하세요. 계속하면 화면은 최신 클라우드 기록으로 바뀝니다.',[
          ['변경 백업',()=>download(bridge.read(),'삼남매영어-충돌백업')],
          ['최신 기록 불러오기',()=>{if(engine.useRemote())unlock();},true],
          ['돌아가기',()=>onSync('conflict')]
        ]);
      }]
    ]);return;
  }
  if(kind==='error')fail(e);
}
async function retry(){
  if(!auth.currentUser){signedOut();return;}
  if(!engine){await connect(auth.currentUser);return;}
  gate('다시 연결하고 있어요','기기에 저장한 내용은 유지됩니다.');
  try{lastRemote=remoteValue(await getDocFromServer(ref));engine.retry(lastRemote);}catch(e){fail(e);}
}
async function connect(user){
  const session=++epoch;
  unsubscribe?.();unsubscribe=null;engine?.close();engine=null;lastRemote=null;
  el('cloudPerson').textContent=user?.email||'';el('cloudLogin').hidden=!!user;el('cloudLogout').hidden=!user;
  if(!user){globalThis.plannerCloud=null;if(!localMode)signedOut();return;}
  if(!user.emailVerified){
    globalThis.plannerCloud=null;status('접근 권한 없음');gate('가족 계정으로 로그인해 주세요','이 프로젝트의 관리자 구글 계정만 학습 기록을 열 수 있습니다.',[['다른 계정으로 로그인',logout,true]]);return;
  }
  gate('학습 기록을 연결하고 있어요','클라우드의 최신 기록을 확인하고 있습니다.');status('↻ 클라우드 연결 중');
  const current=new PlannerSync({
    write:async(payload,base)=>{
      if(!bridge.valid(payload)||new TextEncoder().encode(payload).length>=780000)throw Error('기록 크기 또는 형식 확인 필요');
      return runTransaction(db,async tx=>{
        const snapshot=await tx.get(ref),revision=snapshot.exists()?snapshot.data().revision:0;
        if(revision!==base){const error=Error('다른 기기의 기록이 갱신됐습니다.');error.code='planner/conflict';throw error;}
        tx.set(ref,{payload,revision:revision+1,updatedAt:serverTimestamp(),updatedBy:user.uid});return revision+1;
      });
    },
    apply:payload=>{backup();bridge.replace(payload);},
    checkpoint:saved=>{
      try{if(saved)localStorage.setItem(PENDING,JSON.stringify({uid:user.uid,...saved}));else localStorage.removeItem(PENDING);}catch{bridge.notice('기기 저장 공간이 부족합니다. 백업 파일을 저장해 주세요.');}
    },
    status:(kind,e)=>{if(session===epoch)onSync(kind,e);}
  });
  engine=current;
  try{
    const saved=JSON.parse(localStorage.getItem(PENDING)||'null');
    if(saved?.uid===user.uid&&Number.isInteger(saved.revision)&&bridge.valid(saved.payload)){current.restore(saved);bridge.replace(saved.payload);}
    globalThis.plannerCloud={save:payload=>current.save(payload)};
    const snapshot=await getDocFromServer(ref);if(session!==epoch)return;
    lastRemote=remoteValue(snapshot);current.receive(lastRemote);
    unsubscribe=onSnapshot(ref,{includeMetadataChanges:true},snapshot=>{
      if(session!==epoch||snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
      try{lastRemote=remoteValue(snapshot);current.receive(lastRemote);}catch(e){fail(e);}
    },fail);
  }catch(e){if(session===epoch)fail(e);}
}
el('cloudLogin').onclick=login;el('cloudLogout').onclick=logout;el('cloudRetry').onclick=retry;
window.addEventListener('online',()=>{if(engine?.blocked&&!engine?.remote)void retry();else if(engine?.blocked)el('cloudRetry').hidden=false;});
window.addEventListener('beforeunload',e=>{if(engine?.pending!==null&&engine?.pending!==undefined){e.preventDefault();e.returnValue='';}});
try{await setPersistence(auth,browserLocalPersistence);await getRedirectResult(auth);onAuthStateChanged(auth,connect);}catch(e){fail(e);}
