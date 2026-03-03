import { createClient } from '@supabase/supabase-js';

// Certifique-se de que não há uma barra "/" sobrando no final da URL
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL; 
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);