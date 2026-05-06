namespace CarCharge.Api.Models;

public class MarkExportedRequest
{
    public List<Guid> Ids { get; set; } = new();
}
