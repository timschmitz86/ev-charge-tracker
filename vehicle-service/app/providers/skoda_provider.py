"""Skoda vehicle data provider using the myskoda library."""

import logging
import os
from aiohttp import ClientSession
from myskoda import MySkoda

from app.providers.base import VehicleProvider

logger = logging.getLogger(__name__)


class SkodaProvider(VehicleProvider):
    """Retrieves vehicle data from Skoda Connect using the myskoda library."""

    def __init__(self, username: str, password: str) -> None:
        self._username = username
        self._password = password
        self._session: ClientSession | None = None
        self._myskoda: MySkoda | None = None
        self._connected = False

    async def _ensure_connected(self) -> MySkoda:
        """Lazily connect and authenticate with the Skoda API."""
        if self._myskoda is not None and self._connected:
            return self._myskoda

        logger.info("Connecting to Skoda Connect API...")
        self._session = ClientSession(trust_env=True)
        self._myskoda = MySkoda(self._session, mqtt_enabled=False)
        await self._myskoda.connect(self._username, self._password)
        self._connected = True
        logger.info("Successfully connected to Skoda Connect API.")
        return self._myskoda

    async def get_mileage(self, vin: str) -> int | None:
        """Get the current odometer reading for a Skoda vehicle via the maintenance report."""
        try:
            hub = await self._ensure_connected()
        except Exception as exc:
            exc_name = type(exc).__name__
            if "MarketingConsent" in exc_name:
                logger.error(
                    "Skoda authentication requires marketing consent acceptance. "
                    "Please log in to https://myskoda.skoda-auto.com or the MySkoda app "
                    "and accept the pending consent prompt, then retry."
                )
            else:
                logger.exception("Failed to connect to Skoda API for VIN %s", vin[-4:])
            self._connected = False
            return None

        try:
            maintenance = await hub.get_maintenance(vin)
            if maintenance and maintenance.maintenance_report:
                report = maintenance.maintenance_report
                if report.mileage_in_km is not None:
                    logger.info("Retrieved mileage for VIN %s: %d km", vin[-4:], report.mileage_in_km)
                    return report.mileage_in_km
        except Exception:
            logger.exception("Failed to retrieve mileage for VIN %s", vin[-4:])

        logger.warning("No mileage data available for VIN %s", vin[-4:])
        return None

    async def close(self) -> None:
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
            self._myskoda = None
            self._connected = False
