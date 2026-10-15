from zoneinfo import ZoneInfo
from pydantic_settings import BaseSettings

# Months and weeks are bucketed in the user's local time, not the DB session's.
# Single app-wide zone for v1; replace with a per-user setting later
REPORTING_TIMEZONE_NAME = "Asia/Kolkata"
REPORTING_TIMEZONE = ZoneInfo(REPORTING_TIMEZONE_NAME)

# Automatically loads, type-checks, and validates system environment variables
class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int
    refresh_token_secret_key: str
    refresh_token_expire_days: int
    environment: str = "development"

    # Tells Pydantic to read configuration variables from a local '.env' file
    class Config:
        env_file = ".env"

# Created once here as a Singleton instance to prevent repeatedly reloading the disk file
settings = Settings()
