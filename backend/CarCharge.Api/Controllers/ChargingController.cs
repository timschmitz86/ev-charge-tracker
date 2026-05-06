using CarCharge.Api.Models;
using CarCharge.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace CarCharge.Api.Controllers;

[ApiController]
[Route("api/charging")]
public class ChargingController : ControllerBase
{
    private readonly ChargingService _service;

    public ChargingController(ChargingService service)
    {
        _service = service;
    }

    [HttpGet]
    public ActionResult<object> GetAll()
    {
        var entries = _service.GetAll();
        var active = _service.GetActiveSession();
        var kwCost = _service.GetKwCost();
        return Ok(new { entries, activeSession = active, kwCost });
    }

    [HttpGet("last")]
    public ActionResult<ChargingEntry?> GetLast()
    {
        var last = _service.GetLast();
        if (last is null)
            return Ok(new { lastEntry = (ChargingEntry?)null });
        return Ok(new { lastEntry = last });
    }

    [HttpPost("start")]
    public ActionResult<ActiveSession> StartCharging([FromBody] StartChargingRequest request)
    {
        try
        {
            var session = _service.StartCharging(request);
            return Ok(session);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("finish")]
    public ActionResult<ChargingEntry> FinishCharging([FromBody] FinishChargingRequest request)
    {
        try
        {
            var entry = _service.FinishCharging(request);
            return Ok(entry);
        }
        catch (SessionConflictException ex)
        {
            return Conflict(new
            {
                error = "Session conflict detected",
                conflictType = ex.ConflictType,
                serverSessionId = ex.ServerSessionId,
                clientSessionId = ex.ClientSessionId,
                remedy = "Ensure clientSessionId matches the active session or set allowUnknownSession=true for offline mode"
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("cost")]
    public ActionResult<object> GetCost()
    {
        var cost = _service.GetKwCost();
        return Ok(new { kwCost = cost });
    }

    [HttpPut("cost")]
    public ActionResult<object> UpdateCost([FromBody] UpdateCostRequest request)
    {
        try
        {
            _service.SetKwCost(request.KwCost);
            return Ok(new { kwCost = request.KwCost });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("mark-exported")]
    public ActionResult MarkExported([FromBody] MarkExportedRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return BadRequest(new { error = "No ids provided." });

        _service.MarkAsExported(request.Ids);
        return Ok(new { marked = request.Ids.Count });
    }

    [HttpPost("unmark-exported")]
    public ActionResult UnmarkExported([FromBody] MarkExportedRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return BadRequest(new { error = "No ids provided." });

        _service.UnmarkAsExported(request.Ids);
        return Ok(new { unmarked = request.Ids.Count });
    }

    [HttpDelete("{id}")]
    public ActionResult DeleteEntry(Guid id)
    {
        _service.DeleteEntries(new List<Guid> { id });
        return Ok(new { deleted = true });
    }

    [HttpPut("{id}")]
    public ActionResult<ChargingEntry> UpdateEntry(Guid id, [FromBody] UpdateChargingEntryRequest request)
    {
        try
        {
            var entry = _service.UpdateEntry(id, request);
            return Ok(entry);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
