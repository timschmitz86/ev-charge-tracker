using CarCharge.Api.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CarCharge.Api.Controllers;

[ApiController]
[Route("api/vehicle")]
public class VehicleController : ControllerBase
{
    private readonly IVehicleDataProvider _vehicleProvider;

    public VehicleController(IVehicleDataProvider vehicleProvider)
    {
        _vehicleProvider = vehicleProvider;
    }

    /// <summary>
    /// Get the current mileage for a vehicle.
    /// Returns 200 with data, or 204 if unavailable / feature disabled.
    /// </summary>
    [HttpGet("{vehicleId}/mileage")]
    public async Task<IActionResult> GetMileage(string vehicleId)
    {
        var mileage = await _vehicleProvider.GetMileageAsync(vehicleId);

        if (mileage is null)
        {
            return NoContent();
        }

        return Ok(new { vehicleId, mileage });
    }
}
