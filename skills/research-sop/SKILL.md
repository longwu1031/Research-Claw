---
name: Research SOP
description: Standard operating procedure for academic research tasks. Defines methodology, quality gates, and output standards for all research activities.
metadata: { "openclaw": { "always": true } }
---

# Research Standard Operating Procedure

This SOP applies to all research tasks. Follow these procedures to ensure
consistent quality and methodological rigor.

## Literature Search Protocol

When searching for papers on any topic:

1. **Define scope first.** Before searching, state the search intent: exploratory
   (broad survey), targeted (specific question), or exhaustive (systematic review).
2. **Use structured queries.** Construct search queries with:
   - Primary keywords (the core concept)
   - Secondary keywords (methodological or domain constraints)
   - Exclusion terms (what to filter out)
3. **Search multiple databases.** Never rely on a single database. At minimum:
   - Semantic Scholar (for citation graphs)
   - One domain-specific database (arXiv for CS/physics, PubMed for bio/med)
4. **Apply recency bias thoughtfully.** Default to last 5 years for active fields.
   Extend to 10+ years for foundational or historical work.
5. **Deduplicate results.** Check DOIs before adding papers to avoid duplicates.

## Paper Evaluation Criteria

When assessing a paper's quality and relevance:

- **Venue quality:** Is it published in a reputable journal/conference?
- **Citation count:** Adjusted for publication age (citations per year).
- **Methodology:** Is the approach sound? Sample size adequate? Controls present?
- **Reproducibility:** Are methods described in sufficient detail?
- **Relevance:** Does it directly address the user's research question?

Rate each paper: **high**, **medium**, or **low** relevance. Only add **high**
and **medium** papers to the library unless the user requests otherwise.

## Citation Integrity Rules

1. Every cited paper must exist in the local library or be verifiable via DOI.
2. Cite the primary source, not a secondary reference, unless the primary is
   genuinely inaccessible.
3. When paraphrasing, cite the source. When quoting, use quotation marks and
   provide page numbers if available.
4. If asked to add a citation and you cannot verify the paper exists, say so.
   Do not approximate or guess.

## Writing Quality Standards

When drafting or editing academic text:

1. **Clarity:** Prefer active voice. One idea per sentence. Define acronyms on
   first use.
2. **Precision:** Use exact numbers, not "many" or "several." Specify units.
3. **Structure:** Follow the IMRaD structure (Introduction, Methods, Results,
   Discussion) unless the user specifies otherwise.
4. **Tone:** Academic third person by default. First person plural ("we") for
   multi-author papers. Adjust per user preference.
5. **Transitions:** Each paragraph should logically flow from the previous one.
   Use signpost phrases ("However," "In contrast," "Building on this,").

## Tool vs. Skill Priority

When a user request could be handled by either a local tool or a research skill:

1. **Local tools first.** If a local tool (library_*, task_*, workspace_*, radar_*)
   can fulfill the request, use it directly. Tools execute actions; skills provide
   methodology guidance.
2. **Skills for methodology.** Route to skills when the user needs a workflow, best
   practice, or domain-specific guidance that no tool provides.
3. **Combine when needed.** A single request may need both a tool (for execution)
   and a skill (for methodology). Use both.

## Cross-Category Research Patterns

Common requests span multiple skill categories. Use these combinations:

| User intent | Skill combination |
|:-----------|:-----------------|
| Literature review | literature/search + writing/composition |
| Data analysis report | analysis/statistics + analysis/dataviz |
| Submission preparation | writing/templates + writing/latex + writing/citation |
| Systematic review | research/deep-research + research/methodology |
| Entering a new field | domains/{field} |
| Grant writing | research/funding + writing/composition |

## Error Handling

When a tool call fails or returns unexpected results:

1. Report the error clearly to the user.
2. Suggest an alternative approach if available.
3. Do not retry more than twice without user input.
4. Log the error context for debugging.

## Session Closing

At the end of a productive session:

1. Offer to generate a `progress_card` summarizing the session.
2. Ask if any findings should be persisted to MEMORY.md.
3. Remind the user of upcoming deadlines if any exist within 48 hours.
