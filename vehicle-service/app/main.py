"""Vehicle Integration Service — FastAPI application."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response

from app.config import settings
from app.providers import VehicleProvider, create_provider

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Module-level provider reference (initialized at startup)
_provider: VehicleProvider | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the provider lifecycle."""
    global _provider
    logger.info("Starting vehicle-service with provider: %s", settings.provider)
    _provider = create_provider(settings)
    yield
    # Shutdown
    if _provider:
        await _provider.close()
        _provider = None
    logger.info("Vehicle-service shut down.")


app = FastAPI(
    title="Vehicle Integration Service",
    description="Multi-brand vehicle data abstraction layer",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "provider": settings.provider}


@app.get("/vehicles/{vehicle_id}/mileage")
async def get_mileage(vehicle_id: str, response: Response):
    """
    Get the current mileage for a vehicle.

    Returns 200 with mileage data, or 204 if unavailable.
    """
    if _provider is None:
        response.status_code = 204
        return

    vin = settings.resolve_vin(vehicle_id)
    if vin is None:
        logger.warning("Could not resolve vehicle ID '%s' to a VIN", vehicle_id)
        response.status_code = 204
        return

    mileage = await _provider.get_mileage(vin)

    if mileage is None:
        logger.info("No mileage data available for vehicle '%s'", vehicle_id)
        response.status_code = 204
        return

    logger.info("Returning mileage for vehicle '%s': %d km", vehicle_id, mileage)
    return {"vehicleId": vehicle_id, "mileage": mileage}
