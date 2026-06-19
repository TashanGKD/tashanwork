# Citation & Reference Management Guide

## Purpose

Ensure reference collection, formatting, and export meet Nature-family journal standards. Covers in-text citation style, reference list formatting, and export to common bibliography formats.

## Nature Citation Style

### In-text citations

- **Numbered references**: `[1]`, `[2,3]`, `[4-6]`.
- Citation numbers appear after punctuation: "...as shown previously.[1]"
- First mention of a paper: cite by number, not by author name in the sentence.

### Reference list format

Each entry must include:

1. Authors (surname + initials; all authors for <6 authors; first author + "et al." for >=6).
2. Article title (sentence case, no quotes).
3. Journal name (italic, abbreviated per ISO 4).
4. Year (bold).
5. Volume (bold).
6. Page range or article number.
7. DOI (preferred) or URL.

Example:
```
1. Smith, J. A. & Jones, B. C. Deep learning for protein structure prediction. Nature 596, 583–589 (2021). https://doi.org/10.1038/s41586-021-03819-2
```

## Citation Completeness Rules

- Every claim that is not original must have a citation.
- Every figure that reproduces or adapts prior work must cite the source.
- Methods sections: cite original papers for algorithms, software, and datasets.
- No placeholder citations ("[citation needed]" in final manuscript).
- Verify that all cited references appear in the reference list and vice versa.

## Export Formats

When generating reference lists for export:

| Format | Extension | Use case |
|--------|-----------|----------|
| BibTeX | .bib | LaTeX manuscripts |
| EndNote | .enw | Word + EndNote workflow |
| RIS | .ris | Zotero, Mendeley, RefWorks |
| Zotero RDF | .rdf | Zotero library import |

## Reference Verification Checklist

- [ ] All in-text citations have matching entries in the reference list.
- [ ] All reference list entries have matching in-text citations.
- [ ] DOIs are present and resolvable.
- [ ] Author lists are complete or correctly abbreviated (et al. for >=6).
- [ ] Journal names are italicized and abbreviated per ISO 4.
- [ ] Years and volumes are bold.
- [ ] URLs use https://doi.org/ format where possible.
- [ ] No broken links (spot-check 10% of references).

## Common Errors

| Error | Fix |
|-------|-----|
| "et al." in reference list for <6 authors | List all authors |
| Missing DOI | Query CrossRef or the publisher site |
| Journal name not italicized | Apply italic formatting |
| Conference paper without proceedings | Add conference name and location |
| Preprint without version | Add arXiv ID with version, e.g., arXiv:2301.00001v2 |
