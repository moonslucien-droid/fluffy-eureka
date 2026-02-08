# Human Validation Gates — Editorial Governance

## Principle

No automated step produces a public-facing output without human validation. Every critical transition in the editorial pipeline requires explicit human approval. Speed is never prioritized over editorial quality.

---

## Gate Map

```
SCRAPED_RAW ──────── GATE 1 ────── PLACE_VALIDATED
                                        │
                                   [AI Research]
                                        │
RESEARCH_READY ───── GATE 2 ────── RESEARCH_VALIDATED
                                        │
                                   [AI Writing]
                                        │
ARTICLE_DRAFT ────── GATE 3 ────── ARTICLE_VALIDATED
                                        │
                                   [Image Generation]
                                        │
IMAGE_GENERATED ──── GATE 4 ────── IMAGE_APPROVED
                                        │
                                   [Canonical Publication]
                                        │
CANONICAL_PUBLISHED ─ GATE 5 ───── SOCIAL_VALIDATED
                                        │
                                   [Social Publication]
                                        │
                                     COMPLETE
```

---

## Gate 1: Place Validation

**Transition:** `SCRAPED_RAW` → `PLACE_VALIDATED` or `PLACE_REJECTED`

**When:** After raw scraping stores a new place in Airtable.

**What the human reviews:**

| Criterion | Question | Action if No |
|---|---|---|
| Editorial relevance | Is this place worth writing about in the Lucas Lunes voice? | Reject with reason |
| Category accuracy | Is the scraped category correct? | Correct the category |
| Geographic accuracy | Are city and region correct? | Correct the fields |
| Duplication | Does this place already exist in our database? | Reject as duplicate |
| Data quality | Is the raw text substantive enough for research? | Reject or mark ON_HOLD |
| Ethical flag | Any sensitivity issues (active religious site, private property, indigenous sacred site)? | Flag with notes |

**Where:** Airtable view `Pending Validation`

**Required fields to set:**
- `human_validated`: true
- `human_validator`: [editor name]
- `validation_notes`: [any corrections or observations]
- `status`: `PLACE_VALIDATED` or `PLACE_REJECTED`

**Automation blocked until:** `status` = `PLACE_VALIDATED`

---

## Gate 2: Research Validation

**Transition:** `RESEARCH_READY` → `RESEARCH_VALIDATED` or `RESEARCH_REJECTED`

**When:** After AI generates the historical research dossier.

**What the human reviews:**

| Criterion | Question | Action if No |
|---|---|---|
| Factual accuracy | Are key dates, names, and events verifiable? | Correct or reject |
| Source quality | Are cited sources reliable and accessible? | Flag broken/unreliable sources |
| Women's section | Is the section on women substantive, not token? | Enrich with known figures |
| Uncertainties | Are uncertainty flags honest and complete? | Add missing uncertainties |
| Completeness | Are obvious historical periods or figures missing? | Add notes for enrichment |
| Bias check | Does the dossier reflect multiple perspectives? | Note biases for correction |
| No narrative | Is this strictly a research document, not a narrative? | Reject if it reads like an article |

**Where:** Airtable view `Research Queue` (after filtering for RESEARCH_READY)

**Required fields to set:**
- `research_validated_by`: [editor name]
- `research_validation_notes`: [corrections, additions, flags]
- `status`: `RESEARCH_VALIDATED` or `RESEARCH_REJECTED`

**If rejected:** The dossier can be regenerated after corrections to the source data or prompt adjustments. Status returns to `PLACE_VALIDATED` for re-processing.

**Automation blocked until:** `status` = `RESEARCH_VALIDATED`

---

## Gate 3: Article Validation

**Transition:** `ARTICLE_DRAFT` → `ARTICLE_VALIDATED` or `ARTICLE_REJECTED`

**When:** After AI generates the Lucas Lunes narrative article.

**What the human reviews:**

| Criterion | Question | Action if No |
|---|---|---|
| Voice | Does it sound like Lucas Lunes? | Edit or reject for rewrite |
| Three visitors | Are three distinct visitors present and purposeful? | Edit or reject |
| Légende locale | Is the section present, clearly marked, well-framed? | Add or correct |
| Historical accuracy | Do all facts match the validated research dossier? | Correct factual errors |
| Women's presence | Are women from the research given narrative space? | Edit to include them |
| Ritual opening | Is the correct country-specific opening used? | Correct |
| Originality | No text copied from source or research dossier? | Reject if plagiarism detected |
| AI markers | No generic AI phrases ("Furthermore," "Indeed," "In conclusion")? | Edit out or reject |
| Tone | Not touristic, not encyclopedic, not academic? | Edit or reject |
| Length | Within 1500–2500 words? | Edit for length |
| SEO metadata | Are title, slug, meta title, meta description appropriate? | Correct |

**Where:** Airtable view `Article Review`

**Required fields to set:**
- `article_validated_by`: [editor name]
- `article_validation_notes`: [detailed editorial corrections]
- `status`: `ARTICLE_VALIDATED` or `ARTICLE_REJECTED`

**Human editing expected:** This gate is not just approval — the human editor is expected to actively edit, correct, and polish the article. The AI draft is a starting point, not a finished product.

**If rejected:** Status returns to `RESEARCH_VALIDATED`. The article can be regenerated with adjusted prompts or editorial notes.

**Automation blocked until:** `status` = `ARTICLE_VALIDATED`

---

## Gate 4: Image Approval

**Transition:** `IMAGE_GENERATED` → `IMAGE_APPROVED` or `IMAGE_REJECTED`

**When:** After AI generates an image via DALL·E.

**What the human reviews:**

| Criterion | Question | Action if No |
|---|---|---|
| Relevance | Does the image represent this specific place? | Reject for regeneration |
| Quality | Is the image resolution and composition acceptable? | Reject for regeneration |
| Accuracy | No anachronisms or architectural errors? | Reject |
| Mood | Does it match the Lucas Lunes aesthetic (contemplative, atmospheric)? | Reject or override manually |
| Alt text | Is the alt text accurate, descriptive, SEO-friendly? | Correct |
| No text | No unwanted text or logos in the image? | Reject for regeneration |
| Override decision | Should this place get a manual Nanabana Pro image instead? | Upload manual image and set `image_source` to `manual_override` |

**Where:** Airtable view `Image Review`

**Required fields to set:**
- `image_validated_by`: [editor name]
- `status`: `IMAGE_APPROVED` or `IMAGE_REJECTED`
- If manual override: `image_source`: `manual_override` + upload to `manual_image` field

**Score-based guidance:**
- Score ≥ 80: Strongly consider manual artistic image
- Score 60–79: Automated image acceptable if quality is high
- Score < 60: Automated image is standard

**Automation blocked until:** `status` = `IMAGE_APPROVED`

---

## Gate 5: Social Validation

**Transition:** `SOCIAL_DRAFT` → `SOCIAL_VALIDATED`

**When:** After AI generates social copy for Facebook and Instagram.

**What the human reviews:**

| Criterion | Question | Action if No |
|---|---|---|
| Distinct from article | Is social text genuinely different from the article? | Rewrite or reject |
| Facebook tone | Is the FB post natural, reflective, not promotional? | Edit |
| Instagram tone | Is the IG caption atmospheric with appropriate hashtags? | Edit |
| No link in post | Is there NO URL in the main post text? | Remove link |
| Link comment | Is the comment text natural and includes correct canonical URL? | Correct |
| Canonical first | Has the canonical article already been published? | Do not proceed until it is |
| Schedule date | Is the social schedule date AFTER canonical publication? | Adjust date |
| Image | Is the correct approved image attached for social use? | Correct |
| Hashtags | Are Instagram hashtags relevant and properly formatted? | Edit |

**Where:** Airtable — filter for `SOCIAL_DRAFT` status

**Required fields to set:**
- `status`: `SOCIAL_VALIDATED`
- `social_schedule_date`: [confirmed date]

**Automation blocked until:** `status` = `SOCIAL_VALIDATED`

---

## Override & Emergency Procedures

### Human Override of Ritual Selection

The 48h ritual scheduler automatically selects the next article to publish. The human editor can override this selection:

1. Go to the `Editorial_Calendar` table
2. Change the `assigned_place` to a different record
3. Set `human_override` to true
4. Add `override_notes` explaining the decision
5. The overridden place returns to the `IMAGE_APPROVED` pool

**Override window:** 12 hours after automatic selection notification.

### Emergency Hold

Any record can be set to `ON_HOLD` at any time by a human editor. This:
- Pauses all automation for that record
- Preserves all data and progress
- Requires manual status change to resume

### Emergency Unpublish

If a published article needs to be taken down:
1. Human marks the record with `editorial_notes`: "EMERGENCY UNPUBLISH — [reason]"
2. Human removes the article from the publication platform manually
3. Human sets status to `ON_HOLD`
4. Social posts are deleted manually if already published

**There is no automated unpublish mechanism by design.** Unpublishing is always a human decision.

---

## Validation SLA Guidelines

| Gate | Target Review Time | Escalation |
|---|---|---|
| Gate 1 (Place) | Within 48 hours of scraping | Notification at 24h |
| Gate 2 (Research) | Within 24 hours of generation | Notification at 12h |
| Gate 3 (Article) | Within 48 hours of generation | Notification at 24h |
| Gate 4 (Image) | Within 24 hours of generation | Notification at 12h |
| Gate 5 (Social) | Within 12 hours of generation | Notification at 6h |

Notifications are sent via Slack to the `#editorial-review` channel.

---

## Audit Trail

Every validation action is recorded in Airtable:

- **Who** validated (validator name field)
- **When** validated (timestamp via `last_modified`)
- **What** was decided (status change)
- **Why** (validation notes field)

This trail is essential for editorial accountability and quality tracking over time.
