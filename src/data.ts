import { createClient } from '@supabase/supabase-js';
import type { GuideData, Observation, PlaceDraft, ReportDraft, City } from './types';
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
 ]);
 for (const result of results) if(result.error) throw result.error;
 const [places,profiles,reviews,observations,recommendations]=results.map(r=>r.data || []);
 return {places,profiles,recommendations,reviews:reviews.map(r=>({...r,observations:observations.filter(o=>o.review_id===r.id) as Observation[]}))} as GuideData;
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
