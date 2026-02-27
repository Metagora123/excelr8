/**
 * Tone mapping for newsletter (same as n8n Tone Selector node).
 */

export const TONE_OPTIONS = [
  "Professional/No-Nonsense",
  "Playful/Lighthearted",
  "Sarcastic/Edgy",
  "Warm/Community-Focused",
  "Bold/Energetic/Hype",
  "Minimalist/Zen",
  "Futuristic/Cutting-Edge",
  "CUSTOM",
] as const

export type ToneOption = (typeof TONE_OPTIONS)[number]

const TONE_DETAILS: Record<string, { tone_name: string; tone_details: string }> = {
  "Professional/No-Nonsense": {
    tone_name: "Professional/No-Nonsense",
    tone_details: `**Visual Character:** Corporate, trustworthy, data-focused
- **Layout:** Strict grid alignment, strong horizontal lines, traditional structure
- **Colors:** Muted primary colors, high contrast text, conservative palette
- **Typography:**
  - Headers: Clean sans-serif, bold weight, larger sizes (28-32px H1)
  - Body: 16-18px, generous line-height (1.6-1.8)
  - Minimal font variation
- **Spacing:** Generous, symmetrical padding (30-40px sections)
- **Buttons:** Rectangular or subtle rounded corners (2-4px), solid colors
- **Images:** Professional stock quality, aligned to grid, subtle borders
- **Accents:** Minimal decoration, thin divider lines (#e0e0e0), professional icons
- **Footer:** Clean, organized, all essential links visible`,
  },
  "Playful/Lighthearted": {
    tone_name: "Playful/Lighthearted",
    tone_details: `**Visual Character:** Fun, approachable, energetic
- **Layout:** Asymmetric elements, bouncy sections, unexpected positioning
- **Colors:** Bright, saturated palette, cheerful combinations, gradient backgrounds
- **Typography:**
  - Headers: Rounded or friendly fonts, varied sizes, playful color accents
  - Body: 16-18px, comfortable reading
  - Use of colored text for emphasis
- **Spacing:** Variable padding, organic flow, breathing room
- **Buttons:** Highly rounded corners (8-12px), bright colors, larger padding
- **Images:** Colorful borders (3-5px), slight rotation (-2° to 2°), rounded corners (8-10px)
- **Accents:** Colorful dividers, emoji usage, playful icons, decorative elements
- **Footer:** Friendly language, bright social icons, casual tone`,
  },
  "Sarcastic/Edgy": {
    tone_name: "Sarcastic/Edgy",
    tone_details: `**Visual Character:** Dark humor, subversive, bold
- **Layout:** Intentional asymmetry, unexpected breaks, rule-breaking composition
- **Colors:** Dark backgrounds (#1a1a1a, #0a0a0a), high contrast accents, neon highlights
- **Typography:**
  - Headers: Bold, impactful, sharp fonts, high contrast
  - Body: 16-17px, slightly condensed line-height (1.5)
  - Occasional ALL CAPS for emphasis
- **Spacing:** Tight in some areas, excessive in others (intentional tension)
- **Buttons:** Sharp corners OR heavily rounded, contrasting styles, bold colors
- **Images:** High contrast borders, glitch effects (if possible), dark overlays
- **Accents:** Heavy dividers, dark mode friendly, ironic copy, edgy icons
- **Footer:** Witty unsubscribe text, dark background, minimalist`,
  },
  "Warm/Community-Focused": {
    tone_name: "Warm/Community-Focused",
    tone_details: `**Visual Character:** Friendly, inclusive, approachable
- **Layout:** Centered content, balanced sections, welcoming structure
- **Colors:** Warm tones (coral, orange, warm grays), soft saturation, inviting palette
- **Typography:**
  - Headers: Friendly fonts, warm colors, conversational sizes (24-28px H1)
  - Body: 17-18px, relaxed line-height (1.7)
  - Personal, approachable language
- **Spacing:** Comfortable padding (25-35px), breathable sections
- **Buttons:** Soft rounded corners (6-8px), warm colors, inviting copy
- **Images:** Soft rounded corners (6-10px), warm filters/overlays, people-focused
- **Accents:** Organic shapes, soft dividers, heart/community icons
- **Footer:** Personal sign-off, warm social icons, community links`,
  },
  "Bold/Energetic/Hype": {
    tone_name: "Bold/Energetic/Hype",
    tone_details: `**Visual Character:** High-energy, exciting, dynamic
- **Layout:** Dynamic angles, diagonal sections, motion-implied design
- **Colors:** Maximum saturation, bold contrasts, vibrant gradients
- **Typography:**
  - Headers: LARGE bold fonts (32-36px H1), high impact, exciting colors
  - Body: 16-18px, punchy short paragraphs
  - Heavy use of bold and emphasis
- **Spacing:** Tight, energetic (20-30px sections), fast-paced flow
- **Buttons:** Large, bold, high-contrast, action-oriented copy, generous padding
- **Images:** Full-width when possible, vibrant borders (4-6px), high energy subjects
- **Accents:** Bold dividers (3-5px), energetic icons, exclamation points, gradient backgrounds
- **Footer:** Punchy copy, bright social icons, high contrast`,
  },
  "Minimalist/Zen": {
    tone_name: "Minimalist/Zen",
    tone_details: `**Visual Character:** Clean, simple, contemplative
- **Layout:** Maximum white space (50-60%), single column, extreme simplicity
- **Colors:** Monochrome or single accent color, lots of white/light gray
- **Typography:**
  - Headers: Simple sans-serif, moderate sizes (24-28px H1), ample spacing
  - Body: 17-18px, generous line-height (1.8-2.0)
  - Minimal text overall
- **Spacing:** Excessive padding (40-60px sections), breathing room priority
- **Buttons:** Simple, understated, minimal styling, text-focused
- **Images:** Few images, generous margins, no borders, subtle presentation
- **Accents:** Ultra-minimal dividers (1px, light gray), almost no decoration
- **Footer:** Essential links only, understated, simple`,
  },
  "Futuristic/Cutting-Edge": {
    tone_name: "Futuristic/Cutting-Edge",
    tone_details: `**Visual Character:** High-tech, innovative, sci-fi inspired
- **Layout:** Geometric precision, angular sections, tech-inspired grid
- **Colors:** Deep blues, electric accents, holographic gradients, tech palette
- **Typography:**
  - Headers: Modern, geometric fonts, 28-32px H1, tech-forward
  - Body: 16-18px, clean, precise
  - Monospace for technical elements
- **Spacing:** Precise, mathematical (20px, 30px, 40px), grid-based
- **Buttons:** Angular or highly rounded, glowing effects, tech colors
- **Images:** Geometric borders, subtle glow effects, tech-themed framing
- **Accents:** Circuit patterns, neon dividers, tech icons, gradient overlays
- **Footer:** Sleek, modern, tech-forward social icons`,
  },
}

export function getToneDetails(
  tone: string,
  customToneText?: string
): { tone_name: string; tone_details: string } {
  if (tone === "CUSTOM" && customToneText?.trim()) {
    return { tone_name: "CUSTOM", tone_details: customToneText.trim() }
  }
  return (
    TONE_DETAILS[tone] ?? TONE_DETAILS["Professional/No-Nonsense"]
  )
}
