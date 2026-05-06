import { OfflineQueueManager } from './offlineQueue.js';
import { translate as t } from './i18n/useLanguage.js';

const API_BASE = '/api/charging';

// Track offline state and current session for offline mode
let isOnline = navigator.onLine;
let localClientSessionId = null; // Track offline start's clientSessionId

// Listen for online/offline events
window.addEventListener('online', () => {
  isOnline = true;
  console.log('App is online - syncing queued operations');
  triggerOfflineSync();
});

window.addEventListener('offline', () => {
  isOnline = false;
  console.log('App is offline - operations will be queued');
});

export async function fetchAll() {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error(t('errors.failedLoadChargingData'));
  return res.json();
}

export async function fetchLast() {
  const res = await fetch(`${API_BASE}/last`);
  if (!res.ok) throw new Error(t('errors.failedLoadLastEntry'));
  return res.json();
}

/**
 * Start charging with offline support
 */
export async function startCharging(kmStand, meterStart) {
  const payload = {
    kmStand: parseInt(kmStand, 10),
    meterStart: parseFloat(meterStart),
    clientSessionId: crypto.randomUUID() // Always send client session ID for offline tracking
  };

  try {
    const res = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || t('errors.failedStartCharging'));
    }

    const result = await res.json();
    localClientSessionId = result.clientSessionId; // Remember for potentially offline finish
    return result;
  } catch (error) {
    if (!isOnline || error instanceof TypeError) {
      // Network error - queue the operation
      console.warn('Start charging failed due to offline/network, queueing operation:', error.message);
      localClientSessionId = payload.clientSessionId;
      await OfflineQueueManager.queueStartCharging(payload.kmStand, payload.meterStart);
      
      // Return optimistic response for offline mode
      return {
        id: crypto.randomUUID(),
        clientSessionId: payload.clientSessionId,
        createdAt: new Date().toISOString(),
        kmStand: payload.kmStand,
        meterStart: payload.meterStart,
        _offline: true,
        _queuedForSync: true
      };
    }
    throw error;
  }
}

/**
 * Finish charging with offline support
 */
export async function finishCharging(meterEnd) {
  const payload = {
    meterEnd: parseFloat(meterEnd),
    clientSessionId: localClientSessionId,
    allowUnknownSession: !!localClientSessionId
  };

  try {
    const res = await fetch(`${API_BASE}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      // Session conflict
      const data = await res.json().catch(() => ({}));
      console.warn('Session conflict detected:', data);
      
      if (!isOnline) {
        // Offline - queue anyway
        await OfflineQueueManager.queueFinishCharging(payload.meterEnd, localClientSessionId);
        return {
          _offline: true,
          _queuedForSync: true,
          _conflict: true,
          conflictInfo: data
        };
      }

      throw new Error(`${t('errors.sessionConflictPrefix')} ${data.error}`);
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || t('errors.failedFinishCharging'));
    }

    const result = await res.json();
    localClientSessionId = null;
    return result;
  } catch (error) {
    if (!isOnline || error instanceof TypeError) {
      console.warn('Finish charging failed due to offline/network, queueing operation:', error.message);
      await OfflineQueueManager.queueFinishCharging(payload.meterEnd, localClientSessionId);

      return {
        _offline: true,
        _queuedForSync: true,
        meterEnd: payload.meterEnd,
        chargedKwh: 0
      };
    }
    throw error;
  }
}

export async function updateCost(kwCost) {
  const res = await fetch(`${API_BASE}/cost`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kwCost: parseFloat(kwCost) }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || t('errors.failedUpdateCost'));
  }
  return res.json();
}

/**
 * Sync queued offline operations back to server
 */
export async function syncOfflineOperations() {
  if (isOnline === false) {
    console.log('Still offline, cannot sync');
    return { synced: 0, failed: 0 };
  }

  const pending = await OfflineQueueManager.getPendingOperations();
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  console.log(`Syncing ${pending.length} offline operations`);

  let synced = 0;
  let failed = 0;

  for (const operation of pending) {
    try {
      let resultRes;
      if (operation.type === 'start') {
        resultRes = await fetch(`${API_BASE}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.payload),
        });
      } else if (operation.type === 'finish') {
        resultRes = await fetch(`${API_BASE}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.payload),
        });
      }

      if (!resultRes.ok) {
        const errorData = await resultRes.json().catch(() => ({}));
        
        if (resultRes.status === 409) {
          console.warn(`Operation ${operation.id} rejected due to conflict:`, errorData);
          await OfflineQueueManager.markAsRejected(operation.id, {
            error: t('errors.sessionConflictDetected'),
            conflictInfo: errorData
          });
          failed++;
        } else {
          console.warn(`Operation ${operation.id} failed:`, errorData);
          await OfflineQueueManager.markAsRejected(operation.id, {
            error: errorData.error || t('errors.failedToSync')
          });
          failed++;
        }
      } else {
        const data = await resultRes.json();
        await OfflineQueueManager.markAsSynced(operation.id, data);
        synced++;
      }
    } catch (error) {
      console.error(`Error syncing operation ${operation.id}:`, error);
      failed++;
    }
  }

  console.log(`Sync complete: ${synced} succeeded, ${failed} failed`);
  return { synced, failed };
}

/**
 * Manually trigger offline sync
 */
export async function triggerOfflineSync() {
  return syncOfflineOperations();
}

/**
 * Fetch the current mileage for a vehicle from the vehicle integration service.
 * Returns the mileage (number) or null if the feature is disabled / unavailable.
 */
export async function markExported(ids) {
  const res = await fetch(`${API_BASE}/mark-exported`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || t('errors.failedMarkExported'));
  }
  return res.json();
}

export async function unmarkExported(ids) {
  const res = await fetch(`${API_BASE}/unmark-exported`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || t('errors.failedUnmarkExported'));
  }
  return res.json();
}

export async function deleteEntry(id) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || t('errors.failedDeleteEntry'));
  }
  return res.json();
}

export async function updateEntry(id, kmStand, meterStart, meterEnd, kwCostAtTime = null) {
  const body = { 
    kmStand: parseInt(kmStand, 10), 
    meterStart: parseFloat(meterStart),
    meterEnd: parseFloat(meterEnd)
  };
  
  if (kwCostAtTime !== null && kwCostAtTime !== undefined && kwCostAtTime !== '') {
    body.kwCostAtTime = parseFloat(kwCostAtTime);
  }
  
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || t('errors.failedUpdateEntry'));
  }
  return res.json();
}

export async function fetchVehicleMileage(vehicleId = 'car1') {
  try {
    const res = await fetch(`/api/vehicle/${vehicleId}/mileage`);
    if (res.status === 204 || !res.ok) return null;
    const data = await res.json();
    return data.mileage ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the current online status
 */
export function isCurrentlyOnline() {
  return isOnline;
}

/**
 * Get offline queue stats for UI display
 */
export async function getOfflineStats() {
  const pending = await OfflineQueueManager.getPendingOperations();
  return {
    hasPendingOperations: pending.length > 0,
    pendingCount: pending.length,
    isIndexedDBAvailable: await OfflineQueueManager.isIndexedDBAvailable()
  };
}
