import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import Response

# Ensure imports resolve from vehicle-service root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.main as main_module


class FakeProvider:
    def __init__(self):
        self.closed = False
        self.return_mileage = None

    async def get_mileage(self, vin: str):
        return self.return_mileage

    async def close(self):
        self.closed = True


class MainApiTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        main_module._provider = None

    def tearDown(self):
        main_module._provider = None

    def _make_settings(self, provider_name: str = "skoda", vin_value: str | None = "VIN123"):
        return SimpleNamespace(
            provider=provider_name,
            resolve_vin=lambda _: vin_value,
        )

    async def test_health_endpoint_returns_provider_name(self):
        fake_settings = self._make_settings(provider_name="mock-provider")

        with patch("app.main.settings", fake_settings):
            response = await main_module.health_check()

        self.assertEqual(response, {"status": "ok", "provider": "mock-provider"})

    async def test_mileage_returns_204_when_vehicle_id_cannot_be_resolved(self):
        fake_provider = FakeProvider()
        fake_settings = self._make_settings(vin_value=None)
        response = Response()

        with patch("app.main.settings", fake_settings):
            main_module._provider = fake_provider
            payload = await main_module.get_mileage("car1", response)

        self.assertIsNone(payload)
        self.assertEqual(response.status_code, 204)

    async def test_mileage_returns_204_when_provider_has_no_data(self):
        fake_provider = FakeProvider()
        fake_provider.return_mileage = None
        fake_settings = self._make_settings(vin_value="WAUZZZ8V4JA000003")
        response = Response()

        with patch("app.main.settings", fake_settings):
            main_module._provider = fake_provider
            payload = await main_module.get_mileage("car1", response)

        self.assertIsNone(payload)
        self.assertEqual(response.status_code, 204)

    async def test_mileage_returns_payload_when_data_exists(self):
        fake_provider = FakeProvider()
        fake_provider.return_mileage = 12345
        fake_settings = self._make_settings(vin_value="WAUZZZ8V4JA000004")
        response = Response()

        with patch("app.main.settings", fake_settings):
            main_module._provider = fake_provider
            payload = await main_module.get_mileage("car1", response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload, {"vehicleId": "car1", "mileage": 12345})


if __name__ == "__main__":
    unittest.main()
