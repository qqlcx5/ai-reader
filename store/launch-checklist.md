# Chrome Web Store Launch Checklist — AuraMind

## ✅ Pre-submission

### Code & build
- [x] `wxt.config.ts` — name, short_name, description set
- [x] Icons: 16, 32, 48, 96, 128 PNG (in `public/icon/`)
- [ ] Run `pnpm run zip` to produce `auramind-{version}.zip`
- [ ] Verify zip loads in `chrome://extensions` (Developer mode → Load unpacked → select `.output/chrome-mv3/`)
- [ ] Smoke test: clip a page, run AI summary, save a highlight, schedule review

### Store assets
- [x] English listing copy → `store/listing/en.md`
- [x] Chinese listing copy → `store/listing/zh-CN.md`
- [x] Privacy policy → `store/privacy/privacy-policy.html`
- [ ] **Host privacy policy publicly** (GitHub Pages recommended) and get the URL
- [ ] **Take 5 screenshots** (1280×800 or 640×400):
  1. Workspace view with extracted article + side panel
  2. AI chat / summary in side panel
  3. Highlight toolbar on a web page
  4. Library / review queue with SM-2 cards
  5. Settings: model config + sync config
- [ ] **Optional**: 1 promo tile (440×280) for the "Featured" carousel
- [ ] **Optional**: 1 marquee promo (1400×560) if applying for "Featured"

### Developer account
- [ ] Pay one-time $5 Chrome Web Store developer registration fee
- [ ] Verify email
- [ ] Set up 2FA (required by Google)

## 📝 Submission form

| Field | Value |
|-------|-------|
| Name | `AuraMind - AI Web Clipper & Reader` |
| Short description | (copy from `store/listing/en.md`) |
| Category | Productivity |
| Language | English (+ zh-CN if supported) |
| Icon | 128×128 PNG |
| Screenshots | 5 images, 1280×800 |
| Privacy policy URL | **TODO**: upload to GitHub Pages, paste URL |
| Single-purpose description | (copy from `store/listing/en.md`) |
| Permission justifications | (copy from `store/listing/en.md`) |
| Data usage | (copy from `store/listing/en.md`) |
| Pricing | Free |
| Visibility | Public |

## 🔍 Common review pitfalls to avoid

1. **"Single purpose" violation** — don't bundle unrelated features. AuraMind is a *clipper + reader + review tool* (one coherent purpose: knowledge capture and retention). Document this clearly.
2. **Permission scope** — `<all_urls>` is required for a web clipper but Google wants a clear justification. Already drafted.
3. **Privacy policy must be on a public URL** — GitHub Pages, your own domain, or Notion public page. Not a `file://` link.
4. **No remote code** — extension must not fetch and execute remote JavaScript. Confirm: AI calls send text, not code.
5. **Accurate screenshots** — they must be of the actual extension, not mockups.
6. **Functionality match** — every feature mentioned in the description must work in the submitted build.

## 🚀 Post-submission

- [ ] Reply promptly to any review feedback (usually 1–3 business days)
- [ ] Pin a GitHub Discussions thread for user feedback
- [ ] Add a `CHANGELOG.md` entry for v0.1.0
- [ ] Tweet / blog post launch announcement
- [ ] Submit to Product Hunt (optional, for initial traction)
- [ ] Submit to Hacker News "Show HN" (optional)

## 📊 After launch — track

- Install count (Chrome Web Store dashboard)
- Rating & reviews
- Uninstall reasons (Chrome Web Store dashboard → "Stats")
- GitHub issues
- Discord / Discussions feedback

---

**Estimated timeline**: submission → review → live = 1–7 days
**Approval rate** for well-documented privacy-respecting extensions: ~95%
