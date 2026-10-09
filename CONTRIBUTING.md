# Contributing to Sherlog

Thanks for your interest in Sherlog. This is a learning project, so questions and small improvements are as welcome as big features. By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

1. Look for an existing [issue](https://github.com/AlexandraZambrano/sherlog/issues) or the [project board](https://github.com/users/AlexandraZambrano/projects/15). Work is tracked there.
2. If your idea has no issue yet, open one and wait for a reply before writing code. This avoids work that can't be merged.
3. Comment on the issue to say you are working on it.

## Setting up

See the "Running it locally" section of the [README](README.md). It lists what you need (Docker, Node.js 22 and an LLM) and the commands to start the stack.

## Branches

- `main` holds releases and `develop` is where finished work is combined. **Both are protected: nobody pushes to them directly.** Every change goes through a pull request.
- Create your branch from `develop`, named after the issue: `feature/<issue-number>-short-name`, for example `feature/12-error-rate-tool`.
- Other prefixes: `fix/`, `docs/` and `chore/`.

## Commits and pull request titles

We use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): short description`.

```text
feat(agent): add error_rate tool
fix(ui): handle empty timeline
docs: explain ES|QL queries
test(tools): cover search_logs
chore(ci): pin Elasticsearch version
```

Pull requests into `develop` are **squash merged**, so the PR title becomes the commit message. It must follow the same format.

## Pull requests

- Open the PR against `develop`, and link the issue with `Closes #<number>`.
- Explain what changed and why.
- All automatic checks (lint, type check, unit and integration tests) must pass before it can be merged.
- New behaviour comes with tests. A bug fix starts with a test that reproduces the bug.

## Code style

- Code, comments and docs are written in **English**.
- React and TypeScript, in `strict` mode. No `any` without a comment explaining why.
- Functional style: pure functions, immutable data, side effects (network, time, randomness) at the edges and passed in as arguments. React uses function components and hooks only.
- Names say what something is or does: `calculateErrorRate`, not `calc`.
- Every file starts with a short comment about its purpose, and every exported function has a doc comment. Comment the *why*, not what the code already says.

## Reporting bugs and asking questions

- **Bug:** open an issue with the bug template. Say what you did, what you expected and what happened.
- **Question or idea:** open an issue too, so the answer helps the next person.
- **Security problem:** don't open a public issue. Contact the maintainer through their GitHub profile ([@AlexandraZambrano](https://github.com/AlexandraZambrano)).

## License

By contributing, you agree that your contribution is released under the [MIT License](LICENSE).
