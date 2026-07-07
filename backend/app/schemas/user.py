from pydantic import BaseModel, ConfigDict

# Validates raw user registration input (password arrives here as plain text)
class UserCreate(BaseModel):
    email: str
    password: str  # Hashing happens later in the business logic before saving

# Structures data sent back to client (omits password to prevent security leaks)
class UserResponse(BaseModel):
    id: int
    email: str
    # Allows Pydantic to read data directly from database ORM attributes
    model_config = ConfigDict(from_attributes=True)
