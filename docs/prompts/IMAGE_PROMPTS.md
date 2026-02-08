# Image Generation Prompts

## Overview

Images are generated after article validation. The process has two stages:
1. **Prompt generation** — AI creates a DALL·E prompt from article context
2. **Image generation** — DALL·E produces the image from that prompt

Human override is always available: a manually created artistic image (Nanabana Pro) replaces the automated image entirely.

---

## Stage 1: Prompt Generation

### System Prompt (OpenAI Chat)

```
You are an art director for a literary heritage publication. You generate image prompts for DALL·E 3 that produce evocative, atmospheric images of heritage places in Spain and Portugal.

## STYLE GUIDELINES
- Mood: contemplative, timeless, slightly melancholic
- Light: golden hour, early morning, or soft overcast — never harsh midday
- Perspective: often from a slight distance, as if the viewer is approaching
- People: rarely present; if included, they are small figures giving scale, never posing
- No text, no logos, no watermarks in the image
- No photorealistic style — aim for a painterly, slightly textured quality
- Color palette: warm earth tones, aged stone, patinated metals, weathered wood
- Atmosphere: places that feel inhabited by time, not by tourists

## RULES
1. The prompt must be in English (DALL·E works best in English).
2. Maximum 400 characters.
3. Do NOT mention "Lucas Lunes" or any brand name.
4. Do NOT request text overlays or titles in the image.
5. Reference the specific architectural style or landmark features when known.
6. Include the geographic/cultural context (Iberian, Andalusian, Manueline, etc.).
7. Favor atmospheric conditions that create mood: mist, low sun, dusk, rain on stone.

## OUTPUT FORMAT
Output ONLY the DALL·E prompt text, nothing else.
```

### User Prompt Template

```
Place: {{place_name}}
City: {{city}}, {{region}}
Country: {{country}} (ES = Spain, PT = Portugal)
Article title: {{seo_title}}
Category: {{category}}

Generate a DALL·E 3 prompt for this heritage place.
```

### Model Configuration

| Parameter | Value |
|---|---|
| Model | gpt-4o-mini |
| Temperature | 0.5 |
| Max tokens | 300 |

---

## Stage 2: Image Generation (DALL·E 3)

### Configuration

| Parameter | Value | Rationale |
|---|---|---|
| Model | dall-e-3 | Best quality for artistic heritage images |
| Size | 1792x1024 | Landscape format for web articles and social |
| Quality | hd | Higher detail for architectural subjects |
| Style | natural | Less artificial than "vivid" for heritage subjects |
| N | 1 | Single image per generation |

### Prompt Examples

**Spanish Cathedral:**
```
Atmospheric view of an ancient Gothic cathedral in southern Spain at golden hour, warm sandstone walls glowing in late afternoon light, slight haze in the air, a single figure walking through the shadow of a massive stone archway, painterly texture, earth tones, contemplative mood
```

**Portuguese Monastery:**
```
A Manueline monastery in central Portugal on a misty morning, ornate stone carvings partially obscured by soft fog, wet cobblestones reflecting pale light, overgrown garden courtyard visible through an arched doorway, painterly style, muted greens and warm grays
```

**Ruined Castle:**
```
Crumbling medieval castle walls on a hilltop in Castilla y León at dusk, dry golden grass in the foreground, deep blue sky with last traces of sunset, a single olive tree growing from the ruins, textured brushstroke quality, warm ochre and deep indigo palette
```

**Historic Bridge:**
```
Ancient Roman bridge spanning a river in rural Portugal, morning light filtering through mist rising from the water, moss-covered stones, distant hills fading into haze, no people, painterly atmosphere, soft warm tones
```

---

## Stage 3: Alt Text Generation

### System Prompt

```
Generate SEO-friendly alt text in French for a heritage place image.
The alt text must:
- Describe the image content accurately
- Include the place name and location
- Be max 125 characters
- Be descriptive, not decorative ("Image de..." is not useful)
- Include relevant keywords naturally

Output ONLY the alt text, nothing else.
```

### User Prompt Template

```
Place: {{place_name}}
City: {{city}}, {{region}}
Country: {{country}}
Image description: {{image_prompt_used}}

Generate the French alt text.
```

### Model Configuration

| Parameter | Value |
|---|---|
| Model | gpt-4o-mini |
| Temperature | 0.3 |
| Max tokens | 100 |

### Alt Text Examples

- `Vue atmosphérique de la cathédrale de Séville au coucher du soleil, façade gothique en pierre dorée`
- `Monastère des Hiéronymites à Lisbonne dans la brume matinale, détails manuélins en pierre blanche`
- `Ruines du château de Calatrava la Nueva au crépuscule, murailles médiévales et ciel profond`

---

## Manual Override: Nanabana Pro Artistic Images

### When to Use Manual Override

- `lieu_majeur_score` ≥ 80 (premium editorial treatment)
- The automated image does not capture the place's essence
- The human editor has a specific artistic vision
- The place requires a non-photographic artistic approach

### Manual Override Process

1. Human creates the image using Nanabana Pro or other artistic tools
2. Human uploads the image to the `manual_image` field in Airtable
3. Human sets `image_source` to `manual_override`
4. Human writes custom alt text in the `alt_text` field
5. Human sets status to `IMAGE_APPROVED`

The automated image is preserved in `generated_image` for reference but is NOT used when a manual override exists.

### Image Requirements (Manual)

| Requirement | Specification |
|---|---|
| Format | JPEG or PNG |
| Minimum width | 1200px |
| Aspect ratio | 16:9 preferred (for web + social) |
| File size | Under 5MB |
| Alt text | Required, max 125 chars, French |

---

## Status Transitions

- Input status: `ARTICLE_VALIDATED`
- Automated output status: `IMAGE_GENERATED`
- After human approval: `IMAGE_APPROVED`
- After human rejection: `IMAGE_REJECTED` (with notes for regeneration or manual creation)
