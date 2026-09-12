using System.Net;
using System.Text.Json;
using CarCharge.Api.Extensions;
using CarCharge.Api.Interfaces;
using CarCharge.Api.Models;
using Microsoft.Extensions.Options;

namespace CarCharge.Api.Services;

/// <summary>
/// Vehicle data provider backed by the Škoda Connect Public API.
/// </summary>
public sealed class SkodaConnectVehicleProvider : IVehicleDataProvider
{
    private const int MaxAttempts = 3;
    private readonly HttpClient _httpClient;
    private readonly ILogger<SkodaConnectVehicleProvider> _logger;
    private readonly VehicleIntegrationOptions _options;

    public SkodaConnectVehicleProvider(
        HttpClient httpClient,
        IOptions<VehicleIntegrationOptions> options,
        ILogger<SkodaConnectVehicleProvider> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<int?> GetMileageAsync(string vehicleId)
    {
        var vin = _options.SkodaConnectVin.Trim();
        if (string.IsNullOrWhiteSpace(_options.SkodaConnectApiKey) || string.IsNullOrWhiteSpace(vin))
        {
            _logger.LogError("Škoda Connect integration requires both an API key and VIN.");
            return null;
        }

        var requestUri = $"/api/v1/vehicles/{Uri.EscapeDataString(vin)}?include=odometer";

        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
                request.Headers.TryAddWithoutValidation("X-API-Key", _options.SkodaConnectApiKey);
                using var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<VehicleResponse>();
                    var mileage = result?.Vehicle?.Odometer?.MileageInKm;
                    if (mileage is null)
                    {
                        _logger.LogWarning("Škoda Connect returned no mileage for VIN ending {VinSuffix}.", vin.SafeSuffix());
                        return null;
                    }

                    if (mileage > int.MaxValue)
                    {
                        _logger.LogWarning("Škoda Connect returned an out-of-range mileage for VIN ending {VinSuffix}.", vin.SafeSuffix());
                        return null;
                    }

                    _logger.LogInformation("Retrieved mileage for VIN ending {VinSuffix}: {Mileage} km.", vin.SafeSuffix(), mileage);
                    return (int)mileage;
                }

                if (!IsTransient(response.StatusCode) || attempt == MaxAttempts)
                {
                    _logger.LogWarning(
                        "Škoda Connect mileage request failed with status {StatusCode} for VIN ending {VinSuffix}.",
                        (int)response.StatusCode,
                        vin.SafeSuffix());
                    return null;
                }

                await Task.Delay(GetRetryDelay(response, attempt));
            }
            catch (HttpRequestException ex) when (attempt < MaxAttempts)
            {
                _logger.LogWarning(ex, "Transient Škoda Connect request failure on attempt {Attempt}.", attempt);
                await Task.Delay(TimeSpan.FromSeconds(attempt));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to retrieve mileage from Škoda Connect for VIN ending {VinSuffix}.", vin.SafeSuffix());
                return null;
            }
        }

        return null;
    }

    private static bool IsTransient(HttpStatusCode statusCode) =>
        statusCode == HttpStatusCode.TooManyRequests || (int)statusCode >= 500;

    private static TimeSpan GetRetryDelay(HttpResponseMessage response, int attempt)
    {
        if (response.Headers.RetryAfter?.Delta is { } retryAfter)
        {
            return retryAfter > TimeSpan.FromSeconds(30) ? TimeSpan.FromSeconds(30) : retryAfter;
        }

        return TimeSpan.FromSeconds(Math.Min(attempt, 5));
    }

    private sealed record VehicleResponse(Vehicle? Vehicle);
    private sealed record Vehicle(Odometer? Odometer);
    private sealed record Odometer(long MileageInKm);
}
