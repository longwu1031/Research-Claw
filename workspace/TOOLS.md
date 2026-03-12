---
file: TOOLS.md
version: 2.0
updated: 2026-03-12
---

# Tool Reference

## Paper Database APIs

These external APIs are available for literature search. Use multiple databases
for comprehensive coverage. Prefer Semantic Scholar for citation graphs and
arXiv for preprints.

| API | Coverage | Best For | Rate Limits |
|:---|:---|:---|:---|
| **Semantic Scholar** | 200M+ papers | Citation graphs, recommendations | 100 req/5min |
| **arXiv** | CS, physics, math, bio preprints | Latest preprints, full-text | 3 req/sec |
| **OpenAlex** | 250M+ works | Broad coverage, institutions | 10 req/sec |
| **CrossRef** | 130M+ DOIs | DOI resolution, metadata | 50 req/sec (polite) |
| **PubMed / NCBI** | Biomedical literature | Medical, life sciences | 3 req/sec |
| **Unpaywall** | OA availability for DOIs | Legal open-access full text | 100K/day |

## Local Library Tools (12 tools)

Provided by the `research-claw-core` plugin. Data stored in
`.research-claw/library.db` (SQLite).

| Tool | Purpose | Example |
|:---|:---|:---|
| `library_add_paper` | Add a paper to local library | Provide DOI, title, or BibTeX |
| `library_search` | Search library by keyword (full-text across title, abstract, authors) | `library_search(query="attention", limit=20)` |
| `library_update_paper` | Update paper metadata, status, annotations | Change status to "read", add notes |
| `library_get_paper` | Retrieve full details of a specific paper | By DOI or internal ID |
| `library_export_bibtex` | Export library or subset as BibTeX | Filter by tag, project, or list |
| `library_reading_stats` | Reading activity summary | Papers read this week, total count |
| `library_batch_add` | Batch import multiple papers at once | Provide array of DOIs or metadata objects |
| `library_manage_collection` | Create, update, or delete paper collections | `library_manage_collection(action="create", name="Survey Papers")` |
| `library_tag_paper` | Add or remove a tag on a paper | `library_tag_paper(paper_id="...", tag_name="ml", action="add")` |
| `library_add_note` | Add an annotation note to a paper | `library_add_note(paper_id="...", note_text="Key insight on p.5", page=5)` |
| `library_import_bibtex` | Import papers from BibTeX content | `library_import_bibtex(bibtex_content="@article{...}")` |
| `library_citation_graph` | Query citation relationships between papers | `library_citation_graph(paper_id="...", direction="both", depth=1)` |

## Task Management Tools (6 tools)

| Tool | Purpose | Example |
|:---|:---|:---|
| `task_create` | Create a new task with optional deadline | `task_create(title="Review Ch.3", deadline="2026-03-15", task_type="human")` |
| `task_list` | List tasks, filter by status/priority/deadline | `task_list(status="todo", priority="high")` |
| `task_complete` | Mark a task as complete | `task_complete(id="t-001")` |
| `task_update` | Update task details (title, deadline, priority, status) | `task_update(id="t-001", priority="urgent")` |
| `task_link` | Link a task to a paper in the library | `task_link(task_id="t-001", paper_id="p-001")` |
| `task_note` | Add a timestamped note to a task | `task_note(task_id="t-001", note="Methodology looks solid")` |

## Workspace Tools (6 tools)

For managing files in the research workspace.

| Tool | Purpose | Example |
|:---|:---|:---|
| `workspace_save` | Save content to a workspace file (returns file_card — include it verbatim) | `workspace_save(path="notes/ch3.md", content="...")` |
| `workspace_read` | Read a workspace file | `workspace_read(path="notes/ch3.md")` |
| `workspace_list` | List files in workspace directory | `workspace_list(directory="notes/", recursive=true)` |
| `workspace_diff` | Show changes to a file since last commit | `workspace_diff(path="notes/ch3.md")` |
| `workspace_history` | Show file edit history | `workspace_history(path="notes/ch3.md")` |
| `workspace_restore` | Restore a previous version of a file | `workspace_restore(path="notes/ch3.md", commit_hash="abc1234")` |

## Research Radar Tools (3 tools)

For configuring and scanning with the research radar. Config is persisted in
`.research-claw/library.db` and displayed on the dashboard Radar panel.

| Tool | Purpose | Example |
|:---|:---|:---|
| `radar_configure` | Set tracking keywords, authors, journals, sources | `radar_configure(keywords=["transformer", "LLM"], authors=["Vaswani"])` |
| `radar_get_config` | Read current radar configuration | `radar_get_config()` |
| `radar_scan` | Scan arXiv/Semantic Scholar for new papers matching config | `radar_scan()` or `radar_scan(sources=["arxiv"], max_results=10)` |

**Important:** When the user asks to configure/update their research radar, you
MUST use the `radar_configure` tool to persist the settings. Do NOT just output
text — the dashboard reads from the database, not from chat history.

**Important:** When the user asks to check for new papers or scan their radar,
you MUST use the `radar_scan` tool. Papers are returned but NOT auto-added to
the library — use `library_add_paper` or `library_batch_add` to save interesting ones.

## Tool Count Summary

Total: **27 tools** (12 library + 6 task + 6 workspace + 3 radar), all registered in
`openclaw.json` under `tools.alsoAllow`.

## Citation and Export

- **Supported citation styles:** APA, MLA, Chicago, IEEE, Vancouver, Harvard,
  Nature, ACM, ACS, custom CSL
- **Export formats:** BibTeX (.bib), RIS (.ris), CSV (.csv), JSON, Markdown
- **Import formats:** PDF, BibTeX (.bib), RIS (.ris), CSV, DOI list

## Configuration

Citation style is configured in `openclaw.json` at
`plugins.entries.research-claw-core.config.defaultCitationStyle`.

Tool availability depends on the `tools.profile` setting:
- `"full"` -- All built-in tools + research tools (default)
- `"minimal"` -- Built-in tools only, no research-specific tools
