const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
require('dotenv').config();
const log_channel_id = process.env.log_channel_id || ''; 
let logChannel = null;


const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

function initializeLogging() {
  if (log_channel_id) {
    logChannel = client.channels.cache.get(log_channel_id);
    if (logChannel) {
      console.log(`Logging initialized to channel #${logChannel.name}`);
    } else {
      console.warn(`Could not find log channel with ID: ${log_channel_id}`);
    }
  } else {
    console.warn('No log channel ID provided. Transaction logging disabled.');
  }
}

function createEmbed(type, title, description, fields = [], thumbnail = null, color = null) {
  if (!color) {
    switch (type) {
      case 'success':
        color = 0x00FF00;
        break;
      case 'error':
        color = 0xFF0000;
        break;
      case 'warning':
        color = 0xFFA500;
        break;
      case 'info':
        color = 0x0099FF;
        break;
      case 'deposit':
        color = 0x9932CC;
        break;
      case 'withdraw':
        color = 0xFFD700;
        break;
      case 'inventory':
        color = 0x1E90FF;
        break;
      default:
        color = 0x5865F2;
    }
  }


  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  
  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }
  
  if (fields && fields.length > 0) {
    fields.forEach(field => {
      embed.addFields({ name: field.name, value: field.value, inline: field.inline || false });
    });
  }
  
  return embed;
}


async function logTransaction(type, user, details = {}) {
  if (!logChannel) return;
  
  try {
    const userMention = `<@${user.discord_id}>`;
    
    let logEmbed;
    
    if (type === 'deposit') {
      logEmbed = new EmbedBuilder()
        .setTitle('🔄 Deposit Initiated')
        .setDescription(`${userMention} has initiated a deposit`)
        .setColor(0x9932CC) 
        .addFields(
          { name: 'Roblox Username', value: user.roblox_username, inline: true },
          { name: 'Transaction ID', value: details.transactionId || 'Unknown', inline: true },
          { name: 'Status', value: '⏳ Pending', inline: true }
        )
        .setTimestamp();
    } 
    else if (type === 'deposit_complete') {
      const skinsList = details.skins && details.skins.length > 0 
        ? details.skins.map(skin => `• ${skin}`).join('\n') 
        : 'None';
      
      logEmbed = new EmbedBuilder()
        .setTitle('✅ Deposit Completed')
        .setDescription(`${userMention} has completed a deposit`)
        .setColor(0x00FF00) 
        .addFields(
          { name: 'Roblox Username', value: user.roblox_username, inline: true },
          { name: 'Transaction ID', value: details.transactionId || 'Unknown', inline: true },
          { name: 'Status', value: '✅ Completed', inline: true },
          { name: 'Deposited Skins', value: skinsList, inline: false }
        )
        .setTimestamp();
    }
    else if (type === 'withdraw') {
      const skinsList = details.skins && details.skins.length > 0 
        ? details.skins.map(skin => `• ${skin}`).join('\n') 
        : 'None';
      
      logEmbed = new EmbedBuilder()
        .setTitle('🔄 Withdrawal Initiated')
        .setDescription(`${userMention} has initiated a withdrawal`)
        .setColor(0xFFD700) 
        .addFields(
          { name: 'Roblox Username', value: user.roblox_username, inline: true },
          { name: 'Transaction ID', value: details.transactionId || 'Unknown', inline: true },
          { name: 'Status', value: '⏳ Pending', inline: true },
          { name: 'Requested Skins', value: skinsList, inline: false }
        )
        .setTimestamp();
    }
    else if (type === 'withdraw_complete') {
      const skinsList = details.skins && details.skins.length > 0 
        ? details.skins.map(skin => `• ${skin}`).join('\n') 
        : 'None';
      
      logEmbed = new EmbedBuilder()
        .setTitle('✅ Withdrawal Completed')
        .setDescription(`${userMention} has completed a withdrawal`)
        .setColor(0x00FF00)
        .addFields(
          { name: 'Roblox Username', value: user.roblox_username, inline: true },
          { name: 'Transaction ID', value: details.transactionId || 'Unknown', inline: true },
          { name: 'Status', value: '✅ Completed', inline: true },
          { name: 'Withdrawn Skins', value: skinsList, inline: false }
        )
        .setTimestamp();
    }
    else if (type === 'transaction_cancelled') {
      logEmbed = new EmbedBuilder()
        .setTitle('❌ Transaction Cancelled')
        .setDescription(`${userMention} has cancelled a ${details.transactionType || 'unknown'} transaction`)
        .setColor(0xFF0000) 
        .addFields(
          { name: 'Roblox Username', value: user.roblox_username, inline: true },
          { name: 'Transaction ID', value: details.transactionId || 'Unknown', inline: true },
          { name: 'Reason', value: details.reason || 'User requested cancellation', inline: false }
        )
        .setTimestamp();
    }
    else if (type === 'registration') {
      logEmbed = new EmbedBuilder()
        .setTitle('📝 New Registration')
        .setDescription(`${userMention} has registered with the trading system`)
        .setColor(0x1E90FF) 
        .addFields(
          { name: 'Roblox Username', value: user.roblox_username, inline: true },
          { name: 'Discord ID', value: user.discord_id, inline: true }
        )
        .setTimestamp();
    }
    
    if (logEmbed) {
      await logChannel.send({ embeds: [logEmbed] });
    }
  } catch (error) {
    console.error('Error sending log to channel:', error);
  }
}





const userLocks = new Map(); 

const db = new sqlite3.Database('../bot.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS users (
      discord_id TEXT PRIMARY KEY,
      roblox_username TEXT NOT NULL,
      registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      roblox_username TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      skins TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (discord_id) REFERENCES users (discord_id)
    )`);
  }
});

const api_url = process.env.api_url || 'http://localhost:3000';
const private_server_url = process.env.private_server_url || 'https://www.roblox.com/games/2788229376?privateServerLinkCode=60751427250446075900620073561763';


async function checkSystemStatus() {
  try {
    const response = await axios.get(`${api_url}/system-status`);
    return response.data;
  } catch (error) {
    console.error('Error checking system status:', error);
    return { status: 'unknown', locked: false }; 
  }
}


const allCommands = [
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your Roblox account')
    .addStringOption(option => 
      option.setName('roblox_username')
        .setDescription('Your Roblox username')
        .setRequired(true)),
        
  new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Deposit skins to the bot'),
    
  new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw skins from the bot')
    .addStringOption(option => 
      option.setName('skins')
        .setDescription('The skins you want to withdraw (comma-separated)')
        .setRequired(true)),
        
  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your skin inventory'),
  
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check your current transaction status'),
    
  new SlashCommandBuilder()
    .setName('cancel')
    .setDescription('Cancel your current transaction'),
  
  new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Coinflip gambling commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new coinflip game')
        .addStringOption(option =>
          option.setName('skin')
            .setDescription('The skin you want to bet')
            .setRequired(true)
            .setAutocomplete(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Join an existing coinflip game')
        .addStringOption(option =>
          option.setName('game_id')
            .setDescription('The ID of the game you want to join')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('skin')
            .setDescription('The skin you want to bet')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('client_seed')
            .setDescription('Optional client seed for fairness verification')
            .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('approve')
        .setDescription('Approve or reject a pending coinflip game')
        .addStringOption(option =>
          option.setName('game_id')
            .setDescription('The ID of the game to approve or reject')
            .setRequired(true)
            .setAutocomplete(true))
        .addBooleanOption(option =>
          option.setName('approve')
            .setDescription('Whether to approve (true) or reject (false) the game')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('Cancel your active coinflip game')
        .addStringOption(option =>
          option.setName('game_id')
            .setDescription('The ID of the game you want to cancel')
            .setRequired(true)
            .setAutocomplete(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('View your coinflip game history')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('games')
        .setDescription('List active coinflip games')
    ),
    
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the coinflip leaderboard'),
    
  new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin commands for managing the trading system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add_skin')
        .setDescription('Add a skin to a player\'s inventory')
        .addStringOption(option =>
          option.setName('discord_id')
            .setDescription('The Discord ID of the player')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('skin_name')
            .setDescription('The name of the skin to add')
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option =>
          option.setName('quantity')
            .setDescription('The quantity of skins to add (default: 1)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove_skin')
        .setDescription('Remove a skin from a player\'s inventory')
        .addStringOption(option =>
          option.setName('discord_id')
            .setDescription('The Discord ID of the player')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('skin_name')
            .setDescription('The name of the skin to remove')
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option =>
          option.setName('quantity')
            .setDescription('The quantity of skins to remove (default: 1)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('create_skin')
        .setDescription('Create a new skin in the database')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('The name of the new skin')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('value')
            .setDescription('The value of the skin in value')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('rarity')
            .setDescription('The rarity of the skin')
            .setRequired(true)
            .addChoices(
              { name: 'Common', value: 'common' },
              { name: 'Uncommon', value: 'uncommon' },
              { name: 'Rare', value: 'rare' },
              { name: 'Epic', value: 'epic' },
              { name: 'Legendary', value: 'legendary' },
              { name: 'Mythic', value: 'mythic' }
            ))
        .addStringOption(option =>
          option.setName('image_url')
            .setDescription('The URL of the skin image')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('update_skin')
        .setDescription('Update an existing skin\'s value')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('The name of the skin to update')
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option =>
          option.setName('value')
            .setDescription('The new value of the skin in value')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view_inventory')
        .setDescription('View a player\'s inventory')
        .addStringOption(option =>
          option.setName('discord_id')
            .setDescription('The Discord ID of the player')
            .setRequired(true)))
];








const rest = new REST({ version: '10' }).setToken(process.env.discord_token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    
    await rest.put(
      Routes.applicationCommands(process.env.client_id),
      { body: allCommands.map(command => command.toJSON()) },
    );
    

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

async function checkUserLock(discordId) {
  try {
    const response = await axios.get(`${api_url}/transaction-status/${discordId}`);
    return response.data.locked;
  } catch (error) {
    console.error('Error checking user lock status:', error);
    return false;
  }
}

function updateUserLock(discordId, isLocked) {
  if (isLocked) {
    userLocks.set(discordId, true);
  } else {
    userLocks.delete(discordId);
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isAutocomplete()) return;
  
  try {
    const { commandName } = interaction;
    const focusedOption = interaction.options.getFocused(true);
    const discordId = interaction.user.id;
    
    if (commandName === 'coinflip') {
      if (focusedOption.name === 'skin') {
        try {
          const subcommand = interaction.options.getSubcommand();
          
          if (subcommand === 'create') {
            const response = await axios.get(`${api_url}/inventory?discordId=${discordId}`);
            const skins = response.data.skins || [];
            
            const filtered = skins.filter(skin => 
              skin.toLowerCase().includes(focusedOption.value.toLowerCase())
            ).slice(0, 25);
            
            await interaction.respond(
              filtered.map(skin => ({
                name: skin,
                value: skin
              }))
            );
          } else if (subcommand === 'join') {
            const gameId = interaction.options.getString('game_id');
            
            if (gameId) {
              const response = await axios.get(`${api_url}/coinflip/eligible-skins/${gameId}/${discordId}`);
              const eligibleSkins = response.data.eligibleSkins || [];
              
              const filtered = eligibleSkins
                .filter(skin => skin.skin_name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                .slice(0, 25);
              
              await interaction.respond(
                filtered.map(skin => ({
                  name: `${skin.skin_name} (Value: ${skin.value})`,
                  value: skin.skin_name
                }))
              );
            } else {
              const response = await axios.get(`${api_url}/inventory?discordId=${discordId}`);
              const skins = response.data.skins || [];
              
              const filtered = skins.filter(skin => 
                skin.toLowerCase().includes(focusedOption.value.toLowerCase())
              ).slice(0, 25);
              
              await interaction.respond(
                filtered.map(skin => ({
                  name: skin,
                  value: skin
                }))
              );
            }
          }
        } catch (error) {
          console.error('Error handling skin autocomplete:', error);
          await interaction.respond([]);
        }
      } else if (focusedOption.name === 'game_id') {
        try {
          const response = await axios.get(`${api_url}/coinflip/active`);
          const games = response.data.games || [];
          
          const filtered = games
            .filter(game => 
              game.gameId.includes(focusedOption.value) || 
              game.creator.robloxUsername.toLowerCase().includes(focusedOption.value.toLowerCase())
            )
            .slice(0, 25);
          
          await interaction.respond(
            filtered.map(game => ({
              name: `${game.creator.robloxUsername}: ${game.betSkin} (Value: ${game.skinValue})`,
              value: game.gameId
            }))
          );
        } catch (error) {
          console.error('Error handling game_id autocomplete:', error);
          await interaction.respond([]);
        }
      }
    } else if (commandName === 'admin') {
      if (focusedOption.name === 'skin_name') {
        try {
          const subcommand = interaction.options.getSubcommand();
          const discordId = interaction.options.getString('discord_id');
          
          if (subcommand === 'remove_skin' && discordId) {
            const response = await axios.get(`${api_url}/inventory?discordId=${discordId}`);
            const skins = response.data.skins || [];
            
            const filtered = skins
              .filter(skin => skin.toLowerCase().includes(focusedOption.value.toLowerCase()))
              .slice(0, 25);
            
            await interaction.respond(
              filtered.map(skin => ({
                name: skin,
                value: skin
              }))
            );
          } else {
            const response = await axios.get(`${api_url}/skins`);
            const skins = response.data.skins || [];
            
            const filtered = skins
              .filter(skin => skin.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
              .slice(0, 25);
            
            await interaction.respond(
              filtered.map(skin => ({
                name: `${skin.name} (${skin.value.toLocaleString()} value - ${skin.rarity})`,
                value: skin.name
              }))
            );
          }
        } catch (error) {
          console.error('Error handling skin name autocomplete:', error);
          await interaction.respond([]);
        }
      } else if (focusedOption.name === 'name' && interaction.options.getSubcommand() === 'update_skin') {
        try {
          const response = await axios.get(`${api_url}/skins`);
          const skins = response.data.skins || [];
          
          const filtered = skins
            .filter(skin => skin.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
            .slice(0, 25);
          
          await interaction.respond(
            filtered.map(skin => ({
              name: `${skin.name} (${skin.value.toLocaleString()} value - ${skin.rarity})`,
              value: skin.name
            }))
          );
        } catch (error) {
          console.error('Error handling skin name autocomplete:', error);
          await interaction.respond([]);
        }
      }
    }
  } catch (error) {
    console.error('Error in autocomplete handler:', error);
    await interaction.respond([]).catch(console.error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  try {
    const { commandName } = interaction;
    const discordId = interaction.user.id;
    
    if (commandName === 'admin') {
      const member = interaction.member;
      if (!member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({ 
          content: '❌ You do not have permission to use admin commands.',
          ephemeral: true
        });
        return;
      }
      
      const subcommand = interaction.options.getSubcommand();
      
      switch (subcommand) {
        case 'add_skin':
          await handleAddSkin(interaction);
          break;
        case 'remove_skin':
          await handleRemoveSkin(interaction);
          break;
        case 'create_skin':
          await handleCreateSkin(interaction);
          break;
        case 'update_skin':
          await handleUpdateSkin(interaction);
          break;
        case 'view_inventory':
          await handleViewInventory(interaction);
          break;
      }
      return;
    }

    if (commandName === 'coinflip') {
      await handleCoinflipCommand(interaction);
      return;
    } else if (commandName === 'leaderboard') {
      await handleLeaderboardCommand(interaction);
      return;
    }
  
    if (commandName === 'register') {
      await handleRegister(interaction);
      return;
    } else if (commandName === 'status') {
      await handleStatus(interaction);
      return;
    } else if (commandName === 'cancel') {
      await handleCancel(interaction);
      return;
    }
    
    const isLocked = await checkUserLock(discordId);
    if (isLocked && commandName !== 'status') {
      await interaction.reply({ 
        content: '⚠️ You have an active transaction in progress. Please complete it first or check `/status` for details.', 
        ephemeral: true 
      });
      return;
    }
    
    switch (commandName) {
      case 'deposit':
        await handleDeposit(interaction);
        break;
      case 'withdraw':
        await handleWithdraw(interaction);
        break;
      case 'inventory':
        await handleInventory(interaction);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${interaction.commandName}:`, error);
    
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'There was an error processing your request.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error processing your request.', ephemeral: true });
      }
    } catch (replyError) {
      console.error('Error sending error message:', replyError);
    }
  }
});

async function handleAdminCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  switch (subcommand) {
    case 'add_skin':
      await handleAddSkin(interaction);
      break;
    case 'remove_skin':
      await handleRemoveSkin(interaction);
      break;
    case 'create_skin':
      await handleCreateSkin(interaction);
      break;
    case 'update_skin':
      await handleUpdateSkin(interaction);
      break;
    case 'view_inventory':
      await handleViewInventory(interaction);
      break;
  }
}

async function handleAddSkin(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.options.getString('discord_id');
  const skinName = interaction.options.getString('skin_name');
  const quantity = interaction.options.getInteger('quantity') || 1;
  
  if (quantity <= 0) {
    return interaction.editReply({
      content: '❌ Quantity must be positive.',
      ephemeral: true
    });
  }
  
  db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return interaction.editReply({
        content: '❌ Database error. Please try again later.',
        ephemeral: true
      });
    }
    
    if (!user) {
      return interaction.editReply({
        content: '❌ User not found. Make sure they are registered.',
        ephemeral: true
      });
    }
    
    db.get('SELECT * FROM skins WHERE name = ?', [skinName], (err, skin) => {
      if (err) {
        console.error('Database error:', err);
        return interaction.editReply({
          content: '❌ Database error. Please try again later.',
          ephemeral: true
        });
      }
      
      if (!skin) {
        return interaction.editReply({
          content: `❌ Skin "${skinName}" not found in the database.`,
          ephemeral: true
        });
      }
      
      try {
        const stmt = db.prepare('INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)');
        
        for (let i = 0; i < quantity; i++) {
          stmt.run(discordId, skinName);
        }
        
        stmt.finalize();
        
        const successEmbed = createEmbed(
          'success',
          '✅ Skin Added to Inventory',
          `Successfully added ${quantity}x ${skinName} to <@${discordId}>'s inventory.`,
          [
            { name: 'Skin', value: skinName, inline: true },
            { name: 'Quantity', value: quantity.toString(), inline: true },
            { name: 'Value', value: `${skin.value.toLocaleString()} value`, inline: true },
            { name: 'User', value: `<@${discordId}> (${user.roblox_username})`, inline: true }
          ]
        );
        
        interaction.editReply({ embeds: [successEmbed], ephemeral: true });
      } catch (error) {
        console.error('Error adding skin:', error);
        interaction.editReply({
          content: '❌ Error adding skin to inventory.',
          ephemeral: true
        });
      }
    });
  });
}

async function handleRemoveSkin(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.options.getString('discord_id');
  const skinName = interaction.options.getString('skin_name');
  const quantity = interaction.options.getInteger('quantity') || 1;
  
  if (quantity <= 0) {
    return interaction.editReply({
      content: '❌ Quantity must be positive.',
      ephemeral: true
    });
  }
  
  db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], async (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return interaction.editReply({
        content: '❌ Database error. Please try again later.',
        ephemeral: true
      });
    }
    
    if (!user) {
      return interaction.editReply({
        content: '❌ User not found. Make sure they are registered.',
        ephemeral: true
      });
    }
    
    db.get('SELECT COUNT(*) as count FROM inventory WHERE discord_id = ? AND skin_name = ?', 
      [discordId, skinName], async (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return interaction.editReply({
            content: '❌ Database error. Please try again later.',
            ephemeral: true
          });
        }
        
        const skinCount = row ? row.count : 0;
        
        if (skinCount < quantity) {
          return interaction.editReply({
            content: `❌ User only has ${skinCount}x ${skinName}, can't remove ${quantity}.`,
            ephemeral: true
          });
        }
        
        try {
          let removed = 0;
          
          for (let i = 0; i < quantity; i++) {
            await new Promise((resolve, reject) => {
              db.get(
                'SELECT id FROM inventory WHERE discord_id = ? AND skin_name = ? LIMIT 1',
                [discordId, skinName],
                (err, row) => {
                  if (err) {
                    console.error('Error getting skin ID:', err);
                    reject(err);
                    return;
                  }
                  
                  if (!row) {
                    console.warn(`No more ${skinName} found for user ${discordId}`);
                    resolve();
                    return;
                  }
                  
                  db.run(
                    'DELETE FROM inventory WHERE id = ?',
                    [row.id],
                    (err) => {
                      if (err) {
                        console.error('Error deleting skin:', err);
                        reject(err);
                      } else {
                        removed++;
                        resolve();
                      }
                    }
                  );
                }
              );
            }).catch(error => {
              console.error('Error removing skin:', error);
              throw error;
            });
          }
          
          const successEmbed = createEmbed(
            'success',
            '✅ Skin Removed from Inventory',
            `Successfully removed ${removed}x ${skinName} from <@${discordId}>'s inventory.`,
            [
              { name: 'Skin', value: skinName, inline: true },
              { name: 'Removed', value: removed.toString(), inline: true },
              { name: 'Remaining', value: (skinCount - removed).toString(), inline: true },
              { name: 'User', value: `<@${discordId}> (${user.roblox_username})`, inline: true }
            ]
          );
          
          interaction.editReply({ embeds: [successEmbed], ephemeral: true });
        } catch (error) {
          console.error('Error removing skin:', error);
          interaction.editReply({
            content: `❌ Error removing skin from inventory: ${error.message}`,
            ephemeral: true
          });
        }
      }
    );
  });
}

async function handleApprove(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const discordId = interaction.user.id;
  const gameId = interaction.options.getString('game_id');
  const approve = interaction.options.getBoolean('approve');
  
  try {
    const gameResponse = await axios.get(`${api_url}/coinflip/game/${gameId}`);
    const game = gameResponse.data;
    
    if (game.status !== 'pending_approval') {
      const errorEmbed = createEmbed(
        'error',
        'Game Error',
        `This game is not pending approval (Status: ${game.status}).`
      );
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    
    if (game.creator.discordId !== discordId) {
      const errorEmbed = createEmbed(
        'error',
        'Permission Error',
        'You can only approve or reject your own games.'
      );
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    
    const response = await axios.post(`${api_url}/coinflip/approve/${gameId}`, {
      discordId: discordId,
      approved: approve
    });
    
    if (approve) {
      const result = response.data;
      
      const userWon = result.winner.discordId === discordId;
        
      const resultEmbed = createEmbed(
        userWon ? 'success' : 'error',
        `🎲 Coinflip Result: ${userWon ? 'YOU WON!' : 'You Lost'}`,
        userWon ?
          `Congratulations! You won the coinflip against ${result.joiner.robloxUsername}!` :
          `Better luck next time! ${result.joiner.robloxUsername} won the coinflip.`,
        [
          {
            name: '👤 Creator (You)',
            value: `${result.creator.robloxUsername} with ${Array.isArray(result.creator.skins) ? result.creator.skins.join(', ') : result.creator.skins} (${formatValue(result.creator.skinsValue)} value)`,
            inline: false
          },
          {
            name: '👤 Joiner',
            value: `${result.joiner.robloxUsername} with ${Array.isArray(result.joiner.skins) ? result.joiner.skins.join(', ') : result.joiner.skins} (${formatValue(result.joiner.skinsValue)} value)`,
            inline: false
          },
          {
            name: '🏆 Winner',
            value: `${result.winner.robloxUsername} won ${userWon ? 
              (Array.isArray(result.joiner.skins) ? result.joiner.skins.join(', ') : result.joiner.skins) : 
              (Array.isArray(result.creator.skins) ? result.creator.skins.join(', ') : result.creator.skins)}!`,
            inline: false
          },
          {
            name: '🔐 Provably Fair Verification',
            value: `Server Seed: \`${result.serverSeed}\`\nClient Seed: \`${result.clientSeed}\`\nCombine and hash these values to verify the result.`,
            inline: false
          }
        ]
      );
      
      interaction.editReply({ embeds: [resultEmbed], ephemeral: false });
    } else {
      const successEmbed = createEmbed(
        'success',
        '✅ Game Rejected',
        'You have rejected the game. The joiner\'s skins have been returned to them.'
      );
      
      interaction.editReply({ embeds: [successEmbed], ephemeral: true });
    }
  } catch (error) {
    console.error('Error approving/rejecting game:', error);
    let errorMessage = 'Error processing your request. Please try again later.';
    if (error.response && error.response.data && error.response.data.error) {
      errorMessage = error.response.data.error;
    }
    const errorEmbed = createEmbed('error', 'Error', errorMessage);
    interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleCreateSkin(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const name = interaction.options.getString('name');
  const value = interaction.options.getInteger('value');
  const rarity = interaction.options.getString('rarity');
  const imageUrl = interaction.options.getString('image_url');
  
  db.get('SELECT * FROM skins WHERE name = ?', [name], async (err, skin) => {
    if (err) {
      console.error('Database error:', err);
      return interaction.editReply({
        content: '❌ Database error. Please try again later.',
        ephemeral: true
      });
    }
    
    if (skin) {
      return interaction.editReply({
        content: `❌ Skin "${name}" already exists in the database.`,
        ephemeral: true
      });
    }
    
    db.run(
      'INSERT INTO skins (name, value, rarity, image_url) VALUES (?, ?, ?, ?)',
      [name, value, rarity, imageUrl || null],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return interaction.editReply({
            content: '❌ Error creating skin.',
            ephemeral: true
          });
        }
        
        const successEmbed = createEmbed(
          'success',
          '✅ Skin Created',
          `Successfully created new skin: ${name}`,
          [
            { name: 'Name', value: name, inline: true },
            { name: 'Value', value: value.toLocaleString(), inline: true },
            { name: 'Rarity', value: rarity.charAt(0).toUpperCase() + rarity.slice(1), inline: true },
            { name: 'Image', value: imageUrl || 'None', inline: false }
          ]
        );
        
        interaction.editReply({ embeds: [successEmbed], ephemeral: true });
      }
    );
  });
}

async function handleUpdateSkin(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const name = interaction.options.getString('name');
  const value = interaction.options.getInteger('value');
  
  db.get('SELECT * FROM skins WHERE name = ?', [name], async (err, skin) => {
    if (err) {
      console.error('Database error:', err);
      return interaction.editReply({
        content: '❌ Database error. Please try again later.',
        ephemeral: true
      });
    }
    
    if (!skin) {
      return interaction.editReply({
        content: `❌ Skin "${name}" not found in the database.`,
        ephemeral: true
      });
    }
    
    db.run(
      'UPDATE skins SET value = ? WHERE name = ?',
      [value, name],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return interaction.editReply({
            content: '❌ Error updating skin.',
            ephemeral: true
          });
        }
        
        const successEmbed = createEmbed(
          'success',
          '✅ Skin Updated',
          `Successfully updated skin value: ${name}`,
          [
            { name: 'Name', value: name, inline: true },
            { name: 'Old Value', value: skin.value.toLocaleString(), inline: true },
            { name: 'New Value', value: value.toLocaleString(), inline: true }
          ]
        );
        
        interaction.editReply({ embeds: [successEmbed], ephemeral: true });
      }
    );
  });
}

async function handleViewInventory(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.options.getString('discord_id');
  
  db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], async (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return interaction.editReply({
        content: '❌ Database error. Please try again later.',
        ephemeral: true
      });
    }
    
    if (!user) {
      return interaction.editReply({
        content: '❌ User not found. Make sure they are registered.',
        ephemeral: true
      });
    }
    
    try {
      const response = await axios.get(`${api_url}/inventory/stats/${discordId}`);
      const inventoryStats = response.data;
      
      if (inventoryStats.totalItems === 0) {
        return interaction.editReply({
          content: `<@${discordId}>'s inventory is empty.`,
          ephemeral: true
        });
      }
      
      const overviewEmbed = createEmbed(
        'inventory',
        `🎒 ${user.roblox_username}'s Inventory`,
        `<@${discordId}> has ${inventoryStats.totalItems} items worth ${inventoryStats.totalValue.toLocaleString()} value.`,
        [
          { name: 'Total Items', value: inventoryStats.totalItems.toString(), inline: true },
          { name: 'Unique Skins', value: inventoryStats.uniqueSkins.toString(), inline: true },
          { name: 'Total Value', value: inventoryStats.totalValue.toLocaleString(), inline: true }
        ]
      );
      
      const rarityEmbeds = [];
      
      if (inventoryStats.rarityBreakdown) {
        Object.entries(inventoryStats.rarityBreakdown).forEach(([rarity, data]) => {
          const color = getRarityColor(rarity);
          
          const rarityEmbed = new EmbedBuilder()
            .setTitle(`${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Skins`)
            .setDescription(`${data.count} items worth ${data.value.toLocaleString()} value`)
            .setColor(color);
          
          rarityEmbeds.push(rarityEmbed);
        });
      }
      
      const skinEmbeds = [];
      
      const groupedSkins = {};
      
      inventoryStats.skins.forEach(skin => {
        if (!groupedSkins[skin.rarity]) {
          groupedSkins[skin.rarity] = [];
        }
        groupedSkins[skin.rarity].push(skin);
      });
      
      const rarityOrder = ['Mythic', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];
      
      rarityOrder.forEach(rarity => {
        if (groupedSkins[rarity]) {
          const skinsList = groupedSkins[rarity]
            .map(skin => `• ${skin.skin_name} (${skin.count}x) - ${skin.value.toLocaleString()} value`)
            .join('\n');
          
          if (skinsList.length > 0) {
            const color = getRarityColor(rarity);
            
            const skinEmbed = new EmbedBuilder()
              .setTitle(`${rarity} Skins`)
              .setDescription(skinsList)
              .setColor(color);
            
            skinEmbeds.push(skinEmbed);
          }
        }
      });
      
      await interaction.editReply({ embeds: [overviewEmbed, ...rarityEmbeds, ...skinEmbeds], ephemeral: true });
      
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
      interaction.editReply({
        content: '❌ Error fetching inventory stats.',
        ephemeral: true
      });
    }
  });
}

function getRarityColor(rarity) {
  const colors = {
    'common': 0x95A5A6,
    'uncommon': 0x2ECC71,
    'rare': 0x3498DB,
    'epic': 0x9B59B6,
    'legendary': 0xF1C40F,
    'mythic': 0xE74C3C
  };
  
  return colors[rarity.toLowerCase()] || 0x95A5A6;
}

async function handleCoinflipCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  switch (subcommand) {
    case 'create':
      await handleCoinflipCreate(interaction);
      break;
    case 'join':
      await handleCoinflipJoin(interaction);
      break;
    case 'cancel':
      await handleCoinflipCancel(interaction);
      break;
    case 'history':
      await handleCoinflipHistory(interaction);
      break;
    case 'games':
      await handleCoinflipGames(interaction);
      break;
  }
}

async function handleCoinflipCreate(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.user.id;
  const skin = interaction.options.getString('skin');
  
  db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], async (err, user) => {
    if (err) {
      console.error('Database error:', err);
      const errorEmbed = createEmbed('error', 'System Error', 'An error occurred while processing your request.');
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    
    if (!user) {
      const registerEmbed = createEmbed(
        'info',
        'Registration Required',
        'You need to register first before you can create a coinflip game.',
        [{ name: 'How to Register', value: 'Use the `/register` command with your Roblox username', inline: false }]
      );
      
      interaction.editReply({ embeds: [registerEmbed], ephemeral: true });
      return;
    }
    
    try {
      const response = await axios.get(`${api_url}/inventory?discordId=${discordId}`);
      const inventory = response.data.skins || [];
      
      if (!inventory.includes(skin)) {
        const errorEmbed = createEmbed(
          'error',
          'Inventory Error',
          `You don't have ${skin} in your inventory.`,
          [{ name: 'Your Inventory', value: inventory.length > 0 ? 
            inventory.slice(0, 10).map(s => `• ${s}`).join('\n') + (inventory.length > 10 ? '\n• ...' : '') : 
            'Your inventory is empty.', inline: false }]
        );
        
        interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }
      
      const createResponse = await axios.post(`${api_url}/coinflip/create`, {
        discordId: discordId,
        robloxUsername: user.roblox_username,
        betSkin: skin
      });
      
      const game = createResponse.data;
      
      const skinValueResponse = await axios.get(`${api_url}/skin/${encodeURIComponent(skin)}`);
      const skinInfo = skinValueResponse.data;
      
      const gameEmbed = createEmbed(
        'info',
        '🎲 Coinflip Game Created',
        `You've successfully created a coinflip game with ${skin}!`,
        [
          {
            name: '🎮 Game ID',
            value: `\`${game.gameId}\``,
            inline: true
          },
          {
            name: '🔫 Skin Bet',
            value: skin,
            inline: true
          },
          {
            name: '💰 Skin Value',
            value: `${game.skinValue.toLocaleString()} value`,
            inline: true
          },
          {
            name: '🏆 How to Win',
            value: 'Another player can join your game with a skin of equal or higher value. The winner will be determined by a 50/50 coinflip!',
            inline: false
          },
          {
            name: '🔐 Provably Fair',
            value: `Server Seed Hash: \`${game.serverSeedHash}\`\nThe server seed will be revealed when the game completes.`,
            inline: false
          }
        ],
        skinInfo?.image_url || null
      );
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`cancel_game_${game.gameId}`)
            .setLabel('Cancel Game')
            .setStyle(ButtonStyle.Danger)
        );
      
      interaction.editReply({ embeds: [gameEmbed], components: [row], ephemeral: false });
      
    } catch (error) {
      console.error('Error creating coinflip game:', error);
      
      let errorMessage = 'Error creating coinflip game. Please try again later.';
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      }
      
      const errorEmbed = createEmbed('error', 'Coinflip Error', errorMessage);
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
  });
}

async function handleCoinflipJoin(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.user.id;
  const gameId = interaction.options.getString('game_id');
  const skin = interaction.options.getString('skin');
  const clientSeed = interaction.options.getString('client_seed');
  
  const systemStatus = await checkSystemStatus();
  if (systemStatus.locked && systemStatus.activeTransaction?.discordId !== discordId) {
    const busyEmbed = createEmbed(
      'warning',
      '🤖 Bot is Busy',
      'The trading bot is currently busy with another transaction.',
      [
        { 
          name: 'Current Transaction', 
          value: systemStatus.activeTransaction?.robloxUsername ? 
            `${systemStatus.activeTransaction.type} by ${systemStatus.activeTransaction.robloxUsername}` : 
            'Unknown transaction in progress',
          inline: false 
        },
        { 
          name: 'What to do', 
          value: 'Please try again later when the bot is available.',
          inline: false 
        }
      ]
    );
    
    interaction.editReply({ embeds: [busyEmbed], ephemeral: true });
    return;
  }
  
  db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], async (err, user) => {
    if (err) {
      console.error('Database error:', err);
      const errorEmbed = createEmbed('error', 'System Error', 'An error occurred while processing your request.');
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    
    if (!user) {
      const registerEmbed = createEmbed(
        'info',
        'Registration Required',
        'You need to register first before you can join a coinflip game.',
        [{ name: 'How to Register', value: 'Use the `/register` command with your Roblox username', inline: false }]
      );
      
      interaction.editReply({ embeds: [registerEmbed], ephemeral: true });
      return;
    }
    
    try {
      const gameResponse = await axios.get(`${api_url}/coinflip/game/${gameId}`);
      const game = gameResponse.data;
      
      if (game.status !== 'active') {
        const errorEmbed = createEmbed(
          'error',
          'Game Error',
          `This game is no longer active (Status: ${game.status}).`
        );
        
        interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }
      
      if (game.creator.discordId === discordId) {
        const errorEmbed = createEmbed(
          'error',
          'Game Error',
          'You cannot join your own game.'
        );
        
        interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }
      
      const inventoryResponse = await axios.get(`${api_url}/inventory?discordId=${discordId}`);
      const inventory = inventoryResponse.data.skins || [];
      
      if (!inventory.includes(skin)) {
        const errorEmbed = createEmbed(
          'error',
          'Inventory Error',
          `You don't have ${skin} in your inventory.`
        );
        
        interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }
      
      try {
        const joinResponse = await axios.post(`${api_url}/coinflip/join/${gameId}`, {
          discordId: discordId,
          robloxUsername: user.roblox_username,
          betSkin: skin,
          clientSeed: clientSeed
        });
        
        const result = joinResponse.data;
        
        const userWon = result.winner.discordId === discordId;
        
        const resultEmbed = createEmbed(
          userWon ? 'success' : 'error',
          `🎲 Coinflip Result: ${userWon ? 'YOU WON!' : 'You Lost'}`,
          userWon ? 
            `Congratulations! You won the coinflip against ${result.creator.robloxUsername}!` :
            `Better luck next time! ${result.creator.robloxUsername} won the coinflip.`,
          [
            {
              name: '👤 Creator',
              value: `${result.creator.robloxUsername} with ${result.creator.skin} (${result.creator.skinValue.toLocaleString()} value)`,
              inline: false
            },
            {
              name: '👤 Joiner',
              value: `${result.joiner.robloxUsername} with ${result.joiner.skin} (${result.joiner.skinValue.toLocaleString()} value)`,
              inline: false
            },
            {
              name: '🏆 Winner',
              value: `${result.winner.robloxUsername} won ${userWon ? result.creator.skin : result.joiner.skin}!`,
              inline: false
            },
            {
              name: '🔐 Provably Fair Verification',
              value: `Server Seed: \`${result.serverSeed}\`\nClient Seed: \`${result.clientSeed}\`\nCombine and hash these values to verify the result.`,
              inline: false
            }
          ]
        );
        
        interaction.editReply({ embeds: [resultEmbed], ephemeral: false });
      } catch (joinError) {
        console.error('Error joining game:', joinError);
        
        let errorMessage = 'Error joining coinflip game. Please try again later.';
        if (joinError.response && joinError.response.data && joinError.response.data.error) {
          errorMessage = joinError.response.data.error;
        }
        
        const errorEmbed = createEmbed('error', 'Coinflip Join Error', errorMessage);
        interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      }
      
    } catch (error) {
      console.error('Error joining coinflip game:', error);
      
      let errorMessage = 'Error joining coinflip game. Please try again later.';
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      }
      
      const errorEmbed = createEmbed('error', 'Coinflip Error', errorMessage);
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
  });
}

async function handleCoinflipCancel(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.user.id;
  const gameId = interaction.options.getString('game_id');
  
  try {
    const gameResponse = await axios.get(`${api_url}/coinflip/game/${gameId}`);
    const game = gameResponse.data;
    
    if (game.status !== 'active') {
      const errorEmbed = createEmbed(
        'error',
        'Game Error',
        `This game is no longer active (Status: ${game.status}).`
      );
      
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    
    if (game.creator.discordId !== discordId) {
      const errorEmbed = createEmbed(
        'error',
        'Permission Error',
        'You can only cancel your own games.'
      );
      
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    
    const cancelResponse = await axios.post(`${api_url}/coinflip/cancel/${gameId}`, {
      discordId: discordId
    });
    
    if (cancelResponse.data.status === 'cancelled') {
      const successEmbed = createEmbed(
        'success',
        '✅ Game Cancelled',
        `Your coinflip game with ${game.creatorSkin} has been cancelled successfully.`
      );
      
      interaction.editReply({ embeds: [successEmbed], ephemeral: true });
    } else {
      const errorEmbed = createEmbed(
        'error',
        'Cancellation Error',
        'Failed to cancel the game. Please try again later.'
      );
      
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
    
  } catch (error) {
    console.error('Error cancelling coinflip game:', error);
    
    let errorMessage = 'Error cancelling coinflip game. Please try again later.';
    if (error.response && error.response.data && error.response.data.error) {
      errorMessage = error.response.data.error;
    }
    
    const errorEmbed = createEmbed('error', 'Coinflip Error', errorMessage);
    interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleCoinflipHistory(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.user.id;
  
  try {
    const historyResponse = await axios.get(`${api_url}/coinflip/history/${discordId}`);
    const history = historyResponse.data;
    
    if (!history.games || history.games.length === 0) {
      const emptyEmbed = createEmbed(
        'info',
        '📜 Coinflip History',
        'You haven\'t played any coinflip games yet.',
        [
          {
            name: '💡 Get Started',
            value: 'Use `/coinflip create` to create a new game or `/coinflip games` to see available games to join.',
            inline: false
          }
        ]
      );
      
      interaction.editReply({ embeds: [emptyEmbed], ephemeral: true });
      return;
    }
    
    const stats = history.stats;
    const statsEmbed = createEmbed(
      'info',
      '📊 Your Coinflip Stats',
      `You've played ${stats.totalGames} coinflip games.`,
      [
        {
          name: '🏆 Wins',
          value: `${stats.gamesWon} (${stats.totalGames > 0 ? Math.round(stats.gamesWon / stats.totalGames * 100) : 0}%)`,
          inline: true
        },
        {
          name: '💔 Losses',
          value: `${stats.gamesLost} (${stats.totalGames > 0 ? Math.round(stats.gamesLost / stats.totalGames * 100) : 0}%)`,
          inline: true
        },
        {
          name: '❌ Cancelled',
          value: `${stats.gamesCancelled}`,
          inline: true
        },
        {
          name: '🎮 Games Created',
          value: `${stats.gamesCreated}`,
          inline: true
        },
        {
          name: '🎲 Games Joined',
          value: `${stats.gamesJoined}`,
          inline: true
        }
      ]
    );
    
    const recentGames = history.games.slice(0, 10);
    
    const gamesList = recentGames.map(game => {
      let result = '';
      
      if (game.status === 'completed') {
        result = game.userWon ? '✅ Won' : '❌ Lost';
      } else if (game.status === 'cancelled') {
        result = '⚠️ Cancelled';
      } else {
        result = '⏳ Pending';
      }
      
      let description = '';
      
      if (game.role === 'creator') {
        description = `Created with ${game.creator.skin}`;
        if (game.joiner) {
          description += ` vs ${game.joiner.skin} from ${game.joiner.robloxUsername}`;
        }
      } else {
        description = `Joined ${game.creator.robloxUsername}'s game with ${game.joiner.skin} vs ${game.creator.skin}`;
      }
      
      return `**${result}**: ${description}`;
    }).join('\n\n');
    
    const gamesEmbed = createEmbed(
      'info',
      '📜 Recent Coinflip Games',
      gamesList
    );
    
    interaction.editReply({ embeds: [statsEmbed, gamesEmbed], ephemeral: true });
    
  } catch (error) {
    console.error('Error getting coinflip history:', error);
    
    const errorEmbed = createEmbed('error', 'History Error', 'Error retrieving coinflip history. Please try again later.');
    interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleCoinflipGames(interaction) {
  await interaction.deferReply({ ephemeral: false });
  
  try {
    const gamesResponse = await axios.get(`${api_url}/coinflip/active`);
    const games = gamesResponse.data.games || [];
    
    if (games.length === 0) {
      const emptyEmbed = createEmbed(
        'info',
        '🎲 Active Coinflip Games',
        'There are no active coinflip games at the moment.',
        [
          {
            name: '💡 Create a Game',
            value: 'Use `/coinflip create` to create a new game and be the first!',
            inline: false
          }
        ]
      );
      
      interaction.editReply({ embeds: [emptyEmbed], ephemeral: false });
      return;
    }
    
    const activeGames = games.slice(0, 15);
    
    const skinDetailsPromises = activeGames.map(game => 
      axios.get(`${api_url}/skin/${encodeURIComponent(game.betSkin)}`)
    );
    
    const skinResponses = await Promise.allSettled(skinDetailsPromises);
    const skinDetails = skinResponses.map(result => 
      result.status === 'fulfilled' ? result.value.data : null
    );
    
    const gamesFields = activeGames.map((game, index) => {
      const skinInfo = skinDetails[index];
      return {
        name: `Game #${index + 1} by ${game.creator.robloxUsername}`,
        value: `**Skin**: ${game.betSkin}\n**Value**: ${game.skinValue.toLocaleString()} value\n**Created**: ${new Date(game.createdAt).toLocaleString()}\n**ID**: \`${game.gameId}\``,
        inline: true
      };
    });
    
    const gamesEmbed = createEmbed(
      'info',
      '🎲 Active Coinflip Games',
      `There are currently ${games.length} active coinflip games.`,
      gamesFields
    );
    
    gamesEmbed.addFields({
      name: '💡 How to Join',
      value: 'Use `/coinflip join` and select the game ID to join any of these games. You\'ll need a skin of equal or higher value.',
      inline: false
    });
    
    interaction.editReply({ embeds: [gamesEmbed], ephemeral: false });
    
  } catch (error) {
    console.error('Error getting active coinflip games:', error);
    
    const errorEmbed = createEmbed('error', 'Error', 'Error retrieving active coinflip games. Please try again later.');
    interaction.editReply({ embeds: [errorEmbed], ephemeral: false });
  }
}

async function handleLeaderboardCommand(interaction) {
  await interaction.deferReply({ ephemeral: false });
  
  try {
    const leaderboardResponse = await axios.get(`${api_url}/coinflip/leaderboard`);
    const leaderboard = leaderboardResponse.data.leaderboard || [];
    
    if (leaderboard.length === 0) {
      const emptyEmbed = createEmbed(
        'info',
        '🏆 Coinflip Leaderboard',
        'No players have participated in coinflip games yet.',
        [
          {
            name: '💡 Be the First',
            value: 'Use `/coinflip create` to create a new game and be the first on the leaderboard!',
            inline: false
          }
        ]
      );
      
      interaction.editReply({ embeds: [emptyEmbed], ephemeral: false });
      return;
    }
    
    let description = '';
    
    leaderboard.slice(0, 15).forEach((entry, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      description += `${medal} **${entry.robloxUsername}** - ${entry.wins} wins (${entry.winRate} win rate)\n`;
    });
    
    const leaderboardEmbed = createEmbed(
      'info',
      '🏆 Coinflip Leaderboard',
      description,
      [
        {
          name: '📊 Statistics',
          value: 'Players are ranked by total wins. Only completed games count towards the leaderboard.',
          inline: false
        }
      ]
    );
    
    interaction.editReply({ embeds: [leaderboardEmbed], ephemeral: false });
    
  } catch (error) {
    console.error('Error getting coinflip leaderboard:', error);
    
    const errorEmbed = createEmbed('error', 'Error', 'Error retrieving coinflip leaderboard. Please try again later.');
    interaction.editReply({ embeds: [errorEmbed], ephemeral: false });
  }
}

async function handleRegister(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.user.id;
  const robloxUsername = interaction.options.getString('roblox_username');
  
  db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      const errorEmbed = createEmbed('error', 'Registration Error', 'An error occurred during registration. Please try again later.');
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    
    if (row) {
      db.run('UPDATE users SET roblox_username = ? WHERE discord_id = ?', [robloxUsername, discordId], (err) => {
        if (err) {
          console.error('Update error:', err);
          const errorEmbed = createEmbed('error', 'Update Error', 'Failed to update your Roblox username.');
          interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
          return;
        }
        
        logTransaction('registration', { 
          discord_id: discordId, 
          roblox_username: robloxUsername 
        });

        const successEmbed = createEmbed(
          'success', 
          'Username Updated', 
          `Your Roblox username has been updated to **${robloxUsername}**!`,
          [{ name: 'Account Status', value: '✅ Account linked and ready for trading', inline: false }],
          'https://i.imgur.com/XaHvwBM.png'
        );
        
        interaction.editReply({ embeds: [successEmbed], ephemeral: true });
      });
    } else {
      db.run('INSERT INTO users (discord_id, roblox_username) VALUES (?, ?)', [discordId, robloxUsername], (err) => {
        if (err) {
          console.error('Insert error:', err);
          const errorEmbed = createEmbed('error', 'Registration Error', 'Failed to register your account.');
          interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
          return;
        }

        logTransaction('registration', { 
          discord_id: discordId, 
          roblox_username: robloxUsername 
        });
        
        const successEmbed = createEmbed(
          'success', 
          'Registration Successful', 
          `Successfully registered with Roblox username **${robloxUsername}**!`,
          [
            { name: 'What\'s Next?', value: 'You can now use `/deposit` and `/withdraw` commands', inline: false },
            { name: '💡 Tip', value: 'Use `/inventory` to see your skins', inline: false }
          ],
          'https://i.imgur.com/XaHvwBM.png' 
        );
        
        interaction.editReply({ embeds: [successEmbed], ephemeral: true });
      });
    }
  });
}


async function handleDeposit(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.user.id;
  const systemStatus = await checkSystemStatus();
  
  if (systemStatus.locked && systemStatus.activeTransaction?.discordId !== discordId) {
    const busyEmbed = createEmbed(
      'warning',
      '🤖 Bot is Busy',
      'The trading bot is currently busy with another transaction.',
      [
        { 
          name: 'Current Transaction', 
          value: systemStatus.activeTransaction?.robloxUsername ? 
            `${systemStatus.activeTransaction.type} by ${systemStatus.activeTransaction.robloxUsername}` : 
            'Unknown transaction in progress',
          inline: false 
        },
        { 
          name: 'What to do', 
          value: 'Please try again later when the bot is available.',
          inline: false 
        }
      ]
    );
    
    interaction.followUp({ embeds: [busyEmbed], ephemeral: true });
    return;
  }

  db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], async (err, user) => {
    if (err) {
      console.error('Database error:', err);
      const errorEmbed = createEmbed('error', 'System Error', 'An error occurred while processing your request.');
      interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    
    if (!user) {
      const registerEmbed = createEmbed(
        'info',
        'Registration Required',
        'You need to register first before you can deposit skins.',
        [{ name: 'How to Register', value: 'Use the `/register` command with your Roblox username', inline: false }]
      );
      
      interaction.followUp({ embeds: [registerEmbed], ephemeral: true });
      return;
    }
    
    db.run(
      'INSERT INTO transactions (discord_id, roblox_username, transaction_type) VALUES (?, ?, ?)',
      [discordId, user.roblox_username, 'deposit'],
      async function(err) {
        if (err) {
          console.error('Transaction insert error:', err);
          const errorEmbed = createEmbed('error', 'Transaction Error', 'Failed to create deposit request.');
          interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
          return;
        }
        
        try {
          const response = await axios.post(`${api_url}/deposit`, {
            discordId: discordId,
            robloxUsername: user.roblox_username,
            privateServer: private_server_url
          });
          

          logTransaction('deposit', { 
            discord_id: discordId, 
            roblox_username: user.roblox_username 
          }, {
            transactionId: this.lastID
          });

          if (response.data.locked) {
            updateUserLock(discordId, true);
          }
          
          const depositEmbed = createEmbed(
            'deposit',
            '🔄 Deposit Initiated',
            'Your deposit request has been submitted successfully!',
            [
              {
                name: '🎮 Join Game',
                value: `[Click here to join our private server](${private_server_url})`,
                inline: false
              },
              {
                name: '📋 Instructions',
                value: 'The bot will send you a trade request in-game. After accepting, place the skins you want to deposit in the trade window.',
                inline: false
              },
              {
                name: '⚠️ Important',
                value: 'Your account is now locked for this transaction. You cannot initiate another deposit or withdrawal until this one completes or is cancelled.',
                inline: false
              }
            ]
          );
          
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Join Game')
                .setStyle(ButtonStyle.Link)
                .setURL(private_server_url)
            );
          
          interaction.followUp({ embeds: [depositEmbed], components: [row], ephemeral: true });
        } catch (apiError) {
          console.error('API error:', apiError);
          if (apiError.response && apiError.response.data && apiError.response.data.locked) {
            const busyEmbed = createEmbed(
              'warning',
              '⚠️ Transaction in Progress',
              apiError.response.data.error || 'You already have an active transaction in progress.'
            );
            
            interaction.followUp({ embeds: [busyEmbed], ephemeral: true });
          } else {
            const errorEmbed = createEmbed(
              'error',
              'Connection Error',
              'Error connecting to trading server. Please try again later.'
            );
            
            interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
          }
        }
      }
    );
  });
}


async function handleWithdraw(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.user.id;
  const systemStatus = await checkSystemStatus();
  
  if (systemStatus.locked && systemStatus.activeTransaction?.discordId !== discordId) {
    const busyEmbed = createEmbed(
      'warning',
      '🤖 Bot is Busy',
      'The trading bot is currently busy with another transaction.',
      [
        { 
          name: 'Current Transaction', 
          value: systemStatus.activeTransaction?.robloxUsername ? 
            `${systemStatus.activeTransaction.type} by ${systemStatus.activeTransaction.robloxUsername}` : 
            'Unknown transaction in progress',
          inline: false 
        },
        { 
          name: 'What to do', 
          value: 'Please try again later when the bot is available.',
          inline: false 
        }
      ]
    );
    
    interaction.editReply({ embeds: [busyEmbed], ephemeral: true });
    return;
  }

  const skinsInput = interaction.options.getString('skins');
  const skins = skinsInput.split(',').map(skin => skin.trim());
  
  db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], async (err, user) => {
    if (err) {
      console.error('Database error:', err);
      const errorEmbed = createEmbed('error', 'System Error', 'An error occurred while processing your request.');
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    
    if (!user) {
      const registerEmbed = createEmbed(
        'info',
        'Registration Required',
        'You need to register first before you can withdraw skins.',
        [{ name: 'How to Register', value: 'Use the `/register` command with your Roblox username', inline: false }]
      );
      
      interaction.editReply({ embeds: [registerEmbed], ephemeral: true });
      return;
    }
    
    db.run(
      'INSERT INTO transactions (discord_id, roblox_username, transaction_type, skins) VALUES (?, ?, ?, ?)',
      [discordId, user.roblox_username, 'withdraw', JSON.stringify(skins)],
      async function(err) {
        if (err) {
          console.error('Transaction insert error:', err);
          const errorEmbed = createEmbed('error', 'Transaction Error', 'Failed to create withdraw request.');
          interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
          return;
        }
        
        try {
          const response = await axios.post(`${api_url}/withdraw`, {
            discordId: discordId,
            robloxUsername: user.roblox_username,
            skins: skins,
            privateServer: private_server_url
          });
          
          if (response.data.locked) {
            updateUserLock(discordId, true);
          }
          
          logTransaction('withdraw', { 
            discord_id: discordId, 
            roblox_username: user.roblox_username 
          }, {
            transactionId: this.lastID,
            skins: skins
          });

          const withdrawEmbed = createEmbed(
            'withdraw',
            '🔄 Withdrawal Initiated',
            'Your withdrawal request has been submitted successfully!',
            [
              {
                name: '🔫 Requested Skins',
                value: skins.map(skin => `• ${skin}`).join('\n'),
                inline: false
              },
              {
                name: '🎮 Join Game',
                value: `[Click here to join our private server](${private_server_url})`,
                inline: false
              },
              {
                name: '📋 Instructions',
                value: 'The bot will send you a trade request in-game with your requested skins.',
                inline: false
              },
              {
                name: '⚠️ Important',
                value: 'Your account is now locked for this transaction. You cannot initiate another withdrawal or deposit until this one completes or is cancelled.',
                inline: false
              }
            ]
          );
          
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Join Game')
                .setStyle(ButtonStyle.Link)
                .setURL(private_server_url)
            );
          
          interaction.editReply({ embeds: [withdrawEmbed], components: [row], ephemeral: true });
        } catch (apiError) {
          console.error('API error:', apiError);
          if (apiError.response && apiError.response.data && apiError.response.data.locked) {
            const busyEmbed = createEmbed(
              'warning',
              '⚠️ Transaction in Progress',
              apiError.response.data.error || 'You already have an active transaction in progress.'
            );
            
            interaction.editReply({ embeds: [busyEmbed], ephemeral: true });
          } else if (apiError.response && apiError.response.data && apiError.response.data.error) {
            const errorEmbed = createEmbed('error', 'Withdrawal Error', apiError.response.data.error);
            interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
          } else {
            const errorEmbed = createEmbed(
              'error',
              'Connection Error',
              'Error connecting to trading server. Please try again later.'
            );
            
            interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
          }
        }
      }
    );
  });
}

async function handleInventory(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.user.id;
  
  db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], async (err, user) => {
    if (err) {
      console.error('Database error:', err);
      const errorEmbed = createEmbed('error', 'System Error', 'An error occurred while retrieving your inventory.');
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    
    if (!user) {
      const registerEmbed = createEmbed(
        'info',
        'Registration Required',
        'You need to register first before you can view your inventory.',
        [{ name: 'How to Register', value: 'Use the `/register` command with your Roblox username', inline: false }]
      );
      
      interaction.editReply({ embeds: [registerEmbed], ephemeral: true });
      return;
    }
    
    try {
      const response = await axios.get(`${api_url}/inventory?discordId=${discordId}`);
      const inventory = response.data.skins || [];
      
      if (inventory.length === 0) {
        const emptyEmbed = createEmbed(
          'inventory',
          '🎒 Your Inventory',
          'Your inventory is empty.',
          [{ name: '💡 Tip', value: 'Use `/deposit` to add skins to your inventory', inline: false }]
        );
        
        interaction.editReply({ embeds: [emptyEmbed], ephemeral: true });
      } else {
        const chunks = [];
        for (let i = 0; i < inventory.length; i += 10) {
          chunks.push(inventory.slice(i, i + 10));
        }
        
        const inventoryFields = [];
        chunks.forEach((chunk, index) => {
          inventoryFields.push({
            name: index === 0 ? '🔫 Your Skins' : '\u200B',
            value: chunk.map(skin => `• ${skin}`).join('\n'),
            inline: false
          });
        });
        
        inventoryFields.push({
          name: '💡 Actions',
          value: 'Use `/withdraw` to get your skins back from the inventory',
          inline: false
        });
        
        const inventoryEmbed = createEmbed(
          'inventory',
          '🎒 Your Inventory',
          `You have **${inventory.length}** skins in your inventory.`,
          inventoryFields
        );
        
        interaction.editReply({ embeds: [inventoryEmbed], ephemeral: true });
      }
    } catch (apiError) {
      console.error('API error:', apiError);
      const errorEmbed = createEmbed('error', 'Connection Error', 'Error retrieving your inventory. Please try again later.');
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
  });
}

async function handleStatus(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.user.id;
  
  try {
    const response = await axios.get(`${api_url}/transaction-status/${discordId}`);
    
    const systemStatus = await checkSystemStatus();
    
    if (response.data.locked) {
      const transaction = response.data.transaction;
      const elapsedMinutes = Math.floor(transaction.elapsed / 60000);
      const elapsedSeconds = Math.floor((transaction.elapsed % 60000) / 1000);
      
      const statusEmbed = createEmbed(
        transaction.type === 'deposit' ? 'deposit' : 'withdraw',
        `⚠️ Active ${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)} Transaction`,
        'You have an active transaction in progress.',
        [
          { 
            name: '⏰ Started At', 
            value: new Date(transaction.startTime).toLocaleString(),
            inline: true 
          },
          { 
            name: '⌛ Elapsed Time', 
            value: `${elapsedMinutes}m ${elapsedSeconds}s`,
            inline: true 
          },
          { 
            name: '👤 Roblox Username', 
            value: transaction.robloxUsername,
            inline: true 
          },
          {
            name: '📋 Instructions',
            value: 'Please finish your transaction in the Roblox game or use the `/cancel` command if you need to cancel this transaction.',
            inline: false
          }
        ]
      );
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Join Game')
            .setStyle(ButtonStyle.Link)
            .setURL(private_server_url),
          new ButtonBuilder()
            .setCustomId('cancel_transaction')
            .setLabel('Cancel Transaction')
            .setStyle(ButtonStyle.Danger)
        );
      
      interaction.editReply({ embeds: [statusEmbed], components: [row], ephemeral: true });
    } else if (systemStatus.locked) {
      const activeTransaction = systemStatus.activeTransaction;
      let elapsedText = '';
      
      if (activeTransaction && activeTransaction.startTime) {
        const elapsedMinutes = Math.floor(activeTransaction.elapsed / 60000);
        const elapsedSeconds = Math.floor((activeTransaction.elapsed % 60000) / 1000);
        elapsedText = `${elapsedMinutes}m ${elapsedSeconds}s`;
      }
      
      const busyEmbed = createEmbed(
        'info',
        '🤖 Bot Status: BUSY',
        'You have no active transactions, but the trading bot is currently busy with another user\'s transaction.',
        [
          { 
            name: '📊 Current Activity', 
            value: `The bot is processing a ${activeTransaction?.type || 'unknown'} transaction${activeTransaction?.robloxUsername ? ` for ${activeTransaction.robloxUsername}` : ''}`,
            inline: false 
          },
          { 
            name: '⌛ Elapsed Time', 
            value: elapsedText || 'Unknown',
            inline: true 
          },
          { 
            name: '📋 Recommendation', 
            value: 'Please try again later when the bot is available.',
            inline: false 
          }
        ]
      );
      
      interaction.editReply({ embeds: [busyEmbed], ephemeral: true });
    } else {
      const availableEmbed = createEmbed(
        'success',
        '🤖 Bot Status: AVAILABLE',
        'You have no active transactions. The bot is available for deposits and withdrawals.',
        [
          { 
            name: '📋 Available Commands', 
            value: '`/deposit` - Add skins to your inventory\n`/withdraw` - Get skins from your inventory\n`/inventory` - View your current skins',
            inline: false 
          }
        ]
      );
      
      interaction.editReply({ embeds: [availableEmbed], ephemeral: true });
    }
  } catch (error) {
    console.error('Error checking status:', error);
    const errorEmbed = createEmbed('error', 'Status Error', 'Error checking transaction status. Please try again later.');
    interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleCancel(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const discordId = interaction.user.id;
  
  try {
    const statusResponse = await axios.get(`${api_url}/transaction-status/${discordId}`);
    
    if (!statusResponse.data.locked) {
      const noTransactionEmbed = createEmbed(
        'info',
        '❓ No Active Transactions',
        'You have no active transactions to cancel.'
      );
      
      interaction.editReply({ embeds: [noTransactionEmbed], ephemeral: true });
      return;
    }
    
    const transactionInfo = statusResponse.data.transaction;
    
    const response = await axios.post(`${api_url}/cancel-transaction`, {
      discordId: discordId,
      adminKey: process.env.admin_key 
    });
    
    if (response.data.locked === false) {
      updateUserLock(discordId, false);
      
      db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, user) => {
        if (user) {
          logTransaction('transaction_cancelled', { 
            discord_id: discordId, 
            roblox_username: user.roblox_username 
          }, {
            transactionType: transactionInfo.type,  
            reason: 'User requested cancellation'
          });
        }
      });
      
      const successEmbed = createEmbed(
        'success',
        '✅ Transaction Cancelled',
        'Your transaction has been cancelled successfully. You can now start a new deposit or withdrawal.'
      );
      
      interaction.editReply({ embeds: [successEmbed], ephemeral: true });
    } else {
      const errorEmbed = createEmbed(
        'error',
        '❌ Cancellation Failed',
        'Failed to cancel your transaction. Please try again or contact an administrator.'
      );
      
      interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
  } catch (error) {
    console.error('Error cancelling transaction:', error);
    const errorEmbed = createEmbed('error', 'Cancellation Error', 'Error cancelling transaction. Please try again later or contact an administrator.');
    interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  initializeLogging();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  
  if (interaction.customId === 'cancel_transaction') {
    await handleCancel(interaction);
    return;
  }
  
  if (interaction.customId.startsWith('cancel_game_')) {
    const gameId = interaction.customId.replace('cancel_game_', '');
    

    const fakeInteraction = {
      deferReply: interaction.deferReply.bind(interaction),
      editReply: interaction.editReply.bind(interaction),
      user: interaction.user,
      options: {
        getString: () => gameId,
        getSubcommand: () => 'cancel'
      }
    };
    
    await handleCoinflipCancel(fakeInteraction);
  }
});

client.login(process.env.discord_token);

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
