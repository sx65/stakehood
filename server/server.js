const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { exec } = require('child_process');
const { URL } = require('url');
const path = require('path');
const crypto = require('crypto');
let fetch;
(async () => {
  fetch = (await import('node-fetch')).default;
})();


const fs = require('fs');
require('dotenv').config();
const webhook_url = process.env.webhook_url || ''; 


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;

const private_server_url = process.env.private_server_url || 'https://www.roblox.com/games/2788229376?privateServerLinkCode=60751427250446075900620073561763';
const auto_join_boolean = process.env.auto_join_boolean !== 'false'; 

const COINFLIP_GAMES_WEBHOOK_URL = process.env.COINFLIP_GAMES_WEBHOOK_URL || '';
const logs_webhook = process.env.logs_webhook || '';




const client_id = process.env.DISCORD_client_id || '1361415663784165377';
const client_secret = process.env.DISCORD_client_secret || 'iy9TXg0KsrgeZrHx0r7s2UreM_3AdB3F';
const redirect_url = process.env.redirect_url || 'http://localhost:3000/callback';
const frontend_url = process.env.frontend_url || 'http://localhost:3000';



let lastJoinTime = 0;
let autoJoinLock = false;

const activeTransactions = new Map(); 

const skins_db = [
  { name: "Golden Age DB", value: 100000, rarity: "Legendary", image_url: "https://cdn.discordapp.com/attachments/1196846108945686619/1363203983904084240/Xj3r3xVZr1YeqJwsPqubOyU5L6Sl321cI5betQU9.png?ex=68052e24&is=6803dca4&hm=fd19e58805fde54f054074019abf33821515dd05d4fc2fceb360d7b49c7b618c&" },
  { name: "Golden Aged Revolver", value: 100000, rarity: "Legendary", image_url: "https://cdn.discordapp.com/attachments/1196846108945686619/1362572493772030013/Golden_Age_Revolver.png?ex=6802e205&is=68019085&hm=f18febf0c5de06f040f742306d12e69f39e079ca314a48001e77aacba23c8569&" },
  { name: "Galaxy Knife", value: 200000, rarity: "Legendary", image_url: "https://cdn.discordapp.com/attachments/1196846108945686619/1363204123855552512/LQ2NGf0dK4OuBdoiuUfxEIeAfUJbktRstICFL8s8.png?ex=68052e46&is=6803dcc6&hm=c56f9d55d54f2ef462dba16fe73283333bb1dea5573834b77fb458a42e2493df&" },
  { name: "Galaxy Revolver", value: 100000, rarity: "Epic", image_url: "http://localhost:3000/images/galaxyrev.png" },
];

function initializeSkinsDatabase() {
  console.log("Initializing skins database...");
  
  db.get("SELECT COUNT(*) as count FROM skins", [], (err, row) => {
    if (err) {
      console.error("Error checking skins table:", err);
      return;
    }
    
    if (row.count === 0) {
      console.log("No skins found in database. Adding default skins...");
      const stmt = db.prepare("INSERT INTO skins (name, value, rarity, image_url) VALUES (?, ?, ?, ?)");
      
      skins_db.forEach(skin => {
        stmt.run(skin.name, skin.value, skin.rarity, skin.image_url, (err) => {
          if (err) console.error(`Error adding skin ${skin.name}:`, err);
        });
      });
      
      stmt.finalize();
      console.log(`Added ${skins_db.length} default skins to the database.`);
    } else {
      console.log(`Found ${row.count} skins in the database.`);
    }
  });
}

function createTables(callback) {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT PRIMARY KEY,
    roblox_username TEXT NOT NULL,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
      return;
    }

    db.run(`CREATE TABLE IF NOT EXISTS dice_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  creator_discord_id TEXT NOT NULL,
  creator_roblox_username TEXT NOT NULL,
  creator_skins TEXT NOT NULL,
  creator_skins_value INTEGER NOT NULL,
  joiner_discord_id TEXT,
  joiner_roblox_username TEXT,
  joiner_skins TEXT,
  joiner_skins_value INTEGER,
  creator_roll INTEGER,
  joiner_roll INTEGER,
  winner_discord_id TEXT,
  winner_roblox_username TEXT,
  result TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
)`);

    

    db.run(`CREATE TABLE IF NOT EXISTS user_stats (
      discord_id TEXT PRIMARY KEY,
      total_wagered INTEGER DEFAULT 0,
      rank TEXT DEFAULT 'Iron',
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (discord_id) REFERENCES users (discord_id)
    )`, (err) => {
      if (err) {
        console.error('Error creating user_stats table:', err);
      }
    });


    db.run(`CREATE TABLE IF NOT EXISTS skins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      value INTEGER NOT NULL,
      rarity TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating skins table:', err);
        return;
      }
      
      db.run(`CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        discord_id TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (discord_id) REFERENCES users (discord_id)
      )`, (err) => {
        if (err) {
          console.error('Error creating sessions table:', err);
          return;
        }
        
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          discord_id TEXT NOT NULL,
          roblox_username TEXT NOT NULL,
          transaction_type TEXT NOT NULL,
          skins TEXT,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (discord_id) REFERENCES users (discord_id)
        )`, (err) => {
          if (err) {
            console.error('Error creating transactions table:', err);
            return;
          }
          
          db.run(`CREATE TABLE IF NOT EXISTS coinflip_games (
  id TEXT PRIMARY KEY,
  creator_discord_id TEXT NOT NULL,
  creator_roblox_username TEXT NOT NULL,
  creator_skins TEXT NOT NULL,
  creator_skins_value INTEGER NOT NULL,
  joiner_discord_id TEXT,
  joiner_roblox_username TEXT,
  joiner_skins TEXT,
  joiner_skins_value INTEGER,
  pending_approval BOOLEAN DEFAULT 0,
  winner_discord_id TEXT,
  winner_roblox_username TEXT,
  winner_skins TEXT,
  server_seed TEXT NOT NULL,
  client_seed TEXT,
  revealed_seed TEXT,
  status TEXT NOT NULL,
  allow_multiple_bets BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  joined_at TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (creator_discord_id) REFERENCES users (discord_id)
          )`, (err) => {
            if (err) {
              console.error('Error creating coinflip_games table:', err);
              return;
            }
            
            db.run(`CREATE TABLE IF NOT EXISTS inventory (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              discord_id TEXT NOT NULL,
              skin_name TEXT NOT NULL,
              acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (discord_id) REFERENCES users (discord_id)
            )`, (err) => {
              if (err) {
                console.error('Error creating inventory table:', err);
                return;
              }
              
              db.run(`CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                discord_id TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                reference_id TEXT,
                is_read BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (discord_id) REFERENCES users (discord_id)
              )`, (err) => {
                if (err) {
                  console.error('Error creating notifications table:', err);
                  return;
                }
                
                console.log('All database tables created successfully');
                if (callback) callback();
              });
            });
          });
        });
      });
    });
  });
}


const db = new sqlite3.Database('../bot.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the database.');
    
    createTables(() => {
      initializeSkinsDatabase();
    });
  }
});



async function getSkinDetails(skinName) {
  return new Promise((resolve, reject) => {
      db.get("SELECT * FROM skins WHERE name = ?", [skinName], (err, row) => {
          if (err) {
              console.error(`Error fetching details for skin ${skinName}:`, err);
              reject(err);
              return;
          }
          
          if (!row) {
              console.warn(`Skin not found in database: ${skinName}`);
              resolve(null);
              return;
          }
          
          resolve({
              id: row.id,
              name: row.name,
              value: row.value,
              rarity: row.rarity,
              image_url: row.image_url,
              created_at: row.created_at
          });
      });
  });
}


app.get('/auth/discord', (req, res) => {
  const scope = 'identify';
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${client_id}&redirect_url=${encodeURIComponent(redirect_url)}&response_type=code&scope=${encodeURIComponent(scope)}`);
});


async function notifyPendingApproval(game, joiner) {
  if (!logs_webhook) {
    console.log('No logs webhook URL configured, skipping notification');
    return;
  }
  try {
    const creatorSkinsList = Array.isArray(game.creator_skins) ? 
      JSON.parse(game.creator_skins).join(', ') : game.creator_skins;
    const joinerSkinsList = Array.isArray(joiner.betSkins) ? 
      joiner.betSkins.join(', ') : joiner.betSkins;

    const payload = {
      embeds: [{
        title: "🔄 Coinflip Game Pending Approval",
        description: `A coinflip game requires approval because the joiner is betting different skins`,
        color: 0xF59E0B,
        fields: [
          {
            name: "Creator",
            value: game.creator_roblox_username,
            inline: true
          },
          {
            name: "Joiner",
            value: joiner.robloxUsername,
            inline: true
          },
          {
            name: "Creator's Skins",
            value: creatorSkinsList,
            inline: false
          },
          {
            name: "Creator's Value",
            value: `${game.creator_skins_value.toLocaleString()} points`,
            inline: true
          },
          {
            name: "Joiner's Skins",
            value: joinerSkinsList,
            inline: false
          },
          {
            name: "Joiner's Value",
            value: `${joiner.totalValue.toLocaleString()} points`,
            inline: true
          },
          {
            name: "Game ID",
            value: `\`${game.id}\``,
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "stakehood"
        }
      }]
    };

    console.log(`Sending coinflip pending approval webhook for game ${game.id}`);
    const response = await fetch(logs_webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Error sending pending approval webhook: ${response.status} ${response.statusText}`);
      console.error(`Response: ${responseText}`);
    } else {
      console.log(`Pending approval notification sent for game ${game.id}`);
    }
  } catch (error) {
    console.error('Error sending Discord webhook for pending approval:', error);
  }
}


async function notifyGameRejection(game) {
  if (!logs_webhook) {
    console.log('No logs webhook URL configured, skipping notification');
    return;
  }
  try {
    const creatorSkinsList = JSON.parse(game.creator_skins).join(', ');
    const joinerSkinsList = JSON.parse(game.joiner_skins).join(', ');

    const payload = {
      embeds: [{
        title: "❌ Coinflip Game Rejected",
        description: `${game.creator_roblox_username} has rejected a coinflip game request from ${game.joiner_roblox_username}`,
        color: 0xEF4444,
        fields: [
          {
            name: "Creator",
            value: game.creator_roblox_username,
            inline: true
          },
          {
            name: "Joiner",
            value: game.joiner_roblox_username,
            inline: true
          },
          {
            name: "Creator's Skins",
            value: creatorSkinsList,
            inline: false
          },
          {
            name: "Creator's Value",
            value: `${game.creator_skins_value.toLocaleString()} points`,
            inline: true
          },
          {
            name: "Joiner's Skins",
            value: joinerSkinsList,
            inline: false
          },
          {
            name: "Joiner's Value",
            value: `${game.joiner_skins_value.toLocaleString()} points`,
            inline: true
          },
          {
            name: "Game ID",
            value: `\`${game.id}\``,
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "stakehood"
        }
      }]
    };

    console.log(`Sending coinflip game rejection webhook for game ${game.id}`);
    const response = await fetch(logs_webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Error sending game rejection webhook: ${response.status} ${response.statusText}`);
      console.error(`Response: ${responseText}`);
    } else {
      console.log(`Game rejection notification sent for game ${game.id}`);
    }
  } catch (error) {
    console.error('Error sending Discord webhook for game rejection:', error);
  }
}


app.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect(`${frontend_url}/login-failed.html`);
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: client_id,
        client_secret: client_secret,
        grant_type: 'authorization_code',
        code,
        redirect_url: redirect_url,
        scope: 'identify',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get token');
    }

    const tokenData = await tokenResponse.json();
    
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user data');
    }

    const userData = await userResponse.json();

    db.get('SELECT * FROM users WHERE discord_id = ?', [userData.id], async (err, user) => {
      if (err) {
        console.error('Database error during auth:', err);
        return res.redirect(`${frontend_url}/login-failed.html`);
      }
      
      if (!user) {
        return res.redirect(`${frontend_url}/login-failed.html?error=not_registered`);
      }

      const sessionToken = crypto.randomBytes(64).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
      db.run(
        'INSERT INTO sessions (token, discord_id, expires_at) VALUES (?, ?, ?)',
        [sessionToken, userData.id, expiresAt.toISOString()],
        (err) => {
          if (err) {
            console.error('Error creating session:', err);
            return res.redirect(`${frontend_url}/login-failed.html`);
          }

          res.redirect(`${frontend_url}/auth-success.html?token=${sessionToken}`);
        }
      );
    });
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect(`${frontend_url}/login-failed.html`);
  }
});

app.get('/auth/validate', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  db.get(
    'SELECT s.token, s.discord_id, s.expires_at, u.roblox_username FROM sessions s JOIN users u ON s.discord_id = u.discord_id WHERE s.token = ? AND s.expires_at > ?',
    [token, new Date().toISOString()],
    (err, session) => {
      if (err) {
        console.error('Database error validating session:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      .then(response => response.json())
      .then(userData => {
        res.json({
          id: session.discord_id,
          username: userData.username,
          discriminator: userData.discriminator,
          avatar: userData.avatar,
          robloxUsername: session.roblox_username
        });
      })
      .catch(error => {
        console.error('Error fetching Discord user data:', error);
        res.json({
          id: session.discord_id,
          robloxUsername: session.roblox_username
        });
      });
    }
  );
});


app.post('/auth/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  db.run('DELETE FROM sessions WHERE token = ?', [token], (err) => {
    if (err) {
      console.error('Error deleting session:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({ success: true });
  });
});

app.get('/auth/user', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  db.get(
    'SELECT s.discord_id, u.roblox_username FROM sessions s JOIN users u ON s.discord_id = u.discord_id WHERE s.token = ? AND s.expires_at > ?',
    [token, new Date().toISOString()],
    (err, user) => {
      if (err) {
        console.error('Database error fetching user:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      res.json({
        discordId: user.discord_id,
        robloxUsername: user.roblox_username
      });
    }
  );
});





async function getSkinValue(skinName) {
  return new Promise((resolve, reject) => {
    db.get("SELECT value FROM skins WHERE name = ?", [skinName], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        reject(new Error(`Skin "${skinName}" not found in database`));
        return;
      }
      
      resolve(row.value);
    });
  });
}

async function compareSkinValues(betSkin, joinSkin) {
  try {
    const betValue = await getSkinValue(betSkin);
    const joinValue = await getSkinValue(joinSkin);
    
    return {
      betValue,
      joinValue,
      isValidJoin: joinValue >= betValue
    };
  } catch (error) {
    console.error("Error comparing skin values:", error);
    throw error;
  }
}


app.get('/skins', (req, res) => {
  db.all("SELECT id, name, value, rarity, image_url FROM skins ORDER BY value DESC", [], (err, rows) => {
    if (err) {
      console.error("Error fetching skins:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json({ skins: rows });
  });
});


app.get('/skin/:name', (req, res) => {
  const { name } = req.params;
  
  db.get("SELECT * FROM skins WHERE name = ?", [name], (err, row) => {
    if (err) {
      console.error("Error fetching skin:", err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Skin not found' });
    }
    
    res.json(row);
  });
});

app.post('/admin/skins/add', (req, res) => {
  const { adminKey, name, value, rarity, image_url } = req.body;
  
  if (adminKey !== process.env.admin_key) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  if (!name || !value || !rarity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  db.run(
    "INSERT INTO skins (name, value, rarity, image_url) VALUES (?, ?, ?, ?)",
    [name, value, rarity, image_url || null],
    function(err) {
      if (err) {
        console.error("Error adding skin:", err);
        return res.status(500).json({ error: 'Failed to add skin' });
      }
      
      res.json({
        id: this.lastID,
        name,
        value,
        rarity,
        image_url
      });
    }
  );
});

app.put('/admin/skins/update', (req, res) => {
  const { adminKey, name, value } = req.body;
  
  if (adminKey !== process.env.admin_key) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  if (!name || !value) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  db.run(
    "UPDATE skins SET value = ? WHERE name = ?",
    [value, name],
    function(err) {
      if (err) {
        console.error("Error updating skin:", err);
        return res.status(500).json({ error: 'Failed to update skin' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Skin not found' });
      }
      
      res.json({
        name,
        value,
        updated: true
      });
    }
  );
});



app.post('/coinflip/create', async (req, res) => {
  const { discordId, robloxUsername, betSkins, allowMultipleBets } = req.body;
  
  if (!discordId || !robloxUsername || !betSkins || !Array.isArray(betSkins) || betSkins.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or invalid bet skins' });
  }
  
  const db_transaction = await new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!user) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(400).json({ error: 'User not registered' });
    }
    
    let totalValue = 0;
    const skinsToRemove = [];
    
    const skinCounts = {};
    
    for (const skinName of betSkins) {
      skinCounts[skinName] = (skinCounts[skinName] || 0) + 1;
      
      const inventoryCount = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM inventory WHERE discord_id = ? AND skin_name = ?',
          [discordId, skinName], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
        });
      });
      
      if (skinCounts[skinName] > inventoryCount) {
        await new Promise((resolve) => db.run('ROLLBACK', resolve));
        return res.status(400).json({
          error: `You only have ${inventoryCount} copies of ${skinName} in your inventory`
        });
      }
      
      const inventoryItem = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM inventory 
           WHERE discord_id = ? AND skin_name = ? 
           LIMIT 1 OFFSET ?`,
          [discordId, skinName, skinCounts[skinName] - 1], 
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
      });
      
      if (!inventoryItem) {
        await new Promise((resolve) => db.run('ROLLBACK', resolve));
        return res.status(400).json({
          error: `Could not find the ${skinCounts[skinName]} copy of ${skinName} in your inventory`
        });
      }
      
      const skinDetails = await getSkinDetails(skinName);
      if (!skinDetails) {
        await new Promise((resolve) => db.run('ROLLBACK', resolve));
        return res.status(400).json({
          error: `Could not find skin details for: ${skinName}`
        });
      }
      
      totalValue += skinDetails.value;
      skinsToRemove.push(inventoryItem.id);
    }
    
    const gameId = crypto.randomBytes(16).toString('hex');
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    
    for (const inventoryId of skinsToRemove) {
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM inventory WHERE id = ?', [inventoryId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO coinflip_games (
          id, creator_discord_id, creator_roblox_username,
          creator_skins, creator_skins_value,
          server_seed, status, allow_multiple_bets
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gameId,
          discordId,
          robloxUsername,
          JSON.stringify(betSkins),
          totalValue,
          serverSeed,
          'active',
          allowMultipleBets ? 1 : 0  
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const gameData = {
      gameId,
      creator: {
        discordId,
        robloxUsername
      },
      betSkins,
      skinValue: totalValue,
      serverSeedHash,
      status: 'active',
      allowMultipleBets: !!allowMultipleBets,
      createdAt: new Date().toISOString()
    };
    
    notifyGameCreation(gameData).catch(error => {
      console.error('Failed to send game creation notification:', error);
    });
    
    res.json(gameData);
    
  } catch (error) {
    await new Promise((resolve) => {
      db.run('ROLLBACK', (err) => {
        if (err) console.error('Error rolling back transaction:', err);
        resolve();
      });
    });
    
    console.error('Error creating coinflip game:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

app.get('/coinflip/active', (req, res) => {
  db.all(
    `SELECT
      cg.id, cg.creator_discord_id, cg.creator_roblox_username,
      cg.creator_skins, cg.creator_skins_value, cg.created_at, cg.status,
      cg.allow_multiple_bets, s.rarity, s.image_url
    FROM coinflip_games cg
    LEFT JOIN skins s ON json_extract(cg.creator_skins, '$[0]') = s.name
    WHERE cg.status = 'active' AND cg.joiner_discord_id IS NULL
    ORDER BY cg.created_at DESC`,
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const games = (rows || []).map(row => {
        const creatorSkins = JSON.parse(row.creator_skins);
        return {
          gameId: row.id,
          creator: {
            discordId: row.creator_discord_id,
            robloxUsername: row.creator_roblox_username
          },
          betSkins: creatorSkins,
          skinValue: row.creator_skins_value,
          skinRarity: row.rarity,
          skinImageUrl: row.image_url,
          createdAt: row.created_at,
          status: row.status,
          allowMultipleBets: !!row.allow_multiple_bets
        };
      });
      
      res.json({ games });
    }
  );
});


app.get('/coinflip/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  db.get(
    `SELECT
      cg.*
    FROM coinflip_games cg
    WHERE cg.id = ?`,
    [gameId],
    async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      const creatorSkins = JSON.parse(row.creator_skins);
      const joinerSkins = row.joiner_skins ? JSON.parse(row.joiner_skins) : null;
      const winnerSkins = row.winner_skins ? JSON.parse(row.winner_skins) : null;
      
      let creatorSkinDetails = null;
      if (creatorSkins.length > 0) {
        creatorSkinDetails = await getSkinDetails(creatorSkins[0]);
      }
      
      let joinerSkinDetails = null;
      if (joinerSkins && joinerSkins.length > 0) {
        joinerSkinDetails = await getSkinDetails(joinerSkins[0]);
      }
      
      const game = {
        gameId: row.id,
        creator: {
          discordId: row.creator_discord_id,
          robloxUsername: row.creator_roblox_username,
          skinRarity: creatorSkinDetails?.rarity,
          skinImageUrl: creatorSkinDetails?.image_url
        },
        creatorSkins: creatorSkins,
        creatorSkinValue: row.creator_skins_value,
        status: row.status,
        pendingApproval: row.pending_approval === 1,
        createdAt: row.created_at
      };
      
      if (row.joiner_discord_id) {
        game.joiner = {
          discordId: row.joiner_discord_id,
          robloxUsername: row.joiner_roblox_username,
          skinRarity: joinerSkinDetails?.rarity,
          skinImageUrl: joinerSkinDetails?.image_url
        };
        game.joinerSkins = joinerSkins;
        game.joinerSkinValue = row.joiner_skins_value;
        game.joinedAt = row.joined_at;
      }
      
      if (row.status === 'completed') {
        game.winner = {
          discordId: row.winner_discord_id,
          robloxUsername: row.winner_roblox_username
        };
        game.winnerSkins = winnerSkins;
        game.completedAt = row.completed_at;
        
        game.serverSeed = row.revealed_seed;
        game.clientSeed = row.client_seed;
        
        if (row.revealed_seed) {
          game.serverSeedHash = crypto.createHash('sha256').update(row.revealed_seed).digest('hex');
        }
      } else {
        if (row.server_seed) {
          game.serverSeedHash = crypto.createHash('sha256').update(row.server_seed).digest('hex');
        }
      }
      
      res.json(game);
    }
  );
});



app.post('/coinflip/join/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const { discordId, robloxUsername, betSkins, clientSeed } = req.body;
  if (!discordId || !robloxUsername || !betSkins || !Array.isArray(betSkins) || betSkins.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or invalid bet skins' });
  }
  try {
    const game = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM coinflip_games WHERE id = ?', [gameId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }
    if (game.joiner_discord_id && !game.pending_approval) {
      return res.status(400).json({ error: 'Game already has a joiner' });
    }
    if (game.creator_discord_id === discordId) {
      return res.status(400).json({ error: 'You cannot join your own game' });
    }
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!user) {
      return res.status(400).json({ error: 'User not registered' });
    }
    let joinerTotalValue = 0;
    const joinerSkinsDetails = [];
    const skinCounts = {};
    for (const skinName of betSkins) {
      skinCounts[skinName] = (skinCounts[skinName] || 0) + 1;
      const inventoryCount = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM inventory WHERE discord_id = ? AND skin_name = ?',
          [discordId, skinName], (err, row) => {
            if (err) reject(err);
            else resolve(row?.count || 0);
        });
      });
      if (skinCounts[skinName] > inventoryCount) {
        return res.status(400).json({
          error: `You only have ${inventoryCount} copies of ${skinName} in your inventory`
        });
      }
      const inventoryItem = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM inventory
           WHERE discord_id = ? AND skin_name = ?
           LIMIT 1 OFFSET ?`,
          [discordId, skinName, skinCounts[skinName] - 1],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
      });
      if (!inventoryItem) {
        return res.status(400).json({
          error: `Could not find skin ${skinName} in your inventory`
        });
      }
      const skinDetails = await getSkinDetails(skinName);
      if (!skinDetails) {
        return res.status(400).json({
          error: `Could not find skin details for: ${skinName}`
        });
      }
      joinerTotalValue += skinDetails.value;
      joinerSkinsDetails.push({
        id: inventoryItem.id,
        name: skinName,
        value: skinDetails.value,
        rarity: skinDetails.rarity,
        image_url: skinDetails.image_url
      });
    }
    const creatorSkins = JSON.parse(game.creator_skins);
    const creatorValue = game.creator_skins_value;
    if (joinerTotalValue < creatorValue) {
      return res.status(400).json({
        error: `Your skins (total value: ${joinerTotalValue}) must be at least equal in value to the creator's skins (value: ${creatorValue})`
      });
    }
    const allowMultipleBets = game.allow_multiple_bets === 1;
    if (!allowMultipleBets) {
      if (betSkins.length !== creatorSkins.length) {
        return res.status(400).json({
          error: 'This game requires exact skin matching. You must bet the same skins as the creator.'
        });
      }
      const sortedCreatorSkins = [...creatorSkins].sort();
      const sortedBetSkins = [...betSkins].sort();
      if (!arraysEqual(sortedCreatorSkins, sortedBetSkins)) {
        return res.status(400).json({
          error: 'This game requires exact skin matching. You must bet the same skins as the creator.'
        });
      }
    } else {
      const requiresApproval = !arraysEqual([...creatorSkins].sort(), [...betSkins].sort());
      if (requiresApproval) {
        await new Promise((resolve, reject) => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        try {
          const skinsToRemove = joinerSkinsDetails.map(skin => skin.id);
          console.log(`Removing ${skinsToRemove.length} skins from ${discordId}'s inventory for pending game ${gameId}`);
          for (const inventoryId of skinsToRemove) {
            await new Promise((resolve, reject) => {
              db.run('DELETE FROM inventory WHERE id = ?', [inventoryId], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          }
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE coinflip_games SET
                joiner_discord_id = ?,
                joiner_roblox_username = ?,
                joiner_skins = ?,
                joiner_skins_value = ?,
                client_seed = ?,
                pending_approval = 1,
                status = 'pending_approval',
                joined_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
              [
                discordId,
                robloxUsername,
                JSON.stringify(betSkins),
                joinerTotalValue,
                clientSeed || crypto.randomBytes(16).toString('hex'),
                gameId
              ],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          notifyPendingApproval(game, {
            discordId,
            robloxUsername,
            betSkins,
            totalValue: joinerTotalValue
          }).catch(error => {
            console.error('Failed to send pending approval notification:', error);
          });
          return res.json({
            status: 'pending_approval',
            message: 'Your bet requires approval from the creator because you\'re betting different skins.',
            gameId,
            creatorSkins,
            creatorValue,
            joinerSkins: betSkins,
            joinerValue: joinerTotalValue
          });
        } catch (error) {
          await new Promise((resolve) => {
            db.run('ROLLBACK', (err) => {
              if (err) console.error('Error rolling back transaction:', err);
              resolve();
            });
          });
          throw error;
        }
      }
    }
    const finalClientSeed = clientSeed || crypto.randomBytes(16).toString('hex');
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    try {
      const winner = determineWinner(game.server_seed, finalClientSeed);
      const winnerDiscordId = winner === 'creator' ? game.creator_discord_id : discordId;
      const winnerRobloxUsername = winner === 'creator' ? game.creator_roblox_username : robloxUsername;
      const winnerSkins = winner === 'creator' ? creatorSkins : betSkins;
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE coinflip_games SET
            joiner_discord_id = ?,
            joiner_roblox_username = ?,
            joiner_skins = ?,
            joiner_skins_value = ?,
            client_seed = ?,
            revealed_seed = ?,
            winner_discord_id = ?,
            winner_roblox_username = ?,
            winner_skins = ?,
            status = 'completed',
            joined_at = CURRENT_TIMESTAMP,
            completed_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
          [
            discordId,
            robloxUsername,
            JSON.stringify(betSkins),
            joinerTotalValue,
            finalClientSeed,
            game.server_seed,
            winnerDiscordId,
            winnerRobloxUsername,
            JSON.stringify(winnerSkins),
            gameId
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      try {
        if (game.creator_discord_id && game.creator_skins_value > 0) {
          await new Promise((resolve) => {
            db.run(`INSERT INTO wager_tracking (game_id, discord_id, wager_amount) 
                    VALUES (?, ?, ?) 
                    ON CONFLICT (game_id, discord_id) DO NOTHING`, 
                    [gameId, game.creator_discord_id, game.creator_skins_value], 
                    (err) => {
                      if (err) console.error(`Error tracking creator wager: ${err}`);
                      resolve();
                    });
          });
          
          await updateUserStats(game.creator_discord_id, game.creator_skins_value);
          console.log(`Updated wager stats for creator ${game.creator_discord_id}: +${game.creator_skins_value}`);
        }
        
        if (discordId && joinerTotalValue > 0) {
          await new Promise((resolve) => {
            db.run(`INSERT INTO wager_tracking (game_id, discord_id, wager_amount) 
                    VALUES (?, ?, ?) 
                    ON CONFLICT (game_id, discord_id) DO NOTHING`, 
                    [gameId, discordId, joinerTotalValue], 
                    (err) => {
                      if (err) console.error(`Error tracking joiner wager: ${err}`);
                      resolve();
                    });
          });
          
          await updateUserStats(discordId, joinerTotalValue);
          console.log(`Updated wager stats for joiner ${discordId}: +${joinerTotalValue}`);
        }
      } catch (error) {
        console.error('Error tracking wagers:', error);
      }
      
      for (const skin of joinerSkinsDetails) {
        await new Promise((resolve, reject) => {
          db.run('DELETE FROM inventory WHERE id = ?', [skin.id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      if (winner === 'creator') {
        for (const skinName of betSkins) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
              [game.creator_discord_id, skinName],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
        for (const skinName of creatorSkins) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
              [game.creator_discord_id, skinName],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
      } else {
        for (const skinName of creatorSkins) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
              [discordId, skinName],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
        for (const skinName of betSkins) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
              [discordId, skinName],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
      }
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO notifications
            (discord_id, type, content, reference_id, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            game.creator_discord_id,
            winner === 'creator' ? 'game_won' : 'game_lost',
            winner === 'creator'
              ? `You won a coinflip game against ${robloxUsername}!`
              : `You lost a coinflip game against ${robloxUsername}.`,
            gameId,
            0
          ],
          (err) => {
            if (err) {
              console.error('Error creating notification for creator:', err);
              resolve(); 
            } else {
              resolve();
            }
          }
        );
      });
      await new Promise((resolve, reject) => {
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      const gameResult = {
        gameId,
        status: 'completed',
        winner: {
          discordId: winnerDiscordId,
          robloxUsername: winnerRobloxUsername,
          skins: winnerSkins
        },
        creator: {
          discordId: game.creator_discord_id,
          robloxUsername: game.creator_roblox_username,
          skins: creatorSkins,
          skinValue: creatorValue
        },
        joiner: {
          discordId,
          robloxUsername,
          skins: betSkins,
          skinValue: joinerTotalValue
        },
        serverSeed: game.server_seed,
        clientSeed: finalClientSeed,
        completedAt: new Date().toISOString()
      };
      notifyGameResult(gameResult).catch(error => {
        console.error('Failed to send game result notification:', error);
      });
      return res.json(gameResult);
    } catch (error) {
      await new Promise((resolve) => {
        db.run('ROLLBACK', (err) => {
          if (err) console.error('Error rolling back transaction:', err);
          resolve();
        });
      });
      throw error;
    }
  } catch (error) {
    console.error('Error joining coinflip game:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});


app.post('/user/update-wager', async (req, res) => {
  const { discordId, wagerAmount, gameId } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  console.log(`Received wager update request: User ${discordId}, Amount ${wagerAmount}, Game ${gameId}`);
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const session = await new Promise((resolve, reject) => {
      db.get(
        'SELECT discord_id FROM sessions WHERE token = ? AND expires_at > ?',
        [token, new Date().toISOString()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!session || session.discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS wager_tracking (
        game_id TEXT,
        discord_id TEXT,
        wager_amount INTEGER NOT NULL,
        tracked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (game_id, discord_id)
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    if (gameId) {
      const existingWager = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM wager_tracking WHERE game_id = ? AND discord_id = ?',
          [gameId, discordId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (existingWager) {
        console.log(`Game ${gameId} wager already tracked for user ${discordId}, skipping update`);
        return res.json({ 
          success: true, 
          message: 'Wager already tracked for this game',
          alreadyTracked: true
        });
      }
    }
    
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS user_stats (
        discord_id TEXT PRIMARY KEY,
        total_wagered INTEGER DEFAULT 0,
        rank TEXT DEFAULT 'Iron',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (discord_id) REFERENCES users (discord_id)
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const stats = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM user_stats WHERE discord_id = ?',
        [discordId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    try {
      if (!stats) {
        console.log(`Creating new user stats with initial wager: ${wagerAmount}`);
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO user_stats (discord_id, total_wagered, rank, last_updated) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [discordId, parseInt(wagerAmount), determineRank(parseInt(wagerAmount))],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        const currentWager = parseInt(stats.total_wagered) || 0;
        const newWagerAmount = parseInt(wagerAmount) || 0;
        const newTotalWagered = currentWager + newWagerAmount;
        
        console.log(`Updating user stats: Current wager ${currentWager}, Adding ${newWagerAmount}, New total: ${newTotalWagered}`);
        
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE user_stats SET total_wagered = ?, rank = ?, last_updated = CURRENT_TIMESTAMP WHERE discord_id = ?',
            [newTotalWagered, determineRank(newTotalWagered), discordId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      if (gameId) {
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO wager_tracking (game_id, discord_id, wager_amount) VALUES (?, ?, ?)',
            [gameId, discordId, parseInt(wagerAmount)],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      await new Promise((resolve, reject) => {
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      const updatedStats = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM user_stats WHERE discord_id = ?',
          [discordId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      res.json({ success: true, stats: updatedStats });
    } catch (error) {
      await new Promise((resolve) => {
        db.run('ROLLBACK', () => resolve());
      });
      throw error;
    }
  } catch (error) {
    console.error('Error updating user wager:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});





function determineRank(totalWager) {
  if (totalWager >= 1000000) return 'Master';
  if (totalWager >= 500000) return 'Diamond';
  if (totalWager >= 100000) return 'Platinum';
  if (totalWager >= 50000) return 'Gold';
  if (totalWager >= 10000) return 'Silver';
  if (totalWager >= 1000) return 'Bronze';
  return 'Iron';
}




app.get('/profile/:discordId', async (req, res) => {
  const { discordId } = req.params;
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const gameStats = await new Promise((resolve, reject) => {
      db.get(
        `SELECT
          COUNT(CASE WHEN (creator_discord_id = ? OR joiner_discord_id = ?) THEN 1 END) as total_games,
          COUNT(CASE WHEN winner_discord_id = ? THEN 1 END) as games_won,
          COUNT(CASE WHEN (creator_discord_id = ? OR joiner_discord_id = ?) AND winner_discord_id != ? AND winner_discord_id IS NOT NULL THEN 1 END) as games_lost,
          COUNT(CASE WHEN creator_discord_id = ? THEN 1 END) as games_created,
          COUNT(CASE WHEN joiner_discord_id = ? THEN 1 END) as games_joined,
          COUNT(CASE WHEN status = 'cancelled' AND creator_discord_id = ? THEN 1 END) as games_cancelled
        FROM coinflip_games
        WHERE creator_discord_id = ? OR joiner_discord_id = ?`,
        [discordId, discordId, discordId, discordId, discordId, discordId, discordId, discordId, discordId, discordId, discordId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    const wagerData = await new Promise((resolve, reject) => {
      db.get(
        `SELECT
          SUM(CASE WHEN creator_discord_id = ? THEN creator_skins_value ELSE 0 END) as creator_wager,
          SUM(CASE WHEN joiner_discord_id = ? THEN joiner_skins_value ELSE 0 END) as joiner_wager
         FROM coinflip_games
         WHERE creator_discord_id = ? OR joiner_discord_id = ?`,
        [discordId, discordId, discordId, discordId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    const totalWagered = (wagerData.creator_wager || 0) + (wagerData.joiner_wager || 0);
    
    const recentGames = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM coinflip_games
         WHERE (creator_discord_id = ? OR joiner_discord_id = ?)
         ORDER BY created_at DESC
         LIMIT 10`,
        [discordId, discordId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    let rank = 'Unranked';
    if (totalWagered >= 20000000) rank = 'Master';
    else if (totalWagered >= 10000000) rank = 'Diamond';
    else if (totalWagered >= 5000000) rank = 'Platinum';
    else if (totalWagered >= 50000) rank = 'Gold';
    else if (totalWagered >= 10000) rank = 'Silver';
    else if (totalWagered >= 1000) rank = 'Bronze';
    
    res.json({
      user: {
        discordId: user.discord_id,
        robloxUsername: user.roblox_username,
        registeredAt: user.registered_at
      },
      stats: {
        ...gameStats,
        totalWagered,
        rank,
        winRate: gameStats.total_games > 0
          ? Math.round((gameStats.games_won / gameStats.total_games) * 100)
          : 0
      },
      recentGames: recentGames.map(game => ({
        id: game.id,
        creator: {
          discordId: game.creator_discord_id,
          robloxUsername: game.creator_roblox_username
        },
        joiner: game.joiner_discord_id ? {
          discordId: game.joiner_discord_id,
          robloxUsername: game.joiner_roblox_username
        } : null,
        winner: game.winner_discord_id ? {
          discordId: game.winner_discord_id,
          robloxUsername: game.winner_roblox_username
        } : null,
        creatorBet: game.creator_skins_value,
        joinerBet: game.joiner_skins_value || 0,
        status: game.status,
        createdAt: game.created_at,
        completedAt: game.completed_at
      }))
    });
  } catch (error) {
    console.error('Error fetching profile data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}


app.get('/notifications', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  db.get(
    'SELECT discord_id FROM sessions WHERE token = ? AND expires_at > ?',
    [token, new Date().toISOString()],
    (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      console.log(`Checking notifications for user ${session.discord_id}`);
      
      db.all(
        'SELECT * FROM notifications WHERE discord_id = ? AND is_read = 0 ORDER BY created_at DESC',
        [session.discord_id],
        (err, notifications) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          console.log(`Found ${notifications.length} notifications for user ${session.discord_id}`);
          res.json({ notifications });
        }
      );
    }
  );
});


app.post('/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  db.get(
    'SELECT discord_id FROM sessions WHERE token = ? AND expires_at > ?',
    [token, new Date().toISOString()],
    (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      console.log(`Marking notification ${id} as read for user ${session.discord_id}`);
      
      db.run(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND discord_id = ?',
        [id, session.discord_id],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          console.log(`Updated notification status, changes: ${this.changes}`);
          
          if (this.changes === 0) {
            console.log(`No notification updated with ID ${id} for user ${session.discord_id}`);
          }
          
          res.json({ success: true, changes: this.changes });
        }
      );
    }
  );
});



app.post('/dice/create', async (req, res) => {
  const { discordId, robloxUsername, betSkins } = req.body;
  
  if (!discordId || !robloxUsername || !betSkins || !Array.isArray(betSkins) || betSkins.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or invalid bet skins' });
  }
  
  const db_transaction = await new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!user) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(400).json({ error: 'User not registered' });
    }
    
    let totalValue = 0;
    const skinsToRemove = [];
    const skinCounts = {};
    
    for (const skinName of betSkins) {
      skinCounts[skinName] = (skinCounts[skinName] || 0) + 1;
      
      const inventoryCount = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM inventory WHERE discord_id = ? AND skin_name = ?',
          [discordId, skinName], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
        });
      });
      
      if (skinCounts[skinName] > inventoryCount) {
        await new Promise((resolve) => db.run('ROLLBACK', resolve));
        return res.status(400).json({
          error: `You only have ${inventoryCount} copies of ${skinName} in your inventory`
        });
      }
      
      const inventoryItem = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM inventory
           WHERE discord_id = ? AND skin_name = ?
           LIMIT 1 OFFSET ?`,
          [discordId, skinName, skinCounts[skinName] - 1],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
      });
      
      if (!inventoryItem) {
        await new Promise((resolve) => db.run('ROLLBACK', resolve));
        return res.status(400).json({
          error: `Could not find the ${skinCounts[skinName]} copy of ${skinName} in your inventory`
        });
      }
      
      const skinDetails = await getSkinDetails(skinName);
      if (!skinDetails) {
        await new Promise((resolve) => db.run('ROLLBACK', resolve));
        return res.status(400).json({
          error: `Could not find skin details for: ${skinName}`
        });
      }
      
      totalValue += skinDetails.value;
      skinsToRemove.push(inventoryItem.id);
    }
    
    const gameId = crypto.randomBytes(16).toString('hex');
    
    for (const inventoryId of skinsToRemove) {
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM inventory WHERE id = ?', [inventoryId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO dice_games (
          game_id, creator_discord_id, creator_roblox_username,
          creator_skins, creator_skins_value, status
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          gameId,
          discordId,
          robloxUsername,
          JSON.stringify(betSkins),
          totalValue,
          'active'
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const gameData = {
      gameId,
      creator: {
        discordId,
        robloxUsername
      },
      betSkins,
      skinValue: totalValue,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    res.json(gameData);
    
  } catch (error) {
    await new Promise((resolve) => {
      db.run('ROLLBACK', (err) => {
        if (err) console.error('Error rolling back transaction:', err);
        resolve();
      });
    });
    console.error('Error creating dice game:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});



app.get('/dice/active', (req, res) => {
  db.all(
    `SELECT
      dg.id, dg.game_id, dg.creator_discord_id, dg.creator_roblox_username,
      dg.creator_skins, dg.creator_skins_value, dg.created_at, dg.status,
      s.rarity, s.image_url
    FROM dice_games dg
    LEFT JOIN skins s ON json_extract(dg.creator_skins, '$[0]') = s.name
    WHERE dg.status = 'active' AND dg.joiner_discord_id IS NULL
    ORDER BY dg.created_at DESC`,
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const games = (rows || []).map(row => {
        const creatorSkins = JSON.parse(row.creator_skins);
        return {
          gameId: row.game_id,
          creator: {
            discordId: row.creator_discord_id,
            robloxUsername: row.creator_roblox_username
          },
          betSkins: creatorSkins,
          skinValue: row.creator_skins_value,
          skinRarity: row.rarity,
          skinImageUrl: row.image_url,
          createdAt: row.created_at,
          status: row.status
        };
      });
      
      res.json({ games });
    }
  );
});

app.get('/dice/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  
  db.get(
    `SELECT * FROM dice_games WHERE game_id = ?`,
    [gameId],
    async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      const creatorSkins = JSON.parse(row.creator_skins);
      const joinerSkins = row.joiner_skins ? JSON.parse(row.joiner_skins) : null;
      
      let creatorSkinDetails = null;
      if (creatorSkins.length > 0) {
        creatorSkinDetails = await getSkinDetails(creatorSkins[0]);
      }
      
      let joinerSkinDetails = null;
      if (joinerSkins && joinerSkins.length > 0) {
        joinerSkinDetails = await getSkinDetails(joinerSkins[0]);
      }
      
      const game = {
        gameId: row.game_id,
        creator: {
          discordId: row.creator_discord_id,
          robloxUsername: row.creator_roblox_username,
          skinRarity: creatorSkinDetails?.rarity,
          skinImageUrl: creatorSkinDetails?.image_url
        },
        creatorSkins: creatorSkins,
        creatorSkinValue: row.creator_skins_value,
        status: row.status,
        createdAt: row.created_at
      };
      
      if (row.joiner_discord_id) {
        game.joiner = {
          discordId: row.joiner_discord_id,
          robloxUsername: row.joiner_roblox_username,
          skinRarity: joinerSkinDetails?.rarity,
          skinImageUrl: joinerSkinDetails?.image_url
        };
        game.joinerSkins = joinerSkins;
        game.joinerSkinValue = row.joiner_skins_value;
      }
      
      if (row.status === 'completed') {
        game.creator.roll = row.creator_roll;
        game.joiner.roll = row.joiner_roll;
        game.winner = {
          discordId: row.winner_discord_id,
          robloxUsername: row.winner_roblox_username
        };
        game.completedAt = row.completed_at;
      }
      
      res.json(game);
    }
  );
});


app.post('/dice/join/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const { discordId, robloxUsername, betSkins } = req.body;
  
  if (!discordId || !robloxUsername || !betSkins || !Array.isArray(betSkins) || betSkins.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or invalid bet skins' });
  }
  
  try {
    const game = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM dice_games WHERE game_id = ?', [gameId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }
    
    if (game.joiner_discord_id) {
      return res.status(400).json({ error: 'Game already has a joiner' });
    }
    
    if (game.creator_discord_id === discordId) {
      return res.status(400).json({ error: 'You cannot join your own game' });
    }
    
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!user) {
      return res.status(400).json({ error: 'User not registered' });
    }
    
    let joinerTotalValue = 0;
    const joinerSkinsDetails = [];
    const skinCounts = {};
    
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    try {
      for (const skinName of betSkins) {
        skinCounts[skinName] = (skinCounts[skinName] || 0) + 1;
        
        const inventoryCount = await new Promise((resolve, reject) => {
          db.get('SELECT COUNT(*) as count FROM inventory WHERE discord_id = ? AND skin_name = ?',
            [discordId, skinName], (err, row) => {
              if (err) reject(err);
              else resolve(row?.count || 0);
          });
        });
        
        if (skinCounts[skinName] > inventoryCount) {
          throw new Error(`You only have ${inventoryCount} copies of ${skinName} in your inventory`);
        }
        
        const inventoryItem = await new Promise((resolve, reject) => {
          db.get(
            `SELECT id FROM inventory
             WHERE discord_id = ? AND skin_name = ?
             LIMIT 1 OFFSET ?`,
            [discordId, skinName, skinCounts[skinName] - 1],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
          });
        });
        
        if (!inventoryItem) {
          throw new Error(`Could not find skin ${skinName} in your inventory`);
        }
        
        const skinDetails = await getSkinDetails(skinName);
        if (!skinDetails) {
          throw new Error(`Could not find skin details for: ${skinName}`);
        }
        
        joinerTotalValue += skinDetails.value;
        joinerSkinsDetails.push({
          id: inventoryItem.id,
          name: skinName,
          value: skinDetails.value
        });
      }
      
      const creatorValue = game.creator_skins_value;
      
      if (joinerTotalValue < creatorValue * 0.9 || joinerTotalValue > creatorValue * 1.1) {
        throw new Error(`Your bet value (${joinerTotalValue}) must be within 10% of the creator's bet value (${creatorValue})`);
      }
      
      for (const skin of joinerSkinsDetails) {
        await new Promise((resolve, reject) => {
          db.run('DELETE FROM inventory WHERE id = ?', [skin.id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      
      let creatorRoll = Math.floor(Math.random() * 6) + 1;
      let joinerRoll = Math.floor(Math.random() * 6) + 1;
      
      let tieResolved = false;
      
      if (creatorRoll === joinerRoll) {
        tieResolved = true;
        let rerolls = 0;
        const maxRerolls = 3;
        
        while (creatorRoll === joinerRoll && rerolls < maxRerolls) {
          creatorRoll = Math.floor(Math.random() * 6) + 1;
          joinerRoll = Math.floor(Math.random() * 6) + 1;
          rerolls++;
        }
        
        if (creatorRoll === joinerRoll) {
          creatorRoll++;
          if (creatorRoll > 6) creatorRoll = 6;
        }
      }
      
      const creatorWins = creatorRoll > joinerRoll;
      const winnerDiscordId = creatorWins ? game.creator_discord_id : discordId;
      const winnerRobloxUsername = creatorWins ? game.creator_roblox_username : robloxUsername;
      
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE dice_games SET
            joiner_discord_id = ?,
            joiner_roblox_username = ?,
            joiner_skins = ?,
            joiner_skins_value = ?,
            creator_roll = ?,
            joiner_roll = ?,
            winner_discord_id = ?,
            winner_roblox_username = ?,
            result = ?,
            status = 'completed',
            completed_at = CURRENT_TIMESTAMP
          WHERE game_id = ?`,
          [
            discordId,
            robloxUsername,
            JSON.stringify(betSkins),
            joinerTotalValue,
            creatorRoll,
            joinerRoll,
            winnerDiscordId,
            winnerRobloxUsername,
            tieResolved ? 'tie-resolved' : 'normal',
            gameId
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      try {
        if (game.creator_discord_id && game.creator_skins_value > 0) {
          await new Promise((resolve) => {
            db.run(`INSERT INTO wager_tracking (game_id, discord_id, wager_amount)
                    VALUES (?, ?, ?)
                    ON CONFLICT (game_id, discord_id) DO NOTHING`,
                    [gameId, game.creator_discord_id, game.creator_skins_value],
                    (err) => {
                      if (err) console.error(`Error tracking creator wager: ${err}`);
                      resolve();
                    });
          });
          await updateUserStats(game.creator_discord_id, game.creator_skins_value);
          console.log(`Updated wager stats for creator ${game.creator_discord_id}: +${game.creator_skins_value}`);
        }
        
        if (discordId && joinerTotalValue > 0) {
          await new Promise((resolve) => {
            db.run(`INSERT INTO wager_tracking (game_id, discord_id, wager_amount)
                    VALUES (?, ?, ?)
                    ON CONFLICT (game_id, discord_id) DO NOTHING`,
                    [gameId, discordId, joinerTotalValue],
                    (err) => {
                      if (err) console.error(`Error tracking joiner wager: ${err}`);
                      resolve();
                    });
          });
          await updateUserStats(discordId, joinerTotalValue);
          console.log(`Updated wager stats for joiner ${discordId}: +${joinerTotalValue}`);
        }
      } catch (error) {
        console.error('Error tracking wagers:', error);
      }
      
      const creatorSkins = JSON.parse(game.creator_skins);
      
      if (creatorWins) {
        for (const skinName of [...creatorSkins, ...betSkins]) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
              [game.creator_discord_id, skinName],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
      } else {
        for (const skinName of [...creatorSkins, ...betSkins]) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
              [discordId, skinName],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
      }
      
      const creatorNotificationContent = tieResolved 
        ? `You rolled ${creatorRoll} (tie resolved) and ${creatorWins ? 'won' : 'lost'} a dice game against ${robloxUsername} who rolled ${joinerRoll}!`
        : `You rolled ${creatorRoll} and ${creatorWins ? 'won' : 'lost'} a dice game against ${robloxUsername} who rolled ${joinerRoll}!`;
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO notifications
            (discord_id, type, content, reference_id, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            game.creator_discord_id,
            creatorWins ? 'game_won' : 'game_lost',
            creatorNotificationContent,
            gameId,
            0
          ],
          (err) => {
            if (err) {
              console.error('Error creating notification for creator:', err);
              resolve();
            } else {
              resolve();
            }
          }
        );
      });
      
      const joinerNotificationContent = tieResolved
        ? `You rolled ${joinerRoll} (tie resolved) and ${!creatorWins ? 'won' : 'lost'} a dice game against ${game.creator_roblox_username} who rolled ${creatorRoll}!`
        : `You rolled ${joinerRoll} and ${!creatorWins ? 'won' : 'lost'} a dice game against ${game.creator_roblox_username} who rolled ${creatorRoll}!`;
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO notifications
            (discord_id, type, content, reference_id, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            discordId,
            creatorWins ? 'game_lost' : 'game_won',
            joinerNotificationContent,
            gameId,
            0
          ],
          (err) => {
            if (err) {
              console.error('Error creating notification for joiner:', err);
              resolve(); 
            } else {
              resolve();
            }
          }
        );
      });
      
      await new Promise((resolve, reject) => {
        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      const gameResult = {
        gameId,
        status: 'completed',
        creator: {
          discordId: game.creator_discord_id,
          robloxUsername: game.creator_roblox_username,
          skins: creatorSkins,
          skinValue: game.creator_skins_value,
          roll: creatorRoll
        },
        joiner: {
          discordId,
          robloxUsername,
          skins: betSkins,
          skinValue: joinerTotalValue,
          roll: joinerRoll
        },
        winner: {
          discordId: winnerDiscordId,
          robloxUsername: winnerRobloxUsername
        },
        tieResolved,
        completedAt: new Date().toISOString()
      };
      
      return res.json(gameResult);
      
    } catch (error) {
      await new Promise((resolve) => {
        db.run('ROLLBACK', (err) => {
          if (err) console.error('Error rolling back transaction:', err);
          resolve();
        });
      });
      console.error('Error joining dice game:', error);
      return res.status(400).json({ error: error.message });
    }
    
  } catch (error) {
    console.error('Error joining dice game:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

app.get('/dice/recent', (req, res) => {
  db.all(
    `SELECT * FROM dice_games
    WHERE status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 10`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const games = rows.map(row => {
        const creatorSkins = JSON.parse(row.creator_skins);
        const joinerSkins = row.joiner_skins ? JSON.parse(row.joiner_skins) : [];
        
        return {
          gameId: row.game_id,
          creator: {
            discordId: row.creator_discord_id,
            robloxUsername: row.creator_roblox_username,
            skins: creatorSkins,
            skinValue: row.creator_skins_value,
            roll: row.creator_roll
          },
          joiner: {
            discordId: row.joiner_discord_id,
            robloxUsername: row.joiner_roblox_username,
            skins: joinerSkins,
            skinValue: row.joiner_skins_value,
            roll: row.joiner_roll
          },
          winner: {
            discordId: row.winner_discord_id,
            robloxUsername: row.winner_roblox_username
          },
          completedAt: row.completed_at
        };
      });
      
      res.json({ games });
    }
  );
});


app.post('/dice/cancel/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const { discordId } = req.body;
  
  if (!discordId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const db_transaction = await new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  try {
    const game = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM dice_games WHERE game_id = ?', [gameId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!game) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.status !== 'active') {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(400).json({ error: 'Game is not active' });
    }
    
    if (game.creator_discord_id !== discordId) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(403).json({ error: 'You can only cancel your own games' });
    }
    
    await new Promise((resolve, reject) => {
      db.run('UPDATE dice_games SET status = ? WHERE game_id = ?',
        ['cancelled', gameId], (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    const creatorSkins = JSON.parse(game.creator_skins);
    for (const skinName of creatorSkins) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
          [discordId, skinName], (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({
      gameId,
      status: 'cancelled'
    });
    
  } catch (error) {
    await new Promise((resolve) => db.run('ROLLBACK', resolve));
    console.error('Error cancelling dice game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/notifications/read-all', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  db.get(
    'SELECT discord_id FROM sessions WHERE token = ? AND expires_at > ?',
    [token, new Date().toISOString()],
    (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      console.log(`Marking all notifications as read for user ${session.discord_id}`);
      
      db.run(
        'UPDATE notifications SET is_read = 1 WHERE discord_id = ? AND is_read = 0',
        [session.discord_id],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          console.log(`Marked ${this.changes} notifications as read for user ${session.discord_id}`);
          
          res.json({ success: true, markedAsRead: this.changes });
        }
      );
    }
  );
});




function adminAuth(req, res, next) {
  const adminKey = req.headers['admin-key'];
  if (adminKey !== process.env.admin_key) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    const [
      usersCount,
      totalGames,
      totalSkins,
      totalTransactions
    ] = await Promise.all([
      new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        });
      }),
      new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM coinflip_games', [], (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        });
      }),
      new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM inventory', [], (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        });
      }),
      new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM transactions', [], (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        });
      })
    ]);

    res.json({
      usersCount,
      totalGames,
      totalSkins,
      totalTransactions
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/admin/metrics', adminAuth, async (req, res) => {
  try {
    const [
      activeGames,
      pendingApprovalGames,
      totalValueLocked,
      registrationsLast24h,
      activeSessions
    ] = await Promise.all([
      new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM coinflip_games WHERE status = "active"', [], (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        });
      }),
      new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM coinflip_games WHERE status = "pending_approval"', [], (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.count : 0);
        });
      }),
      new Promise((resolve, reject) => {
        db.get('SELECT SUM(value) as total FROM inventory i JOIN skins s ON i.skin_name = s.name', [], (err, row) => {
          if (err) reject(err);
          else resolve(row ? (row.total || 0) : 0);
        });
      }),
      new Promise((resolve, reject) => {
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        db.get(
          'SELECT COUNT(*) as count FROM users WHERE registered_at > ?',
          [oneDayAgo.toISOString()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
          }
        );
      }),
      new Promise((resolve, reject) => {
        db.get(
          'SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?',
          [new Date().toISOString()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
          }
        );
      })
    ]);
    
    res.json({
      activeGames,
      pendingApprovalGames,
      totalValueLocked,
      registrationsLast24h,
      activeSessions
    });
  } catch (error) {
    console.error('Error fetching server metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/admin/users', adminAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  
  let query = 'SELECT * FROM users';
  let countQuery = 'SELECT COUNT(*) as total FROM users';
  const params = [];
  
  if (search) {
    query += ' WHERE discord_id LIKE ? OR roblox_username LIKE ?';
    countQuery += ' WHERE discord_id LIKE ? OR roblox_username LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY registered_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  db.get(countQuery, search ? [`%${search}%`, `%${search}%`] : [], (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      res.json({
        users: rows,
        pagination: {
          total: countRow.total,
          page,
          limit,
          pages: Math.ceil(countRow.total / limit)
        }
      });
    });
  });
});

app.get('/admin/games', adminAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  const countQuery = 'SELECT COUNT(*) as total FROM coinflip_games';
  const query = `SELECT * FROM coinflip_games ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  
  db.get(countQuery, [], (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    db.all(query, [limit, offset], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      res.json({
        games: rows.map(game => ({
          ...game,
          creator_skins: JSON.parse(game.creator_skins || '[]'),
          joiner_skins: game.joiner_skins ? JSON.parse(game.joiner_skins) : null,
          winner_skins: game.winner_skins ? JSON.parse(game.winner_skins) : null
        })),
        pagination: {
          total: countRow.total,
          page,
          limit,
          pages: Math.ceil(countRow.total / limit)
        }
      });
    });
  });
});


async function updateUserStats(discordId, wagerAmount) {
  try {
    const stats = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM user_stats WHERE discord_id = ?', 
             [discordId], 
             (err, row) => {
                if (err) reject(err);
                else resolve(row);
             });
    });
    
    if (!stats) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO user_stats (discord_id, total_wagered, rank, last_updated) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
              [discordId, wagerAmount, determineRank(wagerAmount)],
              (err) => {
                if (err) reject(err);
                else resolve();
              });
      });
      console.log(`Created new stats for ${discordId} with initial wager: ${wagerAmount}`);
    } else {
      const newTotal = (parseInt(stats.total_wagered) || 0) + parseInt(wagerAmount);
      await new Promise((resolve, reject) => {
        db.run('UPDATE user_stats SET total_wagered = ?, rank = ?, last_updated = CURRENT_TIMESTAMP WHERE discord_id = ?',
              [newTotal, determineRank(newTotal), discordId],
              (err) => {
                if (err) reject(err);
                else resolve();
              });
      });
      console.log(`Updated stats for ${discordId}: ${stats.total_wagered} → ${newTotal}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating user stats for ${discordId}:`, error);
    return false;
  }
}



app.get('/admin/users/:discordId', adminAuth, async (req, res) => {
  const { discordId } = req.params;
  
  try {
    const [user, inventory, gameStats] = await Promise.all([
      new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }),
      new Promise((resolve, reject) => {
        db.all(
          `SELECT i.skin_name, s.value, s.rarity, COUNT(*) as count
           FROM inventory i
           JOIN skins s ON i.skin_name = s.name
           WHERE i.discord_id = ?
           GROUP BY i.skin_name
           ORDER BY s.value DESC`,
          [discordId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      }),
      new Promise((resolve, reject) => {
        db.get(
          `SELECT
            COUNT(CASE WHEN (creator_discord_id = ? OR joiner_discord_id = ?) THEN 1 END) as total_games,
            COUNT(CASE WHEN winner_discord_id = ? THEN 1 END) as games_won,
            COUNT(CASE WHEN (creator_discord_id = ? OR joiner_discord_id = ?) AND winner_discord_id != ? AND winner_discord_id IS NOT NULL THEN 1 END) as games_lost,
            COUNT(CASE WHEN creator_discord_id = ? THEN 1 END) as games_created,
            COUNT(CASE WHEN joiner_discord_id = ? THEN 1 END) as games_joined,
            COUNT(CASE WHEN status = 'cancelled' AND creator_discord_id = ? THEN 1 END) as games_cancelled
          FROM coinflip_games
          WHERE creator_discord_id = ? OR joiner_discord_id = ?`,
          [discordId, discordId, discordId, discordId, discordId, discordId, discordId, discordId, discordId, discordId, discordId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      })
    ]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const totalInventoryValue = inventory.reduce((sum, item) => sum + (item.value * item.count), 0);
    
    res.json({
      user,
      inventory: {
        items: inventory,
        totalValue: totalInventoryValue,
        totalItems: inventory.reduce((sum, item) => sum + item.count, 0)
      },
      gameStats: {
        ...gameStats,
        winRate: gameStats.total_games > 0 
          ? Math.round((gameStats.games_won / gameStats.total_games) * 100) 
          : 0
      }
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/admin/skins', adminAuth, (req, res) => {
  db.all('SELECT * FROM skins ORDER BY value DESC', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json({ skins: rows });
  });
});

app.post('/admin/skins', adminAuth, (req, res) => {
  const { name, value, rarity, image_url } = req.body;
  
  if (!name || !value || !rarity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  db.run(
    'INSERT INTO skins (name, value, rarity, image_url) VALUES (?, ?, ?, ?)',
    [name, value, rarity, image_url || null],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      res.json({
        id: this.lastID,
        name,
        value,
        rarity,
        image_url
      });
    }
  );
});

app.put('/admin/skins/:id', adminAuth, (req, res) => {
  const { id } = req.params;
  const { name, value, rarity, image_url } = req.body;
  
  if (!name || !value || !rarity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  db.run(
    'UPDATE skins SET name = ?, value = ?, rarity = ?, image_url = ? WHERE id = ?',
    [name, value, rarity, image_url, id],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Skin not found' });
      }
      
      res.json({
        id,
        name,
        value,
        rarity,
        image_url
      });
    }
  );
});

app.delete('/admin/skins/:id', adminAuth, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM skins WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Skin not found' });
    }
    
    res.json({ success: true });
  });
});

app.post('/admin/users/:discordId/add-skins', adminAuth, async (req, res) => {
  const { discordId } = req.params;
  const { skins } = req.body;
  
  if (!skins || !Array.isArray(skins) || skins.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid skins array' });
  }
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    for (const skinName of skins) {
      const skin = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM skins WHERE name = ?', [skinName], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!skin) {
        return res.status(404).json({ error: `Skin "${skinName}" not found` });
      }
    }
    
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', err => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    try {
      for (const skinName of skins) {
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
            [discordId, skinName],
            err => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      await new Promise((resolve, reject) => {
        db.run('COMMIT', err => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      res.json({
        success: true,
        message: `Added ${skins.length} skins to user's inventory`,
        skinsAdded: skins
      });
    } catch (error) {
      await new Promise(resolve => {
        db.run('ROLLBACK', () => resolve());
      });
      throw error;
    }
  } catch (error) {
    console.error('Error adding skins to inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/admin/users/:discordId/clear-notifications', adminAuth, (req, res) => {
  const { discordId } = req.params;
  
  db.run(
    'UPDATE notifications SET is_read = 1 WHERE discord_id = ?',
    [discordId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      res.json({
        success: true,
        clearedCount: this.changes
      });
    }
  );
});



app.post('/coinflip/cancel/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const { discordId, notifyJoiner } = req.body;
  
  if (!discordId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const db_transaction = await new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  try {
    const game = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM coinflip_games WHERE id = ?', [gameId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!game) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.status !== 'active' && game.status !== 'pending_approval') {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(400).json({ error: 'Game is not active or pending approval' });
    }
    
    if (game.creator_discord_id !== discordId) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(403).json({ error: 'You can only cancel your own games' });
    }
    
    await new Promise((resolve, reject) => {
      db.run('UPDATE coinflip_games SET status = ? WHERE id = ?',
        ['cancelled', gameId], (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    const creatorSkins = JSON.parse(game.creator_skins);
    for (const skinName of creatorSkins) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
          [discordId, skinName], (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    if (game.joiner_discord_id && game.status === 'pending_approval') {
      const joinerSkins = JSON.parse(game.joiner_skins);
      for (const skinName of joinerSkins) {
        await new Promise((resolve, reject) => {
          db.run('INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
            [game.joiner_discord_id, skinName], (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      if (notifyJoiner) {
        db.run(
          `INSERT INTO notifications (discord_id, type, content, reference_id, created_at) 
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            game.joiner_discord_id, 
            'game_cancelled',
            `${game.creator_roblox_username} has cancelled the game you were trying to join. Your skins have been returned.`,
            gameId
          ],
          (err) => {
            if (err) console.error('Error creating notification:', err);
          }
        );
      }
    }
    
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const cancelledGame = {
      gameId,
      creator: {
        discordId: game.creator_discord_id,
        robloxUsername: game.creator_roblox_username
      },
      creatorSkin: game.creator_skin,
      creatorSkinValue: game.creator_skin_value,
      status: 'cancelled',
      createdAt: game.created_at
    };
    
    notifyGameCancellation(cancelledGame).catch(error => {
      console.error('Failed to send game cancellation notification:', error);
    });
    
    res.json({
      gameId,
      status: 'cancelled'
    });
  } catch (error) {
    await new Promise((resolve) => db.run('ROLLBACK', resolve));
    console.error('Error cancelling coinflip game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.post('/coinflip/approve/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const { discordId, approved } = req.body;
  if (!discordId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const game = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM coinflip_games WHERE id = ?', [gameId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Game is not pending approval' });
    }
    if (game.creator_discord_id !== discordId) {
      return res.status(403).json({ error: 'Only the creator can approve or reject this game' });
    }
    if (!approved) {
      await new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      try {
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE coinflip_games SET
              status = 'rejected',
              pending_approval = 0
            WHERE id = ?`,
            [gameId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        const joinerSkins = JSON.parse(game.joiner_skins);
        for (const skinName of joinerSkins) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
              [game.joiner_discord_id, skinName],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
        const creatorSkins = JSON.parse(game.creator_skins);
        for (const skinName of creatorSkins) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
              [game.creator_discord_id, skinName],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO notifications
            (discord_id, type, content, reference_id, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              game.joiner_discord_id, 
              'game_rejected',
              `${game.creator_roblox_username} has rejected your join request. Your skins have been returned to your inventory.`,
              gameId,
              0
            ],
            (err) => {
              if (err) {
                console.error('Error creating rejection notification:', err);
                resolve();
              } else {
                resolve();
              }
            }
          );
        });
        await new Promise((resolve, reject) => {
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.log(`Game ${gameId} rejected. Returned ${joinerSkins.length} skins to joiner and ${creatorSkins.length} skins to creator.`);
        notifyGameRejection(game).catch(error => {
          console.error('Failed to send game rejection notification to server logs:', error);
        });
        return res.json({
          status: 'rejected',
          message: 'You have rejected this game. All skins have been returned.'
        });
      } catch (error) {
        await new Promise((resolve) => {
          db.run('ROLLBACK', (err) => {
            if (err) console.error('Error rolling back transaction:', err);
            resolve();
          });
        });
        throw error;
      }
    } else {
      await new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      try {
        const winner = determineWinner(game.server_seed, game.client_seed);
        const winnerDiscordId = winner === 'creator' ? game.creator_discord_id : game.joiner_discord_id;
        const winnerRobloxUsername = winner === 'creator' ? game.creator_roblox_username : game.joiner_roblox_username;
        const winnerSkins = winner === 'creator' ? JSON.parse(game.creator_skins) : JSON.parse(game.joiner_skins);
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE coinflip_games SET
              revealed_seed = ?,
              winner_discord_id = ?,
              winner_roblox_username = ?,
              winner_skins = ?,
              status = 'completed',
              pending_approval = 0,
              completed_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [
              game.server_seed,
              winnerDiscordId,
              winnerRobloxUsername,
              JSON.stringify(winnerSkins),
              gameId
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        try {
          if (game.creator_discord_id && game.creator_skins_value > 0) {
            await new Promise((resolve) => {
              db.run(`INSERT INTO wager_tracking (game_id, discord_id, wager_amount) 
                      VALUES (?, ?, ?) 
                      ON CONFLICT (game_id, discord_id) DO NOTHING`, 
                      [gameId, game.creator_discord_id, game.creator_skins_value], 
                      (err) => {
                        if (err) console.error(`Error tracking creator wager: ${err}`);
                        resolve();
                      });
            });
            
            await updateUserStats(game.creator_discord_id, game.creator_skins_value);
            console.log(`Updated wager stats for creator ${game.creator_discord_id}: +${game.creator_skins_value}`);
          }
          
          if (game.joiner_discord_id && game.joiner_skins_value > 0) {
            await new Promise((resolve) => {
              db.run(`INSERT INTO wager_tracking (game_id, discord_id, wager_amount) 
                      VALUES (?, ?, ?) 
                      ON CONFLICT (game_id, discord_id) DO NOTHING`, 
                      [gameId, game.joiner_discord_id, game.joiner_skins_value], 
                      (err) => {
                        if (err) console.error(`Error tracking joiner wager: ${err}`);
                        resolve();
                      });
            });
            
            await updateUserStats(game.joiner_discord_id, game.joiner_skins_value);
            console.log(`Updated wager stats for joiner ${game.joiner_discord_id}: +${game.joiner_skins_value}`);
          }
        } catch (error) {
          console.error('Error tracking wagers for approved game:', error);
        }
        
        const creatorSkins = JSON.parse(game.creator_skins);
        const joinerSkins = JSON.parse(game.joiner_skins);
        if (winner === 'creator') {
          for (const skinName of [...creatorSkins, ...joinerSkins]) {
            await new Promise((resolve, reject) => {
              db.run(
                'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
                [game.creator_discord_id, skinName],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          }
        } else {
          for (const skinName of [...creatorSkins, ...joinerSkins]) {
            await new Promise((resolve, reject) => {
              db.run(
                'INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)',
                [game.joiner_discord_id, skinName],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          }
        }
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO notifications
            (discord_id, type, content, reference_id, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              game.joiner_discord_id,  
              winner === 'joiner' ? 'game_won' : 'game_lost',
              winner === 'joiner'
                ? `Your join request was approved and you won against ${game.creator_roblox_username}!`
                : `Your join request was approved but you lost against ${game.creator_roblox_username}.`,
              gameId,
              0
            ],
            (err) => {
              if (err) {
                console.error('Error creating game result notification for joiner:', err);
                resolve(); 
              } else {
                resolve();
              }
            }
          );
        });
        if (winner === 'joiner') {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO notifications
              (discord_id, type, content, reference_id, is_read, created_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
              [
                game.creator_discord_id,  
                'game_lost',
                `You lost a coinflip game against ${game.joiner_roblox_username}.`,
                gameId,
                0
              ],
              (err) => {
                if (err) {
                  console.error('Error creating game result notification for creator:', err);
                  resolve(); 
                } else {
                  resolve();
                }
              }
            );
          });
        }
        await new Promise((resolve, reject) => {
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        const gameResult = {
          gameId,
          status: 'completed',
          winner: {
            discordId: winnerDiscordId,
            robloxUsername: winnerRobloxUsername,
            skins: winnerSkins
          },
          creator: {
            discordId: game.creator_discord_id,
            robloxUsername: game.creator_roblox_username,
            skins: creatorSkins,
            skinValue: game.creator_skins_value
          },
          joiner: {
            discordId: game.joiner_discord_id,
            robloxUsername: game.joiner_roblox_username,
            skins: joinerSkins,
            skinValue: game.joiner_skins_value
          },
          serverSeed: game.server_seed,
          clientSeed: game.client_seed,
          completedAt: new Date().toISOString()
        };
        notifyGameResult(gameResult).catch(error => {
          console.error('Failed to send game result notification to server logs:', error);
        });
        return res.json(gameResult);
      } catch (error) {
        await new Promise((resolve) => {
          db.run('ROLLBACK', (err) => {
            if (err) console.error('Error rolling back transaction:', err);
            resolve();
          });
        });
        throw error;
      }
    }
  } catch (error) {
    console.error('Error handling game approval:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});








app.get('/coinflip/pending-approvals/:discordId', async (req, res) => {
  const { discordId } = req.params;
  
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const session = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM sessions WHERE token = ? AND expires_at > ?',
          [token, new Date().toISOString()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (!session || session.discord_id !== discordId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }
    
    const pendingGames = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM coinflip_games 
         WHERE creator_discord_id = ? 
         AND status = 'pending_approval' 
         AND pending_approval = 1`,
        [discordId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    const formattedGames = pendingGames.map(game => ({
      gameId: game.id,
      creator: {
        discordId: game.creator_discord_id,
        robloxUsername: game.creator_roblox_username,
        skins: JSON.parse(game.creator_skins),
        skinValue: game.creator_skins_value
      },
      joiner: {
        discordId: game.joiner_discord_id,
        robloxUsername: game.joiner_roblox_username,
        skins: JSON.parse(game.joiner_skins),
        skinValue: game.joiner_skins_value
      },
      status: game.status,
      createdAt: game.created_at,
      joinedAt: game.joined_at
    }));
    
    res.json({ pendingGames: formattedGames });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.get('/user/stats/:discordId', async (req, res) => {
  const { discordId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const session = await new Promise((resolve, reject) => {
      db.get(
        'SELECT discord_id FROM sessions WHERE token = ? AND expires_at > ?',
        [token, new Date().toISOString()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!session || session.discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const stats = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM user_stats WHERE discord_id = ?',
        [discordId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || { total_wagered: 0, rank: 'Iron' });
        }
      );
    });
    
    res.json({
      discord_id: discordId,
      total_wagered: stats.total_wagered || 0,
      rank: stats.rank || 'Iron',
      last_updated: stats.last_updated
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});



app.get('/coinflip/history/:discordId', (req, res) => {
  const { discordId } = req.params;
  const recent = req.query.recent === 'true';
  
  let query = `SELECT * FROM coinflip_games
    WHERE (creator_discord_id = ? OR joiner_discord_id = ?)
    AND status != 'active'`;
  
  if (recent) {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    query += ` AND completed_at > '${oneHourAgo.toISOString()}'`;
  }
  
  query += ` ORDER BY created_at DESC LIMIT ${recent ? 10 : 50}`;
  
  db.all(query, [discordId, discordId], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    const games = rows.map(row => {
      const isCreator = row.creator_discord_id === discordId;
      const game = {
        gameId: row.id,
        role: isCreator ? 'creator' : 'joiner',
        creator: {
          discordId: row.creator_discord_id,
          robloxUsername: row.creator_roblox_username,
          skin: row.creator_skin,
          skinValue: row.creator_skin_value
        },
        status: row.status,
        createdAt: row.created_at,
        viewed: false  
      };
      
      if (row.joiner_discord_id) {
        game.joiner = {
          discordId: row.joiner_discord_id,
          robloxUsername: row.joiner_roblox_username,
          skin: row.joiner_skin,
          skinValue: row.joiner_skin_value
        };
        game.joinedAt = row.joined_at;
      }
      
      if (row.status === 'completed') {
        game.winner = {
          discordId: row.winner_discord_id,
          robloxUsername: row.winner_roblox_username,
          skin: row.winner_skin
        };
        game.completedAt = row.completed_at;
        game.userWon = row.winner_discord_id === discordId;
      }
      
      if (row.status === 'completed') {
        game.serverSeed = row.revealed_seed;
        game.clientSeed = row.client_seed;
      }
      
      return game;
    });
    
    const stats = !recent ? {
      totalGames: games.length,
      gamesCreated: games.filter(game => game.role === 'creator').length,
      gamesJoined: games.filter(game => game.role === 'joiner').length,
      gamesWon: games.filter(game => game.status === 'completed' && game.userWon).length,
      gamesLost: games.filter(game => game.status === 'completed' && !game.userWon).length,
      gamesCancelled: games.filter(game => game.status === 'cancelled').length,
    } : null;
    
    res.json({
      games,
      stats
    });
  });
});

app.get('/coinflip/eligible-skins/:gameId/:discordId', async (req, res) => {
  const { gameId, discordId } = req.params;
  
  try {
    const game = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM coinflip_games WHERE id = ?', [gameId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const inventory = await new Promise((resolve, reject) => {
      db.all(
        `SELECT i.skin_name, s.value, s.rarity, s.image_url
         FROM inventory i
         JOIN skins s ON i.skin_name = s.name
         WHERE i.discord_id = ?`,
        [discordId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    const creatorValue = Number(game.creator_skins_value);
    const skinCountMap = {};
    
    inventory.forEach(item => {
      if (!skinCountMap[item.skin_name]) {
        skinCountMap[item.skin_name] = 0;
      }
      skinCountMap[item.skin_name]++;
    });
    
    const uniqueSkins = [...new Set(inventory.map(item => item.skin_name))]
      .map(skinName => {
        const skin = inventory.find(i => i.skin_name === skinName);
        return {
          skin_name: skinName,
          value: Number(skin.value),
          rarity: skin.rarity,
          image_url: skin.image_url,
          count: skinCountMap[skinName],
          isEligible: Number(skin.value) >= creatorValue
        };
      });
    
    res.json({
      creatorSkins: JSON.parse(game.creator_skins),
      creatorSkinValue: creatorValue,
      eligibleSkins: uniqueSkins.filter(skin => skin.isEligible)
    });
  } catch (error) {
    console.error('Error getting eligible skins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function determineWinner(serverSeed, clientSeed) {
  const combinedSeed = serverSeed + clientSeed;
  const hash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
  
  const hashNum = parseInt(hash.substring(0, 8), 16);
  
  return hashNum % 2 === 0 ? 'creator' : 'joiner';
}

async function getUserSkinsWithValues(discordId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT i.skin_name, s.value, s.rarity 
       FROM inventory i 
       JOIN skins s ON i.skin_name = s.name 
       WHERE i.discord_id = ?
       ORDER BY s.value DESC`,
      [discordId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(rows);
      }
    );
  });
}


app.get('/coinflip/leaderboard', (req, res) => {
  db.all(
    `SELECT
      u.discord_id, u.roblox_username,
      COUNT(CASE WHEN (cg.creator_discord_id = u.discord_id AND cg.winner_discord_id = u.discord_id)
                  OR (cg.joiner_discord_id = u.discord_id AND cg.winner_discord_id = u.discord_id)
             THEN 1 END) as wins,
      COUNT(CASE WHEN (cg.creator_discord_id = u.discord_id OR cg.joiner_discord_id = u.discord_id)
                  AND cg.status = 'completed'
             THEN 1 END) as total_games,
      COUNT(CASE WHEN cg.creator_discord_id = u.discord_id THEN 1 END) as games_created,
      COUNT(CASE WHEN cg.joiner_discord_id = u.discord_id THEN 1 END) as games_joined
    FROM users u
    LEFT JOIN coinflip_games cg ON u.discord_id = cg.creator_discord_id OR u.discord_id = cg.joiner_discord_id
    WHERE cg.id IS NOT NULL
    GROUP BY u.discord_id, u.roblox_username
    HAVING total_games > 0
    ORDER BY wins DESC, total_games DESC
    LIMIT 20`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const leaderboard = rows.map(row => ({
        discordId: row.discord_id,
        robloxUsername: row.roblox_username,
        wins: row.wins,
        totalGames: row.total_games,
        gamesCreated: row.games_created,
        gamesJoined: row.games_joined,
        winRate: row.total_games > 0 ? (row.wins / row.total_games * 100).toFixed(1) + '%' : '0%'
      }));
      
      res.json({ leaderboard });
    }
  );
});


app.get('/coinflip/recent', (req, res) => {
  db.all(
    `SELECT * FROM coinflip_games
    WHERE status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 10`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const games = rows.map(row => {
        const creatorSkins = JSON.parse(row.creator_skins);
        const joinerSkins = row.joiner_skins ? JSON.parse(row.joiner_skins) : [];
        const winnerSkins = row.winner_skins ? JSON.parse(row.winner_skins) : [];
        
        return {
          gameId: row.id,
          creator: {
            discordId: row.creator_discord_id,
            robloxUsername: row.creator_roblox_username,
            skins: creatorSkins,
            skinValue: row.creator_skins_value
          },
          joiner: {
            discordId: row.joiner_discord_id,
            robloxUsername: row.joiner_roblox_username,
            skins: joinerSkins,
            skinValue: row.joiner_skins_value
          },
          winner: {
            discordId: row.winner_discord_id,
            robloxUsername: row.winner_roblox_username,
            skins: winnerSkins
          },
          completedAt: row.completed_at
        };
      });
      
      res.json({ games });
    }
  );
});


app.get('/coinflip/stats', (req, res) => {
  Promise.all([
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM coinflip_games', [], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    }),
    
    new Promise((resolve, reject) => {
      db.get(
        `SELECT SUM(creator_skins_value) as creator_value, SUM(joiner_skins_value) as joiner_value
         FROM coinflip_games
         WHERE status = 'completed'`,
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve((row ? (row.creator_value || 0) + (row.joiner_value || 0) : 0));
        }
      );
    }),
    
    new Promise((resolve, reject) => {
      db.get(
        `SELECT
           id, winner_discord_id, winner_roblox_username, winner_skins,
           CASE
             WHEN winner_discord_id = creator_discord_id THEN joiner_skins_value
             ELSE creator_skins_value
           END as win_value
         FROM coinflip_games
         WHERE status = 'completed'
         ORDER BY win_value DESC
         LIMIT 1`,
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    }),
    
    new Promise((resolve, reject) => {
      db.get(
        `SELECT
           u.discord_id, u.roblox_username,
           COUNT(*) as game_count
         FROM coinflip_games cg
         JOIN users u ON u.discord_id = cg.creator_discord_id OR u.discord_id = cg.joiner_discord_id
         GROUP BY u.discord_id, u.roblox_username
         ORDER BY game_count DESC
         LIMIT 1`,
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    })
  ])
  .then(([totalGames, totalValue, biggestWin, mostActivePlayer]) => {
    res.json({
      totalGames,
      totalValueGambled: totalValue,
      biggestWin: biggestWin ? {
        gameId: biggestWin.id,
        winner: {
          discordId: biggestWin.winner_discord_id,
          robloxUsername: biggestWin.winner_roblox_username,
          skins: JSON.parse(biggestWin.winner_skins)
        },
        winValue: biggestWin.win_value
      } : null,
      mostActivePlayer: mostActivePlayer ? {
        discordId: mostActivePlayer.discord_id,
        robloxUsername: mostActivePlayer.roblox_username,
        gameCount: mostActivePlayer.game_count
      } : null
    });
  })
  .catch(error => {
    console.error('Error getting coinflip stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  });
});
app.get('/inventory/stats/:discordId', (req, res) => {
  const { discordId } = req.params;
  
  db.all(
      `SELECT i.skin_name, COUNT(*) as count, s.value, s.rarity, s.image_url
       FROM inventory i
       JOIN skins s ON i.skin_name = s.name
       WHERE i.discord_id = ?
       GROUP BY i.skin_name
       ORDER BY s.value DESC`,
      [discordId],
      (err, rows) => {
          if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
          }
          
          const totalValue = rows.reduce((sum, item) => sum + (item.value * item.count), 0);
          
          const rarityGroups = {};
          rows.forEach(item => {
              if (!rarityGroups[item.rarity]) {
                  rarityGroups[item.rarity] = {
                      count: 0,
                      value: 0
                  };
              }
              
              rarityGroups[item.rarity].count += item.count;
              rarityGroups[item.rarity].value += (item.value * item.count);
          });
          
          res.json({
              totalItems: rows.reduce((sum, item) => sum + item.count, 0),
              totalValue,
              uniqueSkins: rows.length,
              skins: rows,
              rarityBreakdown: rarityGroups
          });
      }
  );
});



async function notifyGameCreation(game) {
  if (!COINFLIP_GAMES_WEBHOOK_URL) {
    console.log('No coinflip games webhook URL configured, skipping notification');
    return;
  }
  
  try {
    const firstSkinName = Array.isArray(game.betSkins) ? game.betSkins[0] : game.betSkins;
    const skinDetails = await getSkinDetails(firstSkinName);
    
    const skinsList = Array.isArray(game.betSkins) ? game.betSkins.join(', ') : game.betSkins;
    
    const payload = {
      embeds: [{
        title: "🎮 New Coinflip Game Created",
        description: `A new coinflip game has been created by **${game.creator.robloxUsername}**!`,
        color: 0x6c5ce7, 
        fields: [
          {
            name: "Creator",
            value: game.creator.robloxUsername,
            inline: true
          },
          {
            name: "Bet Skins",
            value: skinsList,
            inline: true
          },
          {
            name: "Total Value",
            value: `${game.skinValue.toLocaleString()} points`,
            inline: true
          },
          {
            name: "Skin Rarity",
            value: skinDetails ? skinDetails.rarity : "Unknown",
            inline: true
          },
          {
            name: "Game ID",
            value: `\`${game.gameId}\``,
            inline: true
          },
          {
            name: "Status",
            value: "🟢 Active - Waiting for a player to join",
            inline: true
          }
        ],
        thumbnail: {
          url: skinDetails && skinDetails.image_url ? skinDetails.image_url : null
        },
        timestamp: new Date().toISOString(),
        footer: {
          text: "stake hood"
        }
      }]
    };
    
    console.log(`Sending coinflip game creation webhook for game ${game.gameId}`);
    const response = await fetch(COINFLIP_GAMES_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Error sending coinflip game webhook: ${response.status} ${response.statusText}`);
      console.error(`Response: ${responseText}`);
    } else {
      console.log(`Coinflip game creation notification sent for game ${game.gameId}`);
    }
  } catch (error) {
    console.error('Error sending Discord webhook for game creation:', error);
  }
}

async function notifyGameResult(game) {
  if (!logs_webhook) {
    console.log('No logs webhook URL configured, skipping notification');
    return;
  }
  try {
    const creatorSkinsList = Array.isArray(game.creator.skins) ? game.creator.skins.join(', ') : 
                           (typeof game.creator.skins === 'string' ? game.creator.skins : 'Unknown');
    
    const joinerSkinsList = Array.isArray(game.joiner.skins) ? game.joiner.skins.join(', ') : 
                          (typeof game.joiner.skins === 'string' ? game.joiner.skins : 'Unknown');
    
    const creatorSkinValue = game.creator.skinValue || game.creator.skinsValue || 0;
    const joinerSkinValue = game.joiner.skinValue || game.joiner.skinsValue || 0;
    
    const payload = {
      embeds: [{
        title: "🎲 Coinflip Game Result",
        description: `A coinflip game has been completed!`,
        color: 0x57F287,
        fields: [
          {
            name: "Winner",
            value: `🏆 **${game.winner.robloxUsername}**`,
            inline: false
          },
          {
            name: "Creator",
            value: `${game.creator.robloxUsername} with ${creatorSkinsList}`,
            inline: true
          },
          {
            name: "Joiner",
            value: `${game.joiner.robloxUsername} with ${joinerSkinsList}`,
            inline: true
          },
          {
            name: "Creator Skins Value",
            value: `${creatorSkinValue.toLocaleString()} points`,
            inline: true
          },
          {
            name: "Joiner Skins Value",
            value: `${joinerSkinValue.toLocaleString()} points`,
            inline: true
          },
          {
            name: "Total Value",
            value: `${(creatorSkinValue + joinerSkinValue).toLocaleString()} points`,
            inline: true
          },
          {
            name: "Game ID",
            value: `\`${game.gameId}\``,
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "stakehood"
        }
      }]
    };
    
    console.log(`Sending coinflip game result webhook for game ${game.gameId}`);
    console.log('Webhook URL:', logs_webhook);
    console.log('Webhook payload:', JSON.stringify(payload));
    
    const response = await fetch(logs_webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Error sending coinflip result webhook: ${response.status} ${response.statusText}`);
      console.error(`Response: ${responseText}`);
    } else {
      console.log(`Coinflip game result notification sent for game ${game.gameId}`);
    }
  } catch (error) {
    console.error('Error sending Discord webhook for game result:', error);
    console.error('Error details:', error.stack);
  }
}

async function notifyGameCancellation(game) {
  if (!logs_webhook) {
    console.log('No logs webhook URL configured, skipping notification');
    return;
  }
  
  try {
    const payload = {
      embeds: [{
        title: "❌ Coinflip Game Cancelled",
        description: `A coinflip game has been cancelled by **${game.creator.robloxUsername}**`,
        color: 0xED4245, 
        fields: [
          {
            name: "Creator",
            value: game.creator.robloxUsername,
            inline: true
          },
          {
            name: "Bet Skin",
            value: game.creatorSkin,
            inline: true
          },
          {
            name: "Skin Value",
            value: `${game.creatorSkinValue.toLocaleString()} points`,
            inline: true
          },
          {
            name: "Game ID",
            value: `\`${game.gameId}\``,
            inline: true
          },
          {
            name: "Time Active",
            value: `${Math.floor((new Date() - new Date(game.createdAt)) / 60000)} minutes`,
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "stakehood"
        }
      }]
    };
    
    console.log(`Sending coinflip game cancellation webhook for game ${game.gameId}`);
    
    const response = await fetch(logs_webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Error sending cancellation webhook: ${response.status} ${response.statusText}`);
      console.error(`Response: ${responseText}`);
    } else {
      console.log(`Game cancellation notification sent for game ${game.gameId}`);
    }
  } catch (error) {
    console.error('Error sending Discord webhook for game cancellation:', error);
  }
}




async function notifyDiscordOfCompletion(transactionType, discordId, robloxUsername, skins) {
  if (!webhook_url) {
    console.log('No webhook URL configured, skipping notification');
    return;
  }
  
  try {
    const embeds = [];
    
    const colors = {
      deposit: 0x9932CC, 
      withdraw: 0xFFD700, 
    };
    
    let skinsText = 'None';
    if (skins && skins.length > 0) {
      skinsText = skins.map(skin => `• ${skin}`).join('\n');
    }
    
    if (transactionType === 'deposit') {
      embeds.push({
        title: '✅ Deposit Completed',
        description: `<@${discordId}> has completed a deposit`,
        color: colors.deposit,
        fields: [
          {
            name: 'Roblox Username',
            value: robloxUsername,
            inline: true
          },
          {
            name: 'Transaction ID',
            value: new Date().toISOString(),
            inline: true
          },
          {
            name: 'Deposited Skins',
            value: skinsText
          }
        ],
        timestamp: new Date().toISOString()
      });
    } else if (transactionType === 'withdraw') {
      embeds.push({
        title: '✅ Withdrawal Completed',
        description: `<@${discordId}> has completed a withdrawal`,
        color: colors.withdraw,
        fields: [
          {
            name: 'Roblox Username',
            value: robloxUsername,
            inline: true
          },
          {
            name: 'Transaction ID',
            value: new Date().toISOString(),
            inline: true
          },
          {
            name: 'Withdrawn Skins',
            value: skinsText
          }
        ],
        timestamp: new Date().toISOString()
      });
    }
    
    const payload = {
      embeds: embeds
    };
    
    console.log(`Sending webhook for ${transactionType} by ${robloxUsername}`);
    
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Error sending webhook: ${response.status} ${response.statusText}`);
      console.error(`Response: ${responseText}`);
    } else {
      console.log(`Transaction completion notification sent: ${transactionType} by ${robloxUsername}`);
    }
  } catch (error) {
    console.error('Error sending Discord webhook:', error);
  }
}



function parseRobloxUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    const pathParts = url.pathname.split('/');
    
    let placeId = null;
    for (const part of pathParts) {
      if (/^\d+$/.test(part)) {
        placeId = part;
        break;
      }
    }
    
    const serverCode = url.searchParams.get('privateServerLinkCode');
    
    return { placeId, serverCode };
  } catch (error) {
    console.error('Error parsing Roblox URL:', error);
    return { placeId: null, serverCode: null };
  }
}

let globalTransactionLock = false;

function isAnyTransactionActive() {
  return activeTransactions.size > 0 || globalTransactionLock;
}
function joinPrivateServer(privateServerUrl) {
  if (autoJoinLock) {
    console.log('Auto join already in progress, skipping');
    return false;
  }
  
  const now = Date.now();
  

  
  console.log(`Attempting to join Roblox private server: ${privateServerUrl}`);
  
  const { placeId, serverCode } = parseRobloxUrl(privateServerUrl);
  
  if (!placeId || !serverCode) {
    console.error('Failed to parse Roblox URL - missing place ID or server code');
    return false;
  }
  
  autoJoinLock = true;
  lastJoinTime = now;
  
  setTimeout(() => {
    autoJoinLock = false;
    console.log('Auto join lock released');
  }, 30000); 
  
  try {
      const url = `${privateServerUrl}`;
      
      exec(`rundll32 url.dll,FileProtocolHandler "${url}"`, { windowsHide: true }, (error) => {
        if (error) {
          console.error('Failed to launch via rundll32:', error);
          
          exec(`start "" "${url}"`, { windowsHide: true }, (error2) => {
            if (error2) {
              console.error('Failed to launch via start command:', error2);
              
              const protocolUrl = `roblox://placeId=${placeId}&privateServerLinkCode=${serverCode}`;
              exec(`rundll32 url.dll,FileProtocolHandler "${protocolUrl}"`, { windowsHide: true }, (error3) => {
                if (error3) {
                  console.error('Failed to launch via Roblox protocol:', error3);
                } else {
                  console.log('Launched Roblox via protocol');
                }
              });
            } else {
              console.log('Launched Roblox via start command with hidden window');
            }
          });
        } else {
          console.log('Launched Roblox via rundll32');
        }
      });
    return true;
  } catch (error) {
    console.error('Error launching Roblox:', error);
    autoJoinLock = false;
    return false;
  }
}

app.get('/player/:discordId', (req, res) => {
  const { discordId } = req.params;
  
  db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      discordId: user.discord_id,
      robloxUsername: user.roblox_username
    });
  });
});


app.post('/deposit', (req, res) => {
  const { discordId, robloxUsername, privateServer } = req.body;
  
  if (!discordId || !robloxUsername || !privateServer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (isAnyTransactionActive()) {
    return res.status(409).json({ 
      error: 'A transaction is currently in progress. Please try again later when the bot is available.',
      locked: true,
      globalLock: true
    });
  }
  
  if (activeTransactions.has(discordId)) {
    return res.status(409).json({ 
      error: 'You already have an active transaction in progress. Please wait for it to complete.',
      locked: true
    });
  }
  
  globalTransactionLock = true;
  
  activeTransactions.set(discordId, {
    type: 'deposit',
    startTime: Date.now(),
    robloxUsername
  });
  
  console.log(`Deposit request queued for ${robloxUsername} (${discordId})`);
  
  if (auto_join_boolean) {
    const serverUrl = privateServer || private_server_url;
    joinPrivateServer(serverUrl);
  }
  
  res.json({ 
    status: 'pending',
    message: 'Deposit request received and is being processed',
    privateServer,
    locked: true
  });
});


app.post('/withdraw', (req, res) => {
  const { discordId, robloxUsername, skins, privateServer } = req.body;
  
  if (!discordId || !robloxUsername || !skins || !privateServer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (isAnyTransactionActive()) {
    return res.status(409).json({ 
      error: 'A transaction is currently in progress. Please try again later when the bot is available.',
      locked: true,
      globalLock: true
    });
  }

  if (activeTransactions.has(discordId)) {
    return res.status(409).json({ 
      error: 'You already have an active transaction in progress. Please wait for it to complete.',
      locked: true
    });
  }
  
  globalTransactionLock = true;
  

  const skinsArray = Array.isArray(skins) ? skins : [skins];
  
  let placeholders = skinsArray.map(() => '?').join(',');
  let params = [...skinsArray, discordId];
  
  db.all(
    `SELECT skin_name FROM inventory WHERE skin_name IN (${placeholders}) AND discord_id = ?`,
    params,
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        globalTransactionLock = false; 
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const availableSkins = rows.map(row => row.skin_name);
      const missingSkins = skinsArray.filter(skin => !availableSkins.includes(skin));
      
      if (missingSkins.length > 0) {
        globalTransactionLock = false; 
        return res.status(400).json({ 
          error: `The following skins were not found in your inventory: ${missingSkins.join(', ')}` 
        });
      }
      
      activeTransactions.set(discordId, {
        type: 'withdraw',
        startTime: Date.now(),
        robloxUsername,
        skins: skinsArray
      });
      
      console.log(`Withdraw request queued for ${robloxUsername} (${discordId}): ${skinsArray.join(', ')}`);
      
      if (auto_join_boolean) {
        const serverUrl = privateServer || private_server_url;
        joinPrivateServer(serverUrl);
      }
      
      res.json({ 
        status: 'pending',
        message: 'Withdraw request received and is being processed',
        requestedSkins: skinsArray,
        privateServer,
        locked: true
      });
    }
  );
});


app.post('/withdraw', (req, res) => {
  const { discordId, robloxUsername, skins, privateServer } = req.body;
  
  if (!discordId || !robloxUsername || !skins || !privateServer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (activeTransactions.has(discordId)) {
    return res.status(409).json({ 
      error: 'You already have an active transaction in progress. Please wait for it to complete.',
      locked: true
    });
  }
  
  const skinsArray = Array.isArray(skins) ? skins : [skins];
  
  let placeholders = skinsArray.map(() => '?').join(',');
  let params = [...skinsArray, discordId];
  
  db.all(
    `SELECT skin_name FROM inventory WHERE skin_name IN (${placeholders}) AND discord_id = ?`,
    params,
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const availableSkins = rows.map(row => row.skin_name);
      const missingSkins = skinsArray.filter(skin => !availableSkins.includes(skin));
      
      if (missingSkins.length > 0) {
        return res.status(400).json({ 
          error: `The following skins were not found in your inventory: ${missingSkins.join(', ')}` 
        });
      }
      
      activeTransactions.set(discordId, {
        type: 'withdraw',
        startTime: Date.now(),
        robloxUsername,
        skins: skinsArray
      });
      
      console.log(`Withdraw request queued for ${robloxUsername} (${discordId}): ${skinsArray.join(', ')}`);
      
      if (auto_join_boolean) {
        const serverUrl = privateServer || private_server_url;
        joinPrivateServer(serverUrl);
      }
      
      res.json({ 
        status: 'pending',
        message: 'Withdraw request received and is being processed',
        requestedSkins: skinsArray,
        privateServer,
        locked: true
      });
    }
  );
});


app.post('/received', (req, res) => {
  const { robloxUsername, discordId, skins, transactionType } = req.body;
  
  if (!discordId || !robloxUsername || !skins || !transactionType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (transactionType !== 'deposit' && transactionType !== 'withdraw') {
    return res.status(400).json({ error: 'Invalid transaction type' });
  }
  
  const activeTransaction = activeTransactions.get(discordId);
  if (!activeTransaction || activeTransaction.type !== transactionType) {
    return res.status(400).json({ 
      error: 'No matching active transaction found',
      locked: false
    });
  }
  
  db.run(
    'UPDATE transactions SET status = ? WHERE discord_id = ? AND roblox_username = ? AND transaction_type = ? AND status = ?',
    ['completed', discordId, robloxUsername, transactionType, 'pending'],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        console.warn('No pending transaction found to update');
      }
      
      const skinsArray = Array.isArray(skins) ? skins : [skins];
      
      if (transactionType === 'deposit') {
        const stmt = db.prepare('INSERT INTO inventory (discord_id, skin_name) VALUES (?, ?)');
        
        skinsArray.forEach(skin => {
          stmt.run(discordId, skin, (err) => {
            if (err) console.error(`Error adding skin ${skin} to inventory:`, err);
          });
        });
        
        stmt.finalize();
        
        activeTransactions.delete(discordId);
        globalTransactionLock = false;
        notifyDiscordOfCompletion('deposit', discordId, robloxUsername, skinsArray);

        res.json({ 
          status: 'success',
          message: 'Deposit processed successfully',
          depositedSkins: skinsArray,
          locked: false
        });
      } else { 
        const placeholders = skinsArray.map(() => '?').join(',');
        const params = [...skinsArray, discordId];
        
        db.run(
          `DELETE FROM inventory WHERE skin_name IN (${placeholders}) AND discord_id = ?`,
          params,
          (err) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }
            
            activeTransactions.delete(discordId);
            globalTransactionLock = false;
            notifyDiscordOfCompletion('withdraw', discordId, robloxUsername, skinsArray);

            res.json({ 
              status: 'success',
              message: 'Withdrawal processed successfully',
              withdrawnSkins: skinsArray,
              locked: false
            });
          }
        );
      }
    }
  );
});

app.get('/inventory', (req, res) => {
  const { discordId } = req.query;
  
  if (!discordId) {
    return res.status(400).json({ error: 'Missing discord ID' });
  }
  
  db.all('SELECT skin_name FROM inventory WHERE discord_id = ?', [discordId], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    const skins = rows.map(row => row.skin_name);
    
    res.json({ 
      discordId,
      skins
    });
  });

});

app.get('/pending-transactions', (req, res) => {
  const pendingTransactions = [];

  for (const [discordId, transaction] of activeTransactions.entries()) {
    pendingTransactions.push({
      discordId,
      robloxUsername: transaction.robloxUsername,
      type: transaction.type,
      skins: transaction.skins || [],
      startTime: transaction.startTime
    });
  }
  
  res.json({
    pending: pendingTransactions
  });
});




app.get('/transaction-status/:discordId', (req, res) => {
  const { discordId } = req.params;
  
  if (activeTransactions.has(discordId)) {
    const transaction = activeTransactions.get(discordId);
    res.json({
      locked: true,
      transaction: {
        type: transaction.type,
        startTime: transaction.startTime,
        elapsed: Date.now() - transaction.startTime,
        robloxUsername: transaction.robloxUsername
      }
    });
  } else {
    res.json({
      locked: false
    });
  }
});

app.post('/cancel-transaction', (req, res) => {
  const { discordId, adminKey } = req.body;
  
  if (adminKey !== process.env.admin_key) {
    return res.status(403).json({ error: 'Invalid admin key' });
  }
  
  if (!activeTransactions.has(discordId)) {
    return res.status(404).json({ error: 'No active transaction found for this user' });
  }
  
  const transaction = activeTransactions.get(discordId);
  activeTransactions.delete(discordId);
  
  globalTransactionLock = false;
  
  console.log(`Transaction cancelled for ${transaction.robloxUsername} (${discordId}): ${transaction.type}`);
  
  res.json({
    status: 'success',
    message: 'Transaction cancelled successfully',
    locked: false
  });
});




app.get('/system-status', (req, res) => {
  const isLocked = isAnyTransactionActive();
  
  let activeTransaction = null;
  if (isLocked) {
    if (activeTransactions.size > 0) {
      const [discordId, transaction] = Array.from(activeTransactions.entries())[0];
      activeTransaction = {
        discordId,
        type: transaction.type,
        robloxUsername: transaction.robloxUsername,
        startTime: transaction.startTime,
        elapsed: Date.now() - transaction.startTime
      };
    } else {
      activeTransaction = {
        type: 'unknown',
        startTime: Date.now(),
        elapsed: 0
      };
    }
  }
  
  res.json({
    status: isLocked ? 'busy' : 'available',
    locked: isLocked,
    globalLock: globalTransactionLock,
    activeTransactionCount: activeTransactions.size,
    activeTransaction: activeTransaction
  });
});

app.get('/auto-join/status', (req, res) => {
  res.json({
    enabled: auto_join_boolean,
    lastJoin: lastJoinTime > 0 ? new Date(lastJoinTime).toISOString() : null,
    timeoutSeconds: AUTO_JOIN_TIMEOUT / 1000,
    locked: autoJoinLock,
    nextJoinAvailable: lastJoinTime > 0 
      ? new Date(lastJoinTime + AUTO_JOIN_TIMEOUT).toISOString() 
      : 'Now',
    privateServerUrl: private_server_url
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Auto join ${auto_join_boolean ? 'enabled' : 'disabled'}`);
  console.log(`Private server URL: ${private_server_url}`);
});

const TRANSACTION_TIMEOUT = 15 * 60 * 1000; 
setInterval(() => {
  const now = Date.now();
  for (const [discordId, transaction] of activeTransactions.entries()) {
    if (now - transaction.startTime > TRANSACTION_TIMEOUT) {
      console.log(`Transaction timed out for ${transaction.robloxUsername} (${discordId}): ${transaction.type}`);
      activeTransactions.delete(discordId);
    }
  }
}, 60000); 

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