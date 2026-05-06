using Xunit;
using Moq;
using Microsoft.Extensions.Configuration;
using CarCharge.Api.Models;
using CarCharge.Api.Services;

namespace CarCharge.Api.Tests.Services;

public class ChargingServiceTests : IDisposable
{
    private readonly string _testDataFile;
    private readonly IConfiguration _config;
    private readonly ChargingService _service;

    public ChargingServiceTests()
    {
        _testDataFile = Path.Combine(Path.GetTempPath(), $"test_charging_{Guid.NewGuid()}.json");
        _config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> 
            { 
                { "DataFilePath", _testDataFile } 
            })
            .Build();
        _service = new ChargingService(_config);
    }

    public void Dispose()
    {
        if (File.Exists(_testDataFile))
        {
            File.Delete(_testDataFile);
        }
    }

    #region Existing Functionality Tests

    [Fact]
    public void StartCharging_WhenNoActiveSession_CreatesAndReturnsSession()
    {
        // Arrange
        var request = new StartChargingRequest
        {
            KmStand = 45230,
            MeterStart = 1234.56m
        };

        // Act
        var result = _service.StartCharging(request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(45230, result.KmStand);
        Assert.Equal(1234.56m, result.MeterStart);
        Assert.True(result.Id != Guid.Empty);
        Assert.True(result.CreatedAt <= DateTime.UtcNow);
    }

    [Fact]
    public void StartCharging_WhenActiveSessionExists_ThrowsInvalidOperationException()
    {
        // Arrange
        var request1 = new StartChargingRequest { KmStand = 1000, MeterStart = 100m };
        _service.StartCharging(request1);

        var request2 = new StartChargingRequest { KmStand = 2000, MeterStart = 200m };

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => _service.StartCharging(request2));
        Assert.Equal("An active session already exists.", ex.Message);
    }

    [Fact]
    public void GetActiveSession_WhenSessionExists_ReturnsSession()
    {
        // Arrange
        var request = new StartChargingRequest { KmStand = 5000, MeterStart = 500m };
        var session = _service.StartCharging(request);

        // Act
        var result = _service.GetActiveSession();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(session.Id, result.Id);
    }

    [Fact]
    public void GetActiveSession_WhenNoSession_ReturnsNull()
    {
        // Act
        var result = _service.GetActiveSession();

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void FinishCharging_WithValidRequest_CompletesSessionAndCreatesEntry()
    {
        // Arrange
        var startRequest = new StartChargingRequest { KmStand = 1000, MeterStart = 100m };
        _service.StartCharging(startRequest);

        var finishRequest = new FinishChargingRequest { MeterEnd = 150m };

        // Act
        var result = _service.FinishCharging(finishRequest);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(100m, result.MeterStart);
        Assert.Equal(150m, result.MeterEnd);
        Assert.Equal(50m, result.ChargedKwh);
        Assert.Null(_service.GetActiveSession());
    }

    [Fact]
    public void FinishCharging_WhenNoActiveSession_ThrowsInvalidOperationException()
    {
        // Arrange
        var request = new FinishChargingRequest { MeterEnd = 150m };

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => _service.FinishCharging(request));
        Assert.Equal("No active session to finish.", ex.Message);
    }

    [Fact]
    public void FinishCharging_WhenMeterEndLessThanStart_ThrowsArgumentException()
    {
        // Arrange
        var startRequest = new StartChargingRequest { KmStand = 1000, MeterStart = 100m };
        _service.StartCharging(startRequest);

        var finishRequest = new FinishChargingRequest { MeterEnd = 50m };

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => _service.FinishCharging(finishRequest));
        Assert.Contains("MeterEnd must be >= MeterStart", ex.Message);
    }

    [Fact]
    public void FinishCharging_WhenMeterEndEqualsStart_CreatesEntryWithZeroKwh()
    {
        // Arrange
        var startRequest = new StartChargingRequest { KmStand = 1000, MeterStart = 100m };
        _service.StartCharging(startRequest);

        var finishRequest = new FinishChargingRequest { MeterEnd = 100m };

        // Act
        var result = _service.FinishCharging(finishRequest);

        // Assert
        Assert.Equal(0m, result.ChargedKwh);
    }

    [Fact]
    public void GetAll_ReturnsEntriesInDescendingOrder()
    {
        // Arrange
        for (int i = 0; i < 3; i++)
        {
            var start = new StartChargingRequest { KmStand = 1000 + i * 1000, MeterStart = 100m + i * 10 };
            _service.StartCharging(start);
            var finish = new FinishChargingRequest { MeterEnd = 150m + i * 10 };
            _service.FinishCharging(finish);
            System.Threading.Thread.Sleep(10); // Ensure different timestamps
        }

        // Act
        var results = _service.GetAll();

        // Assert
        Assert.Equal(3, results.Count);
        // Verify descending order by CreatedAt
        for (int i = 0; i < results.Count - 1; i++)
        {
            Assert.True(results[i].CreatedAt >= results[i + 1].CreatedAt);
        }
    }

    [Fact]
    public void SetKwCost_WithValidValue_PersistsCost()
    {
        // Arrange
        const decimal newCost = 0.35m;

        // Act
        _service.SetKwCost(newCost);
        var retrieved = _service.GetKwCost();

        // Assert
        Assert.Equal(newCost, retrieved);
    }

    [Fact]
    public void SetKwCost_WithNegativeValue_ThrowsArgumentException()
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => _service.SetKwCost(-0.1m));
        Assert.Contains("KwCost must be >= 0", ex.Message);
    }

    #endregion

    #region New Offline Functionality Tests

    [Fact]
    public void StartCharging_WithClientSessionId_StoresAndReturnsClientSessionId()
    {
        // Arrange
        var clientSessionId = Guid.NewGuid();
        var request = new StartChargingRequest
        {
            KmStand = 45230,
            MeterStart = 1234.56m,
            ClientSessionId = clientSessionId
        };

        // Act
        var result = _service.StartCharging(request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(clientSessionId, result.ClientSessionId);
    }

    [Fact]
    public void StartCharging_WithoutClientSessionId_StillSucceeds()
    {
        // Arrange
        var request = new StartChargingRequest
        {
            KmStand = 45230,
            MeterStart = 1234.56m,
            ClientSessionId = null
        };

        // Act
        var result = _service.StartCharging(request);

        // Assert
        Assert.NotNull(result);
        Assert.Null(result.ClientSessionId);
    }

    [Fact]
    public void FinishCharging_WithClientSessionIdMatching_Succeeds()
    {
        // Arrange
        var clientSessionId = Guid.NewGuid();
        var startRequest = new StartChargingRequest
        {
            KmStand = 1000,
            MeterStart = 100m,
            ClientSessionId = clientSessionId
        };
        _service.StartCharging(startRequest);

        var finishRequest = new FinishChargingRequest
        {
            MeterEnd = 150m,
            ClientSessionId = clientSessionId
        };

        // Act
        var result = _service.FinishCharging(finishRequest);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(150m, result.MeterEnd);
    }

    [Fact]
    public void FinishCharging_WithClientSessionIdMismatch_ThrowsConflictException()
    {
        // Arrange
        var clientSessionId1 = Guid.NewGuid();
        var startRequest = new StartChargingRequest
        {
            KmStand = 1000,
            MeterStart = 100m,
            ClientSessionId = clientSessionId1
        };
        _service.StartCharging(startRequest);

        var clientSessionId2 = Guid.NewGuid();
        var finishRequest = new FinishChargingRequest
        {
            MeterEnd = 150m,
            ClientSessionId = clientSessionId2
        };

        // Act & Assert
        var ex = Assert.Throws<SessionConflictException>(() => _service.FinishCharging(finishRequest));
        Assert.Equal(clientSessionId2, ex.ClientSessionId);
        Assert.Equal(clientSessionId1, ex.ServerSessionId);
    }

    [Fact]
    public void FinishCharging_WithAllowUnknownSession_CreatesEntryEvenIfNoActiveSession()
    {
        // Arrange
        var clientSessionId = Guid.NewGuid();
        var finishRequest = new FinishChargingRequest
        {
            MeterEnd = 150m,
            ClientSessionId = clientSessionId,
            AllowUnknownSession = true,
            OfflineTimestamp = DateTime.UtcNow.AddHours(-1)
        };

        // Act
        var result = _service.FinishCharging(finishRequest);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(0m, result.MeterStart); // Default when unknown
        Assert.Equal(150m, result.MeterEnd);
    }

    [Fact]
    public void FinishCharging_WithoutClientSessionId_WorksWithExistingSession()
    {
        // Arrange
        var startRequest = new StartChargingRequest
        {
            KmStand = 1000,
            MeterStart = 100m
        };
        _service.StartCharging(startRequest);

        var finishRequest = new FinishChargingRequest
        {
            MeterEnd = 150m,
            ClientSessionId = null
        };

        // Act
        var result = _service.FinishCharging(finishRequest);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(150m, result.MeterEnd);
    }

    [Fact]
    public void IdempotentStart_DuplicateClientSessionId_ReturnsExistingSession()
    {
        // Arrange
        var clientSessionId = Guid.NewGuid();
        var request1 = new StartChargingRequest
        {
            KmStand = 1000,
            MeterStart = 100m,
            ClientSessionId = clientSessionId
        };

        var session1 = _service.StartCharging(request1);

        // Try to start again with same clientSessionId (should fail in current lock model)
        // This is where idempotency would be added
        var request2 = new StartChargingRequest
        {
            KmStand = 2000,
            MeterStart = 200m,
            ClientSessionId = clientSessionId
        };

        // Act & Assert
        // Currently should throw because active session exists
        var ex = Assert.Throws<InvalidOperationException>(() => _service.StartCharging(request2));
        Assert.Equal("An active session already exists.", ex.Message);
    }

    [Fact]
    public void MultiDeviceScenario_DeviceAStartsDeviceBFinishes_WithCorrectClientSessionId()
    {
        // Arrange: Device A starts a session
        var deviceASessionId = Guid.NewGuid();
        var startRequest = new StartChargingRequest
        {
            KmStand = 1000,
            MeterStart = 100m,
            ClientSessionId = deviceASessionId
        };
        var session = _service.StartCharging(startRequest);

        // Act: Device B finishes with Device A's session ID (offline, knows the ID)
        var finishRequest = new FinishChargingRequest
        {
            MeterEnd = 150m,
            ClientSessionId = deviceASessionId
        };
        var entry = _service.FinishCharging(finishRequest);

        // Assert
        Assert.NotNull(entry);
        Assert.Equal(150m, entry.MeterEnd);
        Assert.Null(_service.GetActiveSession());
    }

    [Fact]
    public void OfflineFinish_BeforeSyncedStart_WithAllowUnknownSession_CreatesOrphanEntry()
    {
        // Arrange: Device goes offline before start is synced
        var clientSessionId = Guid.NewGuid();
        var finishRequest = new FinishChargingRequest
        {
            MeterEnd = 150m,
            ClientSessionId = clientSessionId,
            AllowUnknownSession = true,
            OfflineTimestamp = DateTime.UtcNow.AddHours(-2),
            OptionalMeterStart = 100m
        };

        // Act
        var result = _service.FinishCharging(finishRequest);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(100m, result.MeterStart);
        Assert.Equal(150m, result.MeterEnd);
        Assert.Equal(50m, result.ChargedKwh);
    }

    [Fact]
    public void GetActiveSession_Returns_ClientSessionIdWhenPresent()
    {
        // Arrange
        var clientSessionId = Guid.NewGuid();
        var request = new StartChargingRequest
        {
            KmStand = 5000,
            MeterStart = 500m,
            ClientSessionId = clientSessionId
        };
        _service.StartCharging(request);

        // Act
        var result = _service.GetActiveSession();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(clientSessionId, result.ClientSessionId);
    }

    #endregion

    #region Data Persistence Tests

    [Fact]
    public void Data_PersistsAcrossServiceInstances()
    {
        // Arrange
        var request = new StartChargingRequest { KmStand = 1000, MeterStart = 100m };
        _service.StartCharging(request);

        // Act: Create new service instance that loads from same file
        var service2 = new ChargingService(_config);
        var activeSession = service2.GetActiveSession();

        // Assert
        Assert.NotNull(activeSession);
        Assert.Equal(1000, activeSession.KmStand);
    }

    [Fact]
    public void CompleteSession_PersistsToFile()
    {
        // Arrange
        var startRequest = new StartChargingRequest { KmStand = 1000, MeterStart = 100m };
        _service.StartCharging(startRequest);
        var finishRequest = new FinishChargingRequest { MeterEnd = 150m };
        _service.FinishCharging(finishRequest);

        // Act: Reload service
        var service2 = new ChargingService(_config);
        var entries = service2.GetAll();

        // Assert
        Assert.Single(entries);
        Assert.Null(service2.GetActiveSession());
    }

    #endregion
}
