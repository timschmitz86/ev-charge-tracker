import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { fetchAll, startCharging, finishCharging, updateCost, fetchVehicleMileage, markExported, isCurrentlyOnline, getOfflineStats, syncOfflineOperations } from './api'
import { useLanguage } from './i18n/useLanguage'

function App() {
  const { language, locale, setLanguage, t } = useLanguage()

  const [entries, setEntries] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [lastMeterEnd, setLastMeterEnd] = useState('')
  const [error, setError] = useState('')

  // Offline support states
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [offlineStats, setOfflineStats] = useState({ hasPendingOperations: false, pendingCount: 0 })
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState('')

  // Start form
  const [kmStand, setKmStand] = useState('')
  const [meterStart, setMeterStart] = useState('')
  const [mileageAutoFilled, setMileageAutoFilled] = useState(false)

  // Finish form
  const [meterEnd, setMeterEnd] = useState('')
  const [torchApiSupported, setTorchApiSupported] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)

  // Cost configuration
  const [kwCost, setKwCost] = useState(0.30)
  const [editingCost, setEditingCost] = useState(false)
  const [newCost, setNewCost] = useState('')

  // Configuration collapse/expand state
  const [configExpanded, setConfigExpanded] = useState(() => {
    const stored = localStorage.getItem('configExpanded')
    return stored ? JSON.parse(stored) : true
  })

  // History collapse/expand state
  const [historyExpanded, setHistoryExpanded] = useState(() => {
    const stored = localStorage.getItem('historyExpanded')
    return stored ? JSON.parse(stored) : false
  })
  const [historyLoading, setHistoryLoading] = useState(false)

  const [loading, setLoading] = useState(false)

  const streamRef = useRef(null)
  const trackRef = useRef(null)

  const stopTorchStream = async () => {
    const track = trackRef.current
    if (track && typeof track.applyConstraints === 'function') {
      try {
        await track.applyConstraints({ advanced: [{ torch: false }] })
      } catch (err) {
        void err
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((streamTrack) => streamTrack.stop())
    }

    trackRef.current = null
    streamRef.current = null
    setTorchEnabled(false)
  }

  // Force fresh page load for devices with cached old version
  useEffect(() => {
    const checkForFreshPage = async () => {
      try {
        // Fetch index.html with no-cache to check if it's different from cached version
        const response = await fetch(window.location.href, {
          headers: { 'Cache-Control': 'no-cache, no-store' },
          cache: 'no-store'
        })

        if (response.ok) {
          const _html = await response.text()
          // Check if response has proper cache-control headers
          const cacheControl = response.headers.get('Cache-Control')
          const _lastModified = response.headers.get('Last-Modified')

          void _html
          void _lastModified

          // If we get a fresh response from server, reload page once to ensure
          // we're not running from service worker cache
          const lastCheck = localStorage.getItem('app-version-check')
          if (!lastCheck && cacheControl && cacheControl.includes('no-cache')) {
            localStorage.setItem('app-version-check', new Date().toISOString())
            // Reload once to ensure service worker is properly updated
            window.location.reload()
          }
        }
      } catch (err) {
        console.warn('Version check failed:', err)
      }
    }

    // Run check on first load
    if (!localStorage.getItem('app-version-check')) {
      checkForFreshPage()
    }
  }, [])

  // Monitor offline/online state and update offline stats
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      setSyncStatus(t('app.comingOnlineSyncing'))
      updateOfflineStats()
      // Trigger sync on reconnect
      syncOnReconnect()
    }

    const handleOffline = () => {
      setIsOffline(true)
      setSyncStatus(t('app.offlineQueued'))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    updateOfflineStats()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [t]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateOfflineStats = async () => {
    const stats = await getOfflineStats()
    setOfflineStats(stats)
  }

  const syncOnReconnect = async () => {
    setIsSyncing(true)
    try {
      const result = await syncOfflineOperations()
      setSyncStatus(t('app.syncComplete', { synced: result.synced, failed: result.failed }))
      // Only load history if it's expanded
      if (historyExpanded) {
        await loadHistory()
      } else {
        await loadData(false)
      }
      setTimeout(() => setSyncStatus(''), 3000)
    } catch (err) {
      setSyncStatus(t('app.syncFailed', { message: err.message }))
    } finally {
      setIsSyncing(false)
      await updateOfflineStats()
    }
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const data = await fetchAll()
      setEntries(data.entries || [])
      setActiveSession(data.activeSession || null)
      setKwCost(data.kwCost || 0.30)
      if (data.entries && data.entries.length > 0) {
        setLastMeterEnd(data.entries[0].meterEnd.toString())
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadData = async (includeHistory = false) => {
    try {
      if (includeHistory) {
        await loadHistory()
      } else {
        // Only load cost when not loading history
        const data = await fetchAll()
        setKwCost(data.kwCost || 0.30)
        if (data.entries && data.entries.length > 0) {
          setLastMeterEnd(data.entries[0].meterEnd.toString())
        }
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    if (historyExpanded) {
      loadHistory()
    } else {
      loadData(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist historyExpanded state to localStorage
  useEffect(() => {
    localStorage.setItem('historyExpanded', JSON.stringify(historyExpanded))
  }, [historyExpanded])

  // Persist configExpanded state to localStorage
  useEffect(() => {
    localStorage.setItem('configExpanded', JSON.stringify(configExpanded))
  }, [configExpanded])

  useEffect(() => {
    const hasBasicSupport = Boolean(
      navigator?.mediaDevices?.getUserMedia &&
      window?.MediaStreamTrack?.prototype?.applyConstraints
    )
    setTorchApiSupported(hasBasicSupport)
  }, [])

  useEffect(() => {
    const isMobile = Boolean(
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      window.ontouchstart !== undefined
    )
    setIsMobileDevice(isMobile)
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((streamTrack) => streamTrack.stop())
      }
    }
  }, [])

  // Auto-fetch vehicle mileage when the start form is shown (only when online)
  useEffect(() => {
    if (!activeSession && isCurrentlyOnline()) {
      fetchVehicleMileage('car1').then((mileage) => {
        if (mileage !== null && !kmStand) {
          setKmStand(mileage.toString())
          setMileageAutoFilled(true)
        }
      })
    }
  }, [activeSession, isOffline]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeSession && lastMeterEnd) {
      setMeterStart(lastMeterEnd)
    }
  }, [activeSession, lastMeterEnd])

  const handleStart = async (e) => {
    e.preventDefault()
    setError('')
    if (activeSession) {
      setError(t('errors.startSessionExists'))
      return
    }
    if (!kmStand || !meterStart) {
      setError(t('errors.fillAllFields'))
      return
    }
    setLoading(true)
    try {
      await stopTorchStream()
      const result = await startCharging(kmStand, meterStart)
      if (result._offline) {
        setSyncStatus(t('app.startedOffline'))
        setTimeout(() => setSyncStatus(''), 3000)
      }
      setKmStand('')
      setMeterStart('')
      setMileageAutoFilled(false)
      if (historyExpanded) {
        await loadHistory()
      } else {
        await loadData(false)
      }
      await updateOfflineStats()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = async (e) => {
    e.preventDefault()
    setError('')
    if (!meterEnd) {
      setError(t('errors.enterEndingMeter'))
      return
    }
    setLoading(true)
    try {
      await stopTorchStream()
      const result = await finishCharging(meterEnd)
      if (result._offline) {
        setSyncStatus(t('app.stoppedOffline'))
        if (result._conflict) {
          setError(t('errors.sessionConflictOffline'))
        }
        setTimeout(() => setSyncStatus(''), 3000)
      }
      setMeterEnd('')
      if (historyExpanded) {
        await loadHistory()
      } else {
        await loadData(false)
      }
      await updateOfflineStats()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTorchToggle = async () => {
    setError('')

    if (torchEnabled) {
      await stopTorchStream()
      return
    }

    try {
      let track = trackRef.current

      if (!track) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }
          },
          audio: false
        })

        const [videoTrack] = stream.getVideoTracks()
        if (!videoTrack) {
          stream.getTracks().forEach((streamTrack) => streamTrack.stop())
          throw new Error(t('errors.noCameraTrack'))
        }

        streamRef.current = stream
        trackRef.current = videoTrack
        track = videoTrack
      }

      if (typeof track.getCapabilities !== 'function') {
        throw new Error(t('errors.flashlightUnsupportedBrowser'))
      }

      const capabilities = track.getCapabilities()
      if (!capabilities.torch) {
        throw new Error(t('errors.flashlightUnsupportedCamera'))
      }

      await track.applyConstraints({ advanced: [{ torch: true }] })
      setTorchEnabled(true)
    } catch (err) {
      await stopTorchStream()
      setError(err instanceof Error ? err.message : t('errors.flashlightToggleFailed'))
    }
  }

  const handleExportCSV = async () => {
    const unexported = entries.filter((entry) => !entry.exported)
    if (unexported.length === 0) {
      setError(t('errors.noEntriesToExport'))
      return
    }

    const csvDelimiter = language === 'de' ? ';' : ','

    const translatedHeaders = t('csv.headers')
    const headers = Array.isArray(translatedHeaders)
      ? translatedHeaders
      : ['Date & Time', 'Mileage (km)', 'Meter Start (kWh)', 'Meter End (kWh)', 'Charged (kWh)', 'Cost/kWh (€)', 'Total Cost (€)']

    const localizedNumber = (value, options = {}) => {
      const numberValue = Number(value)
      if (!Number.isFinite(numberValue)) {
        return ''
      }

      return new Intl.NumberFormat(locale, options).format(numberValue)
    }

    // Helper to escape CSV values
    const escapeCSV = (value) => {
      const str = String(value)
      if (str.includes(csvDelimiter) || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Generate CSV rows from unexported entries only
    const rows = unexported.map((entry) => {
      const date = new Date(entry.createdAt).toLocaleString(locale)
      const costAtTime = entry.kwCostAtTime ?? kwCost
      const totalCost = entry.chargedKwh * costAtTime

      const formattedKmStand = localizedNumber(entry.kmStand)
      const formattedMeterStart = localizedNumber(entry.meterStart)
      const formattedMeterEnd = localizedNumber(entry.meterEnd)
      const formattedChargedKwh = localizedNumber(entry.chargedKwh)
      const formattedCostAtTime = localizedNumber(costAtTime, {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5
      })
      const formattedTotalCost = localizedNumber(totalCost, {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5
      })

      return [
        escapeCSV(date),
        escapeCSV(formattedKmStand),
        escapeCSV(formattedMeterStart),
        escapeCSV(formattedMeterEnd),
        escapeCSV(formattedChargedKwh),
        escapeCSV(formattedCostAtTime),
        escapeCSV(formattedTotalCost)
      ].join(csvDelimiter)
    })

    // Combine headers and rows
    const csv = [headers.join(csvDelimiter), ...rows].join('\n')

    // Add BOM for Excel compatibility
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })

    // Trigger download
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${t('app.csvFileNamePrefix')}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    // Ask user if they want to mark entries as exported
    const entryWord = unexported.length === 1 ? t('app.entrySingular') : t('app.entryPlural')
    const markAsExported = window.confirm(t('app.exportCompleteConfirm', { count: unexported.length, entryWord }))

    if (markAsExported) {
      setLoading(true)
      setError('')
      try {
        await markExported(unexported.map((entry) => entry.id))
        if (historyExpanded) {
          await loadHistory()
        } else {
          await loadData(false)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
  }

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'de' : 'en')
  }

  const currentLanguageLabel = language === 'en'
    ? t('app.languageValueEnglish')
    : t('app.languageValueGerman')

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleString(locale)
  }

  return (
    <>
      <h1>{t('common.appTitle')}</h1>

      {isOffline && (
        <div className="offline-banner">
          <span>
            {t('app.offlineBanner')}
            {offlineStats.pendingCount > 0 && (
              <span className="pending-count"> {t('app.pendingCount', { count: offlineStats.pendingCount })}</span>
            )}
          </span>
          {!isSyncing && offlineStats.hasPendingOperations && isCurrentlyOnline() && (
            <button
              onClick={syncOnReconnect}
              className="sync-btn"
              disabled={isSyncing}
            >
              {isSyncing ? t('common.syncing') : t('app.syncNow')}
            </button>
          )}
        </div>
      )}

      {syncStatus && (
        <div className="sync-status">
          {syncStatus}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {activeSession && (
        <div className="active-banner">
          <strong>{t('app.chargingInProgress')}</strong> - {t('app.chargingStartedAt')}{' '}
          {formatDate(activeSession.createdAt)}, {t('app.meterAt')}{' '}
          {activeSession.meterStart} kWh, {activeSession.kmStand} km
        </div>
      )}

      {!activeSession && (
        <div className="section">
          <h2>{t('app.startChargingHeader')}</h2>
          <form onSubmit={handleStart}>
            <label htmlFor="kmStand">{t('app.carMileageLabel')}</label>
            <input
              id="kmStand"
              type="number"
              step="1"
              min="0"
              placeholder={t('app.carMileagePlaceholder')}
              value={kmStand}
              onChange={(e) => {
                setKmStand(e.target.value)
                setMileageAutoFilled(false)
              }}
            />
            {mileageAutoFilled && (
              <div className="info">
                {t('app.autoLoadedMileage')}
              </div>
            )}

            <label htmlFor="meterStart">{t('app.meterStartLabel')}</label>
            <input
              id="meterStart"
              type="number"
              step="0.01"
              min="0"
              placeholder={t('app.meterStartPlaceholder')}
              value={meterStart}
              onChange={(e) => setMeterStart(e.target.value)}
            />
            {lastMeterEnd && (
              <div className="info">
                {t('app.suggestedStart', { value: lastMeterEnd })}
              </div>
            )}

            <div className="button-row">
              <button type="submit" disabled={loading}>
                {loading ? t('app.starting') : t('app.startCharging')}
              </button>
              {isMobileDevice && torchApiSupported && (
                <button
                  type="button"
                  onClick={handleTorchToggle}
                  disabled={loading}
                  className="torch-button"
                >
                  {torchEnabled ? t('app.flashlightOn') : t('app.flashlightOff')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {activeSession && (
        <div className="section">
          <h2>{t('app.finishChargingHeader')}</h2>
          <form onSubmit={handleFinish}>
            <label htmlFor="meterEnd">{t('app.meterEndLabel')}</label>
            <input
              id="meterEnd"
              type="number"
              step="0.01"
              min="0"
              placeholder={t('app.meterEndPlaceholder')}
              value={meterEnd}
              onChange={(e) => setMeterEnd(e.target.value)}
            />

            <div className="button-row">
              <button type="submit" disabled={loading}>
                {loading ? t('app.finishing') : t('app.finishCharging')}
              </button>
              {isMobileDevice && torchApiSupported && (
                <button
                  type="button"
                  onClick={handleTorchToggle}
                  disabled={loading}
                  className="torch-button"
                >
                  {torchEnabled ? t('app.flashlightOn') : t('app.flashlightOff')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="section">
        <button
          onClick={() => setConfigExpanded(!configExpanded)}
          className="collapse-btn"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: 'inherit',
            marginBottom: configExpanded ? '1rem' : 0
          }}
        >
          <span style={{ transform: configExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 200ms' }}>▶</span>
          <h2 style={{ margin: 0 }}>{t('app.configurationHeader')}</h2>
        </button>

        {!configExpanded && (
          <p style={{ margin: '0.5rem 0 0 0' }}>{t('app.currentCost')} <strong>{kwCost.toFixed(5)} €/kWh</strong></p>
        )}

        {configExpanded && (
          <>
            <div className="config-block">
              <h3>{t('app.kwCostHeader')}</h3>
              {!editingCost ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <p>{t('app.currentCost')} <strong>{kwCost.toFixed(5)} €/kWh</strong></p>
                  <button onClick={() => { setEditingCost(true); setNewCost(kwCost.toString()) }}>{t('app.editCost')}</button>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  const cost = parseFloat(newCost)
                  const normalized = Math.round(cost * 100000) / 100000
                  if (isNaN(cost) || cost < 0) {
                    setError(t('errors.invalidCostValue'))
                    return
                  }
                  setLoading(true)
                  setError('')
                  try {
                    await updateCost(normalized)
                    setKwCost(normalized)
                    setNewCost(normalized.toString())
                    setEditingCost(false)
                  } catch (err) {
                    setError(err.message)
                  } finally {
                    setLoading(false)
                  }
                }} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <label>
                    {t('app.costLabel')}
                    <input
                      type="number"
                      step="0.00001"
                      min="0"
                      value={newCost}
                      onChange={(e) => setNewCost(e.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" disabled={loading}>{loading ? t('common.saving') : t('common.save')}</button>
                  <button type="button" onClick={() => setEditingCost(false)} disabled={loading}>{t('common.cancel')}</button>
                </form>
              )}
            </div>

            <div className="config-block">
              <h3>{t('app.languageHeader')}</h3>
              <div className="config-row">
                <p>{t('app.currentLanguage')} <strong>{currentLanguageLabel}</strong></p>
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="lang-toggle"
                  aria-label={language === 'en' ? t('language.switchToGerman') : t('language.switchToEnglish')}
                >
                  {language === 'en' ? t('language.germanShort') : t('language.englishShort')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button
            onClick={() => {
              const newState = !historyExpanded
              setHistoryExpanded(newState)
              if (newState && entries.length === 0) {
                loadHistory()
              }
            }}
            className="collapse-btn"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: 'inherit'
            }}
          >
            <span style={{ transform: historyExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 200ms' }}>▶</span>
            <h2 style={{ margin: 0 }}>{t('app.historyHeader')}</h2>
          </button>
          {historyExpanded && (
            <button onClick={handleExportCSV} disabled={loading || historyLoading || entries.length === 0 || entries.every((entry) => entry.exported)} style={{ width: 'auto' }}>
              {loading || historyLoading ? t('app.exporting') : t('app.exportCsv')}
            </button>
          )}
        </div>

        {historyExpanded && (
          <>
            {historyLoading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>{t('app.loadingHistory')}</p>
              </div>
            ) : entries.length === 0 ? (
              <p className="empty">{t('app.noHistory')}</p>
            ) : (
              <ul className="session-list">
                {entries.map((entry) => (
                  <li key={entry.id} className={`session-item${entry.exported ? ' exported' : ''}`}>
                    <div className="date">
                      {formatDate(entry.createdAt)}
                      {entry.exported && <span className="badge-exported">{t('app.exportedBadge')}</span>}
                    </div>
                    <div className="details">
                      <span>{t('app.detailsMileage')}</span>
                      <strong>{entry.kmStand} km</strong>
                      <span>{t('app.detailsMeterStart')}</span>
                      <strong>{entry.meterStart} kWh</strong>
                      <span>{t('app.detailsMeterEnd')}</span>
                      <strong>{entry.meterEnd} kWh</strong>
                    </div>
                    <div className="entry-footer">
                      <span className="kwh">{t('app.chargedSummary', { kwh: entry.chargedKwh, cost: (entry.chargedKwh * (entry.kwCostAtTime ?? kwCost)).toFixed(5) })}</span>
                      <Link to={`/entry/${entry.id}`} className="btn-details">
                        {t('app.viewDetails')}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  )
}

export default App
