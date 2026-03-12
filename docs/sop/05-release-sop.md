# S5 — Release SOP Checklist

> Pre-push and release verification for Research-Claw.
> Run through this checklist before every `git push` or version tag.

---

## 1. Security Audit

- [ ] **No secrets in tracked files**: Run `git diff --cached` and verify no API keys, tokens, or passwords are staged
  - Watch for: `config/openclaw.json`, `.env`, `.env.local`, `.env.production`
  - All should be in `.gitignore`
- [ ] **Check git history**: `git log --diff-filter=A --name-only` — verify no secrets were ever committed
  - If found: rotate the key immediately, then `git filter-branch` or BFG to remove
- [ ] **`.gitignore` coverage**: Verify these patterns are present:
  - `config/openclaw.json` (runtime config with API keys)
  - `.env`, `.env.local`, `.env.production`
  - `*.sqlite`, `*.db`, `.research-claw/`
  - `*.tsbuildinfo`, `*.d.ts.map`
  - `node_modules/`, `dist/`, `dashboard/dist/`
  - `extensions/*/package-lock.json`

## 2. Build & Type Check

- [ ] **TypeScript zero errors**: `cd dashboard && npx tsc --noEmit` — must exit 0
- [ ] **Dashboard build**: `pnpm --filter dashboard build` — must succeed
  - Check bundle size: main chunk < 200KB gzip
- [ ] **Extension type check**: `cd extensions/research-claw-core && npx tsc --noEmit`

## 3. Test Suite

- [ ] **Dashboard tests**: `cd dashboard && npx vitest run` — all tests pass
- [ ] **Root tests**: `pnpm test` — all tests pass (if configured)
- [ ] **No `.only` or `.skip`**: `grep -r '\.only\|\.skip' dashboard/src --include='*.test.*'` — should be empty

## 4. Port Consistency

Research-Claw uses dedicated ports to avoid overlap with OpenClaw defaults:

| Service | Port | OpenClaw Default |
|---------|------|------------------|
| Gateway WS RPC | **28789** | 18789 |
| Vite dev server | **5175** | 5174 |
| OAuth callback | **19876** | N/A |

- [ ] **No OpenClaw default ports**: `grep -r '18789' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.sh' --include='*.mjs' .` — only allowed in comments explaining the old default
- [ ] **Consistent across**: `config/openclaw.example.json`, `package.json`, `dashboard/vite.config.ts`, `dashboard/package.json`, `App.tsx`, `SetupWizard.tsx`, `config.ts`, `SettingsPanel.tsx`, all scripts, all docs

## 5. i18n Completeness

- [ ] **Key parity**: Both `dashboard/src/i18n/en.json` and `zh-CN.json` have the same keys
  - Quick check: compare key count with `jq 'paths | length'`
- [ ] **No `defaultValue` fallbacks**: `grep -r 'defaultValue' dashboard/src --include='*.tsx'` — should be empty (all keys must exist in locale files)
- [ ] **No hardcoded strings**: Check new/modified components for user-visible text not wrapped in `t()`

## 6. Code Quality

- [ ] **No `console.log` in production paths**: Only allowed in `GatewayClient` (debug logging) and stores. Remove from components.
- [ ] **No TODO/FIXME blockers**: `grep -r 'TODO\|FIXME' dashboard/src --include='*.ts' --include='*.tsx'` — review each, ensure none are release-blockers
- [ ] **No dead imports**: TypeScript `--noEmit` catches most; visually scan recently changed files
- [ ] **No large files**: `find . -size +1M -not -path '*/node_modules/*' -not -path '*/.git/*'` — review any matches

## 7. Documentation

- [ ] **CHANGELOG.md updated**: New section for this release with all changes
- [ ] **README.md accurate**: Quick-start commands match actual behavior
- [ ] **Config example matches code**: `config/openclaw.example.json` reflects current schema

## 8. Git Hygiene

- [ ] **Clean working tree**: `git status` — no unintended modifications
- [ ] **Meaningful commits**: Each commit has a descriptive message
- [ ] **No merge conflicts**: `git diff --check` — no conflict markers
- [ ] **Branch up to date**: `git pull --rebase` before push

## 9. Runtime Verification (if time permits)

- [ ] **Gateway starts**: `pnpm start` — no errors, dashboard loads at `http://127.0.0.1:28789`
- [ ] **SetupWizard works**: Clear localStorage, reload — wizard appears and can configure
- [ ] **Panel data loads**: After setup, Library/Tasks/Radar panels show data (or empty states)
- [ ] **Health check**: `pnpm health` — passes

## 10. Post-Push

- [ ] **CI passes** (when configured)
- [ ] **Tag version** (for releases): `git tag v0.x.y && git push --tags`
- [ ] **Update `research-plugins`** if skills changed: bump version, `pnpm publish`

---

## Quick One-Liner Checklist

```bash
# Run before every push:
cd research-claw
npx tsc --noEmit && \
  pnpm --filter dashboard test -- --run && \
  grep -r '18789' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.sh' . | grep -v node_modules | grep -v CHANGELOG && \
  echo "=== All checks passed ==="
```
