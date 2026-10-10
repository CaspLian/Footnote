# Decisions

Consequential choices: anything that changes an interface, a dependency, the data, the architecture or the scope.
Small implementation details don't need a record.

## Convention

- **One file per decision:** `docs/decisions/YYYY-MM-DD-short-name.md` (the date it was proposed). Separate files
  avoid merge conflicts; there is deliberately no index, so list the folder.
- **Status:**
  - `proposed`: an idea under discussion; nobody should build on it yet.
  - `accepted`: say who accepted it. "Accepted by one person" is not "accepted by the team"; write which it is.
  - `superseded by <file>`: a replacement decision exists.
  - `rejected`
- **Changing your mind:** do not rewrite an accepted decision. Add a new file and mark the old one superseded.

## Template

```markdown
# <Decision title>

- Status: proposed | accepted (by whom) | superseded by <file> | rejected
- Date: YYYY-MM-DD        Decision owner: <name, if known>

## Context
<the problem, and the facts that matter>

## Decision
<what was decided, or is proposed, and why>

## Alternatives and tradeoffs
- <option>: <why not / what it would cost>

## Impacted components
<files, routes, tables, teammates>
```
