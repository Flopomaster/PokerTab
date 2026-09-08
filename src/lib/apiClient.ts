import type { Api } from './api';
import { createDemoApi } from './demoApi';
import { createSupabaseApi } from './supabaseApi';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * כשיש הגדרות Supabase — עובדים מול השרת האמיתי.
 * אחרת נופלים למצב הדגמה מקומי, כדי שהאתר לא יישבר לפני החיבור.
 */
export const api: Api = url && anonKey ? createSupabaseApi(url, anonKey) : createDemoApi();

export const isDemoMode = api.kind === 'demo';
