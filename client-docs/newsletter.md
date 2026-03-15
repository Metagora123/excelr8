# Newsletter – Client documentation

## Overview

The **Newsletter** module is a **weekly newsletter generator** inside the Excelr8 dashboard. You choose a date range and stories (or sources), set tone and language, and the app uses **AI** to produce curated content, optional images, and full **HTML** suitable for sending (e.g. via SendGrid or another tool). All prompts and steps are visible so you can review or reuse them.

**Who uses it:** Content and marketing teams who produce a recurring newsletter and want a single place to go from raw stories to send-ready HTML with consistent tone and optional imagery.

**When to use it:** When you have a set of stories or topics and want to generate a draft newsletter (content + optional images + HTML) in one flow.

---

## Business value

- **One place** to go from raw stories to send-ready newsletter (content + optional images + HTML).
- **Consistent tone and language** without manual copy-paste; you set the parameters once per run.
- **Faster production:** AI handles structure and copy; you control story selection and final edits.
- **Auditable:** You see the exact prompts and generated content so you can adjust or reuse them.
- **Flexible:** Optional custom prompts for images and HTML let you align with brand or format.

---

## How it works (user perspective)

1. Open the **Newsletter** page and choose **date range** and **stories** (or paste/select content to include).
2. Set **tone** (e.g. professional, casual) and **language** (e.g. English, French). Optionally set **custom image prompt** and **custom HTML prompt** (or use defaults).
3. Trigger **Generate**. The app runs the content step (AI generates intro, segments, summaries), then optionally generates **images** per story (e.g. via Gemini), then runs the **HTML** step (AI produces full newsletter markup).
4. You get a **preview** and the **HTML** (and prompts) so you can copy into your sending tool or edit further.

---

## How it works (system / data)

- **Input:** Selected stories/articles (title, summary, URL, etc.) and parameters (tone, language, date). Stories are formatted into a single text block for the content prompt.
- **Content step:** The content prompt (see `lib/newsletter-prompts.ts`) is sent to an AI (e.g. OpenAI). The model returns structured content (intro, segments, summaries). Same prompt pattern can support multiple languages via the language parameter.
- **Image step (optional):** For each story, an image prompt is built (title + summary; optional custom template). The app calls the image API (e.g. Gemini) and gets image data; images are then referenced in the HTML step.
- **HTML step:** The HTML prompt (with placeholders for headline, stories, images, tone, date, etc.) is sent to the AI. The model returns full HTML markup. You can override with a custom HTML prompt.
- **Output:** Content prompt, content response, image prompts, generated images, HTML prompt, and final HTML are all available in the UI (and in the API response if you use the generate API). No separate export format is built-in; you copy HTML or use the API response.

---

## Data and integrations

- **Prompts:** Defined in **lib/newsletter-prompts.ts** (content prefix/suffix, image prompt builder, HTML prompt with placeholders). Custom image and HTML prompts can override defaults.
- **AI:** Content and HTML typically use **OpenAI** (e.g. chat completions). Images can use **Gemini** (or another provider) via the configured image model. Keys: **OPENAI_API_KEY**, **GEMINI_API_KEY** (or as configured).
- **Formats:** Input = structured list of articles (title, summary, etc.). Content and HTML = text. Images = generated binary/data as returned by the image API. Output = HTML string and optional image URLs or inline references.

---

## Prompts (content, image, HTML)

**Source:** `lib/newsletter-prompts.ts`. The module uses three prompt types: **content** (story selection + segments), **image** (per-story image), **HTML** (full email markup). Custom image and HTML prompts can override the defaults (templates support placeholders like `{{title}}`, `{{summary}}`, `{{newsletterHeadline}}`, etc.).

### Content prompt (default)

The content step sends a single prompt: **prefix** + formatted articles + optional language block + **suffix**.

- **Prefix:** Role and objective (“AI newsletter editor and content strategist”), then “Input Data” and the formatted stories.
- **Language:** If language is not English, a block instructs: “All output MUST be written in [language].”
- **Suffix:** Task overview (select top 3 stories, headline, subject line, segments), then:
  - **Phase 1 – Story selection:** Criteria (prioritize major releases, funding, adoption; avoid political, doomsday, ads, duplicates). Audience profile. Output: JSON per story (title, summary, reason_for_selection, source_identifiers, external_source_links, key_details, why_it_matters).
  - **Phase 2 – Headline:** 5–8 words, highlight #1 story, no blacklisted terms (“Game-changing”, “Revolutionary”, etc.). Formula: [Specific Company/Technology] + [Concrete Action/Result].
  - **Phase 3 – Subject line:** 7–9 words, tease #1 story; no ALL CAPS/clichés. Pre-header: “PLUS: [Story 2 hint], [Story 3 hint]”, 15–20 words.
  - **Phase 4 – Story segments:** For each story: **The Recap** (1–2 sentences + 1 link), **Unpacked** (exactly 3 bullets, max 1 link per bullet), **Bottom line** (2 sentences). Tone: optimistic, clear, data-driven. Hyperlinking rules: only URLs from source, deep links, 2–3 word anchor text, max 1 link per paragraph.
- **Final output:** Single JSON: `newsletter_headline`, `subject_line`, `pre_header_text`, `top_stories[]` (each with `segment_markdown`), `selection_reasoning`. Word blacklist: e.g. “Smarts”, “Game changing”, “Revolutionize”, “Unprecedented”, “We’re seeing…”.

Full text: `CONTENT_PROMPT_PREFIX`, `CONTENT_PROMPT_SUFFIX`, and `getContentPrompt(formattedArticles, language)` in `lib/newsletter-prompts.ts`.

### Image prompt (default)

Used when no custom image template is set. Placeholders: `{{title}}`, `{{summary}}`.

```
Create a modern newsletter section image (600x315px, 16:9 ratio) for an AI tech newsletter
Title: {{title}}
Summary: {{summary}}
Visual style: Minimalist 3D render with bold color blocking, combining sleek tech elements with organic textures. Use a "refined grit" aesthetic - polished but with subtle grainy texture overlay (10-15% opacity).

Color scheme: Choose 2-3 colors from deep indigo, electric blue, neon green, coral pink, bright orange, paired with warm off-white or charcoal as base. Select colors that match the story's tone (tech=blue/indigo, positive=green, announcements=coral/orange).

Composition rules:
- Use 40-50% negative space
- Place main subject using rule of thirds (off-center)
- Create depth with foreground/background layers
- Add diagonal lines or implied motion for dynamism
- Include subtle mechanical circuit patterns or botanical organic shapes

Lighting: Dramatic volumetric lighting with soft highlights and deep shadows

Technical details: Ultra-sharp focus, octane render quality, 8K resolution, subtle film grain texture

Style references: Behance featured work, modern tech editorial, Apple keynote aesthetics

AVOID: Generic stock photo look, cluttered composition, cliché AI imagery (brain circuits, robot hands), text overlays, logos, low contrast, oversaturation
```

### HTML prompt (default)

The HTML step receives: newsletter date, headline, subject line, pre-header, top stories segment markdown, image tags, tone name, tone details, optional logo URL. Custom HTML prompt can override; placeholders: `{{newsletterDate}}`, `{{newsletterHeadline}}`, `{{subjectLine}}`, `{{preHeaderText}}`, `{{topStoriesSegmentMarkdown}}`, `{{allImageTags}}`, `{{tone}}`, `{{toneName}}`, `{{toneDetails}}`, `{{logoUrl}}`.

**Default role and goal:** “Expert HTML Email Designer … Generate a complete, production-ready HTML newsletter … mobile-responsive … follow email HTML best practices … strictly adhering to the specified TONE configuration.”

**Input variables:** Newsletter name, date, headline, subject line, pre-header, top stories markdown, image tags, header image, tone configuration (tone_name, tone_details), brand colors, logo URL.

**Critical instruction:** Apply TONE CONFIGURATION (tone_details) to every design decision: layout, colors, typography, spacing, buttons, images, footer.

**Structure:** Header (logo, title, date, social); Hero (header image, headline, pre-header); Content sections (story title, image, body, CTA); Footer (social, unsubscribe, address, copyright).

**Technical:** Table-based layout, inline CSS, max width 600–650px, web-safe fonts, Outlook/Gmail safe, responsive.

Full default prompt (with all placeholders): `getDefaultHtmlPromptPlaceholder()` / `DEFAULT_HTML_PROMPT_PLACEHOLDER` in `lib/newsletter-prompts.ts`.

---

## Prerequisites & setup

- **OpenAI:** **OPENAI_API_KEY** for content and HTML generation.
- **Images (optional):** **GEMINI_API_KEY** (or other image model key) and configuration for the image step.
- **SendGrid (optional):** If you send from the app, **SENDGRID_API_KEY**, **SENDGRID_FROM_EMAIL**, **SENDGRID_FROM_NAME**. Otherwise you can copy HTML and send via any tool.

---

## Limits & behaviour

- **Token limits:** Content and HTML length depend on model and token limits; very long newsletters may need to be split or summarized.
- **Images:** Rate limits and quotas of the image API (e.g. Gemini) apply. Image step can be skipped if not configured or if you don’t need images.
- **Idempotency:** Each generate run is independent; there is no automatic saving of generated newsletters to a database unless you add that.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Content/HTML not generating | Ensure **OPENAI_API_KEY** is set and the generate API is reachable. Check for errors in the UI or API response. |
| Images missing or failing | Check **GEMINI_API_KEY** (or image model key) and that the image step is enabled and the API returns successfully. |
| Wrong language or tone | Confirm the language and tone parameters are set correctly in the UI before generating; they are passed into the prompts. |
| HTML doesn’t match brand | Use the **custom HTML prompt** (or custom image prompt) to align with your format; see placeholders in the default prompt. |

---

## Related flows

For a high-level flow of the newsletter pipeline (content → images → HTML), open **flows.pdf** in this folder if a Newsletter diagram is present; otherwise the steps above are the reference.
