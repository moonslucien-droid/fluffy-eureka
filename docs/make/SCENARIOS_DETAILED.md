# Make.com Scenarios — Detailed Configuration

## Scenario 1: ES_RAW_SCRAPE

### Purpose
Scrape heritage places from arteviajero.com (Spain section). Extract raw structured data only. No AI processing.

### Trigger
- **Type:** Scheduled
- **Frequency:** Weekly, Monday 02:00 UTC
- **Fallback:** Manual trigger via Make.com dashboard

### Module Chain

```
[1] HTTP — Get a URL
    URL: https://arteviajero.com/lugares/espana/
    Method: GET
    Headers:
      User-Agent: LucasLunes-Editorial-Bot/1.0
      Accept: text/html
    Parse response: No
    Timeout: 30s

[2] Text Parser — Match Pattern (extract place links)
    Pattern: <a\s+href="(https://arteviajero\.com/lugares/[^"]+)"[^>]*>([^<]+)</a>
    Global match: Yes
    Output: Array of {url, link_text}

[3] Array — Iterator
    Input: Array from module 2

[4] Airtable — Search Records
    Base: ES_Patrimoine
    Table: Places
    Filter: {source_url} = {{iterator.url}}
    Purpose: Skip already-scraped URLs (deduplication)

[5] Router
    Route 1: Record NOT found → continue to module 6
    Route 2: Record found → skip (no action)

[6] HTTP — Get a URL (individual place page)
    URL: {{iterator.url}}
    Method: GET
    Headers:
      User-Agent: LucasLunes-Editorial-Bot/1.0
    Delay: 5 seconds (rate limiting)

[7] Text Parser — Match Pattern (extract place data)
    Operations:
    - Place name: <h1[^>]*>([^<]+)</h1>
    - Category: meta[name="category"] or breadcrumb extraction
    - City/Region: structured data or breadcrumb parsing
    - Raw text: main article body content
    - Images: <img[^>]+src="([^"]+)"[^>]*> within article body

[8] Airtable — Create a Record
    Base: ES_Patrimoine
    Table: Places
    Fields:
      source_url: {{module7.url}}
      place_name: {{module7.place_name}}
      category: {{module7.category}}
      city: {{module7.city}}
      region: {{module7.region}}
      raw_text: {{module7.raw_text}}
      source_image_urls: {{module7.images}} (joined by newline)
      country: "ES"
      status: "SCRAPED_RAW"
      scraped_at: {{now}}
      lieu_majeur_score: null
      human_validated: false

[9] Tools — Sleep
    Duration: 5 seconds
    Purpose: Ethical rate limiting between requests
```

### Error Handling
- Module 1/6 HTTP errors: Retry 3× with 30s interval. On persistent failure, log to `Scraping_Errors` table.
- Module 8 Airtable errors: Retry with exponential backoff. On failure, store payload in Make.com data store for manual recovery.

---

## Scenario 2: HISTORICAL_RESEARCH

### Purpose
Generate a structured historical research dossier for a validated place. AI-assisted but NOT a narrative article.

### Trigger
- **Type:** Airtable webhook
- **Condition:** `Status` field changes to `PLACE_VALIDATED`

### Module Chain

```
[1] Airtable — Watch Records
    Base: ES_Patrimoine (or PT_Patrimoine based on country)
    Table: Places
    Trigger field: status
    Filter: status = "PLACE_VALIDATED"

[2] Airtable — Get a Record
    Full record retrieval for the triggered record ID
    Purpose: Get all fields including raw_text, place_name, region, category

[3] OpenAI — Create a Chat Completion
    Model: gpt-4o
    System prompt: (see docs/prompts/HISTORICAL_RESEARCH_PROMPT.md)
    User prompt:
      """
      Place: {{record.place_name}}
      Category: {{record.category}}
      City: {{record.city}}
      Region: {{record.region}}
      Country: {{record.country}}
      Raw source text:
      {{record.raw_text}}
      """
    Temperature: 0.3
    Max tokens: 4000
    Response format: Structured text (Markdown)

[4] Airtable — Update a Record
    Record ID: {{module1.record_id}}
    Fields:
      research_dossier: {{module3.response}}
      status: "RESEARCH_READY"
      researched_at: {{now}}

[5] Slack — Send a Message (optional notification)
    Channel: #editorial-review
    Message: "📋 Research dossier ready for: {{record.place_name}} ({{record.country}}). Please review and validate."
```

### Guardrails
- OpenAI call uses temperature 0.3 for factual accuracy
- No narrative generation — research dossier format only
- Output must include uncertainty flags section
- Human must validate before any narrative writing begins

---

## Scenario 3: NARRATIVE_WRITING

### Purpose
Write the full Lucas Lunes narrative article from validated research.

### Trigger
- **Type:** Airtable webhook
- **Condition:** `Status` field changes to `RESEARCH_VALIDATED`

### Module Chain

```
[1] Airtable — Watch Records
    Filter: status = "RESEARCH_VALIDATED"

[2] Airtable — Get a Record
    Full record: place data + validated research dossier

[3] Tools — Set Variable
    Name: ritual_opening
    Value:
      IF({{record.country}} = "ES",
         "Que s'est-il passé ce jour-là, en Espagne…",
         "Ce jour-là, au Portugal…")

[4] OpenAI — Create a Chat Completion
    Model: gpt-4o
    System prompt: (see docs/prompts/LUCAS_LUNES_WRITING_PROMPT.md)
    User prompt:
      """
      PLACE: {{record.place_name}}
      CATEGORY: {{record.category}}
      CITY: {{record.city}}
      REGION: {{record.region}}
      COUNTRY: {{record.country}}
      RITUAL OPENING: {{variable.ritual_opening}}

      VALIDATED RESEARCH DOSSIER:
      {{record.research_dossier}}

      RAW SOURCE (reference only, do NOT copy):
      {{record.raw_text}}
      """
    Temperature: 0.7
    Max tokens: 6000

[5] OpenAI — Create a Chat Completion (SEO metadata)
    Model: gpt-4o-mini
    System prompt:
      "Generate SEO metadata for a heritage article. Output JSON only."
    User prompt:
      """
      Article title context: {{record.place_name}}, {{record.city}}, {{record.region}}
      Country: {{record.country}}
      Article excerpt (first 500 chars): {{substring(module4.response, 0, 500)}}

      Generate:
      {
        "seo_title": "(max 60 chars, French)",
        "slug": "(URL-safe, lowercase, hyphens)",
        "meta_title": "(max 60 chars, French)",
        "meta_description": "(max 155 chars, French)"
      }
      """
    Temperature: 0.2
    Max tokens: 500

[6] JSON — Parse
    Input: {{module5.response}}
    Output: Parsed SEO fields

[7] Airtable — Update a Record
    Fields:
      article_markdown: {{module4.response}}
      seo_title: {{module6.seo_title}}
      slug: {{module6.slug}}
      meta_title: {{module6.meta_title}}
      meta_description: {{module6.meta_description}}
      ritual_opening: {{variable.ritual_opening}}
      status: "ARTICLE_DRAFT"
      drafted_at: {{now}}

[8] Slack — Send a Message
    Message: "✍️ Article draft ready for: {{record.place_name}}. Please review, correct, and validate."
```

---

## Scenario 4: IMAGE_GENERATION

### Purpose
Generate a base image for the validated article using DALL·E. Allow human override.

### Trigger
- **Type:** Airtable webhook
- **Condition:** `Status` field changes to `ARTICLE_VALIDATED`

### Module Chain

```
[1] Airtable — Watch Records
    Filter: status = "ARTICLE_VALIDATED"

[2] Airtable — Get a Record
    Full record including article_markdown, place_name, city, region

[3] OpenAI — Create a Chat Completion (generate image prompt)
    Model: gpt-4o-mini
    System prompt: (see docs/prompts/IMAGE_PROMPTS.md — prompt generation section)
    User prompt:
      """
      Place: {{record.place_name}}
      City: {{record.city}}, {{record.region}}
      Country: {{record.country}}
      Article title: {{record.seo_title}}
      """
    Temperature: 0.5
    Max tokens: 300

[4] OpenAI — Generate an Image (DALL·E 3)
    Prompt: {{module3.response}}
    Size: 1792x1024
    Quality: hd
    Style: natural

[5] HTTP — Download a File
    URL: {{module4.image_url}}
    Purpose: Download generated image for storage

[6] Airtable — Upload Attachment
    Record ID: {{module1.record_id}}
    Field: generated_image
    File: {{module5.data}}

[7] OpenAI — Create a Chat Completion (alt text)
    Model: gpt-4o-mini
    System prompt: "Generate SEO-friendly alt text in French for a heritage place image. Max 125 characters."
    User prompt: "Image of {{record.place_name}}, {{record.city}}, {{record.region}} ({{record.country}})"
    Temperature: 0.3

[8] Airtable — Update a Record
    Fields:
      image_prompt_used: {{module3.response}}
      alt_text: {{module7.response}}
      image_source: "automated"
      status: "IMAGE_GENERATED"
      generated_at: {{now}}

[9] Slack — Send a Message
    Message: "🖼️ Image generated for: {{record.place_name}}. Review and approve, or upload manual artistic override."
```

### Manual Override Flow
When a human uploads an image to the `manual_image` attachment field and sets `image_source` to `manual_override`:
- The manual image takes precedence
- Human sets status to `IMAGE_APPROVED` directly
- Automated image is preserved but not used

---

## Scenario 5: CANONICAL_PUBLISH

### Purpose
Publish the validated article to the canonical platform (Substack or Webflow).

### Trigger
- **Type:** Airtable webhook
- **Condition:** `Status` field changes to `IMAGE_APPROVED`

### Module Chain — Substack Variant

```
[1] Airtable — Watch Records
    Filter: status = "IMAGE_APPROVED"

[2] Airtable — Get a Record
    Full record with article, image, SEO metadata

[3] Tools — Set Variable
    Name: publication_date
    Value: {{record.ritual_date}}
    Purpose: Use the date assigned by the ritual scheduler

[4] Router
    Route 1: publication_platform = "substack" → Module 5a
    Route 2: publication_platform = "webflow" → Module 5b

[5a] HTTP — Make a Request (Substack API)
    Method: POST
    URL: Substack API endpoint
    Body:
      title: {{record.seo_title}}
      body_markdown: {{record.article_markdown}}
      subtitle: {{record.meta_description}}
      scheduled_at: {{variable.publication_date}}
      draft: true (human must do final publish confirmation)

[5b] Webflow — Create a CMS Item
    Collection: Articles
    Fields mapped from Airtable record
    Published: false (scheduled for future date)

[6] Airtable — Update a Record
    Fields:
      canonical_url: {{module5.response.url}}
      publication_platform: "substack" or "webflow"
      publication_date: {{variable.publication_date}}
      status: "CANONICAL_SCHEDULED"
      published_at: null (set when actually live)
```

### Post-Publication Confirmation
A separate scheduled check (every 30 minutes) verifies if scheduled articles have gone live and updates status to `CANONICAL_PUBLISHED`.

---

## Scenario 6: SOCIAL_DISTRIBUTE

### Purpose
Create native social posts for Facebook and Instagram. Post link as delayed comment.

### Trigger
- **Type:** Airtable webhook
- **Condition:** `Status` field changes to `CANONICAL_PUBLISHED`

### Module Chain

```
[1] Airtable — Watch Records
    Filter: status = "CANONICAL_PUBLISHED"

[2] Airtable — Get a Record
    Full record with article, canonical_url, image

[3] OpenAI — Create a Chat Completion (social copy)
    Model: gpt-4o
    System prompt: (see docs/prompts/SOCIAL_COPY_PROMPTS.md)
    User prompt:
      """
      PLACE: {{record.place_name}}
      CITY: {{record.city}}, {{record.region}}
      COUNTRY: {{record.country}}
      ARTICLE EXCERPT (first 300 chars): {{substring(record.article_markdown, 0, 300)}}
      CANONICAL URL: {{record.canonical_url}}

      Generate:
      1. Facebook post text (native, NO link, max 500 chars)
      2. Instagram caption (native, NO link, max 2200 chars, include hashtags)
      3. Comment text with link (for delayed posting)
      """
    Temperature: 0.6

[4] Airtable — Update a Record
    Fields:
      social_copy_facebook: {{parsed FB text}}
      social_copy_instagram: {{parsed IG text}}
      social_comment_link: {{parsed comment text}}
      status: "SOCIAL_DRAFT"

[5] Slack — Send a Message
    Message: "📱 Social copy ready for: {{record.place_name}}. Validate before scheduling."
```

### After Human Validation (SOCIAL_VALIDATED):

```
[6] Airtable — Watch Records
    Filter: status = "SOCIAL_VALIDATED"

[7] Facebook Pages — Create a Post
    Page: Lucas Lunes
    Message: {{record.social_copy_facebook}}
    Image: {{record.approved_image}}
    Scheduled: {{record.social_schedule_date}}
    Published: false (scheduled)

[8] Instagram Business — Create a Post
    Account: Lucas Lunes
    Caption: {{record.social_copy_instagram}}
    Image: {{record.approved_image}}
    Scheduled: {{record.social_schedule_date}}

[9] Tools — Sleep
    Duration: 3600 seconds (1 hour)

[10] Facebook Pages — Create a Comment
    Post ID: {{module7.post_id}}
    Message: {{record.social_comment_link}}

[11] Instagram Business — Create a Comment
    Media ID: {{module8.media_id}}
    Message: {{record.social_comment_link}}

[12] Airtable — Update a Record
    Fields:
      social_fb_post_id: {{module7.post_id}}
      social_ig_media_id: {{module8.media_id}}
      social_scheduled_at: {{record.social_schedule_date}}
      status: "SOCIAL_SCHEDULED"
```

### Important Notes
- The 1-hour delay for the link comment uses Make.com's Sleep module
- For production, consider using a separate scheduled scenario instead of Sleep to avoid execution time limits
- Alternative: Store the post IDs and use a separate scenario triggered 1 hour after social publication

---

## Scenario 7: RITUAL_SCHEDULER

### Purpose
Enforce the 48-hour editorial rhythm with country alternation.

### Trigger
- **Type:** Scheduled
- **Frequency:** Daily at 06:00 UTC

### Module Chain

```
[1] Airtable — Search Records
    Table: Places
    Filter: status = "CANONICAL_PUBLISHED"
    Sort: published_at DESC
    Limit: 1
    Purpose: Find the last published article to determine country alternation

[2] Tools — Set Variable
    Name: next_country
    Value:
      IF({{module1.country}} = "ES", "PT", "ES")
      IF no previous record: "ES" (default start)

[3] Airtable — Search Records
    Table: Places
    Filter:
      status = "IMAGE_APPROVED"
      AND country = {{variable.next_country}}
    Sort: lieu_majeur_score DESC
    Limit: 1
    Purpose: Select highest-scoring validated place for the next country

[4] Router
    Route 1: Record found → continue
    Route 2: No record → check other country as fallback

[5] Tools — Set Variable
    Name: next_ritual_date
    Value: {{addDays(module1.published_at, 2)}}
    Fallback: {{addDays(now, 1)}} if no previous publication

[6] Airtable — Update a Record
    Record: {{module3.record_id}}
    Fields:
      ritual_date: {{variable.next_ritual_date}}
      ritual_selected: true
      ritual_selected_at: {{now}}

[7] Slack — Send a Message
    Message:
      "📅 Ritual selection: {{record.place_name}} ({{variable.next_country}})
       Score: {{record.lieu_majeur_score}}/100
       Scheduled for: {{variable.next_ritual_date}}
       ⚠️ Human override window: 12 hours"
```

---

## Scenario 8: LIEU_MAJEUR_SCORING

### Purpose
Calculate the "Lieu Majeur" score (0–100) for validated places.

### Trigger
- **Type:** Airtable webhook
- **Condition:** `Status` changes to `PLACE_VALIDATED`

### Module Chain

```
[1] Airtable — Watch Records
    Filter: status = "PLACE_VALIDATED"

[2] Airtable — Get a Record
    Full record with all place data

[3] OpenAI — Create a Chat Completion
    Model: gpt-4o
    System prompt:
      """
      You are an editorial scoring system for heritage places.
      Score the following place on a 0–100 scale across four criteria.
      Output ONLY valid JSON.

      Criteria:
      1. historical_importance (0–30): Significance in national/regional history,
         architectural value, UNESCO status, documented events.
      2. human_narrative_density (0–25): Richness of human stories,
         presence of notable women figures, diversity of historical actors,
         documented personal stories.
      3. lucas_lunes_potential (0–25): Narrative potential for the Lucas Lunes voice.
         Favor: thresholds, silence, ruins, palimpsest, layered histories,
         places where time is visible, forgotten or overlooked places.
      4. seo_catalog_coherence (0–20): Search volume potential,
         fits within existing catalog structure, complements published articles,
         geographic coverage balance.

      Output format:
      {
        "historical_importance": <int>,
        "human_narrative_density": <int>,
        "lucas_lunes_potential": <int>,
        "seo_catalog_coherence": <int>,
        "total_score": <int>,
        "scoring_rationale": "<brief explanation>"
      }
      """
    User prompt:
      """
      Place: {{record.place_name}}
      Category: {{record.category}}
      City: {{record.city}}, Region: {{record.region}}
      Country: {{record.country}}
      Raw text excerpt: {{substring(record.raw_text, 0, 2000)}}
      """
    Temperature: 0.2

[4] JSON — Parse
    Input: {{module3.response}}

[5] Airtable — Update a Record
    Fields:
      lieu_majeur_score: {{module4.total_score}}
      score_historical: {{module4.historical_importance}}
      score_narrative: {{module4.human_narrative_density}}
      score_lucas_potential: {{module4.lucas_lunes_potential}}
      score_seo: {{module4.seo_catalog_coherence}}
      scoring_rationale: {{module4.scoring_rationale}}
      scored_at: {{now}}
```

### Score Usage Rules
- Score ≥ 80: Priority editorial treatment, premium artistic image (Nanabana Pro)
- Score 60–79: Standard editorial treatment, automated image acceptable
- Score 40–59: Lower priority, publish when pipeline allows
- Score < 40: Deprioritize, review for editorial relevance
- Human may override any score at any time
