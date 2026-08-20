fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'gg_lib'
author 'GG Studio'
license 'LGPL-3.0-or-later'
version '1.0.1'
description 'GG Studio | Import-based library: bridge, gg.* modules, /jobsettings editor | Discord: https://discord.gg/DqMXJzATph'

-- Ships the built UI. Swap these two lines to develop against the vite dev
-- server (web/vite.config.ts serves on 5180); leaving the dev URL active means
-- no gg_lib UI at all in game -- no popups, no editor, no tool HUD.
ui_page "web/dist/index.html"
-- ui_page "http://localhost:5180/"

files {
    'init.lua',
    'utility.lua',
    'bridge/manifest.lua',
    'bridge/fallback.lua',
    'bridge/**/client.lua',
    'bridge/**/server.lua',
    'modules/**/client.lua',
    'modules/**/server.lua',
    'modules/**/shared.lua',
    'web/dist/index.html',
    'web/dist/**/*',
}

shared_scripts {
    '@ox_lib/init.lua',
}

client_scripts {
    'core/client/*.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'core/server/*.lua',
}

dependencies {
    'ox_lib',
    'oxmysql',
}
