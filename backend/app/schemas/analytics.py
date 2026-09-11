from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class CategorySpendingResponse(BaseModel):
    category_id: int
    category_name: str
    total: Decimal

    # Lets Pydantic read a labeled SQLAlchemy Row via attribute access
    model_config = ConfigDict(from_attributes=True)
