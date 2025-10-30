# Hevy MCP Server

A Model Context Protocol (MCP) server that connects to the official Hevy API and exposes workout data to AI assistants. Supports dual transport modes: stdio for Claude Desktop and SSE for remote access (e.g., Poke.com).

## Features

### MCP Tools

#### Workout Management
- `get-workouts` - Get paginated workout list with date filtering
- `get-workout` - Get single workout by ID with full details
- `create-workout` - Create new workout with exercises and sets
- `update-workout` - Update existing workout
- `get-workout-count` - Get total workout count for stats
- `get-workout-events` - Get workout update/delete events since date

#### Routine Management
- `get-routines` - List all saved routines
- `get-routine` - Get single routine by ID
- `create-routine` - Create new workout routine template
- `update-routine` - Update existing routine
- `delete-routine` - Remove routine

#### Exercise Data
- `get-exercise-templates` - Browse available exercises (standard + custom)
- `get-exercise-template` - Get single exercise by ID
- `get-exercise-progress` - Track progress for specific exercises over time
- `get-exercise-stats` - Get personal records and 1RM estimates

#### Folder Organization
- `get-routine-folders` - List routine folders
- `get-routine-folder` - Get folder by ID
- `create-routine-folder` - Create new folder
- `update-routine-folder` - Update folder name
- `delete-routine-folder` - Remove folder

## Prerequisites

1. **Hevy PRO Subscription** - Required for API access
2. **Hevy API Key** - Get it at https://hevy.com/settings?developer
3. **Node.js** - Version 18 or higher

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd hevy-mcp-server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Hevy API key:

```bash
HEVY_API_KEY=your_hevy_api_key_here
HEVY_API_BASE_URL=https://api.hevyapp.com

# Transport configuration
TRANSPORT=stdio                    # stdio | sse | both
PORT=3000                          # Port for SSE/HTTP mode
HOST=127.0.0.1                     # Host for SSE/HTTP mode

# SSE Configuration (for Poke.com)
SSE_PATH=/mcp                      # SSE endpoint path
HEARTBEAT_INTERVAL=30000           # ms - keep connection alive
AUTH_TOKEN=                        # See Security section below
```

#### Security: AUTH_TOKEN Configuration

**When using SSE mode with remote access (e.g., via ngrok for Poke.com), you MUST set an AUTH_TOKEN to prevent unauthorized access to your Hevy data.**

Generate a secure token using either method:

**Option 1: Using the built-in script**
```bash
npm run generate-token
```

**Option 2: Using OpenSSL**
```bash
openssl rand -hex 32
```

Then add the generated token to your `.env` file:
```bash
AUTH_TOKEN=your_generated_token_here
```

When connecting from Poke.com, include the token in the Authorization header:
```
Authorization: Bearer your_generated_token_here
```

**Security Notes:**
- ✅ **REQUIRED** for SSE mode with public/ngrok access
- ❌ **Optional** for stdio mode (Claude Desktop)
- ❌ **Optional** for SSE mode on localhost only
- ⚠️  Never commit your `.env` file or share your AUTH_TOKEN

### 3. Build the Project

```bash
npm run build
```

## Usage

### For Claude Desktop (stdio mode)

#### 1. Run the server in development mode:

```bash
npm run dev
```

#### 2. Configure Claude Desktop

Edit your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the server configuration:

```json
{
  "mcpServers": {
    "hevy": {
      "command": "node",
      "args": ["/absolute/path/to/hevy-mcp-server/dist/index.js"],
      "env": {
        "HEVY_API_KEY": "your_hevy_api_key",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

#### 3. Restart Claude Desktop

The Hevy tools will now be available in Claude Desktop.

### For Poke.com (SSE mode)

#### 1. Generate and set AUTH_TOKEN:

**IMPORTANT:** For security, generate an AUTH_TOKEN before exposing your server:

```bash
npm run generate-token
# Copy the generated token to your .env file
```

#### 2. Start the server in SSE mode:

```bash
# In .env, set TRANSPORT=sse and your AUTH_TOKEN
npm start
```

#### 3. Expose with ngrok (for remote access):

```bash
# In a separate terminal
ngrok http 3000
```

#### 4. Connect to Poke.com:

1. Go to https://poke.com/settings/connections
2. Add new MCP connection
3. Enter your ngrok URL: `https://your-id.ngrok.io/mcp`
4. Add Authorization header: `Bearer your_auth_token_here`
5. Test with: "Tell the subagent to use the 'hevy' integration's 'get-workouts' tool"

## Example Usage

### With Claude Desktop

```
"Show me my last 5 workouts"
"What was my best bench press weight?"
"Create a new Push Day routine with bench press, overhead press, and tricep dips"
"Log today's leg workout"
```

### With Poke.com

```
"Tell the subagent to use the 'hevy' integration's 'get-workouts' tool with startDate '2025-01-01' and limit 10"
"Use the hevy integration to show my exercise templates"
"Create a new workout using the hevy integration"
```

## Development

### Run in development mode with auto-reload:

```bash
npm run dev
```

### Build for production:

```bash
npm run build
npm start
```

### Watch mode (auto-rebuild on changes):

```bash
npm run watch
```

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Poke.com      │         │ Claude Desktop  │
│   (Remote)      │         │    (Local)      │
└────────┬────────┘         └────────┬────────┘
         │ HTTPS                     │ stdio
         ↓                           ↓
    ┌─────────────────────────────────┐
    │       ngrok Tunnel              │
    │   (Optional - for Poke only)    │
    └────────────┬────────────────────┘
                 │
                 ↓
    ┌─────────────────────────────────┐
    │     Hevy MCP Server             │
    │   Port 3000 (configurable)      │
    │   SSE + HTTP / stdio            │
    └────────────┬────────────────────┘
                 │
                 ↓
    ┌─────────────────────────────────┐
    │      Hevy API                   │
    │   api.hevyapp.com               │
    │   (Requires PRO + API Key)      │
    └─────────────────────────────────┘
```

## File Structure

```
hevy-mcp-server/
├── src/
│   ├── index.ts              # Main entry point + transport router
│   ├── server.ts             # MCP server core logic
│   ├── transports/
│   │   ├── stdio.ts          # stdio transport (Claude Desktop)
│   │   └── sse.ts            # SSE + HTTP transport (Poke.com)
│   ├── hevy/
│   │   ├── client.ts         # Hevy API client wrapper
│   │   └── types.ts          # TypeScript types for Hevy data
│   ├── tools/
│   │   ├── workouts.ts       # Workout-related tools
│   │   ├── routines.ts       # Routine-related tools
│   │   ├── exercises.ts      # Exercise-related tools
│   │   └── folders.ts        # Folder-related tools
│   └── utils/
│       ├── formatters.ts     # Data formatting helpers
│       ├── validators.ts     # Input validation with Zod
│       └── errors.ts         # Error handling
├── scripts/
│   └── generate-token.ts     # AUTH_TOKEN generator utility
├── dist/                     # Compiled output
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### "HEVY_API_KEY is required" error

Make sure you've:
1. Created a `.env` file in the project root
2. Added your API key: `HEVY_API_KEY=your_key_here`
3. Restarted the server

### Tools not showing up in Claude Desktop

1. Check that the path in `claude_desktop_config.json` is absolute
2. Verify the server builds successfully with `npm run build`
3. Check Claude Desktop logs for errors
4. Restart Claude Desktop completely

### SSE connection issues with Poke.com

1. Verify ngrok is running and the URL is correct
2. Check that the server is running: `curl http://localhost:3000/health`
3. Ensure firewall allows connections on port 3000
4. Check server logs for errors

### "Unauthorized" error (401) with SSE mode

If you get authentication errors when connecting to Poke.com:

1. Verify `AUTH_TOKEN` is set in your `.env` file
2. Ensure you're sending the Authorization header: `Bearer your_token_here`
3. Check that the token in Poke.com matches exactly what's in your `.env`
4. Regenerate the token if needed: `npm run generate-token`

## API Rate Limits

The Hevy API may have rate limits. The server doesn't currently implement rate limiting or caching, so be mindful of the number of requests.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Links

- [Hevy App](https://hevy.com)
- [Hevy API Documentation](https://hevy.com/settings?developer)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.ai/download)
- [Poke.com](https://poke.com)
