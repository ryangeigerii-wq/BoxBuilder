from functools import lru_cache
try:
    from pydantic_settings import BaseSettings  # type: ignore
except ImportError:  # Provide clear guidance if dependency missing
    class BaseSettings:  # type: ignore
        def __init__(self, **_: object) -> None:  # pragma: no cover
            raise RuntimeError(
                "pydantic-settings is not installed. Install with: pip install pydantic-settings"
            )


class Settings(BaseSettings):
    app_name: str = "Box Builder"
    environment: str = "dev"
    debug: bool = True
    version: str = "0.1.0"

    class Config:  # type: ignore
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()

__all__ = ["Settings", "get_settings"]
