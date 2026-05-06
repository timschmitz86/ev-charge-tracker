namespace CarCharge.Api.Models;

public class StartChargingRequest
{
    public int KmStand { get; set; }
    public decimal MeterStart { get; set; }
    public Guid? ClientSessionId { get; set; }
    public string? DeviceId { get; set; }
}
