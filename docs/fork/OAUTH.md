# Authentication

Upstream authenticates by embedding an OAuth **client ID and client secret** in
the build and running the web authorization-code flow. That does not survive
being forked into a public repository: a client secret in a public repo is not a
secret, and unlike GitHub we cannot rotate ours centrally when it leaks.

So this fork removes the secret entirely rather than trying to hide it. Both
providers support a secretless flow for exactly this situation.

## GitHub — device flow

**Client ID: `Ov23liLgD0Eau7Pm4Sag`**

This is not a secret. OAuth client IDs are public by design — the device flow
transmits it in plaintext from every client, and anyone can read it out of the
binary. It is committed here deliberately so local development builds work
without setup.

The registered OAuth app must have **"Enable Device Flow"** ticked. The callback
URL field is required by GitHub's form but unused by the device flow; any value
works.

How it behaves: the app requests a user code, shows it to the user, and the user
enters it at <https://github.com/login/device>. Meanwhile the app polls for the
token. No redirect, no callback, no custom protocol handler, no secret.

## Gitea — OAuth for Arcen's instance, PAT for everyone else

**Arcen instance client ID: `6ae0a048-e223-4fd1-b924-8d9848b63c2c`**

Like the GitHub one, this is not a secret and is committed deliberately.

**No client secret is used, even though Gitea issued one.** Registering as a
public client with PKCE is what makes the secret unnecessary — see below. If the
app was registered with "Confidential Client" ticked, Gitea will *demand* the
secret at token exchange and PKCE alone will not authenticate; untick it.

Because a Gitea client ID is per-instance, it cannot be a single build-time
constant the way GitHub's is. Known instances are listed in fork configuration,
keyed by instance URL; anything not in that list falls back to a personal access
token, which needs no registration.

### Why not just embed the secret

Even a low-sensitivity secret is the wrong shape here. It ships to every user's
disk in a public app, so it cannot be treated as proof of anything, and rotating
it would break every installed client at once. PKCE gives the same result with
nothing to leak or rotate. The one real cost — per-instance registration — is
why other instances get the token path instead.

## Gitea elsewhere — start with tokens

Gitea supports OAuth2 with **PKCE public clients**, which is the equivalent
secretless flow. But an OAuth app has to be registered **on every Gitea instance
separately**, by someone with access to that instance. That is real friction:
point the app at a second Gitea server and someone has to go register an app
there before anyone can sign in.

A personal access token has no such requirement — it works against any instance
immediately, with nothing to register.

**Recommendation: PAT is the default path for any instance we have not
registered an app on.** The two are not exclusive; upstream already models
multiple sign-in paths.

### Registering an app on another instance

If a second instance is used often enough to justify it, register there and add
it to the known-instances list. Two places, depending on scope:

- **Instance-wide** (all users): Site Administration → Applications, at
  `/admin/applications`. Requires admin.
- **Single user**: user Settings → Applications, at
  `/user/settings/applications`. No admin needed — fine for testing.

Fill in:

| Field | Value |
| --- | --- |
| Application Name | `GitDesktop` |
| Redirect URI | `http://127.0.0.1/` |
| Confidential Client | **unchecked** |

Unchecking "Confidential Client" is the important part — that marks it a public
client, which is what permits PKCE and means no client secret is issued or
required.

Use `http://127.0.0.1/`, not `localhost`. For public clients Gitea allows **any
port** on a loopback redirect URI, which is what lets the app spin up a
throwaway local listener on whatever port is free. Gitea's own docs specifically
warn against `localhost` here, per RFC 8252.

Gitea then issues a Client ID. Add it to the known-instances list keyed by the
instance URL. Ignore the client secret it issues alongside — with the client
marked public, PKCE replaces it.

Relevant scopes are `repository` and `user` (each has read/write variants).

## Status

**Gitea token sign-in works and is verified against `git.arcengames.com`.**
Signing in, listing repositories, and git fetch all succeed. Token entry is
offered for every Gitea endpoint; both sign-in surfaces (the Preferences dialog
and the Welcome flow) share one implementation in
`app/src/ui/fork/gitea-token-form.tsx`.

Remaining, in rough priority order:

1. **GitHub device flow.** Replaces the authorization-code exchange in
   `app/src/lib/api.ts` and drops `__OAUTH_SECRET__` from the build. Until this
   lands, release builds authenticate to GitHub through *upstream's development
   OAuth application* — fine for development, not acceptable to ship.
2. **Gitea PKCE** for registered instances, so they get browser sign-in instead
   of pasting a token. Token sign-in already works everywhere, so this is
   convenience rather than capability. See the warning on
   `usesTokenAuthentication` before changing it.

### A trap worth knowing about

Changing the key returned by `getKeyForEndpoint` orphans every stored
credential: it stays in the credential store under the old name, and the
account then loads with an empty token. The app looks signed in but every
request goes out anonymous, which the API reports as an empty result or a 403
that says nothing about credentials.

There are no released installs yet, so the current rename cost only a
re-authentication. If it ever changes again after release, write a migration
that reads the old key and rewrites it rather than silently signing everyone
out.
