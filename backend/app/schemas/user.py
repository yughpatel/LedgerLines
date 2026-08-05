import re
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# Validates raw user registration input
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(
        ...,
        min_length=8,
        max_length=20,
        description="Password must be between 8 and 20 characters."
    )

    @field_validator('password')
    @classmethod
    def validate_password_complexity(cls, value: str) -> str:
        # Check for at least one uppercase letter
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter.")

        # Check for at least one digit
        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one number.")

        # Check for at least one special character
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
            raise ValueError("Password must contain at least one special character.")

        return value


# Structures data sent back to client (omits password to prevent security leaks)
class UserResponse(BaseModel):
    id: int
    email: str
    # Allows Pydantic to read data directly from database ORM attributes
    model_config = ConfigDict(from_attributes=True)


class UserLogin(BaseModel):
    email: EmailStr
    # max_length=72 prevents DoS attacks from massive payloads pegging the CPU,
    # but no min_length ensures legacy users with short passwords aren't locked out.
    password: str = Field(..., max_length=72)


class Token(BaseModel):
    access_token: str
    token_type: str