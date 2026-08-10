# Gitea support

## How Gitea is recognised

Upstream models three endpoint kinds and defines the third by exclusion:

```ts
isGHES = ep => !isDotCom(ep) && !isGHE(ep)
```

Any unrecognised host is therefore *assumed* to be GitHub Enterprise Server, at
`assumedGHESVersion` (3.1.0). Gitea has to be excluded explicitly or it inherits
GHES capabilities wholesale.

`app/src/lib/fork/gitea.ts` holds the detection. Instances we have registered an
OAuth app on are listed there and recognised without any stored state; anything
else is probed once at sign-in (`/api/v1/version`) and the answer persisted,
because Gitea sends no version header to sniff the way GHES does.

`VersionConstraint` gained a `gitea` field defaulting to **false**, so every
`supports*` predicate that does not mention Gitea answers "no" for it. That is
the safety net: capability checks degrade correctly without being revisited.

## Known API differences

| | GitHub | Gitea |
| --- | --- | --- |
| API path | `/api/v3` (GHES) | `/api/v1` |
| Token auth header | `Bearer <token>` | `token <token>` |
| `/user/repos` | everything reachable, incl. org repos | **only repos the user owns** |
| noreply domain | `users.noreply.<host>`, `id+login@` | `noreply.<host>`, `login@` |
| GraphQL | yes | **no** |

The `/user/repos` difference is the subtle one: a user whose work lives under an
organisation sees an empty list and no error. `streamUserRepositories`
enumerates organisations and fetches their repositories for Gitea to restore
GitHub's semantics.

## The audit

The capability layer routes through `endpointSatisfies`, but **82 call sites
branch on `isDotCom`/`isGHE`/`isGHES` directly** and bypass it. None of them
crash for Gitea; they silently take the GHES or dotcom branch. Every one was
reviewed. Fixed:

- **Avatars** (`ui/lib/avatar.tsx`) — fell through to
  `avatars.githubusercontent.com` with the user's **email address** as a query
  parameter. A privacy leak, not a broken image.
- **Git credentials** (`trampoline-credential-helper.ts`) — upstream classifies
  Gitea as `generic` from its `WWW-Authenticate` realm, which is right for them
  and wrong for us: it ignores the account token we hold and skips the Desktop
  sign-in prompt. Recognised instances are now account-backed.
- **Stealth emails** (`lib/email.ts`) — generated `login@users.noreply.github.com`
  for Gitea users. These are written into commits as `Co-authored-by` trailers,
  so this put a GitHub address on a colleague who has no GitHub account.
- **Copilot** (`app-store.ts`, `preferences/copilot.tsx`, `api.ts`) — three
  filters keyed on `!isGHES`, which Gitea passes. One would have pointed the
  Copilot CLI at the Gitea host; another sent a GraphQL query to a server with
  no GraphQL endpoint.

Reviewed and left alone: account sort order, the `.ghe.com` endpoint migration,
`find(isDotComAccount) ?? accounts.at(0)` fallbacks, and the dotcom-gated
Copilot-bot mentionable. All correct for Gitea as written.

## Known cosmetic issue

Gitea accounts are labelled **"GitHub Enterprise"** throughout the UI, because
`isEnterpriseAccount` is defined as `!isDotComAccount`. Affects the clone and
publish dialog tabs, the Accounts preferences headings, the repository list
group header, and the git-config email warnings.

Functionally correct everywhere — Gitea accounts land in the right bucket and
work. Fixing it means threading an account-kind label through six or so
components, which has not been done.
