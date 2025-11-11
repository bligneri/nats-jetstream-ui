# Changelog

All notable changes to this project will be documented in this file.

## [0.2.7] - 2025-11-11

### Fixed
- Memory optimization: Replaced 50k parallel message fetches with chunked processing (500 messages per chunk)
- Reduced max search range from 50k to 10k messages to prevent OOM errors
- Fixed offset handling for exact subject searches to support deep pagination
- Added frontend memory safeguards with 5k message limit and warnings at 3k messages

### Changed
- Message fetching now processes in chunks to avoid memory spikes
- Search window moves deeper as user clicks "Load More" for pagination
- Frontend displays memory warning when approaching 3k loaded messages
- Frontend blocks loading beyond 5k messages with clear error message

## [0.2.6] - 2025-11-10

### Fixed
- Trusted postinstall dependencies: tailwind, watcher

## [0.2.5] - 2025-11-10

### Fixed
- Prefix the command with `bun` for production with bun

## [0.2.4] - 2025-11-10

### Fixed
- Use `bun` as native type for nitro engine / going to production with bun

## [0.2.3] - 2025-11-10

### Fixed
- Typo: `serve`-> `start` (convention)

## [0.2.2] - 2025-11-10

### Fixed
- Add the `serve` command for nuxt apps in production

## [0.2.1] - 2025-11-03

### Fixed
- Removed invalid `timeout` parameter from `getMessage` API call that was causing NATS warnings
- Fixed undefined `isSourceStream` variable error that broke wildcard pattern queries
- Message fetching now works reliably with `last_by_subj` for exact subjects and parallel fetch for wildcards

### Changed
- Simplified NATS connection to use standard URL format with embedded credentials
- Updated message decorator field extraction to handle SQL NullString/NullInt patterns
- Improved README documentation for decorator configuration and NATS URL formats
- Cleaned up leftover source stream handling code

### Added
- Template file `decorators.config.json.template` with comprehensive configuration examples

## [0.2.0] - 2025-11-03

### Added

#### Virtual Streams for Source Streams
- Automatic expansion of source streams (leaf node aggregation streams) into virtual streams
- Each unique subject in a source stream becomes a browsable virtual stream
- Fast subject pattern detection using `jsm.streams.info()` with subjects_filter
- Virtual streams show parent stream name with clickable navigation back to aggregate view
- Search functionality in stream list (appears when >30 streams)
- Frontend filtering of streams by name, virtual subject, or parent stream

#### Stream Statistics
- First message timestamp display
- Last message timestamp display
- Average messages per day calculation
- Message count per virtual stream (when available from stream state)
- Size shows "Unknown" for virtual streams (per-subject bytes not available)

#### UI Improvements
- Virtual streams display only unique subject part in sidebar (no repetition of parent name)
- Blue banner on virtual stream info page showing it's a filtered view with clickable parent link
- Stream list search box for filtering through hundreds of virtual streams
- Cleaner display with "?" for unknown message counts in sidebar

### Changed
- Source streams now appear in stream list alongside their virtual stream expansions
- Virtual stream subjects use exact matching instead of wildcards for accurate message retrieval
- Stream list layout updated to flex column with scrollable area for better UX with many streams

### Technical Details
- Virtual streams use parent stream name with subject filter for message queries
- Pattern detection extracts all unique subjects from `streamInfo.state.subjects`
- Subject map includes message counts per subject for accurate virtual stream metadata
- Virtual streams metadata: `isVirtual`, `parentStream`, `virtualSubject` flags

## [0.1.0] - 2025-01-02

### Added

#### NATS Integration
- Real NATS JetStream client integration (nats.js v2.29.3) replacing all mock data
- Server-side connection persistence with automatic reconnection on page navigation
- Connection details stored server-side in singleton natsService
- New API endpoints:
  - `/api/connection-status` - Check server-side connection state
  - `/api/connection-info` - Get current connection details
  - `/api/disconnect` - Disconnect from NATS server
  - `/api/decorators` - Load message field decorators
- Middleware to verify server-side connection before accessing dashboard

#### Message Viewer
- Message viewer component with advanced subject filtering
- Support for NATS wildcard patterns (`*` for single token, `>` for multiple levels)
- Support for exact subject matching
- Debounced subject input (500ms delay) to prevent query spam while typing
- Clickable subjects in message cards to instantly filter by exact subject
- Pagination with "Load More" button for browsing historical messages
- Intelligent search for exact subjects:
  - Uses `last_by_subj` API for instant lookup of most recent message
  - Searches backwards 50k messages in parallel to find more matches
  - Returns immediately without waiting to collect full page
- Wildcard pattern search fetches most recent 500 messages in parallel
- Messages sorted newest first by default

#### Message Display
- Decorator system for highlighting important fields per subject pattern
  - Configured via `decorators.config.json` file (no UI needed)
  - Pattern matching with wildcards (e.g., `commands.dlq.*`)
  - Custom field labels and color coding
  - Important fields displayed at card level (not hidden in expanded view)
- JSON syntax highlighting with color-coded keys, strings, numbers, booleans, nulls
- Custom CSS classes: `.json-key`, `.json-string`, `.json-number`, `.json-boolean`, `.json-null`
- Relative timestamps for better readability:
  - "Just now" for <60 seconds
  - "3m ago" for <60 minutes
  - "3h ago" for <24 hours
  - "Today", "Yesterday" for date
  - Day name for <7 days
  - Short date for older
- Collapsible message cards with expand/collapse icons
- Full message data displayed in properly formatted `<pre><code>` blocks
- Message headers shown when present

#### User Experience
- URL state management for shareable links
  - Stream selection persisted in `?stream=NAME`
  - Tab selection persisted in `?tab=messages`
- Dark background set from HTML level to prevent flash
- Disabled page transitions for smoother navigation
- Conditional rendering with loading states
- Auto-connect flow with proper loading indicators
- Disconnect button to switch between NATS servers
- Query parameter `?disconnected=true` to prevent auto-connect after manual disconnect

### Changed
- Message fetching uses parallel `Promise.all()` requests instead of sequential
- Exact subject queries optimized with NATS `last_by_subj` API for instant lookup
- Wildcard patterns use parallel batch fetching (500 messages) instead of one-by-one
- Connection check moved to server-side middleware (no client-side state needed)
- Server URL displayed in header fetched from server API
- Highlighted decorator fields moved from expanded view to card header
- Sequence number and subject shown as secondary info below highlighted fields

### Fixed
- Message loading performance for streams with millions of messages (tested with 374M messages)
- Subject filtering bug where patterns weren't matching correctly
- NATS pattern matching now uses proper wildcard conversion (`*` → `[^.]+`, `>` → `.*`)
- Loading screen flash during auto-connect by setting dark background early
- Connection persistence across page navigation with server-side storage
- Messages now return newest first instead of oldest first
- JSON display formatting (was compressed on one line, now properly indented)
- Race condition in connection state by adding `isConnecting` flag
- Client-side composable errors in middleware by using `defineNuxtRouteMiddleware`
- Variable reassignment errors by changing `const messages` to `let messages`

### Technical Details
- Parallel message fetching: Fetches up to 50,000 messages simultaneously using `Promise.all()`
- For exact subjects: `last_by_subj` → search 50k backwards → return immediately
- For wildcards: fetch recent 500 messages → filter client-side → return
- Auto-reconnect: `ensureConnected()` called before each operation
- Debounce implementation using `@vueuse/core` `useDebounceFn()`
- Connection singleton persists across Nuxt server hot reloads in development
