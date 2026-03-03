import { createClient } from '@supabase/supabase-js';

// Usamos o caminho que definimos na regra de Rewrite do Render
const supabaseUrl = 'https://sneaelis-bi.onrender.com/api/supabase-proxy'; 
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Erro: Variáveis de ambiente não encontradas!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);