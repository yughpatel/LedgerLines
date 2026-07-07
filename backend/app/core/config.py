from pydantic_settings import BaseSettings

# Automatically loads, type-checks, and validates system environment variables
class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int

    # Tells Pydantic to read configuration variables from a local '.env' file
    class Config:
        env_file = ".env"

# Created once here as a Singleton instance to prevent repeatedly reloading the disk file
settings = Settings()
