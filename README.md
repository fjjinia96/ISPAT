# ISPAT হালচাল

Progress dashboard of the UNDP project **Institutional Strengthening for Promoting Accelerated Transformation (ISPAT)**.
Mobile first, 4 UNDP themes, 3 fonts, accessibility options, and a Gemini chat assistant.

**Setup: see [SETUP_GUIDE.md](SETUP_GUIDE.md)** (browser only, about 20 minutes).

* **App:** plain HTML, CSS and JavaScript in `docs/`, published with GitHub Pages
* **Data and login:** Supabase (table `dashboard`, row-level security, realtime)
* **AI chat:** Supabase Edge Function `ask-ai` calling the Gemini API (free tier), with built-in answers as fallback
* **Data entry:** Excel template in `excel/`, uploaded in the app's Settings, or synced from OneDrive by GitHub Actions (optional)

Demo mode: while `docs/js/config.js` has placeholder values, the app shows sample data (login `ispat` / `ispat`).

Icons: [OCHA Humanitarian Icons](https://github.com/UN-OCHA/humanitarian-icons) (CC0). Developed by: Fatema Jinia.

Built with ❤️ for UNDP ISPAT Project.
