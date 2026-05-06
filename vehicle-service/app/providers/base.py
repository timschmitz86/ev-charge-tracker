"""Abstract base class for vehicle data providers."""

from abc import ABC, abstractmethod


class VehicleProvider(ABC):
    """Abstract interface for retrieving vehicle data from manufacturer APIs."""

    @abstractmethod
    async def get_mileage(self, vin: str) -> int | None:
        """
        Get the current mileage (odometer reading in km) for a vehicle.

        Args:
            vin: The Vehicle Identification Number.

        Returns:
            The mileage in km, or None if unavailable.
        """
        ...

    async def close(self) -> None:
        """Clean up any resources (sessions, connections)."""
        pass
