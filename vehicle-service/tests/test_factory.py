import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

# Ensure imports resolve from vehicle-service root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.providers.factory import create_provider


class FactoryTests(unittest.TestCase):
    def test_create_provider_raises_for_unsupported_provider(self):
        settings = SimpleNamespace(provider="unknown", skoda_username="u", skoda_password="p")
        with patch("app.providers.factory._PROVIDER_REGISTRY", {"skoda": object}):
            with self.assertRaises(ValueError) as ctx:
                create_provider(settings)

        self.assertIn("Unsupported vehicle provider", str(ctx.exception))

    def test_create_provider_passes_skoda_credentials(self):
        captured = {}

        class FakeSkodaProvider:
            def __init__(self, username: str, password: str):
                captured["username"] = username
                captured["password"] = password

        settings = SimpleNamespace(provider="skoda", skoda_username="alice", skoda_password="secret")

        with patch("app.providers.factory._PROVIDER_REGISTRY", {"skoda": FakeSkodaProvider}):
            provider = create_provider(settings)

        self.assertIsInstance(provider, FakeSkodaProvider)
        self.assertEqual(captured["username"], "alice")
        self.assertEqual(captured["password"], "secret")


if __name__ == "__main__":
    unittest.main()
