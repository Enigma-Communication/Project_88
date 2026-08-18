# How to set up a Gemini API key that can generate images

Follow in order. Takes about 10 minutes. Steps 1–6 must be done by the
**account holder** (whoever owns the Google account and can add a card).

---

## Step 1 — Open the Google Cloud console

Go to **https://console.cloud.google.com**

Sign in with the Google account that will own this.

---

## Step 2 — Pick or create the project

At the very top of the page, next to the "Google Cloud" logo, there's a
**project dropdown** (it shows the current project name).

- Click it → a "Select a project" dialog opens
- Either pick an existing project, or click **NEW PROJECT** (top right of the dialog)
- If creating one: name it something like `project-88-illustrations` → **CREATE**

**Write down the exact project name.** Every step after this must use the
same project.

---

## Step 3 — Attach billing to that project

Go to **https://console.cloud.google.com/billing**

- Make sure the project selector at the top still shows **your project from Step 2**
- If it says *"This project has no billing account"* → click **LINK A BILLING ACCOUNT**
- Choose an existing billing account, or **CREATE BILLING ACCOUNT** and add a card

✅ **Done when:** the billing page shows your project linked to an active
billing account.

> This is the step that actually unblocks image generation. Without it the key
> gets `limit: 0` on every image request no matter what else is configured.

---

## Step 4 — Turn on the API

Go to **https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com**

- Check the project dropdown at the top is **still your project**
- Click **ENABLE**

✅ **Done when:** the button reads **MANAGE** instead of **ENABLE**.

---

## Step 5 — Create the API key in that project

Go to **https://aistudio.google.com/apikey**

- Click **Create API key** (blue button, top right)
- A dialog appears asking which project to use
- **Select the project from Step 2** — this is the part people get wrong
- Click **Create API key in existing project**

The key appears — a long string. Copy it.

---

## Step 6 — Confirm it's on the paid tier

Still on **https://aistudio.google.com/apikey**, look at the key list.

Each row shows the key's **project** and its **plan**.

✅ **Done when:** the new key's row says **Paid** — not *Free*.

❌ If it still says *Free*, billing didn't attach to the project the key was
made in. Go back to Step 3 and check the project names match exactly.

---

## Step 7 — Test the key before handing it over

Open Terminal and run this, replacing `PASTE_KEY_HERE`:

```bash
curl -s -X POST \
  -H "x-goog-api-key: PASTE_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"a red circle on a white background"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent" \
  | head -c 400
```

✅ **Working** — you'll see a wall of random characters including
`"mimeType": "image/png"` and `"inlineData"`. That's the image coming back.

❌ **Not working** — you'll see `"code": 429` and `limit: 0`.
Billing is not on the key's project. Back to Step 3.

---

## Step 8 — Set a budget cap (recommended)

Go to **https://console.cloud.google.com/billing** → **Budgets & alerts**
→ **CREATE BUDGET**

- Amount: **$20/month** is plenty
- Tick the email alert at 50% / 90% / 100%

Costs are about **$0.04 per image**. Our full test run is under $2.

---

# Step 9 — Put the key into the tool (Will)

Once you have the working key:

```bash
open -a TextEdit "/Users/will/Desktop/Project 88/generator/.env"
```

Replace the line so it reads:

```
GOOGLE_API_KEY=the_new_key_here
```

Save and close. Then:

```bash
cd "/Users/will/Desktop/Project 88/example images"
export PATH="/Users/will/Desktop/Project 88/generator/bin:$PATH"
p88 DSC04576.jpg --keep
```

You should get `DSC04576_illustration.png` — transparent PNG — beside the photo,
plus comps on white / black / navy from `--keep`.

---

## Quick reference

| Step | Where | Done when |
|---|---|---|
| 1–2 | console.cloud.google.com | Project created / selected |
| 3 | …/billing | Project linked to a billing account |
| 4 | …/apis/library/generativelanguage… | Button says MANAGE |
| 5 | aistudio.google.com/apikey | Key created **in that project** |
| 6 | aistudio.google.com/apikey | Key row says **Paid** |
| 7 | Terminal | curl returns `image/png` |
| 8 | …/billing → Budgets | $20/mo cap set |
| 9 | generator/.env | `p88` outputs a PNG |

**The one thing that goes wrong:** creating the key in a different project than
the one with billing. Steps 2, 3, 4 and 5 must all be the same project.
