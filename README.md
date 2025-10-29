# Stakehood - Roblox Trading & Casino Platform

## Project Overview

Stakehood is a Discord and web based gambling platform for Roblox skins. The system allows users to deposit, withdraw, (can be used for auto mm system too), and gamble virtual items through Discord commands and a web interface. The platform supports coinflip and dice gambling games with a provably fair verification system.

## Architecture

The project consists of three main components:

1. **Discord Bot** (`discordbot/`) - Handles Discord slash commands for trading and gambling
2. **Web Server** (`server/`) - Express.js backend with web interface
3. **Client Script** (`client/`) - Lua script for automating Roblox trades

## Technology Stack

- **Backend**: Node.js, Express.js, SQLite3
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Discord**: discord.js v14
- **Database**: SQLite3
- **Automation**: Lua (for Roblox automation)

## Project Structure

```
src/
├── discordbot/          # Discord bot application
│   ├── index.js         # Main bot logic (2570 lines)
│   └── package.json     # Bot dependencies
├── server/              # Web server application
│   ├── server.js        # Main server (4934 lines)
│   ├── package.json     # Server dependencies
│   └── public/          # Web interface files
│       ├── *.html       # Frontend pages
│       ├── js/          # Client-side scripts
│       └── css/         # Stylesheets
├── client/              # Roblox automation
│   └── client.lua       # Lua automation script (352 lines)
├── bot.db               # SQLite database
```

## Features

### Deposit / Withdraw System
- ✅ Deposit skins to bot inventory
- ✅ Withdraw skins from bot inventory
- ✅ Transaction history tracking
- ✅ Real-time inventory management

### Gambling Games
- 🎲 **Coinflip**: 50/50 chance games with provably fair verification
- 🎲 **Dice**: Roll-based games with tie resolution
- 📊 Leaderboards for coinflip games
- 📜 Game history tracking

### Web Interface
- 🎨 Modern dark-themed UI
- 📱 Responsive design
- 🔐 Discord OAuth authentication
- 📦 Inventory management interface
- 📈 Profile and statistics pages
- 🧮 Provably fair calculator


## Usage

### Discord Commands

#### User Commands
- `/register <roblox_username>` - Register your Roblox account
- `/deposit` - Deposit skins to your inventory
- `/withdraw <skins>` - Withdraw skins from your inventory
- `/inventory` - View your skin inventory
- `/status` - Check transaction status
- `/cancel` - Cancel current transaction

#### Coinflip Commands
- `/coinflip create <skin>` - Create a new coinflip game
- `/coinflip join <game_id> <skin> [client_seed]` - Join a coinflip game
- `/coinflip approve <game_id> <true/false>` - Approve or reject pending coinflip
- `/coinflip cancel <game_id>` - Cancel your coinflip game
- `/coinflip history` - View your coinflip history
- `/coinflip games` - List active coinflip games
- `/leaderboard` - View coinflip leaderboard

#### Admin Commands
- `/admin add_skin <discord_id> <skin_name> [quantity]` - Add skins to user
- `/admin remove_skin <discord_id> <skin_name> [quantity]` - Remove skins from user
- `/admin create_skin <name> <value> <rarity> [image_url]` - Create new skin
- `/admin update_skin <name> <value>` - Update skin value
- `/admin view_inventory <discord_id>` - View user inventory

### Web Interface

Access at `http://localhost:3000`

**Pages:**
- `/` - Home page
- `/index.html` - Landing page
- `/profile.html` - User profile and statistics
- `/inventory.html` - Inventory management
- `/coinflip.html` - Coinflip gaming interface
- `/dice.html` - Dice gaming interface
- `/history.html` - Transaction and game history
- `/calculator.html` - Provably fair verification tool
- `/admin.html` - Admin panel
- `/login-failed.html` - Authentication failure page
- `/auth-success.html` - Authentication success page

## Configuration

### Roblox Private Server

The system requires a Roblox private server to automate deposits / withdraws. Configure the private server URL in `server/.env`:

```env
private_server_url=https://www.roblox.com/games/YOUR_GAME_ID?privateServerLinkCode=YOUR_CODE
```

### Database

The SQLite database (`bot.db`) is created automatically on first run. It stores:
- User accounts
- Transactions
- Inventory items
- Coinflip games
- Dice games
- Skins catalog
- Notifications

## Security Considerations

⚠️ **IMPORTANT**: Before deploying to production:

1. Remove all hardcoded credentials
2. Use environment variables for all sensitive data
3. Implement proper authentication middleware
4. Add rate limiting to prevent abuse
5. Validate all user inputs
6. Use HTTPS in production
7. Add SQL injection protection
8. Implement proper session management
9. Add CORS configuration for production domains
10. Review and remove all offensive language from package.json files

## Database Schema

### Tables
- `users` - Discord users and their Roblox usernames
- `skins` - Available skins catalog
- `inventory` - User skin inventories
- `transactions` - Trading transactions
- `coinflip_games` - Coinflip game data
- `dice_games` - Dice game data
- `sessions` - User authentication sessions
- `notifications` - User notifications
- `user_stats` - User statistics (wagering, ranks)
- `wager_tracking` - Wagering tracking

## API Endpoints

### Authentication
- `GET /auth/discord` - Initiate Discord OAuth
- `GET /callback` - Discord OAuth callback
- `GET /auth/user` - Get current user
- `POST /auth/logout` - Logout

### Trading
- `POST /deposit` - Initiate deposit transaction
- `POST /withdraw` - Initiate withdrawal transaction
- `GET /pending-transactions` - Get pending transactions
- `POST /received` - Confirm transaction receipt
- `POST /cancel-transaction` - Cancel active transaction
- `GET /transaction-status/:discordId` - Get transaction status

### Inventory
- `GET /inventory` - Get user inventory
- `GET /inventory/stats/:discordId` - Get inventory statistics
- `GET /skins` - Get all available skins
- `GET /skin/:name` - Get specific skin details

### Coinflip Games
- `POST /coinflip/create` - Create new coinflip game
- `POST /coinflip/join/:gameId` - Join coinflip game
- `POST /coinflip/approve/:gameId` - Approve pending coinflip
- `POST /coinflip/cancel/:gameId` - Cancel coinflip game
- `GET /coinflip/active` - Get active games
- `GET /coinflip/game/:gameId` - Get game details
- `GET /coinflip/history/:discordId` - Get user game history
- `GET /coinflip/leaderboard` - Get leaderboard

### Dice Games
- `POST /dice/create` - Create dice game
- `POST /dice/join/:gameId` - Join dice game
- `GET /dice/active` - Get active dice games
- `GET /dice/recent` - Get recent dice games

### User Management
- `POST /user/update-wager` - Update user wager statistics
- `GET /profile/:discordId` - Get user profile

### System
- `GET /system-status` - Get system status
- `GET /notifications` - Get user notifications
- `POST /notifications/:id/read` - Mark notification as read

## Development

### Code Style
- Use async/await for asynchronous operations
- Follow existing code patterns
- Add error handling to all API endpoints
- Use parameterized queries for database operations

### Adding Features
1. Create feature branch
2. Implement feature
3. Test thoroughly
4. Submit pull request


## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request


## Disclaimer

This project is for educational purposes. Ensure compliance with Roblox Terms of Service and Discord Terms of Service when using this software.

