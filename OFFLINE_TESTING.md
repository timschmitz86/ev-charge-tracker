# Offline Metering Testing Guide

This guide provides comprehensive instructions for testing the offline start/stop metering feature on desktop and mobile devices.

## Quick Start

### Test Offline on Desktop (Chrome, Firefox, Edge)

1. **Open DevTools** (`F12` or `Cmd+Opt+I`)
2. Go to **Network** tab
3. Check **Offline** checkbox
4. App shows purple "\ud83d\udcf5 Offline Mode" banner
5. Click **Start Charging** → operation queues
6. Click **Stop Charging** → operation queues
7. Uncheck **Offline** checkbox
8. Auto-sync triggers, shows "Syncing..." status
9. After sync: "Sync complete: 2 succeeded, 0 failed"
10. Refresh page → both sessions appear in history

### Test Offline on Mobile (iOS Safari, Android Chrome)

1. Put device in **Airplane Mode** or disconnect WiFi
2. App shows purple "\ud83d\udcf5 Offline Mode" banner
3. Perform start/stop operations (they queue)
4. Exit Airplane Mode or reconnect WiFi
5. App auto-syncs when coming online
6. Sync status updates, data appears in history

---

## Desktop Testing (Detailed)

### Environment Setup

- **Backend**: Running on `http://localhost:5000`
- **Frontend**: Running on `http://localhost:5173`
- **Browser**: Chrome, Firefox, or Edge with DevTools

### Test Scenario 1: Basic Offline Start/Stop

**Goal**: Verify operations queue and sync correctly

**Steps**:

1. **Start Online**
   - Open the app
   - Verify no offline banner (online mode)
   - Load data by navigating home

2. **Go Offline (DevTools)**
   - Open DevTools → Network tab
   - Check "Offline" checkbox
   - Verify purple banner appears with "(0 pending)"

3. **Queue Start**
   - Enter Car Mileage: `45000`
   - Enter Meter Start: `1234.00`
   - Click "Start Charging"
   - **Expected**: 
     - Form clears
     - Status shows: "\u26a0\ufe0f Started offline - will sync when online"
     - Banner updates: "(1 pending)"
     - Active session banner appears (optimistic)

4. **Queue Stop**
   - Enter Meter End: `1250.00`
   - Click "Stop Charging"
   - **Expected**:
     - Form clears
     - Status shows: "\u26a0\ufe0f Stopped offline - will sync when online"
     - Banner updates: "(2 pending)"
     - Active session banner disappears (optimistic)
     - Manual "Sync Now" button appears (since now online offline)

5. **Come Online**
   - Uncheck "Offline" checkbox
   - **Expected**:
     - Banner status shows: "Coming online - syncing operations..."
     - Sync bar shows: "Syncing 2 operations..."
     - After ~1s: "Sync complete: 2 succeeded, 0 failed"
     - Banner auto-dismisses after 3 seconds
     - Main list updates with new entries

6. **Verify Data**
   - Main list shows two new entries (matched by timestamps)
   - First entry: `meterStart=1234.00, meterEnd` empty (incomplete)
   - Second entry: `meterStart=1234.00, meterEnd=1250.00` (complete)
   - Both have same `createdAt` ~seconds apart

---

### Test Scenario 2: Multi-Device Conflict (Simulated)

**Goal**: Verify conflict handling when two devices operate on same session

**Setup**:
- Open browser page in **two separate windows** (simulates two devices)

**Steps**:

1. **Device A: Start Online**
   - Window A (Device A): Enter Car Mileage `45100`, Meter Start `2000.00`
   - Click "Start Charging" while **online**
   - **Expected**: Session created immediately, active banner shows

2. **Device B: Go Offline**
   - Window B (Device B): Go offline (DevTools Offline)
   - Verify offline banner shows "(0 pending)"

3. **Device B: Queue Conflicting Stop**
   - Window B: Enter Meter End `2050.00`
   - Click "Stop Charging"
   - **Expected**:
     - Window B shows: "\u26a0\ufe0f Stopped offline - will sync when online"
     - "(1 pending)"
     - Note: Device B doesn't know about Device A's session (no connection)

4. **Device A: Stop and Sync**
   - Window A: Meter End `2040.00`
   - Click "Stop Charging" (while still online)
   - **Expected**: Completes immediately
   - Session ends on server

5. **Device B: Come Online and Sync**
   - Uncheck offline
   - Auto-sync starts
   - **Expected**:
     - Sync status shows: "Coming online - syncing..."
     - After sync: "Sync complete: 1 succeeded, 0 failed" (because Device B's finish sync succeeds now - server already had active session from Device A)
     - Or: conflict error if timing is different

**Note**: If Device B's finish attempts to match a non-existent session (with `allowUnknownSession=false`), it will fail with HTTP 409. In this case:
   - Sync shows: "Sync complete: 0 succeeded, 1 failed"
   - User sees conflict error
   - Must refresh to see current server state

---

### Test Scenario 3: Offline Start, Online Stop

**Goal**: Verify offline start followed by online stop

**Steps**:

1. Go offline (DevTools)
2. Queue start: Car Mileage `45200`, Meter Start `3000.00`
3. Come online
4. Auto-sync starts, shows "Syncing..."
5. While sync in progress, immediately go offline again
6. Enter Meter End `3020.00`, click "Stop Charging"
7. **Expected**: Stop queues even while sync is completing
8. Come online again
9. **Expected**: Both operations appear in history (start and stop)

---

### Test Scenario 4: Storage Inspection

**Goal**: Verify IndexedDB queue persistence

**Setup**:
- Open DevTools → Application (Chrome) or Storage (Firefox)

**Steps**:

1. Go offline, queue 2-3 operations
2. Open DevTools → Application → IndexedDB → CarChargeOfflineDB → operationQueue
3. **Expected**: 
   - Table shows 2-3 rows
   - Each row: `id`, `status` (pending), `type` (start/finish), `payload`, `queuedAt`

4. Go online, sync completes
5. Refresh DevTools storage
6. **Expected**: 
   - Table shows same operations, but `status` now = "synced"
   - `syncedAt` timestamp filled

7. Close app (simulate crash)
8. Reopen app, go offline
9. **Expected**: 
   - Operations still in IndexedDB (data persisted)
   - But UI shows "(0 pending)" because app loads fresh state from server on startup

---

### Test Scenario 5: IndexedDB Disabled (localStorage Fallback)

**Goal**: Verify fallback to localStorage if IndexedDB unavailable

**Setup**:
- Open DevTools → Application
- Open DevTools → DevTools Settings → Disable Storage (or use `chrome://flags` to disable IndexedDB feature)
- Or start browser with `--disable-webdatabase` flag
- Reload app

**Steps**:

1. App should still function (with localStorage fallback)
2. Go offline, queue operations
3. Open DevTools → Application → localStorage
4. Look for key: `carCharge_offlineQueue`
5. **Expected**: JSON array of queued operations
6. Come online
7. **Expected**: Sync still works (using localStorage instead of IndexedDB)

---

### Test Scenario 6: Multiple Charging Prevention

**Goal**: Verify that user cannot start multiple concurrent charging sessions

**Steps**:

1. **Start First Session** (Online)
   - Enter Car Mileage: `45000`
   - Enter Meter Start: `1234.00`
   - Click "Start Charging"
   - **Expected**: Form clears, active session appears in banner

2. **Try to Start Again** (While session active)
   - Enter Car Mileage: `45100`
   - Enter Meter Start: `1300.00`
   - Click "Start Charging"
   - **Expected**: 
     - Error message shows: "A charging session is already in progress. Please finish it before starting a new one."
     - Form does NOT clear
     - Active session remains unchanged

3. **Offline Scenario** (Same state machine)
   - Go offline
   - Try to start while session active
   - **Expected**: Same error message (state machine enforced offline too)

4. **Finish Current Session**
   - Go online (if offline)
   - Enter Meter End: `1250.00`
   - Click "Stop Charging"
   - **Expected**: Session completes, active session banner disappears

5. **Now Can Start New Session**
   - Enter Car Mileage: `45100`
   - Enter Meter Start: `1300.00`
   - Click "Start Charging"
   - **Expected**: Form clears, new active session appears

---

### Test Scenario 7: Vehicle Mileage Auto-Fill Offline

**Goal**: Verify vehicle mileage is NOT fetched during offline, but resumes when online

**Prerequisites:**
- Vehicle integration enabled (optional feature)
- Have previously connected while online (so app can load vehicle data)

**Steps**:

1. **Start Online and Load Mileage** (Baseline)
   - Open app online
   - Look at Start Charging form
   - If no active session, Car Mileage field should auto-fill with current vehicle mileage (e.g., `45230`)
   - Manually finish any active session if present

2. **Go Offline Immediately**
   - DevTools → Network → Offline
   - Return to main list
   - Verify offline banner shows

3. **Check Mileage Field** (Offline)
   - If you finish any pending session first
   - Return to main list (no active session)
   - Open Start Charging form
   - **Expected**: Car Mileage field is EMPTY (not auto-filled)
   - **Reason**: Network unavailable, vehicle service not called

4. **Manually Enter Mileage** (Offline)
   - Enter Car Mileage: `45231` (manually type in value)
   - Enter Meter Start: `1234.00`
   - Click "Start Charging"
   - **Expected**: Offline start succeeds with manual mileage

5. **Come Online**
   - DevTools → Network → Offline (uncheck)
   - App auto-syncs start operation
   - Auto-sync completes

6. **Verify Mileage Auto-Fill Resumes** (Back Online)
   - Finish current session (Meter End: `1250.00`)
   - Back to Not Charging state
   - **Expected**: Start form Car Mileage field auto-fills again with current vehicle mileage
   - **Timing**: May take 1-2 seconds for vehicle service to fetch fresh data

---

## Mobile Testing (iOS & Android)

### iOS (Safari 26+)

**Test Offline Mode on iPhone 15+ with iOS 17+:**

**Airplane Mode Test**:

1. Open app in Safari (pinned to home screen or web app)
2. **Settings** → **Airplane Mode** → ON
3. Verify offline banner appears
4. Start: Car Mileage `45000`, Meter `1234.00` → Queue
5. Stop: Meter End `1250.50` → Queue
6. **Settings** → **Airplane Mode** → OFF
7. Return to app (may be backgrounded)
8. **Expected**: Auto-sync triggers, data syncs, history updates

**WiFi Toggle Test**:

1. Open app over WiFi
2. WiFi → OFF (Settings → WiFi)
3. Verify offline banner + queue operations
4. WiFi → ON
5. **Expected**: Auto sync on reconnect

**App Resume Test**:

1. Start charging while offline
2. Close app (swipe up in app switcher)
3. Wait 5 seconds
4. Reopen app
5. WiFi still off
6. **Expected**: Offline banner shows (1 pending), queued operation intact

### Android (Chrome/Firefox, API 16+)

**Data Toggle Test**:

1. Open app in Chrome over mobile data
2. Settings → Network → Mobile Data → OFF
3. Verify offline banner
4. Queue start and stop
5. Settings → Mobile Data → ON
6. App auto-syncs

**WiFi Toggle Test**:

1. App over WiFi
2. WiFi OFF (Quick Settings)
3. Queue operations
4. WiFi ON
5. Auto-sync triggers

**Background App Test**:

1. Start app offline, queue operation
2. Home button → background
3. Wait 10 seconds
4. Return to app (scroll up in recents)
5. **Expected**: Operation still queued, IndexedDB persisted

---

## Error Scenarios

### Scenario: Network Dropout During Sync

**Setup**:
1. Queue 5 operations
2. Go online
3. Immediately (while syncing) go back offline

**Expected**:
- Partially synced operations: marked "synced"
- Remaining: stay "pending"
- Next online: sync resumes for pending only
- No duplicates (idempotency protects)

### Scenario: Server Validation Error

**Setup**:
1. Queue operation with invalid meter (end < start): `start: 1000, end: 999`
2. Go online, sync

**Expected**:
- Sync status: "Sync complete: 0 succeeded, 1 failed"
- Operation marked "rejected" with error: "MeterEnd must be >= MeterStart"
- User sees error in sync status bar

### Scenario: Multiple Offline Sessions

**Setup**:
1. Queue Start → Queue Stop → (offline) → Queue Start → Queue Stop → Go online

**Expected**:
- 4 operations replay in order
- 2 complete sessions created
- No cross-contamination

---

## Browser Compatibility Matrix

| Device | Browser | iOS | Android | Status |
|--------|---------|-----|---------|--------|
| iPhone | Safari  | 26+ | N/A     | ✅ Full Support |
| iPad | Safari | 26+ | N/A     | ✅ Full Support |
| Samsung | Chrome | N/A | 16+ | ✅ Full Support |
| Pixel | Chrome | N/A | 16+ | ✅ Full Support |
| Generic Android | Firefox | N/A | 16+ | ✅ Full Support |
| Desktop | Chrome | ✅ | ✅ | ✅ Full Support |
| Desktop | Firefox | ✅ | ✅ | ✅ Full Support |
| Desktop | Safari (Mac) | 17+ | N/A | ✅ Full Support |

---

## Debugging Tips

### 1. View Console Logs

Open DevTools Console, look for:
- `"App is offline - operations will be queued"`
- `"Start charging failed due to offline/network, queueing operation"`
- `"Syncing 2 offline operations"`
- `"Sync complete: 2 succeeded, 0 failed"`

### 2. Inspect IndexedDB

Chrome DevTools → Application → IndexedDB → CarChargeOfflineDB → operationQueue
- Verify rows exist
- Check `status` field (pending/synced/rejected)
- Check `payload` shape matches API spec

### 3. Check localStorage Fallback

DevTools → Application → localStorage
- Key: `carCharge_offlineQueue`
- Value: JSON array of operations

### 4. Network Inspection

DevTools → Network tab during sync:
- Watch POST requests to `/api/charging/start` and `/api/charging/finish`
- Verify request payload includes `clientSessionId`
- Check response status (200 OK or 409 Conflict)

### 5. React DevTools

Install React DevTools extension, inspect App.jsx state:
- `isOffline` (boolean)
- `offlineStats` (pending count, IndexedDB available)
- `isSyncing` (boolean)
- `syncStatus` (string)

### 6. Time Sync Verification

After offline sync completes:
1. Inspect new entries in history
2. Check `createdAt` timestamps
3. **Offline start** timestamp should match when operation was queued
4. **Offline stop** timestamp should be a few seconds later

---

## Known Limitations & Workarounds

1. **No Manual Queue Clearing UI**
   - Workaround: Open DevTools → Application → IndexedDB → Clear Storage
   - Or localStorage → clear `carCharge_offlineQueue`

2. **No Retry UI for Rejected Operations**
   - Workaround: Refresh data, manually retry online

3. **No Background Sync on Web**
   - Status remains offline until user opens app

4. **History Offline View Read-Only**
   - PWA caches UI but doesn't allow edit/delete offline
   - Only start/stop queue available

---

## Regression Testing Checklist

- [ ] Online start/stop still works (no offline mode)
- [ ] History list loads correctly
- [ ] Edit entries still works (requires online)
- [ ] Delete entries still works (requires online)
- [ ] CSV export still works (requires online)
- [ ] Cost tracking still functional
- [ ] Vehicle mileage auto-fill still works when online (requires online)
- [ ] Vehicle mileage auto-fill skipped when offline (user must enter manually)
- [ ] Cannot start multiple concurrent sessions (error when trying)
- [ ] Can start new session after finishing previous one
- [ ] Flashlight toggle still works on finish form
- [ ] PWA install still works
- [ ] Service worker still caches assets
- [ ] No TypeError or console errors in normal operation
- [ ] Offline state machine prevents duplicate sessions (offline and online)

---

## Reporting Issues

If offline sync fails:

1. **Collect logs**: Open Console in DevTools, copy all log lines with "Sync", "offline", "conflict"
2. **Take screenshot**: Capture offline banner and sync status
3. **Describe steps**: List exact actions to reproduce
4. **Check IndexedDB**: Verify queued operations visible in DevTools
5. **Network trace**: Check POST requests in Network tab for response codes
6. **Device info**: iOS version, Android API, Browser version

