from datetime import date
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class APIModel(BaseModel):
    # Python uses snake_case; the React API uses camelCase.
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, allow_inf_nan=False
    )


class Listing(APIModel):
    id: str
    source: str
    address: str
    city: str
    state: str
    zip: str
    price: float = Field(ge=0)
    bedrooms: int = Field(ge=0)
    bathrooms: float = Field(ge=0)
    sqft: int = Field(ge=0)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    listed_date: date
    status: Literal["active", "pending", "sold"]
    description: str


class SearchParams(APIModel):
    min_price: float | None = Field(default=None, ge=0)
    max_price: float | None = Field(default=None, ge=0)
    min_bedrooms: int | None = Field(default=None, ge=0)
    city: str = ""
    keyword: str = ""
    target_budget: float | None = Field(default=None, gt=0)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=5, ge=1, le=100)

    @model_validator(mode="after")
    def validate_price_range(self) -> Self:
        if (
            self.min_price is not None
            and self.max_price is not None
            and self.min_price > self.max_price
        ):
            raise ValueError("minPrice must be less than or equal to maxPrice")
        return self


class RankedListing(Listing):
    relevance_score: float


class SearchResponse(APIModel):
    items: list[RankedListing]
    total: int
    page: int
    page_size: int
    total_pages: int
