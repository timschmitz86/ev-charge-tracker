using System.Text.Json;
using CarCharge.Api.Interfaces;

namespace CarCharge.Api.Services;

/// <summary>
/// Vehicle data provider that calls the external Python vehicle-service via HTTP.
/// Used when vehicle integration is enabled in configuration.
/// </summary>
public class RemoteVehicleProvider : IVehicleDataProvider
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<RemoteVehicleProvider> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public RemoteVehicleProvider(HttpClient httpClient, ILogger<RemoteVehicleProvider> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<int?> GetMileageAsync(string vehicleId)
    {
        try
        {
            var response = await _httpClient.GetAsync($"/vehicles/{vehicleId}/mileage");

            if (response.StatusCode == System.Net.HttpStatusCode.NoContent)
            {
                _logger.LogInformation("Vehicle service returned no mileage data for {VehicleId}", vehicleId);
                return null;
            }

            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<MileageResponse>(json, JsonOptions);

            if (result?.Mileage is not null)
            {
                _logger.LogInformation("Retrieved mileage for {VehicleId}: {Mileage} km", vehicleId, result.Mileage);
                return result.Mileage;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to retrieve mileage for {VehicleId} from vehicle service", vehicleId);
            return null;
        }
    }

    private record MileageResponse(string VehicleId, int? Mileage);
}
