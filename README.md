# NATS JetStream Explorer

A web-based UI for exploring NATS JetStream streams, consumers, and messages with support for multiple NATS servers.

## Features

- Multi-server support with easy server switching
- Stream browsing and statistics
- Consumer management
- Message viewer with filtering and pagination
- Virtual streams support (source stream aggregation)
- Customizable message decorators for highlighting important fields
- Real-time connection to NATS JetStream

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Configuration

### Server Configuration

Configure your NATS servers in `decorators.config.json` at the root of the project:

```json
{
  "servers": [
    {
      "id": 1,
      "name": "Commands",
      "url": "nats://localhost:4222",
      "decorators": [...]
    },
    {
      "id": 2,
      "name": "Hub Aggregate",
      "url": "nats://localhost:4223",
      "decorators": [...]
    }
  ]
}
```

Each server requires:
- `id`: Unique integer identifier used in URLs (e.g., `/1/dashboard`)
- `name`: Display name shown in the UI
- `url`: NATS server URL (format: `nats://host:port`)
- `decorators`: Array of message decorator configurations for this server

### Message Decorators

Decorators customize how messages are displayed by highlighting important fields. Each decorator has:

```json
{
  "pattern": "commands.dlq.*",
  "highlightFields": ["serial", "reason", "num_deliveries"],
  "fieldLabels": {
    "serial": "Serial Number",
    "reason": "Failure Reason",
    "num_deliveries": "Delivery Attempts"
  },
  "color": "red"
}
```

- `pattern`: Subject pattern to match (supports NATS wildcards: `*` for single token, `>` for multiple tokens)
- `highlightFields`: Array of field names to extract and display prominently
- `fieldLabels`: Optional friendly labels for fields
- `color`: Visual theme (`red`, `green`, `blue`, `yellow`, `purple`)

**Field Extraction:**
- Direct values: `"serial": "12345"` → displays "12345"
- SQL Null types: `"serial": { "String": "12345", "Valid": true }` → displays "12345"
- Missing fields are silently ignored

### Default NATS Server

To auto-connect to a specific NATS server on startup, set the NATS URL environment variable:

```bash
# Without authentication
NUXT_PUBLIC_NATS_URL=nats://localhost:4222

# With authentication
NUXT_PUBLIC_NATS_URL=nats://myuser:mypass@localhost:4222

# Multiple servers (comma-separated)
NUXT_PUBLIC_NATS_URL=nats://user:pass@server1:4222,nats://server2:4222

# TLS/Secure connection
NUXT_PUBLIC_NATS_URL=tls://user:pass@localhost:4222
```

Or create a `.env` file:

```env
NUXT_PUBLIC_NATS_URL=nats://myuser:mypass@localhost:4222
```

**NATS URL Format:**
- `nats://host:port` - Basic connection
- `nats://user:pass@host:port` - With authentication
- `tls://user:pass@host:port` - Secure/TLS connection
- Multiple servers can be comma-separated for failover

When `NUXT_PUBLIC_NATS_URL` is set, the app will automatically connect on load. If not set, you'll be presented with a connection form where you can:
- Select from configured servers in `decorators.config.json`
- Enter a custom server URL manually (with embedded credentials if needed)

## Usage

1. Start your NATS JetStream server(s)
2. Configure servers in `decorators.config.json`
3. Run the development server
4. Navigate to `http://localhost:3000`
5. Select a server or enter custom connection details
6. Browse streams, consumers, and messages

### Switching Servers

Use the server dropdown in the top-right corner of the dashboard to switch between configured servers or connect to a custom server.

### URL Structure

- `/` - Connection page
- `/[serverId]/dashboard` - Server-specific dashboard (e.g., `/1/dashboard`, `/2/dashboard`)
- Query params:
  - `?stream=StreamName` - Select a specific stream
  - `?tab=messages` - Open a specific tab (info, consumers, messages)
  - `?disconnected=true` - Show connection form after manual disconnect
