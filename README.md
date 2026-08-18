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

**Open `server_config.lua` and put your license in the list:**

```lua
return {
    admins = {
        "license2:6e713bc45df69b1338e94c292948ef0053ffb638",
    },

    ace = true,
}
```

Restart gg_lib and type **`/ggsettings`** in game.

> `server_config.lua` never reaches players. It is not downloaded to their game
> the way the rest of the resource is, so the list is safe to keep here.

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
| Generic | Settings shared by all GG scripts — colour, currency, daily reset |
| Bridges | What gg_lib connected to, and whether it worked |
| Admins | Who has access |
| Logs | Who changed what, and when |

Changes are staged until you press **Save**, so you can adjust several things
and apply them together. Anything needing a restart is labelled.

Each script also has a **Factory Reset** at the bottom of its page, which puts
everything back to how it shipped.

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

Replace the folder and restart. Your settings are in your database, so nothing
you configured is lost.

---

## Support

Discord: https://discord.gg/DqMXJzATph

---

## License

LGPL-3.0-or-later. See `LICENSE`.
