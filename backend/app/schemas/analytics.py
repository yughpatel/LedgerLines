from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class CategorySpendingResponse(BaseModel):
    category_id: int
    category_name: str
    total: Decimal
