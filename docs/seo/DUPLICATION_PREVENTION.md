# SEO & Duplication Prevention

## Principle

Every Lucas Lunes article must be fully original content. No text from source websites, no duplication between articles, no cannibalization of our own SEO. The canonical article is always the authoritative source.

---

## Duplication Risks & Mitigations

### Risk 1: Source Text Duplication

**Risk:** AI reproduces passages from the scraped arteviajero.com content.

**Mitigations:**

1. **Prompt-level instruction**: Both the research and writing prompts explicitly forbid copying source text. The raw source is labeled "reference only, do NOT copy."

2. **Structural separation**: The raw source text is stored in a separate field (`raw_text`) from all AI outputs. The research dossier restructures the information. The narrative article is a third, independent creation.

3. **Post-generation check**: Before marking `ARTICLE_VALIDATED`, the human editor should:
   - Compare key phrases from the article against the raw source text
   - Use a plagiarism checker (Copyscape, Quetext, or similar) against the source URL
   - Flag any passages that are too close to the source

4. **Airtable formula (optional)**: Create a formula field that checks character-level overlap between `article_markdown` and `raw_text`. Alert if similarity exceeds 15%.

### Risk 2: Inter-Article Duplication

**Risk:** Multiple Lucas Lunes articles share similar paragraphs, especially for places in the same region or category.

**Mitigations:**

1. **Unique ritual opening context**: Each article is anchored to a specific date in the 48h ritual, making the opening contextually unique.

2. **Three visitors rule**: The three random visitors in each article are unique fictional characters, preventing structural repetition.

3. **Légende locale**: Each article has a unique local legend, preventing thematic overlap.

4. **SEO metadata uniqueness**: Enforce unique values for:
   - `slug` (Airtable formula: check for duplicates)
   - `seo_title` (Airtable formula: check for duplicates)
   - `meta_description` (manual review)

5. **Airtable validation**: Create a view that flags records where `slug` or `seo_title` already exists in another record.

### Risk 3: Canonical URL Confusion

**Risk:** Google indexes the wrong page as the canonical source (social post, syndicated copy, etc.).

**Mitigations:**

1. **Canonical-first publication**: The article MUST be published on the canonical platform (Substack/Webflow) BEFORE any social publication. This is enforced by the pipeline: social scenarios only trigger after `CANONICAL_PUBLISHED`.

2. **Canonical meta tag**: The published article must include:
   ```html
   <link rel="canonical" href="{{canonical_url}}" />
   ```

3. **No full-text on social**: Social posts are native, short, and different from the article. They never reproduce the article text.

4. **Delayed link**: The canonical URL is not in the initial social post — it's in a comment posted 1 hour later. This prevents social platforms from generating rich previews that compete with the canonical page.

5. **Airtable tracking**: The `canonical_url` field is stored and used as the single source of truth for all downstream references.

### Risk 4: Thin Content / Low-Value Pages

**Risk:** Some articles may be too similar to generic heritage descriptions found elsewhere.

**Mitigations:**

1. **Lieu Majeur scoring**: Places with low narrative potential (score < 40) are deprioritized, reducing the risk of producing thin content for uninteresting places.

2. **Minimum length**: Articles must be 1500–2500 words, ensuring substantive content.

3. **Unique narrative elements**: The Lucas Lunes voice, three visitors, and légende locale ensure structural uniqueness that generic heritage content cannot replicate.

4. **No keyword stuffing**: SEO metadata is generated with literary quality in mind, not keyword density. The meta description is compelling, not stuffed.

### Risk 5: AI-Detectable Content

**Risk:** Search engines or readers detect the content as AI-generated, damaging credibility and SEO.

**Mitigations:**

1. **Human editing**: Gate 3 (Article Validation) requires active human editing, not just approval. The human editor adds personal touches, corrects AI patterns, and ensures voice authenticity.

2. **Prompt design**: The writing prompt specifically forbids AI markers ("Furthermore," "Indeed," "In conclusion," "It is worth noting").

3. **Temperature 0.7**: Higher temperature in the writing model produces more varied and less predictable text.

4. **Frequency/presence penalties**: Applied to reduce the repetitive patterns typical of AI text.

5. **Post-edit ratio**: Track what percentage of the final article was human-edited. Aim for at least 15–20% human modification.

---

## SEO Technical Requirements

### Per-Article SEO Checklist

| Element | Requirement | Stored In |
|---|---|---|
| SEO title | Max 60 chars, French, evocative (not keyword-stuffed) | `seo_title` |
| Slug | URL-safe, lowercase, hyphens, no accents, unique | `slug` |
| Meta title | Max 60 chars, may differ from SEO title | `meta_title` |
| Meta description | Max 155 chars, compelling, French | `meta_description` |
| Canonical URL | Full URL of the published article | `canonical_url` |
| Alt text | Max 125 chars, descriptive, French, includes place name | `alt_text` |
| H1 | Article title (matches or closely mirrors seo_title) | First heading in `article_markdown` |
| Internal links | Link to related published articles when relevant | Manual addition during editing |

### Slug Rules

- Lowercase only
- Hyphens as separators (no underscores, no spaces)
- No accented characters (é → e, ñ → n, ç → c)
- No stop words unless necessary for meaning
- Include place name and optionally city
- Max 60 characters

**Examples:**
- `catedral-sevilla-silence-des-pierres`
- `mosteiro-batalha-memoire-calcaire`
- `castillo-calatrava-seuil-du-temps`

### URL Structure

Canonical URLs should follow a consistent pattern:

```
https://[platform].com/[country-prefix]/[slug]

Examples:
https://lucaslunes.substack.com/p/catedral-sevilla-silence-des-pierres
https://lucaslunes.com/espagne/catedral-sevilla-silence-des-pierres
```

---

## Content Freshness Strategy

### Evergreen Content

Lucas Lunes articles are evergreen by design — heritage places do not change rapidly. However:

1. **No date-dependent references**: Articles should not reference "this year" or "recently." The ritual opening provides temporal anchoring without dating the content.

2. **Update protocol**: If significant changes occur at a heritage site (restoration, damage, new discovery), the article can be updated. The original `published_at` date is preserved; a `last_updated` note is added.

3. **No seasonal content**: Avoid references to seasons, weather, or events that would make the article feel outdated.

---

## Monitoring

### Google Search Console

After the first 20 articles are published, set up monitoring for:

- **Index coverage**: Ensure all published articles are indexed
- **Duplicate content flags**: Investigate any Google-flagged duplication
- **Cannibalization**: Check if multiple articles compete for the same queries
- **Crawl errors**: Monitor for 404s or redirect issues

### Airtable Duplicate Detection

Create the following Airtable automations:

1. **Slug uniqueness**: When `slug` is set, check across both ES and PT bases. Alert if duplicate found.
2. **Title similarity**: When `seo_title` is set, alert if another record has a title with >80% character overlap.
3. **URL integrity**: Weekly check that all `canonical_url` values return HTTP 200.

### Content Audit Schedule

- **Monthly**: Review the last 15 published articles for inter-article similarity
- **Quarterly**: Run all published articles through a plagiarism checker against source URLs
- **Bi-annually**: Full SEO audit of all canonical URLs (indexing, ranking, backlinks)

---

## Ethical Notes on Source Content

- The raw scraped content from arteviajero.com is stored for **editorial reference only**
- It is NEVER published, republished, or used verbatim in any Lucas Lunes output
- The research dossier synthesizes and restructures information with new analysis
- The narrative article is a fully original literary creation
- This approach respects the intellectual property of the source while building original editorial value
- The scraper identifies itself via User-Agent and respects robots.txt
