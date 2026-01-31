# Auto-Commit Guide

This guide shows you how to automatically commit changes as you build in Cursor.

## ⚠️ Important Warning

**Auto-committing can be dangerous!** It may commit:
- Debug code
- Broken builds
- Sensitive data
- Temporary files

**Recommendation:** Use auto-commit only for personal projects or enable it selectively.

---

## Option 1: Manual Commit Scripts (Safest)

### Quick Commit
```powershell
npm run commit
```

### Commit and Push
```powershell
npm run commit:push
```

---

## Option 2: Auto-Commit Watcher (Node.js)

Runs in the background and commits every 60 seconds if changes are detected.

```powershell
npm run auto-commit
```

**To stop:** Press `Ctrl+C`

**Customize:** Edit `scripts/auto-commit.js`:
- Change `COMMIT_INTERVAL` (default: 60000ms = 60 seconds)
- Modify commit message format

---

## Option 3: PowerShell Watcher

```powershell
.\scripts\auto-commit.ps1
```

**To stop:** Press `Ctrl+C`

---

## Option 4: Cursor/VS Code Extension

### Recommended Extension: "Auto Commit"

1. Open Extensions (`Ctrl+Shift+X`)
2. Search: **"Auto Commit"** by mhutchie
3. Install
4. Configure in settings:

```json
{
  "autoCommit.enable": true,
  "autoCommit.interval": 60000,
  "autoCommit.message": "Auto-commit: {{timestamp}}"
}
```

### Alternative: "GitDoc"

Automatically commits when you save files.

---

## Option 5: Git Hooks (Advanced)

Create `.git/hooks/post-commit`:

```bash
#!/bin/sh
git push origin main
```

This auto-pushes after every commit.

---

## Best Practices

### ✅ Do:
- Use descriptive commit messages
- Review changes before committing
- Commit related changes together
- Test before committing

### ❌ Don't:
- Commit sensitive data (API keys, passwords)
- Commit broken code
- Commit large binary files
- Commit `node_modules` or `.next`

---

## Current Setup

Your `.gitignore` already excludes:
- `node_modules/`
- `.next/`
- `.env*`
- Build artifacts

---

## Troubleshooting

### "Nothing to commit"
- Make sure you've saved your files
- Check `git status` to see what's tracked

### "Commit failed"
- Check if you're authenticated with GitHub
- Verify you have write access to the repository

### "Too many commits"
- Increase the commit interval
- Use manual commits instead

---

## Recommended Workflow

For development:
1. **Use manual commits** (`npm run commit`) for important milestones
2. **Use auto-commit** only when working on small, incremental changes
3. **Always review** before pushing (`git log`)

For production:
- **Disable auto-commit**
- Use manual commits with clear messages
- Use pull requests for code review
