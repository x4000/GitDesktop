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

## Gitea — decide later, start with tokens

Gitea supports OAuth2 with **PKCE public clients**, which is the equivalent
secretless flow. But an OAuth app has to be registered **on every Gitea instance
separately**, by someone with access to that instance. That is real friction:
point the app at a second Gitea server and someone has to go register an app
there before anyone can sign in.

A personal access token has no such requirement — it works against any instance
immediately, with nothing to register.

**Recommendation: ship PAT support first.** Add OAuth later if the extra
sign-in step proves annoying in daily use. The two are not exclusive; upstream
already models multiple sign-in paths.

### If/when you do want OAuth

Register the application on the Gitea instance. Two places, depending on scope:

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

Gitea then issues a Client ID. Record it the same way as the GitHub one — it is
equally not a secret. Because it differs per instance, it cannot be baked into
the build; it belongs in per-instance configuration entered at sign-in time.

Relevant scopes are `repository` and `user` (each has read/write variants).

## Status

Not yet implemented. The build still carries upstream's secret-based web flow,
so sign-in does not currently work correctly in this fork. Implementing the
device flow is the next piece of work.
