import React, { useEffect, useMemo, useRef, useState } from 'react';

const icons={sparkles:'✨',travel:'✈️',mountain:'🏔️',food:'🍜',learn:'📚',heart:'❤️',camera:'📷',music:'🎵',fitness:'🏃',home:'🏡',nature:'🌿',star:'⭐'};

async function api(url,options={}){
  const response=await fetch(url,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  if(response.status===204)return null;
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Something went wrong.');
  return data;
}

function BrandMark() {
  return (
    <span className="brand-mark">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
        <path d="M 6 10 A 6 6 0 0 1 18 10" />
        <path d="M 6 10 L 8 20 Q 8 21, 9 21 H 15 Q 16 21, 16 20 L 18 10" />
        <path d="M 5 10 H 19" />
        <path d="M 12 5 L 12.5 6.5 L 14 7 L 12.5 7.5 L 12 9 L 11.5 7.5 L 10 7 L 11.5 6.5 Z" fill="currentColor" stroke="none" />
        <path d="M 19 3 L 19.3 4.2 L 20.5 4.5 L 19.3 4.8 L 19 6 L 18.7 4.8 L 17.5 4.5 L 18.7 4.2 Z" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

function Brand({dark=false}){return <a className={`brand ${dark?'dark':''}`} href="#"><BrandMark /><span>bucketlist</span></a>}

function Auth({onAuthenticated}){
  const [mode,setMode]=useState('login');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function submit(event){event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);try{const data=await api(`/api/auth/${mode}`,{method:'POST',body:JSON.stringify(Object.fromEntries(form))});onAuthenticated(data.user)}catch(err){setError(err.message)}finally{setBusy(false)}}
  const register=mode==='register';
  return <section className="auth-view"><div className="auth-art"><Brand/><div className="auth-copy"><p className="eyebrow">Make room for wonder</p><h1>Life is short.<br/><em>Make it count.</em></h1><p>A thoughtful home for every place you want to go, skill you want to learn, and memory you want to make.</p></div><div className="floating-card card-one"><span>🏔️</span><div><strong>Hike the Dolomites</strong><small>Adventure</small></div></div><div className="floating-card card-two"><span>✓</span><div><strong>Learn to make pasta</strong><small>Completed today</small></div></div><p className="auth-quote">“The trouble is, you think you have time.” <span>— Jack Kornfield</span></p></div><div className="auth-panel"><div className="auth-box"><p className="mobile-brand"><BrandMark /> bucketlist</p><h2>{register?'Start your list':'Welcome back'}</h2><p>{register?'Your someday deserves a place to begin.':'Sign in and keep making life memorable.'}</p><form onSubmit={submit}>{register&&<label>Full name<input name="fullName" type="text" autoComplete="name" placeholder="Your full name" maxLength="80" required/></label>}<label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required/></label><label>Password<input name="password" type="password" autoComplete={register?'new-password':'current-password'} placeholder="At least 8 characters" minLength="8" required/></label><button className="primary full" disabled={busy}>{busy?'Please wait…':register?'Create account':'Sign in'} <span>→</span></button><p className="form-error">{error}</p></form><p className="auth-switch"><span>{register?'Already have an account?':'New around here?'}</span> <button type="button" onClick={()=>{setMode(register?'login':'register');setError('')}}>{register?'Sign in':'Create an account'}</button></p></div></div></section>
}

function BucketCard({bucket,onAdd,onToggle,onTrash,onDelete}){
  const completed=bucket.tasks.filter(task=>task.completed).length;
  function submit(event){event.preventDefault();const input=event.currentTarget.elements.title;onAdd(bucket.id,input.value).then(()=>{input.value=''})}
  return <article className="bucket-card"><div className="bucket-head"><span className="bucket-icon">{icons[bucket.icon]||'✨'}</span><div className="bucket-title"><h3>{bucket.name}</h3><small>{completed} of {bucket.tasks.length} made real</small></div><button className="menu-btn" title="Delete bucket" onClick={()=>onDelete(bucket)}>···</button></div><div className="tasks">{bucket.tasks.length?bucket.tasks.map(task=><div className={`task ${task.completed?'done':''}`} key={task.id}><input className="check" type="checkbox" checked={task.completed} aria-label={`Mark ${task.title} complete`} onChange={event=>onToggle(bucket.id,task.id,event.target.checked)}/><span>{task.title}</span><button className="task-trash" title="Move to trash" onClick={()=>onTrash(bucket.id,task.id)}>⌫</button></div>):<p style={{textAlign:'center',color:'#888',fontSize:12,padding:'20px 0 8px'}}>A lovely empty bucket.</p>}</div><form className="add-task-form" onSubmit={submit}><input name="title" maxLength="140" placeholder="＋ Add a new dream..." aria-label="New task" required/><button>Add</button></form></article>
}

function BucketModal({open,onClose,onCreate}){
  const dialog=useRef(null);const [icon,setIcon]=useState('sparkles');
  useEffect(()=>{if(open&&!dialog.current.open)dialog.current.showModal();if(!open&&dialog.current.open)dialog.current.close()},[open]);
  async function submit(event){event.preventDefault();const name=new FormData(event.currentTarget).get('name');await onCreate(name,icon);event.currentTarget.reset();setIcon('sparkles')}
  return <dialog ref={dialog} onClose={onClose}><form className="modal" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">A new chapter</p><h2>Create a bucket</h2></div><button type="button" className="close-btn" onClick={onClose}>×</button></div><label>Bucket name<input name="name" maxLength="50" placeholder="e.g. Places to wander" required autoFocus/></label><fieldset><legend>Choose an icon</legend><div className="icon-picker">{Object.entries(icons).map(([key,emoji])=><button type="button" key={key} className={`icon-option ${icon===key?'selected':''}`} onClick={()=>setIcon(key)}>{emoji}</button>)}</div></fieldset><button className="primary full">Create bucket <span>→</span></button></form></dialog>
}

function Dashboard({user,onLogout}){
  const [buckets,setBuckets]=useState([]);const [modal,setModal]=useState(false);const [toast,setToast]=useState('');const [installPrompt,setInstallPrompt]=useState(null);
  useEffect(()=>{api('/api/buckets').then(data=>setBuckets(data.buckets)).catch(err=>notify(err.message))},[]);
  useEffect(()=>{const handler=event=>{event.preventDefault();setInstallPrompt(event)};window.addEventListener('beforeinstallprompt',handler);return()=>window.removeEventListener('beforeinstallprompt',handler)},[]);
  function notify(message){setToast(message);setTimeout(()=>setToast(''),2200)}
  async function createBucket(name,icon){try{const data=await api('/api/buckets',{method:'POST',body:JSON.stringify({name,icon})});setBuckets(current=>[...current,data.bucket]);setModal(false);notify('Your new bucket is ready ✨')}catch(err){notify(err.message)}}
  async function addTask(bucketId,title){try{const data=await api(`/api/buckets/${bucketId}/tasks`,{method:'POST',body:JSON.stringify({title})});setBuckets(current=>current.map(bucket=>bucket.id===bucketId?{...bucket,tasks:[...bucket.tasks,data.task]}:bucket))}catch(err){notify(err.message)}}
  async function toggleTask(bucketId,taskId,value){try{const data=await api(`/api/tasks/${taskId}`,{method:'PATCH',body:JSON.stringify({completed:value})});setBuckets(current=>current.map(bucket=>bucket.id===bucketId?{...bucket,tasks:bucket.tasks.map(task=>task.id===taskId?data.task:task)}:bucket));if(value)notify('One dream made real ✓')}catch(err){notify(err.message)}}
  async function trashTask(bucketId,taskId){await api(`/api/tasks/${taskId}`,{method:'DELETE'});setBuckets(current=>current.map(bucket=>bucket.id===bucketId?{...bucket,tasks:bucket.tasks.filter(task=>task.id!==taskId)}:bucket));notify('Moved to trash')}
  async function deleteBucket(bucket){if(!window.confirm(`Delete “${bucket.name}” and all its tasks?`))return;await api(`/api/buckets/${bucket.id}`,{method:'DELETE'});setBuckets(current=>current.filter(item=>item.id!==bucket.id))}
  async function install(){await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null)}
  return <section className="app-view"><div className={`toast ${toast?'show':''}`} role="status">{toast}</div><header className="topbar"><Brand dark/><div className="header-actions">{installPrompt&&<button className="install-btn" onClick={install}>↓ Install app</button>}<span className="user-name">{user.fullName}</span><span className="avatar">{(user.fullName||user.email)[0].toUpperCase()}</span><button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={onLogout}>↗</button></div></header><main className="main"><section className="hero"><div><p className="eyebrow">Your life, intentionally</p><h1>What will you<br/><em>do someday?</em></h1><p>Collect the experiences that matter. Then make them happen.</p></div><button className="primary" onClick={()=>setModal(true)}>＋ New bucket</button></section><div className="section-head"><div><h2>Your buckets</h2><p>Little collections of a life well-lived.</p></div></div>{buckets.length?<section className="bucket-grid">{buckets.map(bucket=><BucketCard key={bucket.id} bucket={bucket} onAdd={addTask} onToggle={toggleTask} onTrash={trashTask} onDelete={deleteBucket}/>)}</section>:<section className="empty-state"><span>✦</span><h3>Your first adventure starts here</h3><p>Create a bucket for travel, learning, small joys—or anything calling your name.</p><button className="secondary" onClick={()=>setModal(true)}>Create your first bucket</button></section>}</main><BucketModal open={modal} onClose={()=>setModal(false)} onCreate={createBucket}/></section>
}

export default function App(){
  const [user,setUser]=useState(undefined);
  useEffect(()=>{api('/api/me').then(data=>setUser(data.user)).catch(()=>setUser(null));if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))},[]);
  async function logout(){await api('/api/auth/logout',{method:'POST'});setUser(null)}
  if(user===undefined)return <div style={{minHeight:'100vh',display:'grid',placeItems:'center'}}>Loading…</div>;
  return user?<Dashboard user={user} onLogout={logout}/>:<Auth onAuthenticated={setUser}/>;
}
