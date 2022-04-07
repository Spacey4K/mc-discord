const Discord = require('discord.js');
const client = new Discord.Client({
    intents: ["GUILDS", "GUILD_MESSAGES"],
    allowedMentions: {
        repliedUser: false,
    }
});

const { spawn } = require('child_process')
const axios = require('axios');
const fs = require('fs');

const whiteListPath = '../server/whitelist.json'
const { PREFIX, BOT_TOKEN, DISCORD_CHANNEL_ID, COLOR } = require('./config.json')

let mc = null

client.on('ready', async () => {
    client.user.setActivity('the loading screen', { type: 'WATCHING' })
    console.log(`Bot logged into Discord as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    const clean = message.cleanContent
    if (message.channel.id == DISCORD_CHANNEL_ID.CHAT && mc && clean && !clean.includes('<')) mc.stdin.write(`tellraw @a "<${message.author.tag}> ${clean}"\n`)

    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command == 'start') {
        const msg = await message.reply(`Server is starting!`)
        mc = spawn('start.bat')

        mc.stdout.on('data', (out) => {
            const outed = out.toString()
            if (outed.includes('Done')) {
                msg.delete()
                message.reply('Server is online')
                client.user.setActivity('Minecraft', { type: 'PLAYING' })

            }
            if (outed.includes('[Server thread/INFO]: <')) {
                const cut = outed.split('<')[1]
                client.channels.cache.get(DISCORD_CHANNEL_ID.CHAT).send("CHAT: <" + cut)
            }
            console.log('stdout:', outed);
            client.channels.cache.get(DISCORD_CHANNEL_ID.LOGS).send("OUT: " + outed)
        });

        mc.stderr.on('data', (err) => {
            console.error('stderr:', err.toString());
            client.channels.cache.get(DISCORD_CHANNEL_ID.LOGS).send("ERR: " + err.toString())

        });

        mc.on('close', (code) => {
            console.log('Child process exited with code:', code.toString());
        });
    }
    else if (command == 'cmd') {
        const cmd = args.join(' ')
        if (!cmd.length) return message.reply(`No command provided!`)
        if (!mc) return message.reply(`Server not running`)
        await mc.stdin.write(cmd + '\n');
        message.reply(`Executed \`${cmd}\``)
    }
    else if (command == 'stop') {
        if (!mc) return message.reply(`Server is already stopped`)
        mc.stdin.write('stop\n');
        message.reply(`Server stopped`)
    }
    else if (command == 'join') {
        const search = args.join(' ')
        if (!search.length) return message.reply(`Please provide an username`)
        const uri = `https://api.ashcon.app/mojang/v2/user/${search}`

        try {
            user = await axios.get(uri)
        } catch (error) {
            return message.reply(`Unable to find that user`)
        }

        const { uuid, username: name } = user.data
        const whitelist = JSON.parse(fs.readFileSync(whiteListPath))
        const found = whitelist.find(user => user.uuid == uuid);
        if (found) return message.reply(`You are already whitelisted`)

        whitelist.push({ name, uuid })
        fs.writeFile(whiteListPath, JSON.stringify(whitelist), (err) => {
            if (err) return console.error(err)
        })
        if (mc) mc.stdin.write('whitelist reload\n');
        message.reply(`Added ${search} (${uuid}) to whitelist`)
    }
    else if (command == 'whitelist') {
        const whitelist = JSON.parse(fs.readFileSync(whiteListPath))
        const whitelisted = whitelist.map(user => user.name).join(' ; ')
        message.reply(`Whitelisted players: ${Discord.Util.escapeMarkdown(whitelisted)}`)
    } else if (command == 'help') {
        const embed = new Discord.MessageEmbed()
            .setTitle(`Command list`)
            .setColor(COLOR)
            .setDescription(`
\`${PREFIX}start\` - start the server
\`${PREFIX}cmd\` - execute a command on the server
\`${PREFIX}stop\` - stop the server
\`${PREFIX}join\` - add a player to the whitelist
\`${PREFIX}whitelist\` - view whitelisted players
\`${PREFIX}help\` - show this message
`)
        message.reply({ embeds: [embed] })
    }
});

client.login(BOT_TOKEN)