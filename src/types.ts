export type City = 'beirut' | 'bristol';
export type Category = 'coffee' | 'restaurants' | 'museums' | 'attractions';
export type Observation = { id?: string; review_id?: string; category: 'observation' | 'edgy' | 'dangerous' | 'unnecessary'; note: string };
export type Place = {
 id: string; slug: string; city_id: City; category: Category; name: string; neighbourhood: string;
 description: string; maps_url: string; image_url: string | null; image_credit: string | null;
 source_url: string | null; source_name: string | null; verification_url: string | null;
 verification_note: string | null; checked_at: string | null; added_by: string | null; created_at: string;
};
export type Profile = { id: string; display_name: string };
export type Review = { id: string; place_id: string; author_id: string; thoughts: string; ordered: string; triangle_sides: number; updated_at: string; observations: Observation[] };
export type Recommendation = { id: string; place_id: string; author_id: string; personal_note: string; updated_at: string };
export type PlacePhotoRecord = { id:string; place_id:string; author_id:string; storage_path:string; created_at:string; url?:string };
export type GuideData = { places: Place[]; photos: PlacePhotoRecord[]; profiles: Profile[]; reviews: Review[]; recommendations: Recommendation[] };
export type ReportDraft = Pick<Review,'thoughts'|'ordered'|'triangle_sides'|'observations'>;
export type PlaceDraft = Pick<Place,'name'|'neighbourhood'|'description'|'category'|'maps_url'>;
export const emptyData = (): GuideData => ({ places: [], photos: [], profiles: [], reviews: [], recommendations: [] });
export function safeExternal(url: string | null | undefined) {
 try { const parsed = new URL(url || ''); return parsed.protocol === 'https:' ? parsed.href : undefined; } catch { return undefined; }
}
