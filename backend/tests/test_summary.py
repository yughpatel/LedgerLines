from decimal import Decimal

from app.models.transaction import TransactionType
from tests.factories import auth_headers, make_category, make_transaction, make_user

CREDIT, DEBIT, REFUND = TransactionType.CREDIT, TransactionType.DEBIT, TransactionType.REFUND


def get_summary(client, user):
    response = client.get("/transactions/summary", headers=auth_headers(user))
    assert response.status_code == 200, response.text
    body = response.json()
    # Compared as Decimals: an empty sum is served as "0", a non-empty one as "0.00"
    for key in ("total_earned", "total_spent", "net"):
        body[key] = Decimal(body[key])
    return body


def test_month_edges_are_ist_midnights(client, db_session, freeze_now):
    freeze_now("2026-10-15 12:00")
    user = make_user(db_session)
    make_transaction(db_session, user, DEBIT, "111.00", at="2026-09-30 23:30")  # September in IST
    make_transaction(db_session, user, DEBIT, "222.00", at="2026-10-01 00:30")  # Sep 30 19:00 UTC
    make_transaction(db_session, user, DEBIT, "333.00", at="2026-10-31 23:59:59.999999")
    make_transaction(db_session, user, DEBIT, "444.00", at="2026-11-01 00:00")
    make_transaction(db_session, user, CREDIT, "1000.00", at="2026-10-10 12:00")

    summary = get_summary(client, user)

    assert summary == {
        "year": 2026,
        "month": 10,
        "total_earned": Decimal("1000.00"),
        "total_spent": Decimal("555.00"),
        "net": Decimal("445.00"),
    }


def test_month_is_taken_from_the_ist_date_not_the_server_date(client, db_session, freeze_now):
    # 20:00 UTC on Oct 31 is already Nov 1 in IST, so "this month" is November
    freeze_now("2026-11-01 01:30")
    user = make_user(db_session)
    make_transaction(db_session, user, DEBIT, "50.00", at="2026-10-31 12:00")
    make_transaction(db_session, user, DEBIT, "60.00", at="2026-11-01 00:30")

    summary = get_summary(client, user)

    assert (summary["year"], summary["month"]) == (2026, 11)
    assert summary["total_spent"] == Decimal("60.00")


def test_december_rolls_over_to_january_of_the_next_year(client, db_session, freeze_now):
    freeze_now("2025-12-15 12:00")
    user = make_user(db_session)
    make_transaction(db_session, user, DEBIT, "75.00", at="2025-12-31 23:59:59.999999")
    make_transaction(db_session, user, DEBIT, "99.00", at="2026-01-01 00:00")

    summary = get_summary(client, user)

    assert (summary["year"], summary["month"]) == (2025, 12)
    assert summary["total_spent"] == Decimal("75.00")


def test_empty_month_is_all_zero(client, db_session, freeze_now):
    freeze_now("2026-10-15 12:00")
    user = make_user(db_session)

    assert get_summary(client, user) == {"year": 2026, "month": 10, "total_earned": 0, "total_spent": 0, "net": 0}


def test_refund_in_a_later_month_makes_spending_negative(client, db_session, freeze_now):
    freeze_now("2026-10-15 12:00")
    user = make_user(db_session)
    make_transaction(db_session, user, DEBIT, "800.00", at="2026-09-20 12:00")
    make_transaction(db_session, user, REFUND, "800.00", at="2026-10-05 12:00")
    make_transaction(db_session, user, CREDIT, "100.00", at="2026-10-06 12:00")

    summary = get_summary(client, user)

    # Not clamped to 0: net still equals earned - spent
    assert summary["total_spent"] == Decimal("-800.00")
    assert summary["total_earned"] == Decimal("100.00")
    assert summary["net"] == Decimal("900.00")


def test_refund_without_any_purchase_is_accepted(client, db_session, freeze_now):
    # Intended behavior for v1: unlinked refunds are accepted on purpose, so a refund of
    # the maximum amount with no purchase makes spending negative. If refunds are ever
    # linked to a purchase (ROADMAP, Later: refund_of_id), this test should change
    freeze_now("2026-10-15 12:00")
    user = make_user(db_session)

    # Through the API, to show validation doesn't block it either
    response = client.post(
        "/transactions",
        json={
            "type": "REFUND",
            "amount": "500000.00",
            "category_id": make_category(db_session, user).id,
            "transaction_date": "2026-10-10T12:00:00+05:30",
        },
        headers=auth_headers(user),
    )

    assert response.status_code == 201, response.text
    assert get_summary(client, user)["total_spent"] == Decimal("-500000.00")
