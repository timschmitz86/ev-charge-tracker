"""Factory for creating vehicle data providers based on configuration."""

import logging

from app.config import Settings
from app.providers.base import VehicleProvider

logger = logging.getLogger(__name__)

# Registry of known provider types
_PROVIDER_REGISTRY: dict[str, type] = {}


def _register_providers() -> None:
    """Register all known provider implementations."""
    # Import here to avoid circular imports and allow lazy loading
    from app.providers.skoda_provider import SkodaProvider

    _PROVIDER_REGISTRY["skoda"] = SkodaProvider
    # Future providers:
    # from app.providers.bmw_provider import BmwProvider
    # _PROVIDER_REGISTRY["bmw"] = BmwProvider
    # from app.providers.tesla_provider import TeslaProvider
    # _PROVIDER_REGISTRY["tesla"] = TeslaProvider


def create_provider(settings: Settings) -> VehicleProvider:
    """
    Create and return the appropriate vehicle provider based on configuration.

    Args:
        settings: Application settings with provider type and credentials.

    Returns:
        An instance of the configured VehicleProvider.

    Raises:
        ValueError: If the configured provider type is not supported.
    """
    if not _PROVIDER_REGISTRY:
        _register_providers()

    provider_type = settings.provider

    if provider_type not in _PROVIDER_REGISTRY:
        supported = ", ".join(sorted(_PROVIDER_REGISTRY.keys()))
        raise ValueError(
            f"Unsupported vehicle provider: '{provider_type}'. "
            f"Supported providers: {supported}"
        )

    provider_class = _PROVIDER_REGISTRY[provider_type]
    logger.info("Creating vehicle provider: %s", provider_type)

    # Map provider type to constructor arguments
    if provider_type == "skoda":
        return provider_class(
            username=settings.skoda_username,
            password=settings.skoda_password,
        )

    # Generic fallback (future providers may need different args)
    return provider_class()
