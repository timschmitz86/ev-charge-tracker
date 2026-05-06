"""Configuration management for the vehicle integration service."""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    def __init__(self) -> None:
        self.provider: str = os.getenv("VEHICLE_PROVIDER", "skoda").lower()
        self.skoda_username: str = os.getenv("SKODA_USERNAME", "")
        self.skoda_password: str = os.getenv("SKODA_PASSWORD", "")
        self.vehicle_vin: str = os.getenv("VEHICLE_VIN", "")

        # Parse vehicle map: "car1=VIN1,car2=VIN2"
        raw_map = os.getenv("VEHICLE_MAP", "")
        self.vehicle_map: dict[str, str] = {}
        if raw_map:
            for pair in raw_map.split(","):
                pair = pair.strip()
                if "=" in pair:
                    key, value = pair.split("=", 1)
                    self.vehicle_map[key.strip()] = value.strip()

    def resolve_vin(self, vehicle_id: str) -> str | None:
        """Resolve a friendly vehicle ID to a VIN. Falls back to using the ID as VIN directly."""
        if vehicle_id in self.vehicle_map:
            return self.vehicle_map[vehicle_id]
        # If only one VIN is configured and a generic ID is used, return it
        if self.vehicle_vin and vehicle_id in ("car1", "default"):
            return self.vehicle_vin
        # Assume the vehicle_id itself might be a VIN
        if len(vehicle_id) == 17:
            return vehicle_id
        return None


settings = Settings()
