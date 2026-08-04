from pydantic import BaseModel, Field, field_validator

class CategoryCreateRequest(BaseModel):
    name: str = Field(..., max_length=50)

    @field_validator('name')
    @classmethod
    def strip_and_check_empty(cls, value: str) -> str:
        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("Category name cannot be empty or just whitespace.")
        return stripped_value