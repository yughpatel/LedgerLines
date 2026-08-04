from pydantic import BaseModel, Field, field_validator, ConfigDict


class CategoryResponse(BaseModel):
    id: int
    name: str

    # This tells Pydantic to read from a SQLAlchemy model!
    model_config = ConfigDict(from_attributes=True)


class CategoryCreateRequest(BaseModel):
    name: str = Field(..., max_length=50)

    @field_validator('name')
    @classmethod
    def strip_and_check_empty(cls, value: str) -> str:
        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("Category name cannot be empty or just whitespace.")
        return stripped_value