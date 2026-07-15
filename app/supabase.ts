import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://heupqmwxkpsezzfnqbsb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhldXBxbXd4a3BzZXp6Zm5xYnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDg2MzEsImV4cCI6MjA4NzE4NDYzMX0.EZdsGLLDXu-xn_rKcnqWU2vFIfueStG0yrgWsIBUc-4';

export const supabase = createClient(supabaseUrl, supabaseKey);