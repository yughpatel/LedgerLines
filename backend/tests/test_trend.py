from datetime import datetime, timezone

import pytest

from app.models.transaction import TransactionType
from tests.factories import auth_headers, make_transaction, make_user

CREDIT, DEBIT, REFUND = TransactionType.CREDIT, TransactionType.DEBIT, TransactionType.REFUND


def get_trend(client, user, year, month, bucket="day"):
    response = client.get(
        "/analytics/trend",
        params={"year": year, "month": month, "bucket": bucket},
        headers=auth_headers(user),
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_transaction_at_0030_ist_on_the_1st_counts_in_the_new_month(client, db_session):
    # 00:30 IST on Sep 1 is 19:00 UTC on Aug 31, so UTC bucketing would put it in August
    user = make_user(db_session)
    make_transaction(db_session, user, DEBIT, "100.00", at="2026-09-01 00:30")

    september = get_trend(client, user, 2026, 9)
    august = get_trend(client, user, 2026, 8)

    assert september[0] == {"start": "2026-09-01", "end": "2026-09-02", "income": "0.00", "spending": "100.00"}
    assert all(day["spending"] == "0.00" for day in august)


def test_utc_instant_at_ist_midnight_lands_in_october(client, db_session):
    # Built from a hardcoded UTC instant, not REPORTING_TIMEZONE, so this fails if the
    # constant is ever changed to the wrong zone. 18:30 UTC on Sep 30 is 00:00 IST on Oct 1
    user = make_user(db_session)
    make_transaction(
        db_session, user, DEBIT, "100.00",
        at=datetime(2026, 9, 30, 18, 30, tzinfo=timezone.utc),
    )

    october = get_trend(client, user, 2026, 10)
    september = get_trend(client, user, 2026, 9)

    assert october[0]["start"] == "2026-10-01"
    assert october[0]["spending"] == "100.00"
    assert september[-1]["spending"] == "0.00"


def test_last_microsecond_of_the_month_stays_in_that_month(client, db_session):
    # Half-open range: < next month's IST midnight, so nothing is lost before 00:00
    user = make_user(db_session)
    make_transaction(db_session, user, DEBIT, "10.00", at="2026-09-30 23:59:59.999999")
    make_transaction(db_session, user, DEBIT, "20.00", at="2026-10-01 00:00:00")

    september = get_trend(client, user, 2026, 9)
    october = get_trend(client, user, 2026, 10)

    assert september[-1] == {"start": "2026-09-30", "end": "2026-10-01", "income": "0.00", "spending": "10.00"}
    assert october[0]["spending"] == "20.00"


@pytest.mark.parametrize("bucket, expected_count", [("day", 31), ("week", 5)])
def test_empty_month_returns_every_bucket_with_zeros(client, db_session, bucket, expected_count):
    user = make_user(db_session)

    july = get_trend(client, user, 2026, 7, bucket)

    assert len(july) == expected_count
    assert all(b["income"] == "0.00" and b["spending"] == "0.00" for b in july)


def test_week_buckets_start_on_monday_and_are_clipped_to_the_month(client, db_session):
    # Sep 1 2026 is a Tuesday: the first week (Mon Aug 31) is clipped to start on the 1st,
    # and the last (Mon Sep 28) is clipped to end on Oct 1
    user = make_user(db_session)
    make_transaction(db_session, user, DEBIT, "100.00", at="2026-09-01 00:30")
    make_transaction(db_session, user, DEBIT, "40.10", at="2026-09-07 00:00")

    weeks = get_trend(client, user, 2026, 9, "week")

    assert [(w["start"], w["end"]) for w in weeks] == [
        ("2026-09-01", "2026-09-07"),
        ("2026-09-07", "2026-09-14"),
        ("2026-09-14", "2026-09-21"),
        ("2026-09-21", "2026-09-28"),
        ("2026-09-28", "2026-10-01"),
    ]
    assert weeks[0]["spending"] == "100.00"
    assert weeks[1]["spending"] == "40.10"


def test_december_rolls_over_to_january_of_the_next_year(client, db_session):
    user = make_user(db_session)
    make_transaction(db_session, user, DEBIT, "75.00", at="2025-12-31 23:59:59.999999")
    make_transaction(db_session, user, DEBIT, "99.00", at="2026-01-01 00:00:00")

    december = get_trend(client, user, 2025, 12)
    december_weeks = get_trend(client, user, 2025, 12, "week")

    assert len(december) == 31
    assert december[-1] == {"start": "2025-12-31", "end": "2026-01-01", "income": "0.00", "spending": "75.00"}
    assert december_weeks[-1]["end"] == "2026-01-01"
    assert sum(float(d["spending"]) for d in december) == 75.0


def test_refund_reduces_spending_and_is_never_income(client, db_session):
    user = make_user(db_session)
    make_transaction(db_session, user, DEBIT, "1000.00", at="2026-09-03 12:00")
    make_transaction(db_session, user, REFUND, "300.00", at="2026-09-03 18:00")
    make_transaction(db_session, user, CREDIT, "500.00", at="2026-09-15 10:00")

    september = get_trend(client, user, 2026, 9)

    assert september[2]["spending"] == "700.00"
    assert september[2]["income"] == "0.00"
    # A credit-only day: SQL sums the else_=0 branch to numeric 0, served as 0.00
    assert september[14] == {"start": "2026-09-15", "end": "2026-09-16", "income": "500.00", "spending": "0.00"}


def test_refund_in_a_later_bucket_than_the_purchase_goes_negative(client, db_session):
    user = make_user(db_session)
    make_transaction(db_session, user, DEBIT, "200.00", at="2026-09-02 12:00")
    make_transaction(db_session, user, REFUND, "200.00", at="2026-09-29 12:00")

    weeks = get_trend(client, user, 2026, 9, "week")

    assert weeks[0]["spending"] == "200.00"
    assert weeks[-1]["spending"] == "-200.00"


def test_defaults_to_the_current_ist_month_with_day_buckets(client, db_session, freeze_now):
    # 23:30 UTC on Oct 31 is already Nov 1 in IST, so the default month is November
    freeze_now("2026-11-01 05:00")
    user = make_user(db_session)

    response = client.get("/analytics/trend", headers=auth_headers(user))

    assert response.status_code == 200
    body = response.json()
    assert body[0]["start"] == "2026-11-01"
    assert len(body) == 30


@pytest.mark.parametrize(
    "params",
    [
        {"year": 2026, "month": 13},
        {"year": 2026, "month": 0},
        {"year": 2026, "month": 12},           # after the frozen current month
        {"year": 2026},                        # year without month
        {"month": 9},                          # month without year
        {"year": 2019, "month": 12},           # before the 2020 floor
        {"year": 2026, "month": 9, "bucket": "month"},
        {"year": 2026, "month": 9, "bucket": "DAY"},
    ],
)
def test_invalid_input_is_rejected_with_422(client, db_session, freeze_now, params):
    freeze_now("2026-10-15 12:00")
    user = make_user(db_session)

    response = client.get("/analytics/trend", params=params, headers=auth_headers(user))

    assert response.status_code == 422, response.text


def test_current_month_in_progress_is_allowed(client, db_session, freeze_now):
    freeze_now("2026-10-15 12:00")
    user = make_user(db_session)

    assert len(get_trend(client, user, 2026, 10)) == 31


def test_requires_authentication(client):
    assert client.get("/analytics/trend").status_code in (401, 403)
