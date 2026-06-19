# Case Retrieval Guide

## When to Read
When the user asks for reference illustrations, similar paper figures, or style examples for a research topic. Also trigger when the Plan Agent needs visual references before drafting the layout.

## Overview
The case retriever searches arXiv and paper databases for similar-topic papers and extracts their method flowcharts, architecture diagrams, and experimental result figures as visual references. It outputs style tags (palette, archetype, layout) alongside reference image URLs.

## Workflow

### Step 1: Query Construction
- Input: user topic (e.g., "diffusion model for protein folding")
- Expand query with synonyms from `search-api-guide.md`
- Target: title + abstract search on arXiv

### Step 2: Paper Filtering
- Filter by year (last 3 years preferred)
- Filter by venue (NeurIPS, ICML, ICLR, CVPR, ICCV, ECCV, Nature, Cell, Science)
- Priority: papers with PDF-accessible figures

### Step 3: Figure Extraction
- Download PDF and extract page images
- Detect figure captions via regex ("Fig.", "Figure", "Fig ")
- Classify each figure by archetype:
  - `workflow` — method pipeline, data flow
  - `mechanism` — biological/chemical/physical process
  - `statistical` — bar/line/scatter plots with data
  - `schematic` — architecture diagrams, network structures

### Step 4: Style Tagging
For each reference figure, output:
```json
{
  "paper_id": "arXiv:2401.12345",
  "venue": "NeurIPS 2024",
  "figure_number": 2,
  "archetype": "workflow",
  "dominant_colors": ["#2878B5", "#C82423"],
  "layout_type": "horizontal-flow",
  "font_style": "Helvetica, sans-serif",
  "notable_features": ["rounded-rect nodes", "color-coded stages", "minimal text"]
}
```

### Step 5: Ranking
- Rank by citation count (OpenAlex)
- Rank by venue tier (Nature > NeurIPS > ICML > ...)
- Return top-3 references per archetype

## Output Format
```json
{
  "query": "diffusion model protein folding",
  "references": [
    {
      "paper_id": "...",
      "venue": "NeurIPS 2024",
      "figures": [
        {"number": 2, "archetype": "workflow", "url": "...", "tags": [...]}
      ]
    }
  ],
  "recommended_palette": "nature",
  "recommended_archetype": "workflow"
}
```

## Integration with Pipeline
The Plan Agent consumes this output as `references` field in the structured spec S before generating the layout.

## Constraints
- Only use open-access papers (arXiv, bioRxiv, OpenReview)
- Do not redistribute copyrighted figures; provide URLs only
- Respect rate limits on arXiv API (3 seconds between requests)
