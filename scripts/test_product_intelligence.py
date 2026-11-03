#!/usr/bin/env python3
"""Test VAGE Phase 8 MongoDB product intelligence.

This script checks MongoDB connectivity and indexes, inserts a uniquely tagged
set of synthetic events, runs the same style of aggregation used by the Admin
dashboard, verifies eventId uniqueness, then deletes only its own test records.

It does not access or modify MySQL and never prints the MongoDB URI.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from pymongo import ASCENDING, DESCENDING, MongoClient
    from pymongo.errors import DuplicateKeyError, PyMongoError
except ImportError as exc:
    print("Missing Python dependency. Run: py -m pip install -r requirements-phase8.txt")
    raise SystemExit(2) from exc

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    """Load basic KEY=value entries from .env.local or .env, without echoing values."""
    for filename in (".env.local", ".env"):
        path = ROOT / filename
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def ensure_indexes(collection) -> None:
    indexes = [
        ([("eventId", ASCENDING)], "uq_product_events_event_id", True),
        ([("createdAt", DESCENDING)], "idx_product_events_created_at", False),
        ([("eventType", ASCENDING), ("createdAt", DESCENDING)], "idx_product_events_type_created", False),
        ([("productId", ASCENDING), ("eventType", ASCENDING), ("createdAt", DESCENDING)], "idx_product_events_product_type_created", False),
        ([("categoryId", ASCENDING), ("createdAt", DESCENDING)], "idx_product_events_category_created", False),
        ([("searchTerm", ASCENDING), ("createdAt", DESCENDING)], "idx_product_events_search_created", False),
        ([("visitorKey", ASCENDING), ("createdAt", DESCENDING)], "idx_product_events_visitor_created", False),
    ]
    for keys, name, unique in indexes:
        collection.create_index(keys, name=name, unique=unique)


def build_events(run_id: str, now: datetime) -> list[dict]:
    visitor_a = "guest:test-" + run_id + "-a"
    visitor_b = "guest:test-" + run_id + "-b"
    category_id, product_a, product_b = 990000001, 990000011, 990000012
    base = {
        "testRunId": run_id,
        "anonymousId": str(uuid.uuid4()),
        "sessionId": str(uuid.uuid4()),
        "userId": None,
    }

    def event(suffix: str, kind: str, visitor: str, **fields) -> dict:
        return {
            **base,
            **fields,
            "eventId": "phase8-" + run_id + "-" + suffix,
            "eventType": kind,
            "visitorKey": visitor,
            "createdAt": now - timedelta(minutes=len(suffix)),
        }

    return [
        event("01", "PRODUCT_VIEW", visitor_a, productId=product_a, productName="Phase 8 Test Tee", categoryId=category_id, categoryName="Phase 8 Test Category"),
        event("02", "PRODUCT_VIEW", visitor_b, productId=product_a, productName="Phase 8 Test Tee", categoryId=category_id, categoryName="Phase 8 Test Category"),
        event("03", "ADD_TO_CART", visitor_a, productId=product_a, productName="Phase 8 Test Tee", categoryId=category_id, categoryName="Phase 8 Test Category", quantity=2),
        event("04", "PRODUCT_VIEW", visitor_b, productId=product_b, productName="Phase 8 Test Hoodie", categoryId=category_id, categoryName="Phase 8 Test Category"),
        event("05", "ADD_TO_CART", visitor_b, productId=product_b, productName="Phase 8 Test Hoodie", categoryId=category_id, categoryName="Phase 8 Test Category", quantity=1),
        event("06", "SEARCH", visitor_a, searchTerm="phase 8 test"),
        event("07", "CATEGORY_BROWSE", visitor_b, categoryId=category_id, categoryName="Phase 8 Test Category"),
        event("08", "PRODUCT_LIST_VIEW", visitor_a, categoryId=category_id, categoryName="Phase 8 Test Category"),
        event("09", "CART_VIEW", visitor_a, itemCount=3),
        event("10", "REMOVE_FROM_CART", visitor_a, productId=product_a, productName="Phase 8 Test Tee", categoryId=category_id, categoryName="Phase 8 Test Category", quantity=1),
        event("11", "CART_QUANTITY_UPDATE", visitor_b, productId=product_b, productName="Phase 8 Test Hoodie", categoryId=category_id, categoryName="Phase 8 Test Category", quantity=2),
    ]


def check_aggregations(collection, run_id: str) -> dict:
    match = {"testRunId": run_id}

    summary_rows = list(collection.aggregate([
        {"$match": match},
        {"$group": {
            "_id": None,
            "totalEvents": {"$sum": 1},
            "visitors": {"$addToSet": "$visitorKey"},
            "productViews": {"$sum": {"$cond": [{"$eq": ["$eventType", "PRODUCT_VIEW"]}, 1, 0]}},
            "searches": {"$sum": {"$cond": [{"$eq": ["$eventType", "SEARCH"]}, 1, 0]}},
            "addToCart": {"$sum": {"$cond": [{"$eq": ["$eventType", "ADD_TO_CART"]}, 1, 0]}},
        }},
        {"$project": {
            "_id": 0,
            "totalEvents": 1,
            "uniqueVisitors": {"$size": "$visitors"},
            "productViews": 1,
            "searches": 1,
            "addToCart": 1,
        }},
    ]))
    assert summary_rows, "Summary aggregation returned no row."
    summary = summary_rows[0]

    popular = list(collection.aggregate([
        {"$match": {**match, "eventType": {"$in": ["PRODUCT_VIEW", "ADD_TO_CART"]}}},
        {"$sort": {"createdAt": 1}},
        {"$group": {
            "_id": "$productId",
            "productName": {"$last": "$productName"},
            "views": {"$sum": {"$cond": [{"$eq": ["$eventType", "PRODUCT_VIEW"]}, 1, 0]}},
            "addToCart": {"$sum": {"$cond": [{"$eq": ["$eventType", "ADD_TO_CART"]}, 1, 0]}},
            "unitsAdded": {"$sum": {"$cond": [{"$eq": ["$eventType", "ADD_TO_CART"]}, {"$ifNull": ["$quantity", 0]}, 0]}},
        }},
        {"$sort": {"addToCart": -1, "views": -1}},
    ]))
    assert len(popular) == 2, "Popular-product aggregation should return two products."
    assert popular[0]["productName"] == "Phase 8 Test Tee", "Popular product ranking is unexpected."
    assert popular[0]["views"] == 2 and popular[0]["addToCart"] == 1 and popular[0]["unitsAdded"] == 2

    categories = list(collection.aggregate([
        {"$match": {**match, "categoryId": {"$type": "number"}}},
        {"$group": {
            "_id": "$categoryId",
            "categoryName": {"$last": "$categoryName"},
            "productViews": {"$sum": {"$cond": [{"$eq": ["$eventType", "PRODUCT_VIEW"]}, 1, 0]}},
            "addToCart": {"$sum": {"$cond": [{"$eq": ["$eventType", "ADD_TO_CART"]}, 1, 0]}},
        }},
    ]))
    assert len(categories) == 1 and categories[0]["productViews"] == 3 and categories[0]["addToCart"] == 2

    searches = list(collection.aggregate([
        {"$match": {**match, "eventType": "SEARCH"}},
        {"$group": {"_id": "$searchTerm", "searches": {"$sum": 1}}},
    ]))
    assert len(searches) == 1 and searches[0]["_id"] == "phase 8 test" and searches[0]["searches"] == 1

    event_mix = list(collection.aggregate([
        {"$match": match},
        {"$group": {"_id": "$eventType", "count": {"$sum": 1}}},
    ]))
    assert len(event_mix) == 8, "Expected all eight supported event types."
    return summary


def main() -> int:
    load_env()
    uri = os.getenv("MONGODB_URI", "").strip()
    if not uri or "replace_with" in uri.lower() or "your_mongodb_uri" in uri.lower():
        print("MONGODB_URI is missing. Add a MongoDB Atlas/local URI to .env.local.")
        return 2

    database = os.getenv("MONGODB_DATABASE", "vage_product_intelligence")
    client = MongoClient(uri, serverSelectionTimeoutMS=8000, connectTimeoutMS=8000)
    run_id = str(uuid.uuid4())
    collection = client[database]["product_events"]

    try:
        client.admin.command("ping")
        print("MongoDB ping: OK")
        print("Database:", database)
        ensure_indexes(collection)

        required = {
            "uq_product_events_event_id",
            "idx_product_events_created_at",
            "idx_product_events_type_created",
            "idx_product_events_product_type_created",
            "idx_product_events_category_created",
            "idx_product_events_search_created",
            "idx_product_events_visitor_created",
        }
        actual = {item["name"] for item in collection.list_indexes()}
        missing = required - actual
        assert not missing, "Missing indexes: " + ", ".join(sorted(missing))
        print("Indexes: OK (" + str(len(required)) + ")")

        docs = build_events(run_id, datetime.now(timezone.utc))
        collection.insert_many(docs, ordered=True)
        print("Synthetic events inserted:", len(docs))

        summary = check_aggregations(collection, run_id)
        assert summary["totalEvents"] == 11
        assert summary["uniqueVisitors"] == 2
        assert summary["productViews"] == 3 and summary["searches"] == 1 and summary["addToCart"] == 2
        print("Summary aggregation: OK")
        print("Popular products aggregation: OK")
        print("Category trends aggregation: OK")
        print("Top searches aggregation: OK")
        print("Event type aggregation: OK")

        try:
            collection.insert_one(dict(docs[0]))
            raise AssertionError("Duplicate eventId was unexpectedly accepted.")
        except DuplicateKeyError:
            print("eventId deduplication: OK")

        print("Test summary:", {
            key: summary[key]
            for key in ("totalEvents", "uniqueVisitors", "productViews", "searches", "addToCart")
        })
        print("Phase 8 MongoDB checks: PASSED")
        return 0
    except (AssertionError, PyMongoError) as error:
        print("Phase 8 MongoDB checks: FAILED")
        print(str(error))
        return 1
    finally:
        deleted = collection.delete_many({"testRunId": run_id}).deleted_count
        client.close()
        print("Temporary test records cleaned up:", deleted)


if __name__ == "__main__":
    raise SystemExit(main())
