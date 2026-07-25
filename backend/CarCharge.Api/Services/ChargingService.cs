using System.Text.Json;
using CarCharge.Api.Extensions;
using CarCharge.Api.Models;

namespace CarCharge.Api.Services;

public class ChargingService
{
    private readonly string _filePath;
    private readonly Lock _lock = new();
    private ChargingData _data = new();
    private readonly ILogger<ChargingService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public ChargingService(IConfiguration configuration, ILogger<ChargingService> logger)
    {
        _logger = logger;
        _filePath = configuration.GetValue<string>("DataFilePath") ?? "data.json";
        Load();
    }

    private void Load()
    {
        if (!File.Exists(_filePath))
        {
            _logger.LogInformation("Data file not found at '{FilePath}', starting with empty data", _filePath.ToSafeString());
            _data = new ChargingData();
            Save();
            return;
        }

        var json = File.ReadAllText(_filePath);
        _data = JsonSerializer.Deserialize<ChargingData>(json, JsonOptions) ?? new ChargingData();
        _logger.LogInformation("Loaded {Count} charging entries from '{FilePath}'", _data.Entries.Count, _filePath.ToSafeString());
    }

    private void Save()
    {
        var json = JsonSerializer.Serialize(_data, JsonOptions);
        File.WriteAllText(_filePath, json);
    }

    public List<ChargingEntry> GetAll()
    {
        lock (_lock)
        {
            return _data.Entries.OrderByDescending(e => e.CreatedAt).ToList();
        }
    }

    public ChargingEntry? GetLast()
    {
        lock (_lock)
        {
            return _data.Entries.OrderByDescending(e => e.CreatedAt).FirstOrDefault();
        }
    }

    public ActiveSession? GetActiveSession()
    {
        lock (_lock)
        {
            return _data.ActiveSession;
        }
    }

    public ActiveSession StartCharging(StartChargingRequest request)
    {
        lock (_lock)
        {
            if (_data.ActiveSession is not null)
            {
                throw new InvalidOperationException("An active session already exists.");
            }

            var session = new ActiveSession
            {
                Id = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow,
                KmStand = request.KmStand,
                MeterStart = request.MeterStart,
                ClientSessionId = request.ClientSessionId,
                DeviceId = request.DeviceId
            };

            _data.ActiveSession = session;
            Save();
            _logger.LogInformation("Started charging session {SessionId} at meter {MeterStart} kWh, km stand {KmStand}",
                session.Id, session.MeterStart, session.KmStand);
            return session;
        }
    }

    public ChargingEntry FinishCharging(FinishChargingRequest request)
    {
        lock (_lock)
        {
            // Handle case where ClientSessionId is provided
            if (request.ClientSessionId.HasValue)
            {
                if (_data.ActiveSession is null)
                {
                    // No active session - check if we should allow unknown session (offline)
                    if (!request.AllowUnknownSession)
                    {
                        throw new InvalidOperationException("No active session to finish.");
                    }
                    
                    // Create orphan entry for offline finish of unknown session
                    var meterStart = request.OptionalMeterStart ?? 0m;
                    if (request.MeterEnd < meterStart)
                    {
                        throw new ArgumentException("MeterEnd must be >= MeterStart.");
                    }

                    var orphanEntry = new ChargingEntry
                    {
                        Id = request.ClientSessionId.Value,
                        CreatedAt = request.OfflineTimestamp ?? DateTime.UtcNow,
                        KmStand = 0,
                        MeterStart = meterStart,
                        MeterEnd = request.MeterEnd,
                        ChargedKwh = request.MeterEnd - meterStart,
                        KwCostAtTime = _data.KwCost
                    };
                    _data.Entries.Add(orphanEntry);
                    Save();
                    _logger.LogInformation("Finished offline/orphan session {EntryId}: {ChargedKwh:F3} kWh charged",
                        orphanEntry.Id, orphanEntry.ChargedKwh);
                    return orphanEntry;
                }
                
                // Active session exists - verify clientSessionId matches
                if (_data.ActiveSession.ClientSessionId.HasValue && 
                    _data.ActiveSession.ClientSessionId.Value != request.ClientSessionId.Value)
                {
                    throw new SessionConflictException(
                        _data.ActiveSession.ClientSessionId,
                        request.ClientSessionId,
                        "SESSION_MISMATCH");
                }
            }
            else
            {
                // No ClientSessionId provided - use legacy behavior
                if (_data.ActiveSession is null)
                {
                    throw new InvalidOperationException("No active session to finish.");
                }
            }

            if (request.MeterEnd < _data.ActiveSession.MeterStart)
            {
                throw new ArgumentException("MeterEnd must be >= MeterStart.");
            }

            var entry = new ChargingEntry
            {
                Id = _data.ActiveSession.Id,
                CreatedAt = _data.ActiveSession.CreatedAt,
                KmStand = _data.ActiveSession.KmStand,
                MeterStart = _data.ActiveSession.MeterStart,
                MeterEnd = request.MeterEnd,
                ChargedKwh = request.MeterEnd - _data.ActiveSession.MeterStart,
                KwCostAtTime = _data.KwCost
            };

            _data.Entries.Add(entry);
            _data.ActiveSession = null;
            Save();
            _logger.LogInformation("Finished charging session {EntryId}: {ChargedKwh:F3} kWh charged, km stand {KmStand}",
                entry.Id, entry.ChargedKwh, entry.KmStand);
            return entry;
        }
    }

    public decimal GetKwCost()
    {
        lock (_lock)
        {
            return _data.KwCost;
        }
    }

    public void SetKwCost(decimal kwCost)
    {
        lock (_lock)
        {
            if (kwCost < 0)
            {
                throw new ArgumentException("KwCost must be >= 0.");
            }
            _data.KwCost = Math.Round(kwCost, 5, MidpointRounding.AwayFromZero);
            Save();
            _logger.LogInformation("kWh cost updated to {KwCost}", _data.KwCost);
        }
    }

    public void MarkAsExported(List<Guid> ids)
    {
        lock (_lock)
        {
            var idSet = new HashSet<Guid>(ids);
            foreach (var entry in _data.Entries.Where(e => idSet.Contains(e.Id)))
            {
                entry.Exported = true;
            }
            Save();
            _logger.LogInformation("Marked {Count} entries as exported", ids.Count);
        }
    }

    public void UnmarkAsExported(List<Guid> ids)
    {
        lock (_lock)
        {
            var idSet = new HashSet<Guid>(ids);
            foreach (var entry in _data.Entries.Where(e => idSet.Contains(e.Id)))
            {
                entry.Exported = false;
            }
            Save();
            _logger.LogInformation("Unmarked {Count} entries as exported", ids.Count);
        }
    }

    public void DeleteEntries(List<Guid> ids)
    {
        lock (_lock)
        {
            var idSet = new HashSet<Guid>(ids);
            _data.Entries = _data.Entries.Where(e => !idSet.Contains(e.Id)).ToList();
            Save();
            _logger.LogInformation("Deleted {Count} entries", ids.Count);
        }
    }

    public ChargingEntry UpdateEntry(Guid id, UpdateChargingEntryRequest request)
    {
        lock (_lock)
        {
            var entry = _data.Entries.FirstOrDefault(e => e.Id == id);
            if (entry is null)
            {
                throw new KeyNotFoundException($"Entry with id {id} not found.");
            }

            if (request.MeterEnd < request.MeterStart)
            {
                throw new ArgumentException("MeterEnd must be >= MeterStart.");
            }

            if (request.KmStand < 0)
            {
                throw new ArgumentException("KmStand must be >= 0.");
            }

            if (request.KwCostAtTime.HasValue)
            {
                if (request.KwCostAtTime.Value < 0)
                {
                    throw new ArgumentException("KwCostAtTime must be >= 0.");
                }
                entry.KwCostAtTime = Math.Round(request.KwCostAtTime.Value, 5, MidpointRounding.AwayFromZero);
            }

            entry.KmStand = request.KmStand;
            entry.MeterStart = request.MeterStart;
            entry.MeterEnd = request.MeterEnd;
            entry.ChargedKwh = request.MeterEnd - request.MeterStart;

            Save();
            return entry;
        }
    }
}
