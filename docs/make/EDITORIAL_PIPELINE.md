# Editorial Pipeline — Make.com Automation Architecture

## Overview

This document defines the full Make.com automation pipeline for the **Lucas Lunes** editorial system. The pipeline orchestrates heritage article production across Spain and Portugal, enforcing strict human validation gates at every critical step.

**Core principle:** Scrape first, write later. No AI before validation. No publication before canonical source. No social before canonical.

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MAKE.COM SCENARIO MAP                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SCENARIO 1: Raw Scraping (Spain)                                  │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────┐           │
│  │ HTTP GET │───▶│ Parse HTML   │───▶│ Airtable CREATE │           │
│  │ (source) │    │ (extract)    │    │ Status=SCRAPED  │           │
│  └──────────┘    └──────────────┘    └─────────────────┘           │
│                                              │                      │
│                                     ─────────┼──── HUMAN GATE 1    │
│                                              ▼                      │
│  SCENARIO 2: Historical Research                                    │
│  ┌──────────────┐    ┌───────────┐    ┌─────────────────┐          │
│  │ Airtable GET │───▶│ OpenAI    │───▶│ Airtable UPDATE │          │
│  │ VALIDATED    │    │ Research  │    │ Status=RESEARCH │          │
│  └──────────────┘    └───────────┘    └─────────────────┘          │
│                                              │                      │
│                                     ─────────┼──── HUMAN GATE 2    │
│                                              ▼                      │
│  SCENARIO 3: Narrative Writing                                      │
│  ┌──────────────┐    ┌───────────┐    ┌─────────────────┐          │
│  │ Airtable GET │───▶│ OpenAI    │───▶│ Airtable UPDATE │          │
│  │ RESEARCH_OK  │    │ Writing   │    │ Status=DRAFT    │          │
│  └──────────────┘    └───────────┘    └─────────────────┘          │
│                                              │                      │
│                                     ─────────┼──── HUMAN GATE 3    │
│                                              ▼                      │
│  SCENARIO 4: Image Generation                                       │
│  ┌──────────────┐    ┌───────────┐    ┌─────────────────┐          │
│  │ Airtable GET │───▶│ DALL·E    │───▶│ Airtable UPDATE │          │
│  │ ARTICLE_OK   │    │ Generate  │    │ Status=IMAGE    │          │
│  └──────────────┘    └───────────┘    └─────────────────┘          │
│                                              │                      │
│                                     ─────────┼──── HUMAN GATE 4    │
│                                              ▼                      │
│  SCENARIO 5: Canonical Publication                                  │
│  ┌──────────────┐    ┌───────────┐    ┌─────────────────┐          │
│  │ Airtable GET │───▶│ Substack/ │───▶│ Airtable UPDATE │          │
│  │ IMAGE_OK     │    │ Webflow   │    │ Status=PUBLISHED│          │
│  └──────────────┘    └───────────┘    └─────────────────┘          │
│                                              │                      │
│                                     ─────────┼──── HUMAN GATE 5    │
│                                              ▼                      │
│  SCENARIO 6: Social Distribution                                    │
│  ┌──────────────┐    ┌───────────┐    ┌──────────────┐             │
│  │ Airtable GET │───▶│ FB + IG   │───▶│ Delayed Link │             │
│  │ CANONICAL_OK │    │ Native    │    │ Comment +1h  │             │
│  └──────────────┘    └───────────┘    └──────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Scenario Inventory

| # | Scenario Name | Trigger | Input | Output | Human Gate |
|---|---|---|---|---|---|
| 1 | `ES_RAW_SCRAPE` | Scheduled (weekly) | arteviajero.com URLs | Airtable records (SCRAPED_RAW) | After scraping |
| 2 | `HISTORICAL_RESEARCH` | Airtable webhook (PLACE_VALIDATED) | Validated place record | Research dossier in Airtable | After research |
| 3 | `NARRATIVE_WRITING` | Airtable webhook (RESEARCH_VALIDATED) | Validated research dossier | Article draft in Airtable | After draft |
| 4 | `IMAGE_GENERATION` | Airtable webhook (ARTICLE_VALIDATED) | Validated article | Generated image + alt text | After image |
| 5 | `CANONICAL_PUBLISH` | Airtable webhook (IMAGE_APPROVED) | Approved image + article | Published URL stored | After publish |
| 6 | `SOCIAL_DISTRIBUTE` | Airtable webhook (CANONICAL_PUBLISHED) | Canonical URL + article | FB/IG posts + delayed comment | Before scheduling |
| 7 | `RITUAL_SCHEDULER` | Cron (daily at 06:00 UTC) | Airtable scoring view | Next article selection | Override allowed |
| 8 | `LIEU_MAJEUR_SCORING` | Airtable webhook (PLACE_VALIDATED) | Validated place | Score (0–100) | After scoring |

---

## Status Flow

```
SCRAPED_RAW
    │
    ▼ [Human validates place]
PLACE_VALIDATED
    │
    ▼ [AI research runs]
RESEARCH_READY
    │
    ▼ [Human validates research]
RESEARCH_VALIDATED
    │
    ▼ [AI narrative writing]
ARTICLE_DRAFT
    │
    ▼ [Human corrects & validates]
ARTICLE_VALIDATED
    │
    ▼ [Image generated]
IMAGE_GENERATED
    │
    ▼ [Human approves image OR overrides with manual]
IMAGE_APPROVED
    │
    ▼ [Canonical publication scheduled]
CANONICAL_SCHEDULED
    │
    ▼ [Published live]
CANONICAL_PUBLISHED
    │
    ▼ [Human validates social copy]
SOCIAL_VALIDATED
    │
    ▼ [Social posts scheduled]
SOCIAL_SCHEDULED
    │
    ▼ [Social posts live + delayed comment]
SOCIAL_PUBLISHED
    │
    ▼
COMPLETE
```

---

## Trigger Mechanisms

### Webhook-Based Triggers (Airtable → Make.com)

Each scenario listens for a status change in Airtable via webhook:

- **Scenario 2** triggers when `Status` changes to `PLACE_VALIDATED`
- **Scenario 3** triggers when `Status` changes to `RESEARCH_VALIDATED`
- **Scenario 4** triggers when `Status` changes to `ARTICLE_VALIDATED`
- **Scenario 5** triggers when `Status` changes to `IMAGE_APPROVED`
- **Scenario 6** triggers when `Status` changes to `CANONICAL_PUBLISHED`

### Scheduled Triggers

- **Scenario 1 (Scraping):** Weekly on Monday at 02:00 UTC
- **Scenario 7 (Ritual Scheduler):** Daily at 06:00 UTC — selects next article for the 48h cycle

### Manual Triggers

All scenarios support manual execution via Make.com dashboard for testing and overrides.

---

## Error Handling

| Error Type | Handling Strategy |
|---|---|
| HTTP timeout on scraping | Retry 3× with 30s delay, then mark `SCRAPE_FAILED` |
| OpenAI API failure | Retry 2× with 60s delay, then mark `AI_ERROR` and notify human |
| Airtable rate limit | Retry with exponential backoff (1s, 2s, 4s), max 5 retries |
| Image generation failure | Mark `IMAGE_FAILED`, allow human to upload manual image |
| Publication API failure | Mark `PUBLISH_FAILED`, send Slack/email notification |
| Social API failure | Mark `SOCIAL_FAILED`, send notification, allow manual posting |

All error states trigger a notification to the editorial team via Slack webhook or email.

---

## Data Flow Contracts

### Scraping → Airtable

```json
{
  "source_url": "string (URL)",
  "place_name": "string",
  "category": "string",
  "city": "string",
  "region": "string",
  "raw_text": "string (long text, unmodified)",
  "source_image_urls": "string (comma-separated URLs)",
  "status": "SCRAPED_RAW",
  "scraped_at": "ISO 8601 datetime",
  "country": "ES"
}
```

### Research Output → Airtable

```json
{
  "research_dossier": "string (Markdown long text)",
  "historical_sources": "string (URLs, one per line)",
  "uncertainty_flags": "string (list of unverified claims)",
  "women_figures": "string (names and roles)",
  "religious_figures": "string (names and orders)",
  "status": "RESEARCH_READY",
  "researched_at": "ISO 8601 datetime"
}
```

### Article Draft → Airtable

```json
{
  "article_markdown": "string (full Markdown article)",
  "seo_title": "string (max 60 chars)",
  "slug": "string (URL-safe)",
  "meta_title": "string (max 60 chars)",
  "meta_description": "string (max 155 chars)",
  "ritual_opening": "string (country-specific opening line)",
  "status": "ARTICLE_DRAFT",
  "drafted_at": "ISO 8601 datetime"
}
```

### Image Output → Airtable

```json
{
  "generated_image_url": "string (URL to stored image)",
  "image_prompt_used": "string",
  "alt_text": "string (SEO-friendly)",
  "image_source": "automated | manual_override",
  "status": "IMAGE_GENERATED",
  "generated_at": "ISO 8601 datetime"
}
```

---

## 48H Ritual Calendar Integration

The `RITUAL_SCHEDULER` scenario runs daily and:

1. Determines which country is next (ES/PT alternation based on last published country)
2. Queries Airtable for the highest `lieu_majeur_score` among `IMAGE_APPROVED` records for that country
3. Assigns the selected record a `ritual_date` (next available slot in the 48h cycle)
4. Sends a notification to the human editor with the selection
5. Allows human override within a 12-hour window before publication proceeds

---

## Make.com Organization

### Folder Structure

```
Editorial Pipeline/
├── 01_Scraping/
│   └── ES_RAW_SCRAPE
├── 02_Research/
│   └── HISTORICAL_RESEARCH
├── 03_Writing/
│   └── NARRATIVE_WRITING
├── 04_Images/
│   └── IMAGE_GENERATION
├── 05_Publication/
│   └── CANONICAL_PUBLISH
├── 06_Social/
│   └── SOCIAL_DISTRIBUTE
├── 07_Scheduling/
│   ├── RITUAL_SCHEDULER
│   └── LIEU_MAJEUR_SCORING
└── 08_Monitoring/
    └── ERROR_NOTIFICATION
```

### Naming Convention

All scenario names follow: `LL_{STEP_NUMBER}_{ACTION}_{COUNTRY}`

Examples:
- `LL_01_SCRAPE_ES`
- `LL_02_RESEARCH_ES`
- `LL_03_WRITE_ES`
- `LL_07_RITUAL_SCHEDULER`

---

## Connection Registry

| Service | Connection Name | Purpose | Rate Limits |
|---|---|---|---|
| Airtable | `airtable_editorial` | Read/write all editorial tables | 5 req/s |
| OpenAI | `openai_editorial` | Research + writing + image | Model-dependent |
| Substack | `substack_lucaslunes` | Canonical publication | Per-plan limits |
| Webflow | `webflow_lucaslunes` | Alternative canonical publication | 60 req/min |
| Facebook Pages | `fb_lucaslunes` | Social posting | Platform limits |
| Instagram Business | `ig_lucaslunes` | Social posting | Platform limits |
| Slack | `slack_editorial` | Error notifications | No practical limit |

---

## Ethical Scraping Notes

- Respect `robots.txt` on arteviajero.com
- Implement minimum 5-second delay between requests
- Identify the scraper with a custom User-Agent: `LucasLunes-Editorial-Bot/1.0`
- Cache scraped content; do not re-scrape already stored URLs
- No scraping of private or paywalled content
- Store raw content only for editorial reference; published articles must be fully original
