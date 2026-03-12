---
file: HEARTBEAT.md
version: 2.0
updated: 2026-03-12
---

# Heartbeat -- Periodic Research Check

You are running in **heartbeat mode**. This is an automated check, not an
interactive session. Be brief. Produce structured JSON output only.

**Language**: Write `highlights` text in the user's preferred language (check
USER.md or previous conversation history). Default to Chinese if the user
communicates in Chinese. Keep tag prefixes like `[URGENT]` and `[APPROACHING]`
in English for machine-parsability; everything else should follow user language.

## Routine

Execute these checks in order. Skip any check that has no actionable results.
Output a single `progress_card` in JSON format summarizing all findings.

### 1. Deadline Check [configurable: window = 48 hours]

- Query `task_list` for tasks with deadlines within the configured window.
- For each upcoming task:
  - If deadline is within 24 hours: label as **URGENT**.
  - If deadline is within 48 hours: label as **APPROACHING**.
- If no tasks have upcoming deadlines, skip this section.

### 2. Group Meeting Prep Check

- Read USER.md for group meeting schedule.
- If a group meeting falls within the next 7 days:
  - Note it in the progress_card highlights.
  - If within 2 days: flag as needing preparation.
  - Check if a prep document already exists in workspace.

### 3. Daily Digest [configurable: frequency = once per day, time = 09:00]

Generate this section only if the current time matches the configured digest
schedule (default: first heartbeat after 09:00 local time each day).

- Papers read since last digest
- Tasks completed since last digest
- Tasks created since last digest
- Upcoming deadlines in the next 7 days

### 4. Reading Reminders [configurable: stale_threshold = 7 days]

- Query `library_search` for papers with status "reading" and no activity
  for longer than the stale threshold.
- For each stale paper, note it in highlights.

### 5. Quiet Hours [configurable: start = 23:00, end = 08:00]

- If the current local time falls within quiet hours, suppress all output
  except **URGENT** deadline alerts.
- During quiet hours, do not generate daily digest or reading reminders.

## Output Format

Produce exactly one `progress_card` in valid JSON format:

```progress_card
{"type":"progress_card","period":"heartbeat","papers_read":0,"papers_added":0,"tasks_completed":0,"tasks_created":0,"highlights":["[URGENT] Submit grant proposal -- due in 6 hours","[APPROACHING] Review draft Chapter 3 -- due in 36 hours","Stale reading: Attention Is All You Need -- 12 days no activity","Group meeting in 3 days -- prep document not yet created"]}
```

If there are no alerts, reminders, or digest items, output:

```progress_card
{"type":"progress_card","period":"heartbeat","papers_read":0,"papers_added":0,"tasks_completed":0,"tasks_created":0,"highlights":["All clear -- no pending alerts"]}
```

## Configuration

All configurable values are set in `openclaw.json` under
`plugins.entries.research-claw-core.config`:

| Parameter | Config Key | Default | Description |
|:---|:---|:---|:---|
| Deadline window | `heartbeatDeadlineWarningHours` | 48 | Hours before deadline to start alerting |
| Digest frequency | `heartbeatDigestFrequency` | `"daily"` | `"daily"` or `"never"` |
| Digest time | `heartbeatDigestTime` | `"09:00"` | Local time for daily digest |
| Stale threshold | `heartbeatStaleReadingDays` | 7 | Days before a "reading" paper is flagged |
| Quiet start | `heartbeatQuietStart` | `"23:00"` | Start of quiet hours (local time) |
| Quiet end | `heartbeatQuietEnd` | `"08:00"` | End of quiet hours (local time) |
