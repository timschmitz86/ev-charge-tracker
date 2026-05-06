namespace CarCharge.Api.Interfaces;

/// <summary>
/// Abstraction for retrieving vehicle data (mileage, etc.).
/// Implementations may call a remote vehicle integration service or return null (disabled).
/// </summary>
public interface IVehicleDataProvider
{
    /// <summary>
    /// Get the current odometer reading (km) for the specified vehicle.
    /// </summary>
    /// <param name="vehicleId">A friendly vehicle identifier (e.g. "car1").</param>
    /// <returns>The mileage in km, or null if unavailable / feature disabled.</returns>
    Task<int?> GetMileageAsync(string vehicleId);
}
