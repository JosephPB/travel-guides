import {useState} from 'react';
import type {Place,PlacePhotoRecord} from './types';
import {PlacePhoto} from './components';
export function PhotoGallery({place,photos,userId,onUpload,onDelete}:{place:Place;photos:PlacePhotoRecord[];userId:string;onUpload:(file:File)=>Promise<void>;onDelete:(photo:PlacePhotoRecord)=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();setMessage('Saved');}catch(e){setMessage(e instanceof Error?e.message:'Unable to save photo. Please try again.');}finally{setBusy(false);}}
 return <section className="photo-gallery" aria-label="Café photos"><PlacePhoto key={place.image_url} place={place}/>{photos.map(photo=><figure key={photo.id}>{photo.url?<a href={photo.url} target="_blank" rel="noopener noreferrer"><img src={photo.url} alt={`${place.name} — shared photo`} loading="lazy"/></a>:<p>Photo unavailable. Try refreshing.</p>}{photo.author_id===userId&&<button disabled={busy} className="text-button danger" onClick={()=>{if(window.confirm('Remove your photo?'))void run(()=>onDelete(photo));}}>Remove photo</button>}</figure>)}<label className="photo-upload">Add your photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void run(()=>onUpload(file));}}/></label><small>JPEG, PNG or WebP · up to 6 MB · shared with both of you</small><p role="status">{busy?'Uploading…':message}</p></section>;
}
