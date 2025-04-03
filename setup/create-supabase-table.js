// This script is for reference only - you can run these SQL commands in the Supabase SQL Editor

/*
-- Create the analysis_results table
CREATE TABLE public.analysis_results (
  id UUID PRIMARY KEY,
  url TEXT NOT NULL,
  colors JSONB NOT NULL,
  frameworks JSONB NOT NULL,
  images JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Set up row level security (RLS)
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow anonymous access for both read and write
CREATE POLICY "Allow anonymous access" ON public.analysis_results
  FOR ALL
  USING (true);

-- Allow public access to the table
GRANT ALL ON public.analysis_results TO anon;
GRANT ALL ON public.analysis_results TO authenticated;
*/
