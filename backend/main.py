import json
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, Query, Request

from models import Listing, SearchParams, SearchResponse
from search import search_listings

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "sample_listings.json"
# Reuse the development server's logger so INFO messages appear in the terminal.
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate the supplied data once at startup, independent of terminal location.
    with DATA_PATH.open() as file:
        app.state.listings = [Listing.model_validate(row) for row in json.load(file)]
    yield


app = FastAPI(title="Listing Search API", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/listings", response_model=SearchResponse)
def listings(request: Request, params: Annotated[SearchParams, Query()]):
    result = search_listings(
        request.app.state.listings, params, datetime.now(UTC).date()
    )
    logger.info(
        "Listing search: %s matches, returning %s items on page %s (page size %s)",
        result.total,
        len(result.items),
        result.page,
        result.page_size,
    )
    return result


@app.get("/api/cities", response_model=list[str])
def cities(request: Request):
    names = {
        listing.city.strip().casefold(): listing.city.strip()
        for listing in request.app.state.listings
    }
    return sorted(names.values(), key=str.casefold)
