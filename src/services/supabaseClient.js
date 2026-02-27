import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dompaukvvwtjuszvpssu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbXBhdWt2dnd0anVzenZwc3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTA0MjUsImV4cCI6MjA4NzY4NjQyNX0.7zGgjvnDxeD3fkQkSbKl9p7o4GJXAMXLZCsdt_tIkwk'; // sua Anon Key

export const supabase = createClient(supabaseUrl, supabaseAnonKey);