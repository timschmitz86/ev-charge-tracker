# EV Charge Tracker

A single, self-hosted PWA for tracking EV charging sessions and cost per kWh without relying on external services.
It is designed for setups where the electricity meter has no internet connection, so readings are entered manually.
Unlike home automation systems (like Home Assistant), this is a dedicated app focused solely on EV charging tracking.
Optionally, it can fetch your vehicle's current mileage from manufacturer APIs ([currently supports Skoda](#vehicle-mileage-integration-optional)).

## Why

- Manual meter readings are first-class, not a workaround
- Simple, focused tool—not a smart home platform
- Self-hosted, no external dependencies

## Stack

- **Frontend**: React + Vite + React Router v6 + PWA
- **Backend**: .NET 10 Web API
- **Storage**: JSON file (`./data/data.json` via bind mount in docker-compose)

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)

## Running the Backend

```bash
cd backend/CarCharge.Api
dotnet run
```

The API will start on `http://localhost:5000` by default.

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server starts on `http://localhost:5173` and proxies API calls to `http://localhost:5000`.

### Frontend testing

A Playwright smoke test is included for the frontend to verify that the app still loads and renders its main charging UI in a browser environment.

## Docker Compose

**Prerequisites:** Docker and Docker Compose v2.

### Local Development

1. Create the data directory:

   ```bash
   mkdir data
   ```

2. Copy the sample env file:

   ```bash
   cp env.sample .env
   ```

3. Set up the vehicle service env file (required even if you don't use vehicle integration):

   ```bash
   cp vehicle-service/.env.example vehicle-service/.env
   ```

4. Start all services:

   ```bash
   docker compose up --build
   ```

Services are exposed on:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Vehicle service: `http://localhost:8100`

## Container image versions and releases

GitHub Actions publishes the backend, frontend, and vehicle-service images to GHCR on every push to `main`. Every image receives a mutable `latest` tag and an immutable `sha-<shortsha>` tag. When files inside a component directory change, that component also receives a SemVer patch tag and a matching Git tag:

- `backend-vX.Y.Z`
- `frontend-vX.Y.Z`
- `vehicle-service-vX.Y.Z`

Changes outside those component directories do not create a component version. Re-running a workflow for the same commit reuses its existing component version tag.

To create a project release, run the **Create Project Release** GitHub Actions workflow and supply an explicit `X.Y.Z` version. It creates a `project-vX.Y.Z` Git tag and GitHub Release with a changelog since the previous project release, grouped by component and shared changes.

### Production (Traefik)

`docker-compose.prod.yml` exposes the frontend through Traefik and keeps the backend and vehicle service off the public network.

**Prerequisites:**

- Traefik running as a Docker container with a shared external Docker network (default name: `traefik`)
- DNS pointing your public hostname to the host machine

1. Create the data directory:

   ```bash
   mkdir data
   ```

2. Copy and configure the env file:

   ```bash
   cp env.sample .env
   ```

   Set at minimum:

   ```env
   TRAEFIK_HOST=your.domain.example.com
   TRAEFIK_NETWORK=traefik   # must match your Traefik Docker network name
   ```

3. Set up the vehicle service env file:

   ```bash
   cp vehicle-service/.env.example vehicle-service/.env
   ```

4. Start all services detached:

   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

### Environment Variables

Copy `env.sample` to `.env` in the repo root and adjust values:

| Variable | Description | Default |
|----------|-------------|---------|
| `ASPNETCORE_ENVIRONMENT` | ASP.NET environment | `Production` |
| `DATA_FILE_PATH` | Backend JSON data file path | `/app/data/data.json` |
| `VEHICLE_INTEGRATION_ENABLED` | Enable vehicle integration | `true` |
| `VEHICLE_INTEGRATION_BASE_URL` | Vehicle service base URL | `http://vehicle-service:8100` |
| `VEHICLE_SERVICE_ENV_FILE` | Path to vehicle service env file | `./vehicle-service/.env` |
| `TRAEFIK_ENABLE` | Enable Traefik labels (prod compose) | `true` |
| `TRAEFIK_HOST` | Public hostname for Traefik router | `example.com` |
| `TRAEFIK_ENTRYPOINTS` | Traefik entrypoints | `websecure` |
| `TRAEFIK_TLS` | Enable TLS | `true` |
| `TRAEFIK_NETWORK` | Traefik Docker network name | `traefik` |
| `TRAEFIK_MIDDLEWARES` | Traefik middlewares | `carcharge-headers@docker` |

## API Endpoints

| Method | Endpoint               | Description                              |
|--------|------------------------|------------------------------------------|
| GET    | `/api/charging`        | Get all entries + active session + cost  |
| GET    | `/api/charging/last`   | Get the last completed entry             |
| POST   | `/api/charging/start`  | Start a new charging session             |
| POST   | `/api/charging/finish` | Finish the active charging session       |
| PUT    | `/api/charging/{id}`   | Update a charging entry                  |
| DELETE | `/api/charging/{id}`   | Delete a charging entry                  |
| GET    | `/api/charging/cost`   | Get current kW cost                       |
| PUT    | `/api/charging/cost`   | Update kW cost (5 decimal precision)     |
| POST   | `/api/charging/mark-exported` | Mark entries as exported          |
| POST   | `/api/charging/unmark-exported` | Unmark exported entries         |
| GET    | `/api/vehicle/{id}/mileage` | Get vehicle mileage (optional feature) |

### Start Charging Request

```json
{
  "kmStand": 45230,
  "meterStart": 1234.56
}
```

### Finish Charging Request

```json
{
  "meterEnd": 1250.00
}
```

### Update kW Cost Request

```json
{
  "kwCost": 0.31234
}
```

### Update Charging Entry Request

```json
{
  "kmStand": 45500,
  "meterStart": 1234.56,
  "meterEnd": 1250.00,
  "kwCostAtTime": 0.31234
}
```

**Fields:**
- `kmStand` (required) - Mileage at time of charge
- `meterStart` (required) - Starting meter reading
- `meterEnd` (required) - Ending meter reading
- `kwCostAtTime` (optional) - Cost per kWh at time of charge (5 decimal precision)

**Validation:**
- `meterEnd` must be >= `meterStart`
- `kmStand` must be >= 0
- `kwCostAtTime` (if provided) must be >= 0
- `chargedKwh` is automatically recalculated as `meterEnd - meterStart`

**Response (200 OK):**
Returns the updated `ChargingEntry` object.

**Error Responses:**
- `404 Not Found` - Entry with the specified ID doesn't exist
- `400 Bad Request` - Validation failed (e.g., meterEnd < meterStart)

## Building for Production

### Backend

```bash
cd backend/CarCharge.Api
dotnet publish -c Release -o ../../dist/backend
```

### Frontend

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`.

## CSV Export

The UI includes an **Export to CSV** button in the Charging History section. The CSV includes:

- Date & Time
- Mileage (km)
- Meter Start (kWh)
- Meter End (kWh)
- Charged (kWh)
- Cost/kWh (€)
- Total Cost (€)

**Streamlined Export Workflow:**
- Only **unexported** entries are included in the CSV export
- After the CSV downloads, you'll be prompted: _"Do you want to mark the X exported entries as exported?"_
- Click **"Yes"** to automatically mark all exported entries, or **"No"** to keep them unmarked
- This eliminates the need for a separate "Mark All Exported" button

## Frontend Routing

The frontend uses **React Router v6** with the following routes:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `App.jsx` | Main list view with all charging sessions |
| `/entry/:id` | `EntryDetailsPage.jsx` | Detailed view, edit, and delete for a single entry |

**Key Features:**
- Client-side routing with browser history
- Deep linking to entry details pages
- Back navigation maintains application state
- URL-based navigation with entry IDs

## Flashlight Toggle (Finish Charging)

When a charging session is active, the **Finish Charging** form can show a manual flashlight toggle next to the submit button.

- The button label shows state: `🔦 On` / `🔦 Off`
- Camera access is requested on first toggle-on (environment camera preferred)
- Torch is enabled/disabled using browser media track constraints

### Flashlight Support Requirements

- App must run in a secure context: **HTTPS** or **localhost**
- Camera permission must be granted by the user
- Browser/device/camera must support torch capability through media APIs
- If basic support is missing, the flashlight button is not shown

## Entry Management

### Viewing Entry Details

The application uses **React Router** to provide navigation between pages:

- **Main List Page** (`/`) - Shows all charging sessions with summary information
- **Entry Details Page** (`/entry/:id`) - Detailed view with edit and delete functionality

Click the **"📝 View Details"** button on any entry in the main list to navigate to its details page.

### Editing Entries

Each charging entry can be edited from its **details page**:

1. Click **"📝 View Details"** on an entry from the main list
2. On the details page, click **"✏️ Edit Entry"**
3. Modify the following fields:
   - **Car Mileage (km)** - Update the odometer reading
   - **Electricity Meter Start (kWh)** - Correct the starting meter value
   - **Electricity Meter End (kWh)** - Correct the ending meter value
   - **Cost per kWh at Time (€)** - Correct the historical cost rate (optional)
4. Click **"✓ Save Changes"** to update or **"Cancel"** to discard

**What Happens on Save:**
- The system validates that Meter End >= Meter Start
- If provided, kwCostAtTime must be >= 0 (5 decimal places supported)
- `chargedKwh` is automatically recalculated: `meterEnd - meterStart`
- The entry's `exported` status remains unchanged
- You're returned to view mode with the updated values

**Use Cases:**
- Correct data entry mistakes
- Update meter readings if you recorded them incorrectly
- Adjust mileage if you forgot to note it during charging
- Fix historical cost rates for accurate accounting

### Deleting Entries

Entries can be deleted from their **details page** (not from the main list):

1. Click **"📝 View Details"** on an entry
2. Click the **"🗑️ Delete Entry"** button
3. Confirm the deletion in the dialog

**Important:**
- Deletion is **permanent** and cannot be undone
- A confirmation dialog shows the date/time of the entry being deleted
- After deletion, you're automatically navigated back to the main list

### Export Status Management

Export status is managed through two interfaces:

**Main List View:**
- **"Export CSV"** button - Downloads unexported entries and prompts to mark them as exported
- Exported entries are displayed with reduced opacity and an "EXPORTED" badge

**Entry Details Page:**
- **"✓ Mark as Exported"** / **"✓ Unmark as Exported"** toggle button
- Allows you to manually adjust the export status of individual entries
- Useful for correcting export status or re-exporting specific entries

This separation keeps the main list clean and focused on batch operations, while providing granular control in the details view.

## Cost Tracking

The application tracks electrical costs with a global **kW cost rate** (€/kWh). 

### How It Works

1. **Cost Capture**: When a charging session is finished, the current global kW cost rate is **snapshot and stored** with that entry as `kwCostAtTime`.

2. **Historical Accuracy**: If you later change the global rate, previously completed sessions will continue to show their original cost rate. This ensures:
   - Accurate accounting and auditing
   - No retroactive cost changes
   - Reliable CSV exports

3. **Graceful Fallback**: Entries created before this feature was implemented will not have a stored cost rate. The frontend will gracefully use the current global rate for display.

### API Details

- **GET** `/api/charging/cost` - Returns current global cost rate
- **PUT** `/api/charging/cost` - Update global cost rate (5 decimal precision)

## Vehicle Mileage Integration (Optional)

The app can optionally fetch vehicle mileage from car manufacturer APIs instead of manual entry.

**Currently Supported:**
- **Skoda** via [`myskoda`](https://github.com/pozitron/myskoda) library — connects to Skoda API to read odometer data

Set `VEHICLE_INTEGRATION_ENABLED=true` in your environment to enable this feature. If disabled, mileage is entered manually.

**Thanks:** Vehicle integration would not be possible without the excellent `myskoda` library. Hat tip to the maintainers!

## Open Source

### License

This project is licensed under **GPL-3.0-or-later**.

### Third-Party Licenses (Direct Dependencies)

- Frontend (MIT): `react`, `react-dom`, `react-router-dom`, `vite`, `vite-plugin-pwa`, `eslint`, `@eslint/js`, `@vitejs/plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `@types/react`, `@types/react-dom`
- Frontend (Apache-2.0): `sharp`
- Backend (MIT): `Microsoft.AspNetCore.OpenApi`
- Python dependencies: `fastapi`, `uvicorn[standard]`, `python-dotenv`, `myskoda` (verify licenses before release)

### Contributing and Security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
- Each charging entry now includes `kwCostAtTime` field when created

Costs are exported with **5 decimal places** for precision.

## Vehicle Mileage Integration (Optional)

The application supports automatic retrieval of your vehicle's current mileage to pre-fill the "Car Mileage" field when starting a new charging session. This feature is **disabled by default** and requires a separate Python microservice.

### Architecture

```
/backend          → .NET 10 Web API (existing)
/vehicle-service  → Python FastAPI (new, optional)
/frontend         → React + Vite (existing)
```

The vehicle-service is a provider-based abstraction layer that supports multiple vehicle brands. Currently implemented:

| Provider | Library  | Status |
|----------|----------|--------|
| Skoda    | myskoda  | ✅      |
| BMW      | —        | Planned |
| Tesla    | —        | Planned |

### How to Enable

**1. Create the vehicle-service `.env` file:**

```bash
cp vehicle-service/.env.example vehicle-service/.env
```

Edit `vehicle-service/.env` with your credentials:

```env
VEHICLE_PROVIDER=skoda
SKODA_USERNAME=your-email@example.com
SKODA_PASSWORD=your-password
VEHICLE_VIN=TMBJB9NY1RF123456
VEHICLE_MAP=car1=TMBJB9NY1RF123456
```

**2. Enable vehicle integration in the backend:**

In `.env`, set:

```env
VEHICLE_INTEGRATION_ENABLED=true
```

**3. Start with Docker Compose:**

```bash
docker compose up --build
```

### How to Disable

Set `VehicleIntegration__Enabled=false` (the default). The vehicle-service container will still start but the backend will not call it. The system behaves exactly as before — no breaking changes.

### Vehicle Service API

| Method | Endpoint                          | Description                |
|--------|-----------------------------------|----------------------------|
| GET    | `/vehicles/{vehicleId}/mileage`   | Get current odometer (km)  |
| GET    | `/health`                         | Health check               |

### Adding a New Vehicle Brand

1. Create `vehicle-service/app/providers/your_brand_provider.py` implementing `VehicleProvider`
2. Register it in `vehicle-service/app/providers/factory.py`
3. Set `VEHICLE_PROVIDER=your_brand` in `.env`
4. No changes needed in the .NET backend or React frontend

### Security

- Vehicle credentials are **only** stored in `vehicle-service/.env`
- The .NET backend never handles manufacturer credentials
- Token refresh is managed inside the vehicle-service
- The `.env` file must not be committed to version control

## PWA

The app is a Progressive Web App and can be installed on mobile devices or desktops. The service worker caches static assets for offline UI access. API calls require network connectivity.

## Offline Metering

The application now supports **offline start and stop charging operations** for intermittent connectivity scenarios. This feature enables reliable metering even when cellular or WiFi connectivity is temporarily unavailable.

### What Works Offline

✅ **Offline Operations:**
- **Start Charging** - Queue a new charging session (records meter start, mileage)
- **Stop Charging** - Queue a charging completion (records meter end)
- Both operations sync automatically when connectivity returns

❌ **Online-Only Features:**
- History viewing (cached via PWA, but read-only)
- Editing past entries (requires server validation)
- Deleting entries
- Exporting to CSV (requires server state)
- Vehicle mileage auto-fill (skipped during offline; resumes when online)

### How Offline Works

When you start or stop charging without network connectivity:

1. **Queuing** - The operation is saved locally using IndexedDB (or localStorage fallback)
2. **Optimistic UI** - You see immediate feedback ("Started offline - will sync when online")
3. **Background Sync** - When connectivity is restored, operations replay in FIFO order
4. **User Notification** - Visual sync indicators show progress (pending count → sync in progress → completion status)

### Browser & Platform Support

**Minimum Requirements:**
- **iOS 26+** (all modern Safari versions)
- **Android 16+** (Chrome, Firefox, Samsung Internet, other Chromium-based browsers)
- **Desktop** - Modern browsers (Chrome, Firefox, Edge, Safari)

**Storage:**
- Primary: IndexedDB (persistent per app origin, ~50MB minimum quota on most platforms)
- Fallback: localStorage (if IndexedDB unavailable, ~5-10MB limit, less reliable)

### User Interface

When offline:
- A **purple "📱 Offline Mode"** banner appears with pending operation count
- Start/Stop buttons remain fully functional
- Submitted operations show confirmation: "⚠️ Started offline - will sync when online"
- Manual **Sync Now** button appears if pending operations exist when reconnecting

When syncing:
- Sync status bar shows: "Syncing: 2/3..." then "Sync complete: 2 succeeded, 0 failed"
- After completion, main data list auto-refreshes to show synced sessions

### Operation Sync Details

**Sync Process:**
1. Operations queue in the order they were created (FIFO)
2. When online, each operation replays to the server with original payload + metadata
3. Server validates and applies operations (idempotent via `clientSessionId`)
4. Failed operations show error reason (validation, conflict, validation)
5. UI updates reflect both successful and rejected operations

**Automatic Triggers:**
- App comes online (online event)
- App resumes from background (focus event)
- Manual "Sync Now" button (user-initiated)

### Charging State Machine

The application enforces a strict charging state machine:

1. **Not Charging** - No active session, Start button enabled
2. **Start Charging** - Creates session (online or offline queue)
3. **Charging Active** - Session in progress, Start button disabled (shows error if user tries), Stop button enabled
4. **Stop Charging** - Completes session (online or offline queue)
5. **Back to Not Charging** - Ready for next session

Key behaviors:
- **Cannot start twice**: If a session is active, attempting to start again shows error: "A charging session is already in progress. Please finish it before starting a new one."
- **Works offline**: State machine enforcement happens offline and online (prevents duplicate sessions)
- **Multi-device scenarios**: Server enforces state on sync; conflicts show 409 error

### Offline Mileage Behavior

**Vehicle Mileage Auto-Fill:**
- **Online**: Automatically fetches mileage from vehicle service (if enabled) when starting new charge
- **Offline**: Mileage fetch is skipped (no network available); user must enter manually
- **Coming Online**: Auto-fetch resumes; if user returns before finishing charge, mileage is still available

**Implication**: If you go offline immediately when starting the app, you won't get auto-filled mileage. Simply enter it manually.

### Multi-Device Handling

If two devices try to operate on the same charging session:

**Scenario:** Device A starts → goes offline → Device B finishes before Device A syncs start

**What Happens:**
1. Device B's finish fails with HTTP 409 (Session Conflict)
2. User is notified: "Session conflict: offline stop may not match active session"
3. On next sync, Device A sends start (creates session)
4. Device B's finish retries (matches now, succeeds)

**Server-Authoritative Conflict Resolution:** The server always wins. If state differs from what the client expects, the sync shows the error and user must refresh or retry.

### Conflict Recovery

If a conflict occurs during sync:
1. The operation is marked as "rejected" locally
2. User sees the conflict reason in the UI
3. Options:
   - Refresh the main data list (GET `/api/charging` shows current server state)
   - Manually redo the operation online
   - For multi-device: coordinate with the other device

### Limitations & Constraints

- **Offline History**: Past entries cannot be viewed or edited offline (PWA cache shows UI, but no new data)
- **No Background Sync** in Web API: Sync happens only when app is open/resumed (not via background task)
- **Single-Device Preferred**: Offline operations work best on one device at a time
- **Data Loss Risk:** If user clears browser storage before sync, queued operations are lost (educate users before clearing)
- **No Conflict Resolution UI**: On 409 conflict, user must manually refresh and retry
- **Manual Mileage Entry**: Vehicle mileage auto-fill unavailable offline; user must enter manually

### Technical Implementation

**Frontend (JavaScript/React):**
- `offlineQueue.js` - IndexedDB operation queue manager
- `api.js` - Offline-aware fetch wrappers for start/finish endpoints
- App.jsx - Offline state monitoring and sync trigger logic

**Backend (.NET 10):**
- `SessionConflictException` - Explicit conflict detection
- `StartChargingRequest.ClientSessionId` - Idempotency key (UUID)
- `FinishChargingRequest.ClientSessionId` + `AllowUnknownSession` - Flexible finish handling
- HTTP 409 response - Structured conflict metadata for client reconciliation

**Queue Storage:**
- Each operation stored with: `id`, `type` (start/finish), `payload`, `status` (pending/synced/rejected), `clientSessionId`, `queuedAt`, `syncedAt`
- Automatically cleared after all operations successfully synced
- Persists across app restarts until sync completes or user clears storage

### Testing Offline Functionality

**Manual Testing on Desktop/Mobile:**

1. **Simulate Offline:**
   - Chrome DevTools → Network tab → Offline checkbox
   - Or disconnect WiFi/cellular

2. **Queue Operations:**
   - Start Charging with offline
   - Stop Charging with offline
   - Observe pending count in banner

3. **Trigger Sync:**
   - Reconnect network (auto-sync starts)
   - Or click "Sync Now" button
   - Watch sync progress and completion

4. **Verify Data:**
   - After sync, refresh main list
   - Confirm both start and stop entries appear
   - Check timestamps match offline operation times

