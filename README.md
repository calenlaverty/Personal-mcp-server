
# Personal MCP Server

Unified Model Context Protocol (MCP) server providing AI assistant access to:
- **Hevy** - Workout tracking and fitness data
- **Home Assistant** - Smart home control and automation

Single server, single Tailscale funnel, dual functionality.

## Features

### Hevy Tools (20 tools)
- **Workouts**: Get, create, update workouts with exercises and sets
- **Routines**: Manage workout templates and routine folders
- **Exercises**: Browse exercises, track progress, view personal records
- **Folders**: Organize routines into folders

### Home Assistant Tools (6 tools)
- **State Management**: Get/set entity states
- **Service Calls**: Control devices (lights, switches, climate, etc.)
- **History**: Query historical state data
- **Discovery**: List available services and entities

## Prerequisites

1. **Hevy PRO** - API key from https://hevy.com/settings?developer
2. **Home Assistant** (optional) - Long-lived access token
3. **Node.js** 18+

## Quick Start

### 1. Install
```bash
npm install
```

### 1. Install
```bash
git clone https://github.com/calenlaverty/Personal-mcp-server
cd Personal-mcp-server
npm install
```

### 2. Configure
```bash
cp .env.example .env
```

Edit `.env`:
```bash
# Required
HEVY_API_KEY=your_hevy_api_key

# Optional - Home Assistant
HA_BASE_URL=http://homeassistant.local:8123/api
HA_TOKEN=your_ha_long_lived_token

# Transport
TRANSPORT=stdio              # stdio (Claude Desktop) or sse (remote)
PORT=3004                    # For SSE mode
AUTH_TOKEN=                  # Generate with: npm run generate-token
```

### 3. Build & Run
```bash
npm run build
npm start
```

## Usage

### Claude Desktop (stdio mode)

Edit Claude Desktop config:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
   "personal-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/Personal-mcp-server/dist/index.js"],
      "env": {
        "HEVY_API_KEY": "your_hevy_api_key",
        "HA_BASE_URL": "http://homeassistant.local:8123/api",
        "HA_TOKEN": "your_ha_token",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

Restart Claude Desktop.

### Remote Access (SSE mode)

For Claude.ai or other remote clients:

1. **Generate auth token**:
   ```bash
   npm run generate-token
   ```

2. **Set environment**:
   ```bash
   TRANSPORT=sse
   AUTH_TOKEN=your_generated_token
   ```

3. **Start server**:
   ```bash
   npm start
   ```

4. **Expose via Tailscale Funnel**:
   ```bash
   tailscale funnel 3004
   ```

5. **Connect from Claude.ai**:
   - Add MCP server at Settings
   - URL: `https://your-tailscale-hostname/mcp`
   - Authorization: `Bearer your_generated_token`

## Example Queries

**Fitness (Hevy):**
- "Show my last 5 workouts"
- "What's my bench press PR?"
- "Create a push day routine"

**Home Assistant:**
- "Turn on the living room lights"
- "What's the temperature in the bedroom?"
- "Show me the history for my front door sensor"

**Combined:**
- "Log my workout and turn off the gym lights"

## Configuration Options

### Transport Modes
- `stdio` - Local Claude Desktop (default)
- `sse` - Remote access (Claude.ai, Poke.com)
- `both` - Run both simultaneously

### Security
- `AUTH_TOKEN` - **Required** for SSE mode with public access
- Generate with: `npm run generate-token` or `openssl rand -hex 32`

### Home Assistant
- Optional - server works with just Hevy if HA not configured
- Get long-lived token: Settings → Security → Long-Lived Access Tokens

## Development

```bash
npm run dev          # Watch mode with auto-reload
npm run build        # Compile TypeScript
npm run watch        # Auto-rebuild on changes
```

## Architecture

```
Claude.ai / Claude Desktop
         ↓
   MCP Server (this)
    ├── Hevy API
    └── Home Assistant API
```

### File Structure
```
src/
├── index.ts                    # Entry point & transport router
├── server.ts                   # MCP server core
├── hevy/
│   ├── client.ts              # Hevy API wrapper
│   └── types.ts               # Hevy types
├── ha/
│   ├── client.ts              # Home Assistant API wrapper
│   └── types.ts               # HA types
├── tools/
│   ├── workouts.ts            # Fitness workout tools
│   ├── routines.ts            # Fitness routine tools
│   ├── exercises.ts           # Fitness exercise tools
│   ├── folders.ts             # Fitness folder tools
│   └── ha.ts                  # Home Assistant tools
├── transports/
│   ├── stdio.ts               # Claude Desktop transport
│   └── sse.ts                 # Remote transport
└── utils/
    ├── formatters.ts          # Data formatting
    ├── validators.ts          # Input validation
    └── errors.ts              # Error handling
```

## Troubleshooting

**"HEVY_API_KEY is required"**
- Add API key to `.env` and restart

**Tools not showing in Claude Desktop**
- Check config path is absolute
- Verify `npm run build` succeeds
- Restart Claude Desktop

**Home Assistant tools not appearing**
- Verify `HA_BASE_URL` and `HA_TOKEN` are set
- Check Home Assistant is accessible from server

**SSE connection fails**
- Verify `AUTH_TOKEN` is set and matches on both ends
- Check firewall allows port 3004
- Test health endpoint: `curl http://localhost:3004/health`

## Why This Approach?

Previously planned separate Hevy and Home Assistant MCP servers. **Problem**: Each needs its own Tailscale funnel, complicating deployment.

**Solution**: Single MCP server with multiple API clients. The MCP transport layer is implementation-agnostic - it just registers tools. Each API client handles its own domain (Hevy fitness, HA smart home) with namespaced tool names (`hevy_*`, `ha_*`).

Benefits:
- Single deployment & Tailscale funnel
- Single Claude.ai connector
- Both services always available
- Clean separation of concerns via tool namespacing

## License

MIT
