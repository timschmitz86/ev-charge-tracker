namespace CarCharge.Api.Models;

public class ActiveSession
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public int KmStand { get; set; }
    public decimal MeterStart { get; set; }
    public Guid? ClientSessionId { get; set; }
    public string? DeviceId { get; set; }
}
