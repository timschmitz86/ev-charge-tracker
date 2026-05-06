namespace CarCharge.Api.Models;

public class FinishChargingRequest
{
    public decimal MeterEnd { get; set; }
    public Guid? ClientSessionId { get; set; }
    public bool AllowUnknownSession { get; set; } = false;
    public DateTime? OfflineTimestamp { get; set; }
    public decimal? OptionalMeterStart { get; set; }
}
