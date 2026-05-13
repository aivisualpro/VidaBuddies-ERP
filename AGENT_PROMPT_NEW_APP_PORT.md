# Prompt: Assign a unique dev port to a new or copied app

Use this every time you create a new app or copy an existing one to a new folder. Replace `PATH` with the actual folder path before pasting.

---

```
I just made a new app folder at PATH (either created from scratch or copied from another existing app). I need it to get a unique deterministic dev port that won't collide with any of my other ~50 apps in the parent folder.

PATH: <paste the full path to the new app folder here>

RULE: Do NOT run any terminal commands. Only edit files. I will run commands myself.

TASK:

1. Read PATH/package.json. Identify the framework:
   - Next.js: has "next" in dependencies
   - Nuxt: has "nuxt" in dependencies
   - Vite: has "vite" in dependencies and no "next"/"nuxt"
   - Expo: has "expo" — report back, do not auto-edit
   - Express / Node: dev script runs "node" / "nodemon" / "ts-node" — report back, do not auto-edit
   - Other: report back, do not auto-edit

2. Compute this app's deterministic port:
   port = 3000 + (parseInt(md5(folderName).slice(0,4), 16) % 7000)
   where folderName = path.basename(PATH).

3. Collision check. List every sibling folder of PATH (folders in PATH's parent directory) that has a package.json. For each sibling, extract its dev port:
   - If its dev script contains PORT=$(...path.basename...) or vite --port $(...), compute its port using the same formula on its folder name.
   - If its dev script has a hardcoded --port N or PORT=N, use that literal number.
   - Build a Set of all sibling ports.

4. If the new app's port is already in the Set, salt and retry:
   - Try folderName + "-salt1", recompute port.
   - If still collides, try folderName + "-salt2", etc.
   - Stop at the first salt that gives an unused port.
   - Note which salt was needed.

5. Edit PATH/package.json — replace the dev script using the appropriate pattern. Preserve any existing flags (--turbopack, --webpack, BROWSERSLIST_IGNORE_OLD_DATA=true, etc.) by prepending PORT= before them or appending --port after the framework command, whichever fits the framework.

   Next.js (no salt):
   "dev": "PORT=$(node -e \"const h=require('crypto').createHash('md5').update(require('path').basename(__dirname)).digest('hex');console.log(3000+parseInt(h.slice(0,4),16)%7000)\") next dev"

   Next.js (with salt example for salt1):
   "dev": "PORT=$(node -e \"const name=require('path').basename(__dirname)+'-salt1';const h=require('crypto').createHash('md5').update(name).digest('hex');console.log(3000+parseInt(h.slice(0,4),16)%7000)\") next dev"

   Nuxt: same as Next.js but replace "next dev" with "nuxt dev".

   Vite:
   "dev": "vite --port $(node -e \"const h=require('crypto').createHash('md5').update(require('path').basename(__dirname)).digest('hex');console.log(3000+parseInt(h.slice(0,4),16)%7000)\")"

   Vite with salt: replace the inner update(...) the same way the Next.js salt example does.

   IMPORTANT — if this is a COPIED app whose dev script already has PORT=$(...path.basename...): the formula auto-picks the new port based on the new folder name, so the port WILL change automatically. Only re-edit if salting is required for a collision.

6. Report back:
   - Detected framework
   - Final port assigned
   - Whether salting was needed and which salt
   - The full diff you applied (or "no changes needed — formula already picks the right port" for a copied app with no collision)
   - The command I should run: `cd "PATH" && npm run dev` → "App will run on http://localhost:PORT"
   - If framework was Expo / Express / Other: instructions for me to set the port manually for that framework

Do not start the dev server. Do not run npm install.
```

---

## How to use

1. Create or duplicate the app folder.
2. Open your agent in the new folder (or wherever your agent runs from).
3. Paste the prompt above, replacing `PATH` with the actual folder path.
4. Agent reports the assigned port and the diff.
5. You run `npm run dev` and it boots on the right port automatically.

## What it handles

- **New app from scratch** — adds the PORT formula to the dev script.
- **Copied app** — formula already uses `path.basename(__dirname)` so it auto-rotates to a new port based on the new folder name. Agent verifies no collision and salts if needed.
- **Framework auto-detection** — Next, Nuxt, Vite handled automatically. Expo / Express / others get flagged for manual handling.
- **Collision-proof** — salts the hash if the new port matches any sibling app's port.
