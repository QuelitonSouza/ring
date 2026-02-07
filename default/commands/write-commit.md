---
name: ring:write-commit
description: Generate a single commit message based on staged/unstaged changes
argument-hint: ""
model: haiku
---

Generate a professional, technical commit message in English based on the current code changes. Returns a single, ready-to-use message.

## Performance & Cost

- **Model Used:** Haiku (cost-effective for commit message generation)
- **Execution Time:** ~5-10 seconds
- **Cost:** Minimal - optimized for this simple task

## Usage

```
/ring:write-commit
```

## Rules

| Rule | Description |
|------|-------------|
| **Language** | English only |
| **Tone** | Technical and professional |
| **Source** | Based only on actual code changes (git diff) |
| **Format** | No emojis |
| **Output** | Single message |

## Process

### Step 1: Analyze Changes

Run these commands to understand what changed:

```bash
# Check status
git status

# View staged changes (priority)
git diff --cached

# View unstaged changes (if nothing staged)
git diff
```

### Step 2: Identify Change Type

Based on the diff, determine the commit type:

| Type | When to Use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `chore` | Maintenance, dependencies, config |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `style` | Formatting, whitespace (no logic change) |
| `perf` | Performance improvement |
| `ci` | CI/CD configuration |
| `build` | Build system or dependencies |

### Step 3: Determine Scope

Identify the component or area affected:

- Module name (e.g., `auth`, `api`, `db`)
- Feature area (e.g., `users`, `payments`, `orders`)
- Layer (e.g., `service`, `controller`, `repository`)

Scope is optional. Omit if changes span multiple areas.

### Step 4: Generate Message

**Format:**
```
<type>(<scope>): <subject>

<body - optional>
```

**Subject rules:**
- Imperative mood ("add" not "added")
- Max 50 characters
- No period at end
- Lowercase after type/scope

**Body rules (optional):**
- Wrap at 72 characters
- Explain *what* and *why*, not *how*
- Separate from subject with blank line

## Output Format

Present the message in a ready-to-copy format:

```
feat(auth): add OAuth2 refresh token support

Implements automatic token refresh when access token expires,
preventing session interruptions for long-running operations.
```

Or for simpler changes:

```
fix(api): handle null response in user endpoint
```

## Examples

### Feature Addition
```diff
+ export async function refreshToken(token: string): Promise<Token> {
+   const response = await fetch('/api/refresh', { ... });
+   return response.json();
+ }
```
**Generated message:**
```
feat(auth): add token refresh function
```

### Bug Fix
```diff
- if (user) {
+ if (user && user.isActive) {
    return user.permissions;
  }
```
**Generated message:**
```
fix(users): check active status before returning permissions
```

### Refactoring
```diff
- function getUserById(id) {
-   const user = db.query(`SELECT * FROM users WHERE id = ${id}`);
+ function getUserById(id: string): User | null {
+   const user = db.query('SELECT * FROM users WHERE id = ?', [id]);
```
**Generated message:**
```
refactor(db): add type safety and parameterized queries to getUserById
```

### Documentation
```diff
+ ## Authentication
+
+ This module handles user authentication using JWT tokens.
```
**Generated message:**
```
docs: add authentication section to README
```

## Anti-Patterns

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| `Added new feature` | `feat: add new feature` |
| `🚀 feat: add feature` | `feat: add feature` |
| `fix: Fixed the bug` | `fix: resolve login validation error` |
| `update code` | `refactor(api): extract validation logic` |
| `misc changes` | `chore: update dependencies` |

## Notes

- This command **only generates** the message, it does not execute the commit
- Use `/ring:commit` if you want to stage, commit, and push
- The message is based solely on what `git diff` shows
- If no changes are detected, inform the user
