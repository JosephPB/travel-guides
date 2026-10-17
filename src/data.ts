import { createClient } from '@supabase/supabase-js';
import type { GuideData, Observation, PlaceDraft, ReportDraft, City, PlacePhotoRecord } from './types';
const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
// Deliberately accept only the new publishable-key format, never secret/service keys.
export const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && key.startsWith('sb_publishable_');
export const supabase = configured ? createClient(url,key,{auth:{detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}}) : null;
export const localPreview = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1';
export async function getGuide(): Promise<GuideData> {
 if (!supabase) throw new Error('Supabase is not configured.');
 const results = await Promise.all([
  supabase.from('places').select('*').order('name'),
  supabase.from('profiles').select('*'),
  supabase.from('reviews').select('*'),
  supabase.from('observations').select('*'),
  supabase.from('recommendations').select('*'),
  supabase.from('place_photos').select('*').order('created_at',{ascending:false}),
 ]);
 for (const result of results) if(result.error) throw result.error;
 const [places,profiles,reviews,observations,recommendations,photos]=results.map(r=>r.data || []);
 const signedPhotos=await Promise.all((photos as PlacePhotoRecord[]).map(async photo=>({...photo,url:await photoUrl(photo.storage_path)})));
 return {places,photos:signedPhotos,profiles,recommendations,reviews:reviews.map(r=>({...r,observations:observations.filter(o=>o.review_id===r.id) as Observation[]}))} as GuideData;
}
function db() { if (!supabase) throw new Error('Supabase is not configured.'); return supabase; }
export async function saveReport(placeId: string,draft: ReportDraft) {
 const {error}=await db().rpc('save_report',{p_place_id:placeId,p_thoughts:draft.thoughts,p_ordered:draft.ordered,p_score:draft.triangle_sides,p_observations:draft.observations.map(({category,note})=>({category,note}))}); if(error) throw error;
}
export async function deleteReview(id: string) { const {error}=await db().from('reviews').delete().eq('id',id); if(error) throw error; }
export async function savePlace(id: string | null,city: City,author: string,draft: PlaceDraft) {
 const query=id?db().from('places').update(draft).eq('id',id):db().from('places').insert({...draft,city_id:city,added_by:author,slug:crypto.randomUUID()});
 const {data,error}=await query.select().single(); if(error) throw error; return data;
}
export async function deletePlace(id: string) {const {error}=await db().from('places').delete().eq('id',id); if(error) throw error;}
export async function saveRecommendation(place: string,author: string,note: string,id?: string) {
 const query=id?db().from('recommendations').update({personal_note:note}).eq('id',id):db().from('recommendations').insert({place_id:place,author_id:author,personal_note:note}); const {error}=await query; if(error) throw error;
}
export async function deleteRecommendation(id: string) { const {error}=await db().from('recommendations').delete().eq('id',id); if(error) throw error; }

const signedCache=new Map<string,{url:string;expires:number}>();
export function clearPhotoCache(){signedCache.clear();}
async function photoUrl(path:string){
 const cached=signedCache.get(path);if(cached&&cached.expires>Date.now())return cached.url;
 const {data,error}=await db().storage.from('guide-photos').createSignedUrl(path,3600);
 if(error)return undefined;
 signedCache.set(path,{url:data.signedUrl,expires:Date.now()+3300000});return data.signedUrl;
}
export async function uploadPhoto(placeId:string,userId:string,file:File){
 const extension=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'} as Record<string,string>)[file.type];
 if(!extension||file.size>6*1024*1024)throw new Error('Choose a JPEG, PNG or WebP photo up to 6 MB.');
 const storage_path=`${userId}/${placeId}/${crypto.randomUUID()}.${extension}`;
 const bucket=db().storage.from('guide-photos');
 const {error:uploadError}=await bucket.upload(storage_path,file,{contentType:file.type,upsert:false});
 if(uploadError)throw uploadError;
 const {error}=await db().from('place_photos').insert({place_id:placeId,author_id:userId,storage_path});
 if(error){await bucket.remove([storage_path]);throw error;}
}
export async function deletePhoto(photo:PlacePhotoRecord){
 const {error}=await db().storage.from('guide-photos').remove([photo.storage_path]);if(error)throw error;
 const {error:rowError}=await db().from('place_photos').delete().eq('id',photo.id);if(rowError)throw rowError;
 signedCache.delete(photo.storage_path);
}
