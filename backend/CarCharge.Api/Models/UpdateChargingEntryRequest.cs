namespace CarCharge.Api.Models;

public class UpdateChargingEntryRequest
{
    public int KmStand { get; set; }
    public decimal MeterStart { get; set; }
    public decimal MeterEnd { get; set; }
    public decimal? KwCostAtTime { get; set; }
}
