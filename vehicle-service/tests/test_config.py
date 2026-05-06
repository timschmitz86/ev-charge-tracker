import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

# Ensure imports resolve from vehicle-service root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings


class SettingsTests(unittest.TestCase):
    def test_resolve_vin_prefers_vehicle_map(self):
        env = {
            "VEHICLE_MAP": "car1=VIN_FROM_MAP,car2=VIN2",
            "VEHICLE_VIN": "VIN_FALLBACK",
        }
        with patch.dict(os.environ, env, clear=True):
            settings = Settings()

        self.assertEqual(settings.resolve_vin("car1"), "VIN_FROM_MAP")
        self.assertEqual(settings.resolve_vin("car2"), "VIN2")

    def test_resolve_vin_uses_default_vehicle_vin_for_generic_ids(self):
        env = {
            "VEHICLE_VIN": "WAUZZZ8V4JA000001",
        }
        with patch.dict(os.environ, env, clear=True):
            settings = Settings()

        self.assertEqual(settings.resolve_vin("car1"), "WAUZZZ8V4JA000001")
        self.assertEqual(settings.resolve_vin("default"), "WAUZZZ8V4JA000001")

    def test_resolve_vin_accepts_raw_vin(self):
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()

        vin = "WAUZZZ8V4JA000002"
        self.assertEqual(settings.resolve_vin(vin), vin)

    def test_resolve_vin_returns_none_for_unknown_non_vin(self):
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()

        self.assertIsNone(settings.resolve_vin("unknown-car"))


if __name__ == "__main__":
    unittest.main()
