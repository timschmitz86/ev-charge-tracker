namespace CarCharge.Api.Models;

public class ChargingData
{
    public List<ChargingEntry> Entries { get; set; } = new();
    public ActiveSession? ActiveSession { get; set; }
    public decimal KwCost { get; set; } = 0.30000m;
}
