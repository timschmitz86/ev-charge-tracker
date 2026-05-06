# EV Charge Tracker Frontend

React + Vite frontend for the EV Charge Tracker application.

## Local Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` and proxies API calls to the backend at `http://localhost:5000`.

## Build

```bash
npm run build
```

Output is generated in `dist/`.

## Lint

```bash
npm run lint
```

For full setup and environment variables, see the main [README.md](../README.md).

## Flashlight Toggle (Finish Charging)

The **Finish Charging** form includes a manual flashlight toggle button:

- Label shows current state: `🔦 On` / `🔦 Off`
- Button is shown only when basic torch-related browser media APIs are available
- Camera is requested on the first toggle-on (prefers back/environment camera)
- Torch support is verified on the active camera track before enabling

### Support and Constraints

- Requires a **secure context** (`https://`) or `http://localhost`
- Requires user camera permission
- Requires browser/device/camera support for `MediaStreamTrack` torch capability
- If unsupported, the flashlight button is hidden or an error is shown in the existing app error area

## Collapsible Charging History

The **Charging History** section is collapsible and uses **lazy loading** to minimize initial page load time and improve performance.

### Features

- **Collapsed by Default**: History is hidden when the app first loads, showing only a toggle button with a chevron icon (▶)
- **Lazy Loading**: History data and active session are only fetched when the user expands the history by clicking the chevron
- **Loading Indicator**: A spinner is shown while history data is being fetched
- **Persistent State**: The expanded/collapsed preference is saved to `localStorage` and remembered across page reloads
- **CSV Export**: The "Export CSV" button is only visible when history is expanded

### State Management

**New State Variables in `App.jsx`:**
```javascript
const [historyExpanded, setHistoryExpanded] = useState(() => {
  const stored = localStorage.getItem('historyExpanded')
  return stored ? JSON.parse(stored) : false
})
const [historyLoading, setHistoryLoading] = useState(false)
```

**localStorage Key**: `historyExpanded` (stores boolean as JSON string)

### Data Loading Behavior

| Scenario | What Loads | What Doesn't |
|----------|-----------|--------------|
| App startup (history collapsed) | kWh cost | History entries, active session |
| User expands history | History entries, active session | — |
| User finishes charging (history collapsed) | History (refreshed), active session cleared | — |
| User finishes charging (history expanded) | History (refreshed), active session cleared | — |
| Device comes online after offline (history collapsed) | Cost & pending operations | History entries |
| Device comes online after offline (history expanded) | History (refreshed), pending operations synced | — |

## Offline Metering

The frontend includes full offline support for **start and stop charging operations** with automatic sync when connectivity returns.

### File Structure

```
src/
├─ api.js                 # API layer with offline-aware fetch wrappers
├─ offlineQueue.js        # IndexedDB queue manager for offline operations
├─ App.jsx                # Main component with offline state monitoring
├─ index.css              # Includes offline UI styles (.offline-banner, .sync-status)
└─ ...
```

### API Module (`api.js`)

**Offline-Aware Functions:**
- `startCharging(kmStand, meterStart)` - Queue start if offline
- `finishCharging(meterEnd)` - Queue finish if offline
- `syncOfflineOperations()` - Manually trigger sync
- `isCurrentlyOnline()` - Get current online status
- `getOfflineStats()` - Get queue stats (pending count, IndexedDB available)

**Behavior:**
- Returns optimistic responses (`{_offline: true, _queuedForSync: true}`) when offline
- Automatically syncs on reconnect (online event)
- Handles 409 Conflict responses with user-friendly error messages
- Preserves operation order (FIFO)

### Queue Manager (`offlineQueue.js`)

**Storage Layers:**
1. **IndexedDB (Primary)** - Persistent, large quota (~50MB+), fast
2. **localStorage (Fallback)** - Used if IndexedDB unavailable (~5-10MB limit)

### Offline Session Tracking

**Client Session IDs:**
- Generated when start/finish is initiated (even offline): `crypto.randomUUID()`
- Sent to server in both `StartChargingRequest.clientSessionId` and `FinishChargingRequest.clientSessionId`
- Enables server to match offline operations and prevent duplicates
