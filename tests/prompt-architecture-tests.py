#!/usr/bin/env python3
"""
Research-Claw Prompt Architecture Test Suite
Following DEVELOPMENT_SOP.md testing pyramid methodology

Layer 0: Protocol / Reference Verification (OpenClaw source-verified)
Layer 1: Behavioral Parity — Skill Category paths
Layer 2: Cross-Reference Consistency
Layer 3: Content Completeness & Regression
Layer 4: Prompt Budget Verification
Layer 5: Config Verification
"""

import json
import os
import re
import sys
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

RC = Path(__file__).resolve().parent.parent
SKILLS_DIR = RC / "skills"
WORKSPACE = RC / "workspace"
CONFIG_FILE = RC / "config" / "openclaw.json"
RP = Path.home() / ".openclaw" / "extensions" / "research-plugins"

# ── Test framework ───────────────────────────────────────────────────────────

PASS = FAIL = WARN = 0
RESULTS = []


def p(msg):
    global PASS
    PASS += 1
    RESULTS.append(f"  [PASS] {msg}")


def f(msg):
    global FAIL
    FAIL += 1
    RESULTS.append(f"  [FAIL] {msg}")


def w(msg):
    global WARN
    WARN += 1
    RESULTS.append(f"  [WARN] {msg}")


def section(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


# ── Helpers ──────────────────────────────────────────────────────────────────

def read_file(path):
    return Path(path).read_text(encoding="utf-8")


def load_config():
    return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))


# ═══════════════════════════════════════════════════════════════════════════════
# Layer 0: Protocol / Reference Verification
# ═══════════════════════════════════════════════════════════════════════════════

section("Layer 0: Protocol / Reference Verification")

# T0.1: Skill discovery — direct subdirectory scanning
# Reference: openclaw/src/agents/skills/workspace.ts:380-395
print("T0.1: Skill discovery — direct subdirectory scanning")

discoverable = []
for d in sorted(SKILLS_DIR.iterdir()):
    if not d.is_dir():
        continue
    if d.name.startswith(".") or d.name == "node_modules":
        continue
    skill_md = d / "SKILL.md"
    if skill_md.exists():
        discoverable.append(d.name)
        print(f"  Found: {d.name}/SKILL.md")
    else:
        print(f"  Skip:  {d.name}/ (no SKILL.md)")

expected_skills = {"research-sop", "wentor-api"}
if set(discoverable) == expected_skills:
    p("T0.1: All 2 skills discoverable")
else:
    f(f"T0.1: Expected {expected_skills}, found {set(discoverable)}")

# T0.1b: _always/ must not exist
if (SKILLS_DIR / "_always").exists():
    f("T0.1b: _always/ directory still exists (blocks discovery)")
else:
    p("T0.1b: _always/ directory removed")

# T0.2: SKILL.md frontmatter format validation
# Reference: openclaw/src/agents/skills/frontmatter.ts:186-206
# Reference: openclaw/src/shared/frontmatter.ts:34-60
# OpenClaw canonical: metadata: { "openclaw": { "always": true } }
# Top-level always: true is silently IGNORED
print("\nT0.2: SKILL.md frontmatter format validation")

for skill in ["research-sop", "wentor-api"]:
    content = read_file(SKILLS_DIR / skill / "SKILL.md")
    lines = content.split("\n")

    # Extract frontmatter
    if lines[0].strip() == "---":
        end = next(i for i, l in enumerate(lines[1:], 1) if l.strip() == "---")
        fm_lines = lines[1:end]
    else:
        f(f"T0.2: {skill} — no YAML frontmatter found")
        continue

    fm_text = "\n".join(fm_lines)

    # Check required fields
    if re.search(r"^name:", fm_text, re.MULTILINE):
        p(f"T0.2a: {skill} has 'name' field")
    else:
        f(f"T0.2a: {skill} missing 'name' field (REQUIRED by OpenClaw)")

    if re.search(r"^description:", fm_text, re.MULTILINE):
        p(f"T0.2b: {skill} has 'description' field")
    else:
        f(f"T0.2b: {skill} missing 'description' field (REQUIRED by OpenClaw)")

    # Check for incorrect top-level 'always' field
    has_toplevel_always = bool(re.search(r"^always:", fm_text, re.MULTILINE))
    has_metadata_block = bool(re.search(r"^metadata:", fm_text, re.MULTILINE))

    if has_toplevel_always and not has_metadata_block:
        w(f"T0.2c: {skill} — top-level 'always: true' is IGNORED by OpenClaw. "
          f"Canonical format: metadata: {{ \"openclaw\": {{ \"always\": true }} }}. "
          f"No runtime impact (skill has no requires).")
    elif has_toplevel_always and has_metadata_block:
        w(f"T0.2c: {skill} — has both top-level 'always' AND metadata block (redundant)")
    else:
        p(f"T0.2c: {skill} — frontmatter format OK")

    # Check for unrecognized top-level fields
    recognized = {"name", "description", "homepage", "user-invocable",
                  "disable-model-invocation", "command-dispatch",
                  "command-tool", "command-arg-mode", "metadata"}
    for line in fm_lines:
        m = re.match(r"^([a-z][a-z0-9_-]*)\s*:", line)
        if m and m.group(1) not in recognized:
            w(f"T0.2d: {skill} — unrecognized top-level field '{m.group(1)}' "
              f"(silently ignored by OpenClaw)")

# T0.3: SKILL.md file size
# Reference: workspace.ts DEFAULT_MAX_SKILL_FILE_BYTES = 256_000
print("\nT0.3: SKILL.md file size limits (< 256KB)")

for skill in ["research-sop", "wentor-api"]:
    size = (SKILLS_DIR / skill / "SKILL.md").stat().st_size
    if size < 256_000:
        p(f"T0.3: {skill} = {size:,} bytes (OK)")
    else:
        f(f"T0.3: {skill} = {size:,} bytes (EXCEEDS 256KB)")

# T0.4: Total skill count under prompt limit (150)
print("\nT0.4: Skill count under prompt limit")
builtin = 52
total = builtin + len(discoverable)
if total <= 150:
    p(f"T0.4: Total skills = {total} ({builtin} built-in + {len(discoverable)} local) < 150")
else:
    f(f"T0.4: Total skills = {total} EXCEEDS 150 limit")


# ═══════════════════════════════════════════════════════════════════════════════
# Layer 1: Behavioral Parity — Skill Categories
# ═══════════════════════════════════════════════════════════════════════════════

section("Layer 1: Behavioral Parity — Skill Category Paths")

# T1.1: Category directories exist in research-plugins
print("T1.1: Skill categories match research-plugins structure")

expected_cats = ["literature", "analysis", "writing", "research", "domains", "tools"]

for cat in expected_cats:
    catalog = RP / "curated" / cat / "README.md"
    skills_dir = RP / "skills" / cat
    if catalog.exists():
        p(f"T1.1a: curated/{cat}/README.md exists")
    else:
        f(f"T1.1a: curated/{cat}/README.md MISSING")
    if skills_dir.is_dir():
        p(f"T1.1b: skills/{cat}/ exists")
    else:
        f(f"T1.1b: skills/{cat}/ MISSING")

# T1.2: Subcategory directories exist
print("\nT1.2: Subcategory verification")

expected_subcats = {
    "literature": ["search", "discovery", "metadata", "fulltext"],
    "analysis": ["statistics", "econometrics", "dataviz", "wrangling"],
    "writing": ["composition", "citation", "latex", "polish", "templates"],
    "research": ["methodology", "deep-research", "paper-review", "automation", "funding"],
    "tools": ["diagram", "document", "code-exec", "knowledge-graph", "ocr-translate", "scraping"],
}

for cat, subcats in expected_subcats.items():
    for sub in subcats:
        if (RP / "skills" / cat / sub).is_dir():
            p(f"T1.2: {cat}/{sub}/ exists")
        else:
            f(f"T1.2: {cat}/{sub}/ MISSING")

# T1.3: Skill counts by category
print("\nT1.3: Skill count by category")

expected_counts = {
    "literature": 89, "analysis": 57, "writing": 68,
    "research": 70, "domains": 143, "tools": 61,
}

total_actual = 0
for cat in expected_cats:
    actual = len(list((RP / "skills" / cat).rglob("SKILL.md"))) if (RP / "skills" / cat).exists() else 0
    total_actual += actual
    expected = expected_counts[cat]
    if actual == expected:
        p(f"T1.3: {cat} = {actual} (expected {expected})")
    else:
        w(f"T1.3: {cat} = {actual} (expected {expected}, delta: {actual - expected})")

if total_actual == 431:
    p(f"T1.3: Total = {total_actual} (expected 431)")
else:
    w(f"T1.3: Total = {total_actual} (expected 431, delta: {total_actual - 431})")


# ═══════════════════════════════════════════════════════════════════════════════
# Layer 2: Cross-Reference Consistency
# ═══════════════════════════════════════════════════════════════════════════════

section("Layer 2: Cross-Reference Consistency")

config = load_config()
config_tools = set(config["tools"]["alsoAllow"])
agents_md = read_file(WORKSPACE / "AGENTS.md")
tools_md = read_file(WORKSPACE / "TOOLS.md")

# T2.1: AGENTS.md trigger table tool names vs config
print("T2.1: AGENTS.md trigger table tool names vs config")

agents_tool_refs = [
    "search_papers", "search_arxiv",
    "library_add_paper", "library_batch_add", "library_tag_paper",
    "library_manage_collection", "library_export_bibtex",
    "workspace_save",
    "task_create", "task_list",
    "radar_configure", "radar_scan",
]

for tool in agents_tool_refs:
    if tool in config_tools:
        p(f"T2.1: {tool} in config")
    else:
        f(f"T2.1: {tool} NOT in config")

# T2.2: TOOLS.md tool names vs config (full bidirectional check)
print("\nT2.2: TOOLS.md ↔ config bidirectional tool check")

# Extract all backtick-quoted tool names from TOOLS.md
tools_documented = set()
for m in re.finditer(r"`([a-z][a-z_]+)`", tools_md):
    name = m.group(1)
    if re.match(r"^(library_|task_|workspace_|radar_|search_|get_|find_|resolve_)", name):
        tools_documented.add(name)

# Bidirectional check
missing_from_config = tools_documented - config_tools
missing_from_docs = config_tools - tools_documented

for tool in sorted(missing_from_config):
    f(f"T2.2: {tool} documented but NOT in config")
for tool in sorted(missing_from_docs):
    f(f"T2.2: {tool} in config but NOT documented in TOOLS.md")

if not missing_from_config and not missing_from_docs:
    p(f"T2.2: Perfect match — {len(config_tools)} tools in both config and TOOLS.md")

# T2.3: (Removed — skill-router was deleted; skills now auto-loaded via subcategory indexes)

# T2.4: Module tool counts consistency
print("\nT2.4: Module tool counts AGENTS.md vs TOOLS.md")

agents_counts = {}
for m in re.finditer(r"(Library|Tasks|Workspace|Radar)\s+\((\d+) tools?\)", agents_md):
    agents_counts[m.group(1)] = int(m.group(2))

# Count only table rows (lines starting with |) to avoid double-counting
# tools mentioned in prose paragraphs
table_lines = [l for l in tools_md.split("\n") if l.startswith("| `")]
tools_counts = {
    "Library": len([l for l in table_lines if "`library_" in l]),
    "Tasks": len([l for l in table_lines if "`task_" in l]),
    "Workspace": len([l for l in table_lines if "`workspace_" in l]),
    "Radar": len([l for l in table_lines if "`radar_" in l]),
}

for module in ["Library", "Tasks", "Workspace", "Radar"]:
    a = agents_counts.get(module, "?")
    t = tools_counts.get(module, "?")
    if a == t:
        p(f"T2.4: {module} = {a} in both files")
    else:
        f(f"T2.4: {module} count mismatch: AGENTS={a}, TOOLS={t}")


# ═══════════════════════════════════════════════════════════════════════════════
# Layer 3: Content Completeness & Regression
# ═══════════════════════════════════════════════════════════════════════════════

section("Layer 3: Content Completeness & Regression")

# T3.1: Red Lines preserved
print("T3.1: Red Lines preservation")

red_lines = [
    "fabricated citations", "unauthorized submissions", "data fabrication",
    "plagiarism", "silent failures", "invented DOIs",
]
for line in red_lines:
    if line.lower() in agents_md.lower():
        p(f"T3.1: Red Line '{line}' present")
    else:
        f(f"T3.1: Red Line '{line}' MISSING")

# T3.2: Output card types preserved
print("\nT3.2: Output card types preserved")

cards = ["paper_card", "task_card", "progress_card", "approval_card", "radar_digest", "file_card"]
for card in cards:
    if card in agents_md:
        p(f"T3.2: {card} defined")
    else:
        f(f"T3.2: {card} MISSING")

# T3.3: Research workflow phases preserved
print("\nT3.3: Research workflow phases preserved")

phases = {
    "Phase 1": "Literature Review",
    "Phase 2": "Deep Reading",
    "Phase 3": "Analysis and Writing",
    "Phase 4": "Task Management",
}
for phase, title in phases.items():
    if phase in agents_md and title in agents_md:
        p(f"T3.3: {phase} — {title}")
    else:
        f(f"T3.3: {phase} — {title} MISSING")

# T3.4: New architecture features present
print("\nT3.4: New architecture features present")

new_features = [
    "Module Map", "Tool Priority", "Skill Routing",
    "Cross-Module Handoff", "Tool Feedback", "Trigger Word Table",
    "decision tree",
]
for feat in new_features:
    if feat.lower() in agents_md.lower():
        p(f"T3.4: '{feat}' present")
    else:
        f(f"T3.4: '{feat}' MISSING")

# T3.5: Removed content should NOT be present
print("\nT3.5: Removed content absence check")

removed = [
    "Discipline-Specific Workflows",
    "Humanities and Social Sciences",
    "Natural Sciences",
    "Engineering, Mathematics, and Physics",
    "Long Sequential Tasks",
    "Information Gathering Priority",
]
for pattern in removed:
    if pattern in agents_md:
        f(f"T3.5: Removed content still present: '{pattern}'")
    else:
        p(f"T3.5: '{pattern}' correctly removed")

# T3.6: Session Startup preserved
print("\nT3.6: Session Startup preserved")

startup_checks = ["MEMORY.md", "48 hours", "BOOTSTRAP.md", "citation style"]
for check in startup_checks:
    if check in agents_md:
        p(f"T3.6: Startup check '{check}' present")
    else:
        f(f"T3.6: Startup check '{check}' MISSING")

# T3.7: Human-in-Loop Protocol preserved
print("\nT3.7: Human-in-Loop Protocol preserved")

hil_checks = ["approval_card", "Deleting files", "explicit approval", "autonomous"]
for check in hil_checks:
    if check.lower() in agents_md.lower():
        p(f"T3.7: HiL check '{check}' present")
    else:
        f(f"T3.7: HiL check '{check}' MISSING")


# ═══════════════════════════════════════════════════════════════════════════════
# Layer 4: Prompt Budget Verification
# ═══════════════════════════════════════════════════════════════════════════════

section("Layer 4: Prompt Budget Verification")

print("T4.1: Bootstrap file sizes")

total_bytes = 0
bootstrap_files = [
    "SOUL.md", "AGENTS.md", "TOOLS.md", "BOOTSTRAP.md",
    "HEARTBEAT.md", "IDENTITY.md", "USER.md", "MEMORY.md",
]

for fname in bootstrap_files:
    fpath = WORKSPACE / fname
    if fpath.exists():
        size = fpath.stat().st_size
        total_bytes += size
        print(f"  {fname}: {size:,} bytes")

for skill in ["research-sop", "wentor-api"]:
    fpath = SKILLS_DIR / skill / "SKILL.md"
    size = fpath.stat().st_size
    total_bytes += size
    print(f"  skills/{skill}/SKILL.md: {size:,} bytes")

print(f"  {'─' * 40}")
print(f"  Total: {total_bytes:,} bytes")

budget = 150_000
if total_bytes < budget:
    pct = total_bytes * 100 // budget
    p(f"T4.1: Total = {total_bytes:,} bytes ({pct}% of {budget:,} budget)")
else:
    f(f"T4.1: Total = {total_bytes:,} bytes EXCEEDS {budget:,} budget")

# T4.2: Size reduction
print("\nT4.2: Size reduction from previous version")

agents_size = (WORKSPACE / "AGENTS.md").stat().st_size
tools_size = (WORKSPACE / "TOOLS.md").stat().st_size

old_agents = 17_396
old_tools = 5_816

if agents_size < old_agents:
    red = (old_agents - agents_size) * 100 // old_agents
    p(f"T4.2a: AGENTS.md {old_agents:,} → {agents_size:,} bytes (-{red}%)")
else:
    f(f"T4.2a: AGENTS.md grew from {old_agents:,} to {agents_size:,}")

if tools_size < old_tools:
    red = (old_tools - tools_size) * 100 // old_tools
    p(f"T4.2b: TOOLS.md {old_tools:,} → {tools_size:,} bytes (-{red}%)")
else:
    f(f"T4.2b: TOOLS.md grew from {old_tools:,} to {tools_size:,}")


# ═══════════════════════════════════════════════════════════════════════════════
# Layer 5: Config Verification
# ═══════════════════════════════════════════════════════════════════════════════

section("Layer 5: Config Verification")

# T5.1: extraDirs includes ./skills
print("T5.1: skills.load.extraDirs config")

extra_dirs = config.get("skills", {}).get("load", {}).get("extraDirs", [])
if "./skills" in extra_dirs:
    p("T5.1: extraDirs includes './skills'")
else:
    f("T5.1: extraDirs does NOT include './skills' — local skills may not be scanned")

# T5.2: tools.alsoAllow count matches documentation
print("\nT5.2: tools.alsoAllow count")

allow_count = len(config["tools"]["alsoAllow"])
if allow_count == 40:
    p(f"T5.2: alsoAllow has {allow_count} tools (27 local + 13 API)")
else:
    f(f"T5.2: alsoAllow has {allow_count} tools (expected 40)")


# ═══════════════════════════════════════════════════════════════════════════════
# Results Summary
# ═══════════════════════════════════════════════════════════════════════════════

section("RESULTS SUMMARY")

for r in RESULTS:
    print(r)

print(f"\n{'─' * 40}")
print(f"  PASS: {PASS}")
print(f"  WARN: {WARN}")
print(f"  FAIL: {FAIL}")
print(f"{'─' * 40}")

if FAIL > 0:
    print("  STATUS: SOME TESTS FAILED — see [FAIL] items above")
    sys.exit(1)
else:
    print("  STATUS: ALL TESTS PASSED")
    sys.exit(0)
