# @tenxtools/bugfixbot

Local-first PR review autopilot for Cursor Bugbot. Watches GitHub PR comments for Bugbot findings, applies fixes via Cursor CLI, runs verification checks, and commits in cycles until no actionable comments remain.

## Installation

```bash
npm install -g @tenxtools/bugfixbot
```

## Quick Start

```bash
# Initialize in your project
bugfixbot init

# Run a single fix cycle
bugfixbot run --pr 123

# Watch mode: continuously fix until done
bugfixbot watch --pr 123

# Check status
bugfixbot status --pr 123
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Fix Loop Cycle                          │
├─────────────────────────────────────────────────────────────┤
│  1. Fetch Bugbot comments from GitHub PR                    │
│  2. Filter to actionable, unhandled comments                │
│  3. Build fix prompt with file locations + context          │
│  4. Apply fixes via Cursor CLI                              │
│  5. Run verification (tests, lint, typecheck)               │
│  6. Commit and push: "chore(bugbot): fix review findings"   │
│  7. Repeat until 0 actionable comments or max cycles        │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

Create `bugfixbot.yml` in your project root (or run `bugfixbot init`):

```yaml
github:
  # repo: owner/repo    # Optional: inferred from git remote
  # pr: 123             # Optional: inferred from branch
  auth: env             # 'gh' (use gh CLI), 'token', or 'env' (GITHUB_TOKEN)
  botAuthors:
    - cursor-bot
    - bugbot

fix:
  engine: cursor-cli    # 'cursor-cli' or 'cursor-command'
  # command: bugbot_fix # For cursor-command engine

verification:
  commands:
    - npm run typecheck
    - npm run lint
    - npm test
  timeout: 300000       # 5 minutes per command
  stopOnFailure: true

guardrails:
  maxCycles: 5
  maxFilesPerCycle: 10
  maxLinesPerCycle: 500
  pollIntervalMs: 30000

git:
  commitTemplate: "chore(bugbot): fix review findings [cycle {cycle}]"
  autoRebase: false
  pushForce: false
```

## CLI Commands

### `bugfixbot init`

Initialize bugfixbot in the current directory. Creates:
- `bugfixbot.yml` - Configuration file
- `.cursor/commands/bugbot_fix.md` - Cursor command template
- `.bugfixbot/` - State directory (gitignored)

```bash
bugfixbot init [--force] [--skip-templates]
```

### `bugfixbot run`

Run a single fix cycle.

```bash
bugfixbot run --pr <number> [--repo owner/repo] [--config path]
```

### `bugfixbot watch`

Watch mode: continuously run fix cycles until done or max cycles reached.

```bash
bugfixbot watch --pr <number> [--max-cycles 5] [--poll-interval 30000]
```

### `bugfixbot status`

Show current status, pending comments, and session state.

```bash
bugfixbot status --pr <number>
```

## GitHub Authentication

bugfixbot supports three authentication methods:

1. **`gh` CLI** (recommended): Uses `gh auth token` to get credentials
2. **Environment variable**: Set `GITHUB_TOKEN` or `GH_TOKEN`
3. **Explicit token**: Set `github.token` in config

## Guardrails

Built-in safety guardrails prevent runaway automation:

| Setting | Default | Description |
|---------|---------|-------------|
| `maxCycles` | 5 | Stop after N cycles |
| `maxFilesPerCycle` | 10 | Require approval if exceeded |
| `maxLinesPerCycle` | 500 | Require approval if exceeded |
| `pollIntervalMs` | 30000 | Wait between cycles |
| `stopOnTestFailure` | true | Halt if verification fails |

## Customizing Fix Prompts

For teams wanting custom fix behavior, use the `cursor-command` engine with templates in `.cursor/commands/`:

```yaml
fix:
  engine: cursor-command
  command: bugbot_fix  # Uses .cursor/commands/bugbot_fix.md
```

Templates support placeholders:
- `{{prompt}}` - The generated fix prompt
- `{{taskCount}}` - Number of tasks
- `{{files}}` - Comma-separated file list

## Programmatic Usage

```typescript
import { runLoop, loadConfig, createGitHubClient } from '@tenxtools/bugfixbot';

const config = loadConfig({ cwd: process.cwd() });
const octokit = createGitHubClient({ auth: config.github.auth });

const result = await runLoop({
  octokit,
  config,
  owner: 'your-org',
  repo: 'your-repo',
  prNumber: 123,
  cwd: process.cwd(),
});

console.log(result.status); // 'complete' | 'pushed' | 'stopped' | 'failed'
```

## Requirements

- Node.js >= 18
- Cursor CLI installed and authenticated
- GitHub access (via `gh` CLI or token)

## License

Apache-2.0
