namespace CarCharge.Api.Models;

public class ChargingEntry
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public int KmStand { get; set; }
    public decimal MeterStart { get; set; }
    public decimal MeterEnd { get; set; }
    public decimal ChargedKwh { get; set; }
    public bool Exported { get; set; } = false;
    public decimal? KwCostAtTime { get; set; }
}
