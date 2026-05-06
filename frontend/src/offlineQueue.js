/**
 * Offline queue manager for handling start/stop charging operations
 * Queues operations when offline and syncs them when connectivity returns
 */

// IndexedDB database name and stores
const DB_NAME = 'CarChargeOfflineDB';
const QUEUE_STORE = 'operationQueue';
const DB_VERSION = 1;

/**
 * Low-level IndexedDB operations
 */
const IndexedDBOps = {
  /**
   * Initialize or get the database
   */
  async getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  },

  /**
   * Add operation to queue
   */
  async addToQueue(operation) {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const request = store.add({
          ...operation,
          queuedAt: new Date().toISOString(),
          status: 'pending'
        });

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    } catch (error) {
      console.error('Failed to add operation to IndexedDB queue:', error);
      // Fallback to localStorage for browsers without IndexedDB
      await LocalStorageQueue.addToQueue(operation);
    }
  },

  /**
   * Get all pending operations
   */
  async getQueuedOperations() {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const store = tx.objectStore(QUEUE_STORE);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result.filter(op => op.status === 'pending'));
      });
    } catch (error) {
      console.error('Failed to read from IndexedDB, falling back to localStorage:', error);
      return LocalStorageQueue.getQueuedOperations();
    }
  },

  /**
   * Update operation status
   */
  async updateOperationStatus(id, status, result = null) {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const op = getRequest.result;
          op.status = status;
          op.syncedAt = new Date().toISOString();
          if (result) op.result = result;
          if (status === 'rejected') op.error = result?.error;

          const updateRequest = store.put(op);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve();
        };

        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (error) {
      console.error('Failed to update IndexedDB operation status:', error);
      await LocalStorageQueue.updateOperationStatus(id, status, result);
    }
  },

  /**
   * Clear all operations (after successful sync)
   */
  async clearQueue() {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('Failed to clear IndexedDB queue:', error);
      LocalStorageQueue.clearQueue();
    }
  }
};

/**
 * Fallback localStorage implementation for browsers without IndexedDB
 */
const LocalStorageQueue = {
  STORAGE_KEY: 'carCharge_offlineQueue',

  async addToQueue(operation) {
    const queue = this.getQueue();
    queue.push({
      ...operation,
      id: Date.now(), // Simple ID generation for localStorage
      queuedAt: new Date().toISOString(),
      status: 'pending'
    });
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
  },

  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  },

  async getQueuedOperations() {
    return this.getQueue().filter(op => op.status === 'pending');
  },

  async updateOperationStatus(id, status, result = null) {
    const queue = this.getQueue();
    const op = queue.find(o => o.id === id);
    if (op) {
      op.status = status;
      op.syncedAt = new Date().toISOString();
      if (result) op.result = result;
      if (status === 'rejected') op.error = result?.error;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
    }
  },

  async clearQueue() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};

/**
 * Offline queue manager - main public API
 */
export const OfflineQueueManager = {
  /**
   * Queue a start charging operation
   */
  async queueStartCharging(kmStand, meterStart) {
    const clientSessionId = crypto.randomUUID();
    const operation = {
      type: 'start',
      clientSessionId,
      payload: { kmStand, meterStart, clientSessionId },
      timestamp: new Date().toISOString()
    };

    await IndexedDBOps.addToQueue(operation);
    return clientSessionId;
  },

  /**
   * Queue a finish charging operation
   */
  async queueFinishCharging(meterEnd, clientSessionId = null) {
    const operation = {
      type: 'finish',
      clientSessionId: clientSessionId || crypto.randomUUID(),
      payload: {
        meterEnd,
        clientSessionId: clientSessionId || crypto.randomUUID(),
        allowUnknownSession: !clientSessionId, // Allow unknown if no session known
        offlineTimestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    await IndexedDBOps.addToQueue(operation);
    return operation.clientSessionId;
  },

  /**
   * Get all pending operations
   */
  async getPendingOperations() {
    return IndexedDBOps.getQueuedOperations();
  },

  /**
   * Mark operation as synced
   */
  async markAsSynced(operationId, result) {
    await IndexedDBOps.updateOperationStatus(operationId, 'synced', result);
  },

  /**
   * Mark operation as rejected (conflict or error)
   */
  async markAsRejected(operationId, error) {
    await IndexedDBOps.updateOperationStatus(operationId, 'rejected', error);
  },

  /**
   * Clear entire queue (use after successful sync)
   */
  async clearQueue() {
    await IndexedDBOps.clearQueue();
  },

  /**
   * Check if IndexedDB is supported and working
   */
  async isIndexedDBAvailable() {
    try {
      await IndexedDBOps.getDB();
      return true;
    } catch {
      return false;
    }
  }
};
