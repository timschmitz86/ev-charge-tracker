namespace CarCharge.Api.Models;

/// <summary>
/// Configuration section for optional vehicle integration.
/// </summary>
public class VehicleIntegrationOptions
{
    public const string SectionName = "VehicleIntegration";

    /// <summary>Whether vehicle integration is enabled.</summary>
    public bool Enabled { get; set; } = false;

    /// <summary>Base URL of the vehicle-service (Python FastAPI).</summary>
    public string BaseUrl { get; set; } = "http://vehicle-service:8100";

    /// <summary>Provider to use: remote, dummy, or skoda_connect.</summary>
    public string Provider { get; set; } = "remote";

    /// <summary>Škoda Connect public API base URL.</summary>
    public string SkodaConnectBaseUrl { get; set; } = "https://public.api.connect.skoda-auto.cz";

    /// <summary>Škoda Connect API key. Supply this through a secret or environment variable.</summary>
    public string SkodaConnectApiKey { get; set; } = string.Empty;

    /// <summary>VIN selected for the Škoda Connect integration.</summary>
    public string SkodaConnectVin { get; set; } = string.Empty;
}
