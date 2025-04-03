# Website Component Analyzer

A tool to analyze websites for colors, frameworks, and images.

## Supabase Setup Instructions

This project uses Supabase for persistent storage. Follow these steps to set up your database:

1. **Create a Supabase Project**

   - Go to [Supabase](https://supabase.com/) and sign up or log in
   - Create a new project and note the project URL and API key

2. **Set Up the Database Table**

   - In your Supabase project, go to the SQL Editor
   - Copy and paste the SQL from `setup/create-supabase-table.js`
   - Run the SQL commands to create the `analysis_results` table and set permissions

3. **Configure Environment Variables**

   - Copy `.env.local.example` to `.env.local`
   - Replace the placeholders with your actual Supabase project URL and anon key:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     ```

4. **Run the Project**
   - Install dependencies: `npm install` or `pnpm install`
   - Start the development server: `npm run dev` or `pnpm dev`
   - Open [http://localhost:3000](http://localhost:3000) to view the app

## How It Works

1. Enter a URL to analyze
2. The app fetches the website and analyzes its HTML and CSS
3. Analysis results are stored in your Supabase database
4. View the results on a dedicated page

## Troubleshooting

If you encounter issues:

- Make sure your Supabase URL and key are correctly set in `.env.local`
- Check that the table was created properly in Supabase
- Review Supabase console logs for any errors
- Check the browser console for client-side errors

## Disclaimer

This project contains code that is _mostly_ AI-generated and has been adjusted and tinkered with to suit a specific use case.

While it works for the intended purpose, it may not be fully optimized or error-free. Feel free to explore, adapt, and improve it to better fit your needs!
