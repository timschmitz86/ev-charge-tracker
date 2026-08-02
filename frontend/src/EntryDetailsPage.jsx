import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { fetchAll, updateEntry, deleteEntry, markExported, unmarkExported } from './api'
import { useLanguage } from './i18n/useLanguage'

function EntryDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { locale, t } = useLanguage()

  const [entry, setEntry] = useState(null)
  const [kwCost, setKwCost] = useState(0.30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editKmStand, setEditKmStand] = useState('')
  const [editMeterStart, setEditMeterStart] = useState('')
  const [editMeterEnd, setEditMeterEnd] = useState('')
  const [editKwCostAtTime, setEditKwCostAtTime] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAll()
      const foundEntry = data.entries.find((item) => item.id === id)
      if (!foundEntry) {
        setError(t('errors.entryNotFound'))
        setLoading(false)
        return
      }
      setEntry(foundEntry)
      setKwCost(data.kwCost || 0.30)
      setEditKmStand(foundEntry.kmStand.toString())
      setEditMeterStart(foundEntry.meterStart.toString())
      setEditMeterEnd(foundEntry.meterEnd.toString())
      const costAtTime = foundEntry.kwCostAtTime ?? data.kwCost ?? 0.30
      setEditKwCostAtTime(costAtTime.toString())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    if (entry) {
      setEditKmStand(entry.kmStand.toString())
      setEditMeterStart(entry.meterStart.toString())
      setEditMeterEnd(entry.meterEnd.toString())
      const costAtTime = entry.kwCostAtTime ?? kwCost
      setEditKwCostAtTime(costAtTime.toString())
    }
    setError('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')

    if (!editKmStand || !editMeterStart || !editMeterEnd || !editKwCostAtTime) {
      setError(t('errors.fillAllFields'))
      return
    }

    const meterStart = parseFloat(editMeterStart)
    const meterEnd = parseFloat(editMeterEnd)
    const kwCostAtTime = parseFloat(editKwCostAtTime)

    if (meterEnd < meterStart) {
      setError(t('errors.meterEndMustBeHigher'))
      return
    }

    if (kwCostAtTime < 0) {
      setError(t('errors.costAtTimeMustBePositive'))
      return
    }

    setLoading(true)
    try {
      await updateEntry(id, editKmStand, editMeterStart, editMeterEnd, kwCostAtTime)
      await loadData()
      setIsEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!entry) return

    const confirmed = window.confirm(
      t('details.deleteConfirm', { date: formatDate(entry.createdAt) })
    )
    if (!confirmed) return

    setLoading(true)
    setError('')
    try {
      await deleteEntry(id)
      navigate('/')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleToggleExported = async () => {
    if (!entry) return

    setLoading(true)
    setError('')
    try {
      if (entry.exported) {
        await unmarkExported([entry.id])
      } else {
        await markExported([entry.id])
      }
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleString(locale)
  }

  if (loading && !entry) {
    return (
      <div className="details-page">
        <h1>{t('common.appTitle')}</h1>
        <div className="section">
          <p>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error && !entry) {
    return (
      <div className="details-page">
        <h1>{t('common.appTitle')}</h1>
        <div className="error">{error}</div>
        <button onClick={() => navigate('/')}>{t('details.backToList')}</button>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="details-page">
        <h1>{t('common.appTitle')}</h1>
        <div className="section">
          <p>{t('errors.entryNotFound')}</p>
          <button onClick={() => navigate('/')}>{t('details.backToList')}</button>
        </div>
      </div>
    )
  }

  const costAtTime = entry.kwCostAtTime ?? kwCost
  const totalCost = (entry.chargedKwh * costAtTime).toFixed(5)

  return (
    <div className="details-page">
      <h1>{t('common.appTitle')}</h1>

      {error && <div className="error">{error}</div>}

      <div className="section">
        <div className="details-header">
          <button onClick={() => navigate('/')} className="btn-back">
            {t('details.backToList')}
          </button>
          <h2>{t('details.header')}</h2>
        </div>

        <div className="details-info">
          <div className="info-row">
            <span className="label">{t('details.dateTime')}</span>
            <strong>{formatDate(entry.createdAt)}</strong>
          </div>
          <div className="info-row">
            <span className="label">{t('details.status')}</span>
            <strong>
              {entry.exported ? (
                <span className="badge-exported">{t('details.exported')}</span>
              ) : (
                <span className="badge-not-exported">{t('details.notExported')}</span>
              )}
            </strong>
          </div>
        </div>

        {!isEditing ? (
          <>
            <div className="details-data">
              <div className="data-row">
                <span className="label">{t('details.carMileage')}</span>
                <strong>{entry.kmStand} km</strong>
              </div>
              <div className="data-row">
                <span className="label">{t('details.electricityMeterStart')}</span>
                <strong>{entry.meterStart} kWh</strong>
              </div>
              <div className="data-row">
                <span className="label">{t('details.electricityMeterEnd')}</span>
                <strong>{entry.meterEnd} kWh</strong>
              </div>
              <div className="data-row highlight">
                <span className="label">{t('details.charged')}</span>
                <strong>⚡ {entry.chargedKwh} kWh</strong>
              </div>
              <div className="data-row">
                <span className="label">{t('details.costAtTime')}</span>
                <strong>{costAtTime.toFixed(5)} €/kWh</strong>
              </div>
              <div className="data-row highlight">
                <span className="label">{t('details.totalCost')}</span>
                <strong>💶 {totalCost} €</strong>
              </div>
            </div>

            <div className="details-actions">
              <button
                onClick={handleToggleExported}
                disabled={loading}
                className={`btn-toggle-export${entry.exported ? ' exported' : ''}`}
              >
                {entry.exported ? t('details.unmarkExported') : t('details.markExported')}
              </button>
              <button onClick={handleEdit} disabled={loading} className="btn-edit">
                {t('details.editEntry')}
              </button>
              <button onClick={handleDelete} disabled={loading} className="btn-delete">
                {t('details.deleteEntry')}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSave} className="edit-form">
            <div className="form-group">
              <label htmlFor="editKmStand">{t('details.editCarMileageLabel')}</label>
              <input
                id="editKmStand"
                type="number"
                step="1"
                min="0"
                value={editKmStand}
                onChange={(e) => setEditKmStand(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="editMeterStart">{t('details.editMeterStartLabel')}</label>
              <input
                id="editMeterStart"
                type="number"
                step="0.01"
                min="0"
                value={editMeterStart}
                onChange={(e) => setEditMeterStart(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="editMeterEnd">{t('details.editMeterEndLabel')}</label>
              <input
                id="editMeterEnd"
                type="number"
                step="0.01"
                min="0"
                value={editMeterEnd}
                onChange={(e) => setEditMeterEnd(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="editKwCostAtTime">{t('details.editCostAtTimeLabel')}</label>
              <input
                id="editKwCostAtTime"
                type="number"
                step="0.00001"
                min="0"
                value={editKwCostAtTime}
                onChange={(e) => setEditKwCostAtTime(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={loading} className="btn-save">
                {loading ? t('common.saving') : t('details.saveChanges')}
              </button>
              <button type="button" onClick={handleCancel} disabled={loading} className="btn-cancel">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default EntryDetailsPage
