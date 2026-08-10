# Icons and branding

The master artwork is `app/static/logos/app-icon.png`. Everything else is
generated from it:

```bash
python script/fork/generate-icons.py
```

That produces, for both the `prod` and `dev` variants:

- `icon-logo.ico` — Windows, 7 sizes from 16px to 256px
- `icon-logo-legacy.icns` — macOS

plus the shared `win32-installer-splash.gif`.

The dev variant is the same artwork hue-rotated to teal, so a development build
is obvious next to a production one in the taskbar.

## Replace the master with a 1024px original

The current master is 256px, so macOS icons are upscaled and look soft at large
sizes. Windows is unaffected — its largest icon is 256px, which the master
covers exactly. Drop a 1024px PNG in as `app-icon.png` and re-run the script to
fix macOS.

## What we deliberately do not ship

Upstream carries two Apple asset-catalog artifacts:

- `app/static/logos/{prod,dev}/Assets.car`
- `app/static/logos/{prod,dev}/icon-logo.icon/`

Both are compiled by Xcode's `actool`, which only runs on macOS 26. They cannot
be regenerated on Windows or Linux, and keeping upstream's copies would mean
shipping GitHub's logo inside our app. So they are removed.

`script/build.ts` treats `Assets.car` as optional rather than asserting its
presence (upstream asserts). Without it, macOS falls back to the packaged ICNS,
which is the correct icon — it only loses the macOS 26 themed-icon treatment.

If you later want that back, build the `.icon` bundle in Icon Composer on a Mac,
run `actool` to produce `Assets.car`, commit both, and the existing build code
will pick them up with no further changes.

## Still GitHub-branded

The app icon is done, but in-app artwork is not. These still show GitHub Desktop
branding and need replacing before any public release:

- `app/static/common/ghd_dark.svg`, `ghd_light.svg` — the wordmark on the
  welcome screen
- `app/static/common/logo-64x64@2x.png`

These are wordmarks rather than icons, so they need a type treatment for
"GitDesktop" rather than a mechanical conversion of the app icon.

## Licensing

`LICENSE` is MIT and must keep its `Copyright (c) GitHub, Inc.` line — that is
a condition of the license. Add your own copyright alongside it, not instead of
it. The MIT grant covers the code only; it conveys no rights to GitHub's name
or logos, which is why the branded assets above have to go.
