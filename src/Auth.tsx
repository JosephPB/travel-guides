import { useState } from 'react';
import { supabase } from './data';
import { Logo } from './components';
import { usernameEmail } from './login';
export function SignIn() {
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit() {
  if(!supabase)return;
  setBusy(true);setMessage('');
  try {
   const email=usernameEmail(username);
   const {error}=await supabase.auth.signInWithPassword({email,password});
   if(error)throw new Error('Unable to sign in. Check your username and password.');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to sign in. Please try again.');}finally{setBusy(false);}
 }
 return <main className="auth-page"><Logo/><h1>Sign in</h1><form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={busy}><label>Username<input autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={40} value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary">{busy?'Signing in…':'Sign in'}</button></fieldset></form><p role="status">{message}</p><p className="muted">Forgot your password? Ask the guide owner to reset it.</p></main>;
}
export function Account({name,onSave,onClose}: {name:string;onSave:(name:string)=>Promise<void>;onClose:()=>void}) {
 const [displayName,setDisplayName]=useState(name),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <section className="account"><h1>Your account</h1><form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try {if(password!==confirmation)throw new Error('Passwords do not match.');if(password&&supabase){const {error}=await supabase.auth.updateUser({password});if(error)throw error;}await onSave(displayName);setPassword('');setConfirmation('');setMessage('Account updated.');}catch(e){setMessage(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}}}><fieldset disabled={busy}><label>Name<input required maxLength={60} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>{supabase&&<><label>New password<input type="password" minLength={12} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm new password<input type="password" minLength={12} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></>}<div className="form-actions"><button className="primary">Save</button><button type="button" onClick={onClose}>Back to guide</button></div></fieldset><p role="status">{message}</p></form></section>;
}
