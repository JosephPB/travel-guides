import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { configured, getGuide, localPreview, supabase, saveReport, savePlace, saveRecommendation, deletePlace, deleteReview, deleteRecommendation } from './data';
import { Account, SignIn } from './Auth';
import { Logo, asset, External, PlacePhoto, ReportForm, PlaceForm, RecommendationForm, Triangles } from './components';
import { emptyData } from './types';
import type { GuideData, City, Place, PlaceDraft, ReportDraft } from './types';
import './style.css';
const path=()=>location.hash.startsWith('#/')?location.hash.slice(1):'/';
const demoUsers=[{id:'preview-you',display_name:'You'},{id:'preview-cara',display_name:'Caragh'}];
const titles={beirut:'Beirut',bristol:'Bristol'};
function App() {
 const [route,setRoute]=useState(path),[session,setSession]=useState<Session|null>(null),[authReady,setAuthReady]=useState(!configured||localPreview);
 const [data,setData]=useState<GuideData>(emptyData),[previewUser,setPreviewUser]=useState(demoUsers[0].id),[member,setMember]=useState(localPreview);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[authError,setAuthError]=useState('');
 const [neighbourhood,setNeighbourhood]=useState('all'),[visit,setVisit]=useState('all'),[query,setQuery]=useState('');
 const [editing,setEditing]=useState<Place|'new'|null>(null),[account,setAccount]=useState(false),[dirty,setDirty]=useState(false),[turn,setTurn]=useState<'next'|'previous'|null>(null);
 const pageRef=useRef<HTMLElement>(null),touch=useRef<{x:number;y:number}|null>(null),loadId=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const userId=localPreview?previewUser:session?.user.id;
 const city:City=route.startsWith('/bristol')?'bristol':'beirut';
 const cityRoot=`/${city}`;
 const landing=route==='/',coffee=route===`${cityRoot}/coffee`,slug=route.startsWith(`${cityRoot}/coffee/`)?route.split('/')[3]:null;
 const place=slug?data.places.find(p=>p.slug===slug&&p.city_id===city):undefined;
 const cityPlaces=data.places.filter(p=>p.city_id===city&&p.category==='coffee').sort((a,b)=>a.name.localeCompare(b.name));
 const visited=(id:string)=>data.reviews.some(r=>r.place_id===id);
 const filtered=cityPlaces.filter(p=>(neighbourhood==='all'||p.neighbourhood.split(' / ').includes(neighbourhood))&&(visit==='all'||visited(p.id)===(visit==='visited'))&&`${p.name} ${p.neighbourhood}`.toLowerCase().includes(query.toLowerCase()));
 const neighbourhoods=[...new Set(cityPlaces.flatMap(p=>p.neighbourhood.split(' / ')))].sort();
 const pages=[cityRoot,`${cityRoot}/coffee`,...cityPlaces.map(p=>`${cityRoot}/coffee/${p.slug}`)];
 const pageIndex=pages.indexOf(route),previous=pageIndex>0?pages[pageIndex-1]:null,next=pageIndex>=0&&pageIndex<pages.length-1?pages[pageIndex+1]:null;
 const currentProfile=data.profiles.find(p=>p.id===userId);
 const displayName=(id:string)=>data.profiles.find(p=>p.id===id)?.display_name||'Member';
 const checkDiscard=()=>!dirty||window.confirm('Discard unsaved report changes?');
 const navigate=(to:string,direction:'next'|'previous'='next')=>{
  if(to===route||turn||!checkDiscard())return;
  setDirty(false);setEditing(null);setAccount(false);setNotice('');
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||landing||to==='/'){location.hash=to;return;}
  setTurn(direction);timer.current=setTimeout(()=>{location.hash=to;setTurn(null);},240);
 };
 const Nav=({to,children,className,ariaLabel}:{to:string;children:React.ReactNode;className?:string;ariaLabel?:string})=><a href={`#${to}`} className={className} aria-label={ariaLabel} onClick={e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();navigate(to,pages.indexOf(to)<pageIndex?'previous':'next');}}}>{children}</a>;
 useEffect(()=>{
  const changed=()=>{setRoute(path());setEditing(null);setNeighbourhood('all');setVisit('all');setQuery('');setDirty(false);window.scrollTo(0,0);};
  window.addEventListener('hashchange',changed);return()=>{window.removeEventListener('hashchange',changed);if(timer.current)clearTimeout(timer.current);};
 },[]);
 useEffect(()=>{if(!landing&&authReady&&!loading)pageRef.current?.focus({preventScroll:true});},[route,authReady,loading,landing]);
 useEffect(()=>{if(!dirty)return;const before=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);},[dirty]);
 useEffect(()=>{
  if(localPreview){void import('./data/cafes.json').then(({default:places})=>setData({places:places as Place[],profiles:demoUsers,reviews:[],recommendations:[]}));return;}
  if(!supabase)return;
  let active=true;
  void supabase.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);setAuthError(error?.message||'');setAuthReady(true);}}).catch(()=>{if(active){setAuthError('Unable to read your session. Please reload.');setAuthReady(true);}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,newSession)=>{setSession(newSession);setAuthReady(true);if(event==='PASSWORD_RECOVERY')setAccount(true);if(!newSession){loadId.current++;setData(emptyData());setMember(false);setDirty(false);}});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 const refresh=useCallback(async()=>{
  if(localPreview||!supabase||!userId)return;
  const id=++loadId.current;setLoading(true);setError('');
  try {
   const membership=await supabase.from('members').select('user_id').eq('user_id',userId).maybeSingle();
   if(membership.error)throw membership.error;
   if(id!==loadId.current)return;
   if(!membership.data){setMember(false);setData(emptyData());return;}
   const guide=await getGuide();if(id===loadId.current){setData(guide);setMember(true);}
  }catch(e){if(id===loadId.current)setError(e instanceof Error?e.message:'Unable to load the guide.');}
  finally{if(id===loadId.current)setLoading(false);}
 },[userId]);
 useEffect(()=>{void refresh();const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{loadId.current++;window.removeEventListener('focus',focus);};},[refresh]);
 async function logout(){if(!checkDiscard())return;setAccount(false);if(supabase){const{error}=await supabase.auth.signOut();if(error){setError(error.message);return;}}setData(emptyData());setMember(false);location.hash='/';}
 async function mutate(action:()=>Promise<void>){await action();await refresh();}
 async function keepReport(draft:ReportDraft){if(!place||!userId)return;if(localPreview){setData(d=>({...d,reviews:[...d.reviews.filter(r=>!(r.place_id===place.id&&r.author_id===userId)),{...draft,id:crypto.randomUUID(),place_id:place.id,author_id:userId,updated_at:new Date().toISOString()}]}));}else await mutate(()=>saveReport(place.id,draft));setDirty(false);setNotice('Report saved');}
 async function keepPlace(draft:PlaceDraft){if(!userId)return;const maps=draft.maps_url||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${draft.name} ${draft.neighbourhood} ${titles[city]}`)}`;if(!/^https:\/\/(www\.)?google\.com\/maps[/?]/.test(maps))throw new Error('Use a full google.com/maps link, or leave the link blank.');if(!draft.name.trim())throw new Error('Please enter a name.');let saved:Place;
  if(localPreview){saved=editing&&editing!=='new'?{...editing,...draft,maps_url:maps}:{...draft,maps_url:maps,id:crypto.randomUUID(),slug:crypto.randomUUID(),city_id:city,added_by:userId,created_at:new Date().toISOString(),image_url:null,image_credit:null,source_url:null,source_name:null,verification_url:null,verification_note:null,checked_at:null};setData(d=>({...d,places:[...d.places.filter(p=>p.id!==saved.id),saved]}));}
  else {saved=await savePlace(editing&&editing!=='new'?editing.id:null,city,userId,{...draft,maps_url:maps});await refresh();}
  setEditing(null);location.hash=`/${city}/coffee/${saved.slug}`;
 }
 async function removePlace(){if(!place)return;if(!window.confirm(`Delete ${place.name}? Reports and recommendations must be removed first.`))return;try{if(localPreview){if(data.reviews.some(r=>r.place_id===place.id)||data.recommendations.some(r=>r.place_id===place.id))throw new Error('Remove the reports and recommendations first. Each author controls their own entries.');setData(d=>({...d,places:d.places.filter(p=>p.id!==place.id)}));}else await mutate(()=>deletePlace(place.id));navigate(`${cityRoot}/coffee`);}catch{setError('This place could not be deleted. Remove its reports and recommendations first; each author controls their own entries.');}}
 const report=place?data.reviews.find(r=>r.place_id===place.id&&r.author_id===userId):undefined;
 const myRecommendation=place?data.recommendations.find(r=>r.place_id===place.id&&r.author_id===userId):undefined;
 const showGuide=localPreview||member;
 if(!authReady)return <main className="auth-page"><p role="status">Signing in…</p></main>;
 if(!localPreview&&!configured)return <main className="auth-page"><Logo/><h1>Setup needed</h1><p>Add the Supabase project URL and publishable key, then rebuild the app.</p></main>;
 if(!localPreview&&!session)return <><SignIn/>{authError&&<p className="error" role="alert">{authError}</p>}</>;
 if(landing&&!account&&showGuide)return <main className="landing" aria-label="Choose a guide"><div className="photo-table"><img className="table-photo" src={asset('coffee-table-edited.png')} alt="Coffee table with Beirut and Bristol guidebooks" fetchPriority="high"/><Nav to="/beirut" className="photo-book beirut-hit" ariaLabel="Open Beirut guide"><Logo white/><span>Open Beirut ↗</span></Nav><Nav to="/bristol" className="photo-book bristol-hit" ariaLabel="Open Bristol guide"><Logo white/><span>Open Bristol ↗</span></Nav></div></main>;
 return <><header className="topbar"><Nav to="/"><Logo/></Nav><nav aria-label="Account"><span>{localPreview?'Local preview':currentProfile?.display_name}</span>{localPreview?<select aria-label="Preview as" value={previewUser} onChange={e=>{if(checkDiscard()){setPreviewUser(e.target.value);setDirty(false);setNotice('');}}}>{demoUsers.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select>:<button onClick={()=>{if(checkDiscard()){setDirty(false);setAccount(!account);}}}>Account</button>}<button onClick={()=>void refresh()} disabled={loading||localPreview} aria-label="Refresh shared guide">↻</button>{!localPreview&&<button onClick={()=>void logout()}>Sign out</button>}</nav></header>
 <main className={`inner page ${turn?`turn-${turn}`:''}`} ref={pageRef} tabIndex={-1} key={route} onTouchStart={e=>{if((e.target as HTMLElement).closest('input,textarea,select,button,a,form'))return;touch.current={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>85&&Math.abs(dx)>Math.abs(dy)*2){if(dx<0&&next)navigate(next);else if(dx>0&&previous)navigate(previous,'previous');}}}>
 {error&&<div className="error" role="alert"><p>{error}</p><button onClick={()=>void refresh()}>Retry</button></div>}
 {loading&&!showGuide?<p role="status">Loading your guide…</p>:!showGuide?<section className="auth-page"><h1>Membership needed</h1><p>Your account is signed in, but it has not been added to this guide. Ask the owner to add your user ID in Supabase.</p><code>{userId}</code><button onClick={()=>void refresh()}>Check again</button></section>:account?<Account name={currentProfile?.display_name||'You'} onClose={()=>{setAccount(false);location.hash='/beirut';}} onSave={async name=>{if(localPreview)setData(d=>({...d,profiles:d.profiles.map(p=>p.id===userId?{...p,display_name:name}:p)}));else if(supabase){const {error}=await supabase.from('profiles').update({display_name:name}).eq('id',userId!);if(error)throw error;await refresh();}}}/>:<>
 <nav className="breadcrumbs" aria-label="Breadcrumb"><Nav to="/">Table</Nav><span>/</span><Nav to={cityRoot}>{titles[city]}</Nav>{(coffee||slug)&&<><span>/</span><Nav to={`${cityRoot}/coffee`}>Coffee shops</Nav></>}</nav>
 {editing?<PlaceForm key={editing==='new'?'new':editing.id} place={editing==='new'?undefined:editing} onSave={keepPlace} onCancel={()=>setEditing(null)}/>:!coffee&&!slug?<section className="cover-layout"><button className={`book ${city}`} onClick={()=>navigate(`${cityRoot}/coffee`)} aria-label={`Open ${titles[city]} coffee chapter`}><Logo white/><span className="book-city">{titles[city]}</span><span className="book-bottom">2026 <span>↗</span></span></button><div className="contents"><h1>{titles[city]}</h1><p className="city-intro">{city==='beirut'?'Coffee shops, from Hamra to Mar Mikhael.':'A guide to fill in together.'}</p>{['Coffee shops','Restaurants','Museums','Attractions'].map((chapter,i)=><div className="chapter" key={chapter}><span className="chapter-number">0{i+1}</span>{i===0?<Nav to={`${cityRoot}/coffee`}>{chapter}<span>{cityPlaces.length} places ↗</span></Nav>:<div>{chapter}<span>Field research to come</span></div>}</div>)}</div></section>:coffee?<section><div className="chapter-heading"><h1>Coffee shops</h1><button onClick={()=>setEditing('new')}>+ Add café</button></div><div className="filters"><label className="search-label">Search<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a café"/></label><label>Neighbourhood<select value={neighbourhood} onChange={e=>setNeighbourhood(e.target.value)}><option value="all">All neighbourhoods</option>{neighbourhoods.map(n=><option key={n}>{n}</option>)}</select></label><label>Visits<select value={visit} onChange={e=>setVisit(e.target.value)}><option value="all">All places</option><option value="unvisited">Not visited</option><option value="visited">Visited</option></select></label></div>{filtered.length?<div className="cafe-list">{filtered.map(p=><article className="cafe-card" key={p.id}><Nav to={`${cityRoot}/coffee/${p.slug}`} className="card-photo" ariaLabel={`Open ${p.name}`}><PlacePhoto place={p} compact/></Nav><div className="card-copy"><p className="neighbourhood">{p.neighbourhood}</p><h2><Nav to={`${cityRoot}/coffee/${p.slug}`}>{p.name}</Nav></h2><p>{p.description}</p><span className="card-footer">{visited(p.id)?'Visited':'Not visited'}<Nav to={`${cityRoot}/coffee/${p.slug}`}>Open ↗</Nav></span></div></article>)}</div>:<div className="empty"><h2>{cityPlaces.length?'No matches':'No cafés yet'}</h2>{cityPlaces.length>0&&<button onClick={()=>{setQuery('');setNeighbourhood('all');setVisit('all');}}>Clear filters</button>}</div>}</section>:place?<><div className="detail-heading"><p className="neighbourhood">{place.neighbourhood}</p><h1>{place.name}</h1>{place.added_by===userId&&<div className="form-actions"><button onClick={()=>setEditing(place)}>Edit place</button><button className="text-button danger" onClick={()=>void removePlace()}>Delete place</button></div>}</div><section className="detail-grid"><div className="photo-column"><PlacePhoto key={place.id} place={place}/></div><div className="detail-copy"><div className="description"><p>{place.description}</p><div className="source-links"><External href={place.maps_url}>Google Maps ↗</External>{place.source_url&&<External href={place.source_url}>{place.source_name} ↗</External>}</div>{place.checked_at&&<details className="source-details"><summary>Listed as operating · checked {new Date(place.checked_at+'T12:00:00').toLocaleDateString('en-GB')}</summary><p>{place.verification_note}</p><External href={place.verification_url}>Status source ↗</External><p>Check with the café before visiting. This is not a live opening-hours service.</p></details>}<p className="byline">{place.added_by?`Added by ${displayName(place.added_by)}`:`From ${place.source_name}`}</p></div><section className="notebook"><h2>Your field report</h2><ReportForm key={`${place.id}-${userId}-${report?.updated_at||'new'}`} review={report} onDirty={setDirty} onSave={keepReport} onDelete={async()=>{if(!report)return;if(localPreview)setData(d=>({...d,reviews:d.reviews.filter(r=>r.id!==report.id)}));else await mutate(()=>deleteReview(report.id));setDirty(false);setNotice('Report deleted');}}/><p className="status" role="status">{notice}</p>{data.reviews.filter(r=>r.place_id===place.id&&r.author_id!==userId).map(r=><aside className="partner" key={r.id}><h3>{displayName(r.author_id)}’s report</h3><Triangles value={r.triangle_sides}/><p>{r.triangle_sides}/9</p>{r.thoughts&&<p>{r.thoughts}</p>}{r.ordered&&<p>Ordered: {r.ordered}</p>}{r.observations.map((o,i)=><p key={o.id||i}><span className="tag">{o.category}</span> {o.note}</p>)}<small>{new Date(r.updated_at).toLocaleDateString('en-GB')}</small></aside>)}</section><details className="recommendation"><summary>Recommendations</summary><RecommendationForm key={myRecommendation?.updated_at||`${place.id}-${userId}`} initial={myRecommendation?.personal_note} onSave={async note=>{if(!userId)return;if(localPreview)setData(d=>({...d,recommendations:[...d.recommendations.filter(r=>!(r.place_id===place.id&&r.author_id===userId)),{id:myRecommendation?.id||crypto.randomUUID(),place_id:place.id,author_id:userId,personal_note:note,updated_at:new Date().toISOString()}]}));else await mutate(()=>saveRecommendation(place.id,userId,note,myRecommendation?.id));}} onDelete={myRecommendation?async()=>{if(localPreview)setData(d=>({...d,recommendations:d.recommendations.filter(r=>r.id!==myRecommendation.id)}));else await mutate(()=>deleteRecommendation(myRecommendation.id));}:undefined}/>{data.recommendations.filter(r=>r.place_id===place.id&&r.author_id!==userId).map(r=><blockquote key={r.id}><p>{r.personal_note}</p><cite>{displayName(r.author_id)}</cite></blockquote>)}</details></div></section></>:<section className="empty"><h1>Page not found</h1><Nav to={`${cityRoot}/coffee`}>Back to coffee shops</Nav></section>}
 {!editing&&<nav className="page-controls" aria-label="Turn pages"><button disabled={!previous} onClick={()=>previous&&navigate(previous,'previous')}>← Previous page</button><span>{pageIndex+1} / {pages.length}</span><button disabled={!next} onClick={()=>next&&navigate(next)}>Next page →</button></nav>}
 </>}
 </main></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
