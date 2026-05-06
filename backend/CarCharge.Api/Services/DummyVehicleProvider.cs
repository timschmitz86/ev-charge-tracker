using CarCharge.Api.Interfaces;

namespace CarCharge.Api.Services;

/// <summary>
/// No-op vehicle data provider used when vehicle integration is disabled.
/// Always returns null — the system behaves as if the feature does not exist.
/// </summary>
public class DummyVehicleProvider : IVehicleDataProvider
{
    public Task<int?> GetMileageAsync(string vehicleId)
    {
        return Task.FromResult<int?>(null);
    }
}
