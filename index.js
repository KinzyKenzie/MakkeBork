/// Written on Node.JS v11.5.0
/// Based on the documentation provided by Twitch ( https://dev.twitch.tv/docs/irc/ )
/// Uses tmi.js v1.2.1

const path = require('path')
const tmi = require('tmi.js')
const fs = require('fs')

let commandPrefix = '!'
let opts = readJSONFile('./options.json', true)
opts['identity']['password'] += readJSONFile('./oauth.json', true)['token']

let millis = 0

let knownResponses = readJSONFile('./commands.json')
let knownCommands = { commands, addcom, editcom, delcom, caster, english, eng, tally, vote, votes }
let knownActions = { vohiyo }

let modRights = {
	addcom: true,
	editcom: true,
	delcom: true,
	caster: true
}

let voteList = {}

function readJSONFile(file, vital)
{
	var output = ''
	
	try { output = fs.readFileSync(path.resolve(__dirname, file)) }
	catch (err)
	{
		if (vital) 
		{
			console.log(`[*err] "${file}" file not found. Aborting ...`)
			process.exit(0)
		}
		else console.log(`[*err] "${file}" file not found. Continuing with empty Object`)
	}
	
	if (output != '') return JSON.parse(output)
	
	return {}
}

function renewFile (input)
{
	var output = input.replace('{', '{\n\t')
	
	output = output.replace(/":"/g, '": "')
	output = output.replace(/",/g, '",\n\t')
	output = output.replace('}', '\n}\n')
	
	fs.writeFileSync(path.resolve(__dirname, './commands.json'), output)
	knownResponses = ((input.length > 1) ? JSON.parse(input) : {})
}

function commands (target, context, mod, params)
{
	var cmds = []
	
	if (params.includes('all')) {
		for (var name in knownCommands) {
			if (name == 'commands' || name == 'english' || name == 'votes') continue
			cmds.push('!' + name)
		}
	}
	
	for (var name in knownResponses) cmds.push('!' + name)
	
	if (cmds.length > 0)
	{
		sendMessage(target, context, 'Listed commands: ' + cmds.join(', '))
	}
	else
	{
		sendMessage(target, context, 'The command-list is empty!')
	}
}

function addcom (target, context, mod, params)
{
	if (params.length > 0)
	{
		var cmd = params[0]
		
		if (cmd in knownResponses)
		{
			sendMessage(target, context, 'That command already exists!')
		}
		else
		{
			if (cmd.substr(0, 1) == commandPrefix) { cmd = cmd.substr(1, cmd.length) }
			
			var word = []
			for (i = 1; i < params.length; i++) word.push(params[i].replace(/"/g, '\\"'))
			
			var output = JSON.stringify(knownResponses)
			output = output.replace('}','')
			
			var entry = ((output.length > 1) ? ',' : '')
			entry += '"' + cmd + '":"' + word.join(' ') + '"'
			
			output += entry + '}'
			
			renewFile(output)
			
			sendMessage(target, context, 'Command \'' + cmd + '\' has been added!')
		}
	}
	else
	{
		sendMessage(target, context, 'Syntax: !addcom <command> <response>')
	}
}

function editcom (target, context, mod, params)
{
	if (params.length > 0)
	{
		var cmd = ((params[0].substr(0, 1) == commandPrefix) ?
			params[0].substr(1, params[0].length) :
			params[0])
		
		if (cmd in knownResponses)
		{
			// var word = []
			// for (i = 1; i < params.length; i++) word.push(params[i])
			var word = params
			word.unshift()
			
			knownResponses[cmd] = word.join(' ')
			renewFile(JSON.stringify(knownResponses))
			sendMessage(target, context, 'Command \'' + cmd + '\' has been edited!')
		}
		else
		{
			sendMessage(target, context, 'Command not found.')
		}
	}
	else
	{
		sendMessage(target, context, 'Syntax: !editcom <command> <new response>')
	}
}

function delcom (target, context, mod, params)
{
	if (params.length > 0)
	{
		var cmd = ((params[0].substr(0, 1) == commandPrefix) ?
			params[0].substr(1, params[0].length) :
			params[0])
		
		if (cmd in knownResponses)
		{
			var input = JSON.stringify(knownResponses)
			input = input.replace('{', '')
			input = input.replace('}', '')
			
			var entry = input.split(',')
			var output = '{'
			
			for (i = 0; i < entry.length; i++)
			{
				if (!entry[i].includes(cmd))
				{
					output += entry[i] + ','
				}
			}
			
			output = output.substring(0, output.length - 1)
			if (output.length > 0) output += '}'
			
			renewFile(output)
			
			sendMessage(target, context, 'Command \'' + cmd + '\' has been removed!')
		}
		else
		{
			sendMessage(target, context, 'Command not found.')
		}
	}
	else
	{
		sendMessage(target, context, 'Syntax: !delcom <command>')
	}
}

function caster (target, context, mod, params)
{
	if (params.length > 0) sendMessage(target, context, params[0] + ' is an awesome streamer, and you ' +
	'should definitely check them out at https://twitch.tv/' + params[0].toLowerCase())
	else sendMessage(target, context, 'Syntax: !caster <username>')
}

function eng (target, context, mod, params) { english(target, context, mod, params) }
function english (target, context, mod, params)
{
	if (params.length > 0) sendMessage(target, context, 'English Only please, ' + params[0] + '!')
	else sendMessage(target, context, 'English Only, please!')
}

function tally (target, context, mod, params)
{
	if (params.length > 0)
	{
		var list = inVoteList(params[0])
		
		if (list != null)
		{
			var names = []
			
			voteList[list].forEach(function(element) {
				names.push(element)
			})
			
			var pronoun = ((names.length == 1) ? 'person' : 'peeps')
			
			sendMessage(target, context, voteList[list].length + ' ' + pronoun + ' voted for \'' + list +
			'\': ' + names.join(', '))
		}
		else
		{
			sendMessage(target, context, 'No vote exists with that name!')
		}
	}
	else
	{
		sendMessage(target, context, 'Syntax: !vote <active vote>')
	}
}

function vote (target, context, mod, params)
{
	if (params.length > 0)
	{
		var list = inVoteList(params[0])
		
		if (list != null)
		{
			if (!voteList[list].includes(context.username))
			{
				voteList[list].push(context.username)
				sendMessage(target, context, '@' + context.username + ' voted for \'' + list +
				'\'. Votes for this now at ' + voteList[list].length)
			}
			else { sendMessage(target, context, 'You already voted for that!') }
		}
		else if (mod)
		{
			if (params[1] == '++') voteList[params[0]] = [ context.username ]
			else voteList[params[0]] = []
			
			sendMessage(target, context, 'Added \'' + params[0] + '\' to the votes list')
		}
	}
	else
	{
		votes (target, context, mod, params)
	}
}

function votes (target, context, mod, params)
{
	if (Object.keys(voteList).length == 0)
	{
		sendMessage(target, context, 'There are no ongoing votes - A mod can make one at any time with ' +
		'!vote <word>')
	}
	else	
	{
		var msg = []
		
		for (var list in voteList) msg.push(list + ' (' + voteList[list].length + ')')
		
		sendMessage(target, context, 'Ongoing votes: ' + msg.join(', '))
	}
}

function vohiyo (target, context, mod, params)
{
	params[0] = 'OhMyDog'
	respondFull(target, context, mod, params)
}

function respondQuote (target, context, mod, params)
{
	sendMessage(target, context, params[0])
}

function respondFull (target, context, mod, params)
{
	sendMessage(target, context, params.join(' '))
}

function sendMessage (target, context, message)
{
	if (context['message-type'] === 'whisper')
	{
		client.whisper(target, message)
	}
	else
	{
		if (!message.includes('OhMyDog')) { message += ' OhMyDog' }
		client.say(target, message)
	}
}

function inVoteList(arg)
{
	for (var check in voteList)
	{
		if (arg.toLowerCase() == check.toLowerCase())
		{
			return check
		}
	}
	return null
}

function timeCheck ()
{
	if (millis > Date.now() - 2500) return false
	return true
}

function modCheck (user)
{
	if (user.mod) return true
	if (user['badges-raw'].includes('broadcaster')) return true
	return false
}

console.log(`[*sys] Initializing ${opts['identity']['username']} ...`)

let client = new tmi.client(opts)

client.on('message', onMessageHandler)
client.on('connected', onConnectedHandler)
client.on('disconnected', onDisconnectedHandler)

client.on('hosted', onHostedHandler)
// client.on('cheer', onCheerHandler)
client.on('subscription', onSubscriptionHandler)
client.on('subanniversary', onResubHandler)

client.connect()

function onMessageHandler (target, context, msg, self)
{
	if (self) { return }
	
	if (!timeCheck())
	{
		console.log(`[${context['message-type']}] ${context.username}: ${msg}`)
		console.log(`[*err] Message from ${context.username} left unparsed - last command too recent`)
		return
	}
	
	const parse = msg.split(' ')
	const commandName = parse[0].toLowerCase()
	const params = parse.splice(1)
	if (msg.substr(0, 1) == commandPrefix)
	{
		// Strip the '!' from the command
		let commandActual = commandName.slice(1)
		
		if (commandActual in knownCommands)
		{
			const command = knownCommands[commandActual]
			
			if (modRights[commandActual] && !modCheck(context))
			{
				console.log(`[*cmd] ${context.username} tried to execute a mod-only command`)
				return
			}
			
			command(target, context, modCheck(context), params)
			millis = Date.now()
			console.log(`[*cmd] Executed command '${commandActual}' for ${context.username}`)
		}
		else if (commandActual in knownResponses)
		{
			var msg = knownResponses[commandActual]
			sendMessage(target, context, msg)
			console.log(`[*cmd] Executed command '${commandActual}' for ${context.username}`)
		}
		else
		{
			console.log(`[*err] Unknown command '${commandActual}' from ${context.username}`)
		}
	}
	else
	{
		if (commandName in knownActions)
		{
			const command = knownActions[commandName]
			command(target, context, modCheck(context), msg.split(' '))
			
			millis = Date.now()
			console.log(`[*cmd] Executed command '${commandName}' for ${context.username}`)
		}
		else
		{
			console.log(`[${context['message-type']}] ${context.username}: ${msg}`)
		}
	}
}

function onHostedHandler (channel, username, viewers, autohost)
{
	console.log(`[*sys] Host received from ${username} (${viewers})`)
	if (!autohost && viewers > 0) client.say(channel, 'OhMyDog ' + username + ' is bringing over ' +
	viewers + ' of their mates! OhMyDog')
}

function onCheerHandler (channel, tags, msg) // Might do something with this in future
{
	console.log(`[*sys] Cheer received from ${username}`)
}

// 'method' is an Object containing 'prime', 'plan', and 'planName'
function onSubscriptionHandler (channel, username, method, message, userstate)
{
	console.log(`[*sys] Sub received from ${username}`)
	
	client.say(channel, 'OhMyDog ' + username + ' just subbed! OhMyDog')
}

function onResubHandler (channel, username, months, msg, userstate, method)
{
	console.log(`[*sys] Resub received from ${username}`)
	client.say(channel, 'OhMyDog ' + username + ' has been subbed for ' + months + ' months! OhMyDog')
}

function onConnectedHandler (addr, port)
{
	client.color('Red')
	console.log(`[*sys] Connected to ${opts['channels'][0]} @ ${addr}:${port}`)
}

function onDisconnectedHandler (reason)
{
	console.log(`[*sys] Disconnected: ${reason}`)
	process.exit(1)
}
