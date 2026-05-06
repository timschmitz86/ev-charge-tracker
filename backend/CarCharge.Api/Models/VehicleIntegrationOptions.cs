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
}
