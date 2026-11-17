from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from main import app
from models import Listing, SearchParams
from search import relevance_score, search_listings

TODAY = date(2026, 9, 18)


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def listing():
    return Listing(
        id="1",
        source="MLS_A",
        address="1 Main St",
        city="Springfield",
        state="VA",
        zip="22150",
        price=500000,
        bedrooms=3,
        bathrooms=2,
        sqft=1500,
        latitude=38,
        longitude=-77,
        listed_date=TODAY,
        status="active",
        description="Sunny home near schools",
    )


def test_default_response_and_camel_case(client):
    response = client.get("/api/listings")
    assert response.status_code == 200
    data = response.json()
    assert (data["total"], data["page"], data["pageSize"], data["totalPages"]) == (
        12,
        1,
        5,
        3,
    )
    assert len(data["items"]) == 5
    assert "listedDate" in data["items"][0]
    assert "relevanceScore" in data["items"][0]
    scores = [item["relevanceScore"] for item in data["items"]]
    assert scores == sorted(scores, reverse=True)


def test_combined_filters(client):
    response = client.get(
        "/api/listings",
        params={
            "city": "  SPRINGFIELD ",
            "keyword": " SCHOOLS ",
            "minPrice": 525000,
            "maxPrice": 527500,
            "minBedrooms": 3,
            "targetBudget": 525000,
        },
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == ["A2", "B8"]


@pytest.mark.parametrize(
    "params",
    [
        {"minPrice": -1},
        {"maxPrice": -1},
        {"minBedrooms": -1},
        {"minBedrooms": "1.5"},
        {"minPrice": 10, "maxPrice": 5},
        {"pageSize": 0},
        {"pageSize": -1},
        {"pageSize": 101},
        {"page": 0},
        {"page": "abc"},
        {"targetBudget": 0},
        {"targetBudget": -1},
        {"targetBudget": "NaN"},
        {"maxPrice": "Infinity"},
    ],
)
def test_invalid_input_returns_validation_error(client, params):
    response = client.get("/api/listings", params=params)
    assert response.status_code == 422
    assert response.json()["detail"]


def test_unknown_city_is_empty_success(client):
    response = client.get("/api/listings", params={"city": "Atlantis"})
    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "total": 0,
        "page": 1,
        "pageSize": 5,
        "totalPages": 0,
    }


def test_pagination_boundaries_and_no_duplicates(client):
    pages = [
        client.get("/api/listings", params={"page": page}).json()
        for page in range(1, 5)
    ]
    assert [len(page["items"]) for page in pages] == [5, 5, 2, 0]
    assert all(page["total"] == 12 and page["totalPages"] == 3 for page in pages)
    identities = [
        (item["source"], item["id"]) for page in pages for item in page["items"]
    ]
    assert len(set(identities)) == 12


def test_cities(client):
    response = client.get("/api/cities")
    assert response.status_code == 200
    assert response.json() == [
        "Chantilly",
        "Fairfax",
        "Manassas",
        "Reston",
        "Springfield",
        "Vienna",
    ]


def test_scoring_formula(listing):
    assert relevance_score(listing, 500000, TODAY) == pytest.approx(100)
    older = listing.model_copy(update={"listed_date": TODAY - timedelta(days=30)})
    assert relevance_score(older, 500000, TODAY) == pytest.approx(85)
    assert relevance_score(older, None, TODAY) == pytest.approx(50)
    expensive = listing.model_copy(update={"price": 1000000})
    assert relevance_score(expensive, 500000, TODAY) == pytest.approx(30)
    future = listing.model_copy(update={"listed_date": TODAY + timedelta(days=1)})
    assert relevance_score(future, None, TODAY) == pytest.approx(100)


def test_ties_are_stable_and_ids_are_unique_per_source(listing):
    records = [
        listing.model_copy(update={"source": "MLS_B"}),
        listing.model_copy(update={"id": "2"}),
        listing,
    ]
    params = SearchParams(page_size=2)
    result = search_listings(records, params, TODAY)
    assert [(item.source, item.id) for item in result.items] == [
        ("MLS_A", "1"),
        ("MLS_A", "2"),
    ]
    assert result == search_listings(list(reversed(records)), params, TODAY)
    assert result.total == 3


def test_filters_are_inclusive_and_keyword_only_searches_description(listing):
    params = SearchParams(min_price=500000, max_price=500000, min_bedrooms=3)
    assert search_listings([listing], params, TODAY).total == 1
    assert search_listings([listing], SearchParams(keyword="Main St"), TODAY).total == 0
    assert (
        search_listings([listing], SearchParams(city=" ", keyword=" "), TODAY).total
        == 1
    )
