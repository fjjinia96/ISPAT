# ISPAT হালচাল: Setup Guide (Supabase + GitHub Pages)

Everything happens **in your web browser**. The only other tool is **Notepad**, to copy and paste.
Nothing to install. Everything is free.

| What | Does what |
|---|---|
| **Supabase** (supabase.com) | Team login and the dashboard data |
| **GitHub Pages** | Gives the app its web link |
| **Google AI Studio** (optional) | Free key for the Gemini chat |

**Time:** about 20 minutes for the app to go live (Stages 1 to 6). The AI chat (Stage 7) and the automatic Excel sync (Stage 8) are optional extras.

Before you start, unzip `ispat-halchal.zip` (right-click > **Extract All**). You get a folder `ispat-halchal`.

---

## Stage 1. Create the Supabase project (5 min)

1. Go to **https://supabase.com** and click **Start your project**.
2. Click **Continue with GitHub** and allow it. This is the easiest login because you already use GitHub.
3. If asked, create an **organization**: any name (for example `ISPAT`), plan **Free**.
4. Click **New project**:
   * **Project name:** `ispat-halchal`
   * **Database password:** click **Generate a password**, then copy it into Notepad and save that file somewhere safe. (The app never needs it, but keep it.)
   * **Region:** choose **South Asia (Mumbai)**. If it is not offered, choose **Southeast Asia (Singapore)**.
   * Click **Create new project**.
5. Wait 1 to 2 minutes until the project page is ready.

## Stage 2. Create the database table (2 min)

1. In the left menu, click **SQL Editor** (the icon looks like `>_` or a page with code).
2. Click **New query** (or the **+**).
3. On your computer, open the folder `ispat-halchal\supabase`. Right-click **setup.sql** > **Open with** > **Notepad**.
4. In Notepad: **Ctrl + A** (select all), **Ctrl + C** (copy).
5. Back in Supabase, click in the big empty editor, **Ctrl + V** (paste).
6. Click **Run** (bottom right, or press **Ctrl + Enter**).
7. You should see **"Success. No rows returned"**. Done.

## Stage 3. Create the team login (3 min)

1. Left menu > **Authentication** (the icon with people) > **Users**.
2. Click **Add user** > **Create new user**:
   * **Email:** `ispat@ispat-halchal.app` (exactly like this; it is not a real mailbox, and that is fine)
   * **Password:** the team password, **at least 6 characters**, for example `Ispat@2026`. Write it in Notepad.
   * Tick **Auto Confirm User**.
   * Click **Create user**.
3. Stop strangers from making their own accounts:
   * Still in **Authentication**, open **Sign In / Providers** (on some screens it is called **Providers** or **Settings**).
   * Turn **OFF** the switch **Allow new users to sign up**.
   * Click **Save**.

Your team signs in with **ID `ispat`** and that password.

## Stage 4. Copy two values into the app (3 min)

1. In Supabase, click **Project Settings** (gear icon, bottom of the left menu).
   *Shortcut:* the **Connect** button at the top of the project page also shows both values.
2. Find the **Project URL**. It is under **Data API** (or **API**). It looks like `https://abcdefghijkl.supabase.co`. Copy it into Notepad.
3. Open **API Keys**. Copy the **Publishable key** (starts with `sb_publishable_`). Copy it into Notepad.
   *If you only see "anon public" and "service_role": copy the **anon public** key (a long text starting with `eyJ`). Both work.*
   *Do **not** use the "secret" or "service_role" key here. That one must stay private.*
4. On your computer open `ispat-halchal\docs\js\config.js` with **Notepad** (right-click > Open with > Notepad).
5. Replace the two placeholders. Keep the quotes:
   ```
   supabaseUrl: "https://abcdefghijkl.supabase.co",
   supabaseKey: "sb_publishable_xxxxxxxxxxxxxxxx",
   ```
6. **File > Save** and close Notepad.

> These two values are designed to be public. Your data stays protected because only the team login can read it (Stage 2 rules) and nobody can create new accounts (Stage 3).

## Stage 5. Put the app on GitHub (5 min)

Use a **new** repository so the old Firebase files do not get mixed in.

1. Go to **https://github.com/new**
   * **Repository name:** `ispat-halchal-app`
   * Choose **Public** (GitHub Pages is free only for public repositories; your data is still private in Supabase)
   * Do not add anything else. Click **Create repository**.
2. On the next page, click the link **uploading an existing file**.
3. Open the unzipped `ispat-halchal` folder on your computer. Select **everything inside it** (Ctrl + A): `docs`, `excel`, `github-actions`, `supabase`, `sync`, `package.json`, `README.md`, `SETUP_GUIDE.md`.
4. Drag them into the GitHub upload box. Wait until all files are listed.
5. Click **Commit changes**.
6. Check: open the **docs** folder on GitHub > **js** > **config.js**, and make sure your Supabase URL and key are there.

*(You can delete the old Firebase repository later: its **Settings** > scroll to the bottom > **Delete this repository**.)*

## Stage 6. Turn on the web link (3 min) 🎉

1. In your new repository, click **Settings** (top tab of the repository).
2. Left menu > **Pages**.
3. Under **Build and deployment**:
   * **Source:** Deploy from a branch
   * **Branch:** `main` and folder **`/docs`**
   * Click **Save**.
4. Wait 1 to 2 minutes, then refresh the page. At the top it shows:
   **Your site is live at `https://YOUR-NAME.github.io/ispat-halchal-app/`**
5. Open the link, sign in with **`ispat`** and your password.
6. You see **"No data yet"**. Go to **Settings > Data > Upload**, pick your filled-in Excel file, check the summary, tap **Update for everyone**.

**Your app is live.** Share the link with the team. On phones: Chrome menu ⋮ > **Add to Home screen** (iPhone Safari: Share > **Add to Home Screen**).

**Updating data from now on:** edit the Excel file, then in the app **Settings > Upload** the new version. (Or set up Stage 8 so it happens by itself.)

---

## Stage 7 (optional). Gemini AI chat (10 min)

Without this, the chat still works with built-in answers. With it, people can ask anything, in English or বাংলা.

**7a. Get a free Gemini key**
1. Go to **https://aistudio.google.com/apikey** and sign in with a Google account.
2. Click **Create API key** (choose or create a project if asked). Copy the key (starts with `AIza`) into Notepad.

**7b. Store the key in Supabase**
1. Supabase > left menu **Edge Functions** > **Secrets**.
2. **Name:** `GEMINI_API_KEY`  **Value:** paste the key. Click **Save** (or **Add secret**).

**7c. Create the chat function**
1. **Edge Functions** > **Functions** > **Deploy a new function** > **Via Editor**.
2. **Function name:** `ask-ai` (exactly).
3. On your computer open `ispat-halchal\supabase\ask-ai.ts` with Notepad, **Ctrl + A**, **Ctrl + C**.
4. In the Supabase editor, select all the example code (**Ctrl + A**) and paste (**Ctrl + V**).
5. Click **Deploy function**. Wait until it says deployed.
6. Open the app, tap the chat button, ask "What is the budget this year?". The answer now comes from Gemini.

*If the chat still gives the short built-in answers:* open the function **ask-ai** > **Details** (or **Settings**), switch **off** the **JWT verification** option, and save. It is safe: the code itself checks that the person is signed in with the team account.

*Free Gemini note:* on the free tier, Google may use the questions and the data sent with them to improve its products. If that is not acceptable, skip Stage 7.

## Stage 8 (optional, older method). Automatic sync with GitHub Actions (10 min)

*Easier: use Stage 9 instead.*

The app copies the Excel file from OneDrive every 30 minutes by itself. This also keeps the free Supabase project awake.

1. **OneDrive:** open the Excel file > **Share** > link settings > **Anyone with the link** > **Can view** > **Copy**. (If "Anyone" is greyed out, UNDP does not allow it: keep using Upload in the app instead.)
2. **Supabase secret key:** Project Settings > **API Keys** > **Secret keys** > reveal and copy the key (`sb_secret_...`). *Older projects: the `service_role` key.* Keep it private.
3. **GitHub secrets:** your repository > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**, three times:

   | Name | Secret |
   |---|---|
   | `EXCEL_SHARE_URL` | the OneDrive link |
   | `SUPABASE_URL` | the Project URL (same as in config.js) |
   | `SUPABASE_SECRET_KEY` | the secret key |

4. **Create the workflow file on GitHub:** repository main page > **Add file** > **Create new file**.
   * In the name box type exactly: `.github/workflows/sync-excel.yml` (typing the `/` creates the folders).
   * Open `ispat-halchal\github-actions\sync-excel.yml` with Notepad, copy all, paste into GitHub.
   * Click **Commit changes**.
5. Click the **Actions** tab > **Sync Excel to app** > **Run workflow**. After about a minute: green tick = done.

## Stage 9. Live Excel: "Sync now" button (10 min)

The app reads the Excel file straight from OneDrive: automatically each time someone opens the app (if the data is older than 10 minutes), and immediately when someone taps **Sync now**. No GitHub secrets needed.

1. **Database:** Supabase > **SQL Editor** > **New query** > paste all of `supabase\setup.sql` > **Run**. (Safe to run again; it adds a small settings table.)
2. **Function:** Supabase > **Edge Functions** > **Deploy a new function** > **Via Editor**. Name: `sync-now`. Paste all of `supabase\sync-now.ts` (replace the example code) > **Deploy function**.
   *(If `sync-now` already exists: open it > **Code** > replace everything > **Deploy**.)*
3. **OneDrive link:** open the Excel file in OneDrive > **Share** > link settings > **Anyone with the link** > **Can view** > **Apply** > **Copy link**. Test it in a private window (Ctrl + Shift + N): it must open **without** asking you to sign in.
4. **App:** open the app (Ctrl + F5) > **Settings** > **Data** > paste the link in **Live Excel link** > **Save** > tap **Sync now**.

The app shows a clear message if something is wrong (for example, if the link needs a UNDP sign-in). If it says Supabase blocked the request, open **Edge Functions** > **sync-now** > **Details**, switch **off** **Verify JWT**, save.

*The older GitHub Actions sync (Stage 8) is not needed any more. To stop it: repository > **Actions** > **Sync Excel to app** > **⋯** > **Disable workflow**.*

---

## Good to know

* **Free Supabase projects pause after 7 days with no use.** If the team uses the app every week (or Stage 8 is on), this never happens. If it does: open supabase.com, your project, **Resume project**. Your data is kept.
* **Change the team password:** Supabase > Authentication > Users > the user's **⋮** menu > **Delete user**, then add it again (Stage 3) with the new password.
* **Change something in the app later:** on GitHub open the file > pencil ✏️ > edit > **Commit changes**. The live site updates within about 1 minute.
* **Try the app without setup:** if `config.js` still has the PASTE placeholders, the app runs in demo mode with sample data (login `ispat` / `ispat`).

## Troubleshooting

| Problem | Fix |
|---|---|
| Login says ID or password does not match | Check the user email is exactly `ispat@ispat-halchal.app`, **Auto Confirm User** was ticked, and the password is right. |
| App still shows sample data | `docs/js/config.js` still has PASTE_... text. Fill in Stage 4 values on GitHub (pencil ✏️) and commit. |
| "Could not load the data" | Run `supabase/setup.sql` again in SQL Editor (Stage 2). |
| Upload says "Could not save" | Same as above: run setup.sql. Make sure you are signed in as `ispat`. |
| GitHub Pages link shows 404 | Wait 2 minutes. Check Pages uses branch `main` and folder `/docs`. |
| Pages option not available | The repository must be **Public**. |
| Chat gives only short built-in answers | Stage 7: check the secret name `GEMINI_API_KEY`, the function name `ask-ai`, and the JWT tip in 7c. |
| Sync fails "returned a web page" | The OneDrive link is not "Anyone with the link". Make a new link, update the secret. |
| A date shows red in Excel | Retype it like `15-Mar-2026`. |

## What is in the folder

```
ispat-halchal/
├── docs/                 the app (GitHub Pages publishes this folder)
│   ├── index.html
│   ├── js/config.js      ← YOUR TWO SUPABASE VALUES GO HERE
│   ├── js/app.js · backend.js · parse.js · icons.js · demo-data.js
│   ├── js/vendor/supabase.js   (Supabase library, included)
│   ├── css/app.css · img/ · manifest.webmanifest
├── supabase/setup.sql    paste into Supabase SQL Editor (Stage 2)
├── supabase/ask-ai.ts    paste into a Supabase Edge Function (Stage 7)
├── supabase/sync-now.ts  paste into a Supabase Edge Function (Stage 9, Sync now button)
├── github-actions/sync-excel.yml   optional auto sync (Stage 8)
├── sync/                 code used by the auto sync
├── excel/ISPAT_Halchal_Data_Template.xlsx
└── SETUP_GUIDE.md        this guide
```

Built with ❤️ for UNDP ISPAT Project.
