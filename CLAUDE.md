# CLAUDE.md

## Project Overview

**fluffy-eureka** is a test repository for Claude Code. It serves as a minimal environment for experimenting with AI-assisted development workflows, version control operations, and repository management features.

## Repository Structure

```
fluffy-eureka/
├── CLAUDE.md       # AI assistant guidance (this file)
└── README.md       # Project description
```

This is intentionally a minimal repository with no application source code, build system, or dependencies.

## Development Workflow

### Git

- **Primary remote:** `origin`
- **Default branch:** `main`
- Branch names for Claude Code sessions follow the pattern: `claude/<task>-<session-id>`

### Branching Conventions

- Feature and task branches are created off `main`
- Claude Code branches use the `claude/` prefix
- Push with tracking: `git push -u origin <branch-name>`

## Conventions for AI Assistants

- Keep changes minimal and focused on the task at hand
- Use clear, descriptive commit messages
- Do not introduce unnecessary files or dependencies
- When adding new functionality, document it in this file
- Verify the repository is in a clean state before and after making changes
