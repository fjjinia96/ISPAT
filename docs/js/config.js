/*
 * ISPAT হালচাল : your settings
 * ---------------------------------------------------------------
 * Until you fill in the two Supabase lines below, the app runs in
 * DEMO MODE with sample data and the login  ispat / ispat.
 *
 * Where to find the values: Supabase > your project > Project Settings
 * (gear icon) > API Keys and Data API. See SETUP_GUIDE.md, Stage 4.
 * These two values are safe to be public: your data is protected by
 * the team login and the database rules.
 */
export const CONFIG = {

  // Project URL, looks like  https://abcdefghijkl.supabase.co
  supabaseUrl: "https://kglcwmsoftonbyqguulm.supabase.co",

  // Publishable key, looks like  sb_publishable_xxxxxxxxxxxx
  // (older projects: the "anon public" key, a long text starting with eyJ)
  supabaseKey: "sb_publishable_Vm-UDYtlzFq-Xr4AYoSi0Q_wpI20If1",

  // The team login. ID "ispat" becomes the user  ispat@ispat-halchal.app
  // If you change this, also change the email in supabase/setup.sql and supabase/ask-ai.ts
  loginDomain: "ispat-halchal.app",

  // Gemini AI chat (needs Stage 7). If it is not set up, the chat uses built-in answers.
  ai: { enabled: true },

  // Library for reading Excel files (only loaded when someone uploads a file)
  sheetjsUrl: "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs",

  // Demo mode login (only used while the Supabase lines above are not filled in)
  demoLogin: { id: "ispat", password: "ispat" },

  appVersion: "2.0.0"
};
