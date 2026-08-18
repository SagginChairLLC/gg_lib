fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'gg_lib'
author 'GG Studio'
license 'LGPL-3.0-or-later'
version '1.0.1'
description 'GG Studio | Import-based library: bridge, gg.* modules, /jobsettings editor | Discord: https://discord.gg/DqMXJzATph'

ui_page "http://localhost:5180/"

files {
    'init.lua',
    'utility.lua',
    'bridge/manifest.lua',
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
