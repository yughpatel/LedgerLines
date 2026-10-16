from datetime import date
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel


class TrendBucket(str, Enum):
    DAY = "day"
    WEEK = "week"


class CategorySpendingResponse(BaseModel):
    category_id: int
    category_name: str
    total: Decimal


class CategoryIncomeResponse(BaseModel):
    category_id: int
    category_name: str
    total: Decimal


class TrendBucketResponse(BaseModel):
    # IST calendar dates; end is exclusive, matching the half-open query range
    start: date
    end: date
    income: Decimal
    spending: Decimal
