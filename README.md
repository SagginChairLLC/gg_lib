# gg_lib

Import-based library for every GG Studio script — one bridge, one set of `gg.*`
modules, and one `/jobsettings` editor, instead of a `core/` copy embedded in
each resource.

A consumer adds one line to its manifest and
`init.lua` runs **inside that resource's Lua VM**, pulling gg_lib's module and
bridge sources over with `LoadResourceFile`. Every `gg.*` function therefore
executes in the consumer's own context — events, NUI callbacks and exports all
register against the consumer, exactly as they did when `core/` was embedded.

## Install

```cfg
ensure oxmysql
ensure ox_lib
ensure gg_lib      # before every gg_* script
ensure gg_taxijob
```

Two config files, one for the whole server:

| File | Reaches clients? | Holds |
| --- | --- | --- |
| `utility.lua` | yes (`files{}`) | bridge overrides, notification/progress preferences |
| `server_config.lua` | **no** | admin list, anything else players must not read |

Per-script `utility.lua` bridge settings are no longer read.

## Admins

Two lists, checked independently.

**`server_config.lua`** is the bootstrap — the first admin, entered before
anyone can open the editor. Not in `files{}`, so it never reaches a client.

```lua
admins = {
    "license2:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",   -- bare = license2
},
ace = true,   -- false makes this file the only route in
```

Prefix an entry (`steam:`, `discord:`, `fivem:`, `license:`) to match a
different identifier type.

**Everyone else is managed in the editor.** `/ggsettings` → **Admins** in the
rail: grant to anyone online in a click, paste an identifier for someone
offline, revoke with a confirm. Writes land in `gg_studio_admins`. There are no
admin commands — the editor is the only surface.

Entries from the file are shown there but locked: the editor cannot revoke
them, so the owner can't be locked out by someone they granted, and a database
outage can't lock them out either.

Access is checked server-side on every call — open, fetch, save, reset, grant
and revoke — and denials are logged with the player's name and license2. Other
resources ask via `exports.gg_lib:ggIsAdmin(source)`.

## Database

Created by [core/server/database.lua](core/server/database.lua) at boot, before
any consumer starts:

| Table | Holds |
| --- | --- |
| `gg_studio_settings` | setting overrides, one row per changed key, for every script and for the studio-wide `gg_studio` pseudo-resource |
| `gg_studio_settings_meta` | per-resource config revision and version |
| `gg_studio_admins` | admins granted in game |

`gg_lib:database:ready` fires once the schema is in place.

## Consumer integration

```lua
-- fxmanifest.lua
shared_scripts {
    '@ox_lib/init.lua',
    '@gg_lib/init.lua',   -- after ox_lib, before your config files
    'config/**/*.lua',
}

-- opt-in modules (loaded before your config files run):
gg_lib 'settings'
```

That is the whole migration for the bridge: delete the resource's `core/`
folder, drop the `core/*` lines from its manifest, add `'@gg_lib/init.lua'`.
Call sites are untouched — `gg.framework.GetIdentifier`, `gg.display.notify`,
`gg.print.info`, `gg.cache`, `gg.fuel` … all keep working. `gg.bridge` exposes
what detection resolved (`gg.bridge.framework == "qb-core"` etc.), and the
`<resource>:client:onResourceStart` / `:server:` ready events still fire.

## Modules

Eager-loaded into every consumer: `print`, `scriptcache` (gg.cache), `util`,
`blip`, `camera`, `display`, `menu`, `miniBridge` (gg.fuel / gg.keys), `nui`,
`pedManager`, `player`, `vehicleManager`.

Bridged categories (auto-detected, override in utility.lua): `framework`,
`inventory`, `target`, `dispatch`. Candidates live in `bridge/manifest.lua`;
adding a bridge = add the folder + add its name there.

Unknown keys on `gg` lazy-load `modules/<name>/` on first access, so new
modules ship without touching init.lua.

## Popup (gg.popup)

The basic string popup every GG script shows, rendered by gg_lib's own ui_page
-- consumer scripts need no web app of their own. One popup is shared server
(well, client)-wide; the last writer wins.

```lua
gg.popup.show("Drive to the marked pickup and press E to start.")  -- optional 2nd arg: position
gg.popup.message("Updated text")   -- non-empty auto-shows, "" just changes text
gg.popup.hide()
```

Positions: `bottom-middle` (default), `top-middle`, `left-middle`, `right-middle`,
and the four corners.

## Settings (/jobsettings)

The editor UI is gg_lib's own NUI. A script opts in with `gg_lib 'settings'`
and declares its schema in config (see gg_taxijob's `config/shared/settings.lua`):

```lua
settings.script({ label = "Advanced Taxi Job", icon = "fa-taxi", order = 10, command = "taxisettings" })
settings.group("popup", { label = "Popups", icon = "fa-comment" })
settings.define("settings.popup.enabled", { group = "popup", label = "Enable Popups", type = "boolean", default = true })
```

- Overrides-only storage in `gg_studio_settings` (oxmysql); defaults stay in Lua.
- `/ggsettings` opens the editor (`/jobsettings` is an alias); per-script
  aliases (`/taxisettings`) deep-link.
- Admin gated, checked server-side on every open, fetch, save and reset — the
  command itself is unrestricted. A caller passes if they are in
  `server_config.lua`'s `admins` list, or hold the ace:

  ```
  add_ace group.admin gg.settings allow        # open + edit
  add_ace group.mod   gg.settings.view allow   # open read-only
  ```

  Denied attempts (open or write) are logged to the server console with the
  player's name and license2.
- Studio-wide **Generic Settings** live under the pseudo-resource `gg_studio`;
  `gg_lib:generic:changed` fires server-side on edits.
- Config revision auto-bumps on every save; shown with the fxmanifest version
  in the editor rail.

### Generic values

Declared once in gg_lib so no script ships its own copy:

| Path | Type |
| --- | --- |
| `theme.apply_to_all` | on = every script uses the studio accent; off = each script shows its own |
| `theme.primary_color` | studio accent color |
| `popup.enabled` | master switch for `gg.popup` |
| `popup.position` | where popups anchor on screen |
| `reset.daily_time` | when daily progress rolls over, 24h |
| `reset.timezone` | which zone that time is measured in |
| `general.currency_type` | USD, EUR, GBP … |
| `general.number_format` | `1,234.56` / `1.234,56` / `1 234,56` / no grouping |
| `fallback.vehicle` | model spawned when a script's own vehicle fails to load |
| `fallback.ped` | model spawned when a script's own ped fails to load |

Currency and number format are already wired into `gg.util`, so a script gets
them without reading `cfg.generic` at all:

```lua
gg.util.formatNumber(1234567)      --> 1,234,567   (or 1.234.567, per the setting)
gg.util.formatMoney(9500)          --> $9,500      (or €9.500)
gg.util.formatMoney(12.5, 2)       --> $12.50
```

Both fall back to the US default when a resource has no settings module or the
first generic payload has not landed yet.

The daily rollover is resolved the same way, so every script that resets
progress does it at the same moment:

```lua
local hour, minute, offset = settings.generic.dailyReset()   -- 4, 30, -18000
```

`offset` is the configured zone's distance from UTC in seconds, looked up in
`settings.timezones` — the same table the editor built its zone list from.

A setting can hide itself when something else makes it irrelevant. `hidden` is
a predicate re-run on every editor fetch; the value stays in `cfg` either way,
only the row disappears:

```lua
settings.define("settings.ui_theme.primary_color", {
    ...
    hidden = function()
        return settings.generic.get("theme.apply_to_all") ~= false
    end,
})
```

That is how a script's own Primary Color drops out of the editor while the
studio theme is applied to every UI, and comes back when it is not.

Generic values replicate live into every script carrying the settings module.
On launch the module fetches them from gg_lib (which caches the resource as a
subscriber and pushes every later edit back), and they land in `cfg.generic`:

```lua
local currency = cfg.generic.general.currency_type   -- or settings.generic.get("general.currency_type")

settings.generic.onChange(function(changed)          -- fires on the first payload too
    refreshPriceTags()
end)
```

`settings.generic.isResolved()` reports whether the first payload has landed;
until then `cfg.generic` is empty (the generic schema, and therefore its
defaults, live only in gg_lib).

**Migration note:** a script still embedding the old `base/settings/` module
will fight gg_lib for `/jobsettings`. When moving a script onto gg_lib, delete
its `base/settings/` folder and manifest lines in the same change.

## Web development

```sh
cd web && pnpm install && pnpm dev   # browser dev with mock scripts
pnpm build                            # writes web/dist for the ui_page
```
