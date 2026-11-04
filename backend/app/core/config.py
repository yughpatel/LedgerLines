from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Months and weeks are bucketed in the user's local time, not the DB session's.
# Single app-wide zone for v1; replace with a per-user setting later
REPORTING_TIMEZONE_NAME = "Asia/Kolkata"
REPORTING_TIMEZONE = ZoneInfo(REPORTING_TIMEZONE_NAME)

# Secrets shorter than this are refused in production
MIN_SECRET_LENGTH = 32


# Automatically loads, type-checks, and validates system environment variables
class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int
    refresh_token_secret_key: str
    refresh_token_expire_days: int

    # A closed list, so a typo like "prod" fails at startup instead of quietly
    # running production without the Secure cookie flag
    environment: Literal["development", "test", "production"] = "development"

    # Origins allowed to call the API from a browser with credentials. Comma-separated
    # in the environment. In production the frontend reaches the API through its own
    # /api proxy (same origin), so this only matters for direct cross-origin callers
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # Path of the refresh cookie as the BROWSER sees it. The frontend calls the API
    # under /api (the Vite dev proxy and the Vercel rewrite both strip it before the
    # request reaches FastAPI), so the browser must send the cookie to /api/auth/*.
    # Set to /auth when the browser calls the API directly, without a proxy
    refresh_cookie_path: str = "/api/auth"

    # Tells Pydantic to read configuration variables from a local '.env' file
    model_config = SettingsConfigDict(env_file=".env")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value):
        # "https://a.example, https://b.example" -> ["https://a.example", "https://b.example"]
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("refresh_cookie_path")
    @classmethod
    def path_is_absolute(cls, value: str) -> str:
        if not value.startswith("/"):
            raise ValueError("refresh_cookie_path must start with '/'.")
        return value.rstrip("/") or "/"

    @model_validator(mode="after")
    def safe_for_production(self):
        if self.environment != "production":
            return self
        problems = []
        if len(self.secret_key) < MIN_SECRET_LENGTH:
            problems.append(f"SECRET_KEY must be at least {MIN_SECRET_LENGTH} characters")
        if len(self.refresh_token_secret_key) < MIN_SECRET_LENGTH:
            problems.append(f"REFRESH_TOKEN_SECRET_KEY must be at least {MIN_SECRET_LENGTH} characters")
        if self.secret_key == self.refresh_token_secret_key:
            # One leaked key would otherwise forge both kinds of token
            problems.append("SECRET_KEY and REFRESH_TOKEN_SECRET_KEY must be different")
        if "*" in self.cors_origins:
            problems.append("CORS_ORIGINS can't be '*' when cookies are sent")
        insecure = [origin for origin in self.cors_origins if not origin.startswith("https://")]
        if insecure:
            problems.append(f"CORS_ORIGINS must all be https:// in production (got {', '.join(insecure)})")
        if problems:
            raise ValueError("Unsafe production settings: " + "; ".join(problems) + ".")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


# Created once here as a Singleton instance to prevent repeatedly reloading the disk file
settings = Settings()
