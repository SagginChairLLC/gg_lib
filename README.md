# gg_lib

The shared foundation every GG Studio script runs on.

Install it once and every GG Studio resource you own works with your server —
your framework, your inventory, your target system, your dispatch — with nothing
to configure. It also gives you **Script Studio**, a single in-game menu where
you edit the settings for all of them.

You only ever install this once. Every GG Studio script released from now on
uses it.

---

## What it does

**It connects our scripts to your server.**
gg_lib detects what you are running and wires our scripts to it automatically.
It supports the common frameworks, inventories, target systems and dispatch
resources out of the box. If detection ever picks the wrong one, you can force
your choice — see [Bridges](#bridges).

**It gives you Script Studio.**
Every setting in every GG Studio script, in one menu, edited in game. No config
files, no restarts for most changes. Positions are placed by walking to the spot
and dropping them there rather than typing coordinates.

**It saves your settings to your database.**
Your changes live in your database, not in a file. Updating a script never wipes
what you configured — you can update and keep everything.

---

## Install

**1. Install the two things gg_lib needs**

- [ox_lib](https://github.com/overextended/ox_lib)
- [oxmysql](https://github.com/overextended/oxmysql)

**2. Drop `gg_lib` into your resources folder**

**3. Start it before any GG Studio script**

```cfg
ensure oxmysql
ensure ox_lib
ensure gg_lib          # must come before the scripts below
ensure gg_taxijob
```

That is the whole install. gg_lib builds its own database tables the first time
it starts — there is no `.sql` file to import.

---

## Giving yourself access

Script Studio is admin-only. Nobody can open it until you add yourself.

**Copy `server_config.example.lua` to `server_config.lua`, then put your license in the list:**

```lua
return {
    admins = {
        "license2:put_your_own_license_here",
    },

    ace = true,
}
```

Restart gg_lib and type **`/ggsettings`** in game.

> `server_config.lua` never reaches players. It is not downloaded to their game
> the way the rest of the resource is, so the list is safe to keep here. It also
> survives updates, because the release only ships the example.

### If your server already has admins

It probably does, so gg_lib uses it. Anyone holding one of the usual admin
principals — `group.admin`, `group.god`, `group.superadmin`, or the ones
qb-core and Qbox register — or sitting in their framework’s admin group gets
the **Admin** role here without being added to anything.

They never get **Owner**. Deciding who else gets in stays with the people
named in `server_config.lua`, because that file is the way back in when
everything else says no. `group.mod` and `group.moderator` get read-only
access instead.

They show on the Admins page tagged **Server**, so the page answers "who can
get in" honestly — but you cannot change or remove them there, because it was
not that page that let them in. Take away the permission on your server and
they lose this with it.

Turn it off with `auto_admin = false` in `server_config.lua`. gg_lib prints a
line the first time it lets someone in this way, so an admin appearing out of
nowhere is always explainable from the console.

### Finding your license

Join your server and check the console, or use any admin tool that shows player
identifiers. You want the one that starts with `license2:`.

### Adding everyone else

Do not edit the file again. Open **`/ggsettings` → Admins** and add them there —
online players are listed for one-click access, or you can paste an identifier.
Admins added this way are stored in your database and can be removed the same
way.

Anyone listed in `server_config.lua` **cannot** be removed in game. That is
deliberate: it is the route back in if something goes wrong. Keep yourself
there.

### If you use ACE permissions

With `ace = true`, these also grant access:

```cfg
add_ace group.admin gg.settings allow        # can edit
add_ace group.mod   gg.settings.view allow   # can look, cannot change
```

Set `ace = false` to ignore ACE entirely and use only the lists above.

---

## Using Script Studio

Type **`/ggsettings`** in game. `/jobsettings` does the same thing, and each
script also gets its own shortcut — `/taxisettings` opens straight to the taxi
job.

| Page | What it holds |
| --- | --- |
| Your scripts | Every setting, grouped, with search |
| Generic | Settings shared by all GG scripts — color, currency, daily reset |
| Bridges | What gg_lib connected to, and whether it worked |
| Admins | Who has access |
| Logs | Who changed what, and when |

Changes are staged until you press **Save**, so you can adjust several things
and apply them together. Anything needing a restart is labelled.

Each script also has a **Factory Reset** at the bottom of its page, which puts
everything back to how it shipped.

### Server-only settings

A setting marked **Server Only** — an upload key, an API token — is stored on
the server and never sent anywhere else. The page shows that a value is set,
not what it is, so you can replace it or clear it but not read it back. It is
left out of everything that goes to a player: the settings the client receives,
the live update after a save, and the old and new values in the log.

A script declares one by adding `server_only = true` to the setting:

```lua
settings.define("upload.api_key", {
    group       = "uploads",
    label       = "Upload API Key",
    type        = "string",
    server_only = true,
    default     = "",
})
```

Read it with `settings.read` on the **server** only — a client reading one gets
`nil`, because it was never given a value to hold. Leave `default` empty: config
files are shared scripts, so anything written there is already on every
player's disk. gg_lib prints a warning if a server-only setting ships one.

---

## Daily reset

One clock for every GG script. Whatever resets each day — progress, streaks,
claims, payouts — rolls over at the same moment, set once under
**Generic → Daily Reset** rather than in each script’s own config.

```lua
gg.daily.onReset(function()
    MySQL.query.await("UPDATE gg_studio_taxijob SET daily_progress = ?", { json.encode(FRESH) })
end)
```

And for the countdown every one of these ends up drawing:

```lua
gg.daily.clock()          -- "05:12:44"
gg.daily.secondsUntil()   -- 18764
gg.daily.remaining()      -- 5, 12, 44
```

### It is not a cron

A cron fires at a time, so a server that was switched off at that time never
gets it. gg_lib stores the last reset boundary each script dealt with, so the
question on startup is not "is it midnight" but "has a midnight passed since
this script last looked". Down for two hours across the reset, or down for a
week — it runs once on the way back up, either way.

A handler returning `false`, or throwing, means the day is **not** written off:
gg_lib tries again rather than losing the reset. Nothing is marked done until
the script says it finished.

A script gg_lib has never seen starts caught up, so installing something new
does not wipe what it shipped with. Move the reset time and the next one lands
on the new time, without waiting out the old one.

`gg_daily_reset` in the server console rolls everything over now, for testing.

---

## World waypoints

A waypoint is a distance, a unit and a label on a billboard out in the world.
It turns to face the camera, grows as you get further away so it stays
readable, and lifts itself over anything that gets between you and it.

```lua
gg.waypoint.create({
    id     = "dropoff",
    coords = vector3(-1035.7, -2731.8, 12.8),
    label  = "DROP OFF",
})

gg.waypoint.remove("dropoff")
```

Ids are scoped to the script that placed them, so `dropoff` in one script and
`dropoff` in another are two different waypoints. Everything a script places
is cleaned up for it when that script stops.

### Routes

A route is a run of waypoints where one is live at a time — race checkpoints,
a delivery round, a tow route. Setting the next point retires the one before
it, so a job only ever has to say where the player is going next.

```lua
gg.waypoint.setRoutePoint("lap", 1, checkpoints[1], { label = "CHECKPOINT 1" })
gg.waypoint.setRoutePoint("lap", 2, checkpoints[2], { label = "CHECKPOINT 2" })

gg.waypoint.clearRoute("lap")
```

Pass `keep_previous = true` to leave the last one standing and build a trail.

| Call | What it does |
| --- | --- |
| `create(data)` | Place one, or replace the one already under that id |
| `update(id, data)` | Change only the keys you pass |
| `remove(id)` / `clear()` | Take one away, or all of this script’s |
| `show(id)` / `hide(id)` | Leave it placed but stop drawing it |
| `exists(id)` | Whether it is placed |
| `setRoutePoint(routeId, index, coords, options)` | Move a route to its next point |
| `activeRoutePoint(routeId)` | `{ id, index, coords, label }`, or nil |
| `clearRoute(routeId)` | Remove every point on a route |

`data` takes `id`, `coords`, `label`, `render_distance`, `visible` and `meta`.

### Styles

The same waypoint can wear a different face depending on the job:

| Style | What it looks like |
| --- | --- |
| `race` | A big countdown you read at speed — distance, then the label |
| `taxi` | A destination plate — badge, name, then the distance |

```lua
gg.waypoint.create({ id = "fare", coords = coords, style = "taxi", label = "DROP OFF" })
```

Leave `style` out and you get `race`. Switching it on a placed waypoint takes
effect straight away — the texture behind it does not change.

Open **`/ggsettings` → Waypoints** to see every style, copy its export, change
what it says by default, and drop one in front of you for ten seconds to look
at it.

### Seeing one

There is a command for checking it works without writing any code:

```
/waypoint            place one at your feet
/waypoint map        place one at your marker on the map
/waypoint DROP OFF   place one at your feet saying something else
```

Run it again to take it away. Place one and walk off to watch it count up,
grow, switch to miles and lift itself over anything in the way. `/ggwaypoint`
does the same thing, for when another resource already owns the short name.

Each waypoint draws through its own 4096x2048 DUI, which is a real amount of
video memory. A handful at a time is fine; leaving dozens placed is not, and
gg_lib says so in the console if you do.

---

## Bridges

The **Bridges** page shows what gg_lib connected to and whether each connection
worked. If a script is not behaving, look here first.

Everything is detected automatically. To force a choice instead, open
`utility.lua` and name the resource:

```lua
framework = "qb-core",   -- leave blank to auto detect
```

A forced name that is not running is shown in red on the Bridges page, so a typo
is visible instead of silent.

The same page lets you choose who draws notifications, progress bars and text
prompts. Those apply the moment you pick them — no restart.

---

## Updating

Replace the folder and restart. Your settings are in your database and your
`server_config.lua` is not part of the download, so nothing you configured is
lost.

---

## Support

Discord: https://discord.gg/DqMXJzATph

---

## License

LGPL-3.0-or-later. See `LICENSE`.
