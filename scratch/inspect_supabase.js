import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Trying to insert a todo with priority...");
  const { data, error } = await supabase
    .from('todos')
    .insert([{
      student_id: '6a0c8565952b70c5a28d',
      title: 'Test Priority',
      due_date: '2026-05-21',
      is_completed: false,
      priority: 'high'
    }])
    .select();
  if (error) {
    console.error("Error inserting:", error);
  } else {
    console.log("Success:", data);
  }
}

run();
