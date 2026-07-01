const $ = (s) => document.querySelector(s);
const icons = { sparkles:'✨', travel:'✈️', mountain:'🏔️', food:'🍜', learn:'📚', heart:'❤️', camera:'📷', music:'🎵', fitness:'🏃', home:'🏡', nature:'🌿', star:'⭐' };
let state = { buckets: [], user: null, authMode: 'login', selectedIcon: 'sparkles' };
let installPrompt;

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }
function escapeHtml(value) { const div=document.createElement('div'); div.textContent=value; return div.innerHTML; }

function setAuthMode(mode) {
  state.authMode=mode; const register=mode==='register';
  $('#authTitle').textContent=register?'Start your list':'Welcome back';
  $('#authSubtitle').textContent=register?'Your someday deserves a place to begin.':'Sign in and keep making life memorable.';
  $('#authSubmit').innerHTML=`${register?'Create account':'Sign in'} <span>→</span>`;
  $('#switchPrompt').textContent=register?'Already have an account?':'New around here?';
  $('#switchAuth').textContent=register?'Sign in':'Create an account';
  $('#nameField').classList.toggle('hidden',!register); $('#fullName').required=register;
  $('#password').autocomplete=register?'new-password':'current-password'; $('#authError').textContent='';
}
function showApp() { $('#authView').classList.add('hidden'); $('#appView').classList.remove('hidden'); const displayName=state.user.fullName||state.user.email; $('#userInitial').textContent=displayName[0].toUpperCase(); $('#userName').textContent=state.user.fullName||''; render(); }
function showAuth() { $('#appView').classList.add('hidden'); $('#authView').classList.remove('hidden'); }

function render() {
  const all=state.buckets.flatMap(b=>b.tasks), completed=all.filter(t=>t.completed).length, progress=all.length?Math.round(completed/all.length*100):0;
  $('#bucketCount').textContent=state.buckets.length; $('#dreamCount').textContent=all.length; $('#completeCount').textContent=completed; $('#progressText').textContent=`${progress}%`; $('#progressBar').style.width=`${progress}%`;
  $('#bucketGrid').innerHTML=state.buckets.map(bucket=>`<article class="bucket-card" data-bucket="${bucket.id}"><div class="bucket-head"><span class="bucket-icon">${icons[bucket.icon]||'✨'}</span><div class="bucket-title"><h3>${escapeHtml(bucket.name)}</h3><small>${bucket.tasks.filter(t=>t.completed).length} of ${bucket.tasks.length} made real</small></div><button class="menu-btn delete-bucket" title="Delete bucket">···</button></div><div class="tasks">${bucket.tasks.length?bucket.tasks.map(t=>`<div class="task ${t.completed?'done':''}" data-task="${t.id}"><input class="check" type="checkbox" ${t.completed?'checked':''} aria-label="Mark ${escapeHtml(t.title)} complete"><span>${escapeHtml(t.title)}</span><button class="task-trash" title="Move to trash">⌫</button></div>`).join(''):'<p style="text-align:center;color:#98a39e;font-size:12px;padding:20px 0 8px">A lovely empty bucket.</p>'}</div><form class="add-task-form"><input maxlength="140" placeholder="＋ Add a new dream..." aria-label="New task"><button>Add</button></form></article>`).join('');
  $('#emptyState').classList.toggle('hidden',state.buckets.length>0); $('#bucketGrid').classList.toggle('hidden',state.buckets.length===0);
}

$('#authForm').addEventListener('submit',async e=>{e.preventDefault(); $('#authError').textContent=''; const btn=$('#authSubmit'); btn.disabled=true; try{const data=await api(`/api/auth/${state.authMode}`,{method:'POST',body:JSON.stringify({fullName:$('#fullName').value,email:$('#email').value,password:$('#password').value})}); state.user=data.user; state.buckets=(await api('/api/buckets')).buckets; showApp();}catch(err){$('#authError').textContent=err.message}finally{btn.disabled=false}});
$('#switchAuth').addEventListener('click',()=>setAuthMode(state.authMode==='login'?'register':'login'));
$('#logoutBtn').addEventListener('click',async()=>{await api('/api/auth/logout',{method:'POST'}); state={buckets:[],user:null,authMode:'login',selectedIcon:'sparkles'}; $('#authForm').reset(); setAuthMode('login'); showAuth()});

Object.entries(icons).forEach(([key,emoji])=>{const b=document.createElement('button'); b.type='button'; b.className=`icon-option ${key==='sparkles'?'selected':''}`; b.dataset.icon=key; b.textContent=emoji; $('#iconPicker').appendChild(b)});
$('#iconPicker').addEventListener('click',e=>{const b=e.target.closest('.icon-option'); if(!b)return; document.querySelectorAll('.icon-option').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); state.selectedIcon=b.dataset.icon});
function openBucketDialog(){ $('#bucketDialog').showModal(); setTimeout(()=>$('#bucketName').focus(),50) }
$('#newBucketBtn').addEventListener('click',openBucketDialog); $('#emptyBucketBtn').addEventListener('click',openBucketDialog); $('.close-btn').addEventListener('click',()=>$('#bucketDialog').close());
$('#bucketForm').addEventListener('submit',async e=>{e.preventDefault(); try{const data=await api('/api/buckets',{method:'POST',body:JSON.stringify({name:$('#bucketName').value,icon:state.selectedIcon})}); state.buckets.push(data.bucket); render(); $('#bucketDialog').close(); e.target.reset(); toast('Your new bucket is ready ✨')}catch(err){toast(err.message)}});
$('#bucketGrid').addEventListener('submit',async e=>{if(!e.target.matches('.add-task-form'))return;e.preventDefault();const card=e.target.closest('.bucket-card'),input=e.target.querySelector('input');try{const data=await api(`/api/buckets/${card.dataset.bucket}/tasks`,{method:'POST',body:JSON.stringify({title:input.value})});state.buckets.find(b=>b.id===card.dataset.bucket).tasks.push(data.task);render()}catch(err){toast(err.message)}});
$('#bucketGrid').addEventListener('click',async e=>{const card=e.target.closest('.bucket-card');if(!card)return;const taskEl=e.target.closest('.task'),bucket=state.buckets.find(b=>b.id===card.dataset.bucket);if(e.target.matches('.delete-bucket')){if(!confirm(`Delete “${bucket.name}” and all its tasks?`))return;await api(`/api/buckets/${bucket.id}`,{method:'DELETE'});state.buckets=state.buckets.filter(b=>b.id!==bucket.id);render()}if(e.target.matches('.task-trash')){await api(`/api/tasks/${taskEl.dataset.task}`,{method:'DELETE'});bucket.tasks=bucket.tasks.filter(t=>t.id!==taskEl.dataset.task);render();toast('Moved to trash')}});
$('#bucketGrid').addEventListener('change',async e=>{if(!e.target.matches('.check'))return;const taskEl=e.target.closest('.task'),card=e.target.closest('.bucket-card'),bucket=state.buckets.find(b=>b.id===card.dataset.bucket),task=bucket.tasks.find(t=>t.id===taskEl.dataset.task);try{const data=await api(`/api/tasks/${task.id}`,{method:'PATCH',body:JSON.stringify({completed:e.target.checked})});Object.assign(task,data.task);render();if(task.completed)toast('One dream made real ✓')}catch(err){toast(err.message);render()}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').addEventListener('click',async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#installBtn').classList.add('hidden')}});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));
(async()=>{try{const me=await api('/api/me');state.user=me.user;state.buckets=(await api('/api/buckets')).buckets;showApp()}catch{showAuth()}})();
