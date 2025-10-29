lua54 'yes' fx_version 'cerulean' game 'gta5' lua54 'yes' version '0.0.1'



author 'GG Studio'
description 'GG studio | Discord: https://discord.gg/DqMXJzATph'



shared_scripts {
    '@ox_lib/init.lua',
    'utility.lua',
}

-- Production build
--ui_page "web/dist/index.html"
-- Hot reloading Live Server
--  ui_page "http://localhost:5173/"

files {
    'utility.lua',
    'init/shared.lua',
    'bridge/**/**/*.lua',

    -- 'web/dist/index.html',
    -- 'web/dist/**/*'
}
server_scripts {   
    '@oxmysql/lib/MySQL.lua',
    'init/server.lua',
    'lib/**/server.lua',
}

client_scripts { 
    'init/client.lua',
    'lib/**/client.lua',
}

dependencies {
	'ox_lib',
    'oxmysql',
}