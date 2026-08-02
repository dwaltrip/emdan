# bounce-flick

## Formatting

Biome formats the code (`biome.json`). Run `pnpm format` from this directory, or `pnpm format:check` for a dry run.

### Pre-commit hook

A pre-commit hook auto-formats staged bounce-flick files via lint-staged. It's opt-in per clone:

```sh
git config core.hooksPath bounce-flick/scripts/git-hooks
```

- Bypass for one commit: `git commit --no-verify`
- Disable: `git config --unset core.hooksPath`
