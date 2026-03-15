# Contributing

Thanks for your interest! Here's how to get started.

## Setup

```bash
git clone https://github.com/exposir/react-dom-transfer.git
cd react-dom-transfer
npm install
npm run dev  # watch mode
```

## Development

```bash
npm run build   # build CJS + ESM + DTS
npm run lint    # type check
```

## Before submitting a PR

1. Make sure `npm run build` passes
2. If you changed behavior, update the README (both EN and zh-CN)
3. Add a note to CHANGELOG.md under `## [Unreleased]`

## What makes a good PR

- **Bug fixes** — include a description of the bug and how to reproduce it
- **New features** — open an issue first to discuss the design
- **React version compatibility** — if you've tested on a new React version, let us know

## Code style

- Keep it minimal. The whole library is ~200 lines and should stay that way.
- No external dependencies (other than React as peer dep).
- Dev-mode warnings should use the `isDev` guard.

## Reporting issues

- Include React version
- Include browser + version
- Minimal reproduction (CodeSandbox or repo link preferred)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
