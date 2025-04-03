import { createClient } from "@supabase/supabase-js";

// These environment variables will need to be set in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey);

// Define the AnalysisResult type to match what we'll store in Supabase
export type AnalysisResult = {
  id: string;
  url: string;
  colors: ColorInfo[];
  frameworks: string[];
  images: string[];
  created_at?: string;
};

export type ColorInfo = {
  value: string;
  context: string;
};
