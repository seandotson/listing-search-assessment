from datetime import date
from math import ceil

from models import Listing, RankedListing, SearchParams, SearchResponse


def relevance_score(
    listing: Listing, target_budget: float | None, today: date
) -> float:
    age_days = max(0, (today - listing.listed_date).days)
    recency = 30 / (30 + age_days)
    if target_budget is None:
        return 100 * recency
    budget_match = max(0, 1 - abs(listing.price - target_budget) / target_budget)
    return 100 * (0.7 * budget_match + 0.3 * recency)


def search_listings(
    listings: list[Listing], params: SearchParams, today: date
) -> SearchResponse:
    city = params.city.strip().casefold()
    keyword = params.keyword.strip().casefold()
    matches = []
    for listing in listings:
        if params.min_price is not None and listing.price < params.min_price:
            continue
        if params.max_price is not None and listing.price > params.max_price:
            continue
        if params.min_bedrooms is not None and listing.bedrooms < params.min_bedrooms:
            continue
        if city and listing.city.strip().casefold() != city:
            continue
        if keyword and keyword not in listing.description.casefold():
            continue
        matches.append(
            RankedListing(
                **listing.model_dump(),
                relevance_score=relevance_score(listing, params.target_budget, today),
            )
        )

    # Sort before pagination; source + id makes ties deterministic across feeds.
    matches.sort(
        key=lambda listing: (
            -listing.relevance_score,
            -listing.listed_date.toordinal(),
            listing.source,
            listing.id,
        )
    )
    total = len(matches)
    start = (params.page - 1) * params.page_size
    return SearchResponse(
        items=matches[start : start + params.page_size],
        total=total,
        page=params.page,
        page_size=params.page_size,
        total_pages=ceil(total / params.page_size),
    )
