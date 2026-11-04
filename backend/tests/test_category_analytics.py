from decimal import Decimal

import pytest

from app.models.transaction import TransactionType
from tests.factories import auth_headers, make_category, make_transaction, make_user

CREDIT, DEBIT, REFUND = TransactionType.CREDIT, TransactionType.DEBIT, TransactionType.REFUND


def get_json(client, user, path, **params):
    response = client.get(path, params=params, headers=auth_headers(user))
    assert response.status_code == 200, response.text
    return response.json()


def totals_by_name(rows):
    return {row["category_name"]: row["total"] for row in rows}


def test_spending_nets_refunds_and_hides_categories_at_or_below_zero(client, db_session):
    user = make_user(db_session)
    shopping = make_category(db_session, user, "Shopping")
    gadgets = make_category(db_session, user, "Gadgets")
    gifts = make_category(db_session, user, "Gifts")
    make_transaction(db_session, user, DEBIT, "1000.00", at="2026-09-01 12:00", category=shopping)
    make_transaction(db_session, user, REFUND, "300.00", at="2026-09-05 12:00", category=shopping)
    make_transaction(db_session, user, DEBIT, "500.00", at="2026-08-01 12:00", category=gadgets)
    make_transaction(db_session, user, REFUND, "500.00", at="2026-09-01 12:00", category=gadgets)   # nets to 0
    make_transaction(db_session, user, REFUND, "50.00", at="2026-09-01 12:00", category=gifts)      # nets below 0

    spending = get_json(client, user, "/analytics/spending-by-category")

    assert totals_by_name(spending) == {"Shopping": "700.00"}


def test_income_counts_only_credits(client, db_session):
    user = make_user(db_session)
    salary = make_category(db_session, user, "Salary")
    shopping = make_category(db_session, user, "Shopping")
    make_transaction(db_session, user, CREDIT, "5000.00", at="2026-09-01 12:00", category=salary)
    make_transaction(db_session, user, DEBIT, "1000.00", at="2026-09-01 12:00", category=shopping)
    make_transaction(db_session, user, REFUND, "300.00", at="2026-09-05 12:00", category=shopping)

    income = get_json(client, user, "/analytics/income-by-category")

    assert totals_by_name(income) == {"Salary": "5000.00"}


def test_ties_are_ordered_by_name_then_id(client, db_session):
    user = make_user(db_session)
    for name in ["Zeta", "Alpha", "Food"]:
        make_transaction(db_session, user, DEBIT, "500.00", at="2026-09-01 12:00",
                         category=make_category(db_session, user, name))
    make_transaction(db_session, user, DEBIT, "900.00", at="2026-09-01 12:00",
                     category=make_category(db_session, user, "Rent2"))

    spending = get_json(client, user, "/analytics/spending-by-category")

    assert [row["category_name"] for row in spending] == ["Rent2", "Alpha", "Food", "Zeta"]


def test_month_filter_uses_ist_month_edges(client, db_session, freeze_now):
    freeze_now("2026-11-03 18:00")
    user = make_user(db_session)
    food = make_category(db_session, user, "Food")
    salary = make_category(db_session, user, "Salary")
    make_transaction(db_session, user, DEBIT, "111.00", at="2026-09-30 23:30", category=food)    # September in IST
    make_transaction(db_session, user, DEBIT, "222.00", at="2026-10-01 00:30", category=food)    # Sep 30 19:00 UTC
    make_transaction(db_session, user, DEBIT, "333.00", at="2026-10-31 23:59:59.999999", category=food)
    make_transaction(db_session, user, DEBIT, "444.00", at="2026-11-01 00:00", category=food)
    make_transaction(db_session, user, CREDIT, "500.00", at="2026-10-01 00:30", category=salary)
    make_transaction(db_session, user, CREDIT, "900.00", at="2026-09-30 23:30", category=salary)

    spending = get_json(client, user, "/analytics/spending-by-category", year=2026, month=10)
    income = get_json(client, user, "/analytics/income-by-category", year=2026, month=10)

    assert totals_by_name(spending) == {"Food": "555.00"}
    assert totals_by_name(income) == {"Salary": "500.00"}


def test_month_filter_keeps_categories_below_zero_but_drops_zero(client, db_session, freeze_now):
    # Headphones bought in September and returned in October: October's Shopping is
    # really -800. All-time hides it as a data entry error; one month must not
    freeze_now("2026-11-03 18:00")
    user = make_user(db_session)
    shopping = make_category(db_session, user, "Shopping")
    gadgets = make_category(db_session, user, "Gadgets")
    food = make_category(db_session, user, "Food")
    make_transaction(db_session, user, DEBIT, "800.00", at="2026-09-20 12:00", category=shopping)
    make_transaction(db_session, user, REFUND, "800.00", at="2026-10-05 12:00", category=shopping)
    make_transaction(db_session, user, DEBIT, "500.00", at="2026-10-08 12:00", category=gadgets)
    make_transaction(db_session, user, REFUND, "500.00", at="2026-10-09 12:00", category=gadgets)   # nets to 0
    make_transaction(db_session, user, DEBIT, "300.00", at="2026-10-10 12:00", category=food)

    spending = get_json(client, user, "/analytics/spending-by-category", year=2026, month=10)

    assert [(row["category_name"], row["total"]) for row in spending] == [("Food", "300.00"), ("Shopping", "-800.00")]


def test_month_categories_add_up_to_the_summary(client, db_session, freeze_now):
    freeze_now("2026-11-03 18:00")
    user = make_user(db_session)
    shopping = make_category(db_session, user, "Shopping")
    food = make_category(db_session, user, "Food")
    salary = make_category(db_session, user, "Salary")
    make_transaction(db_session, user, DEBIT, "4999.00", at="2026-09-09 14:20", category=shopping)
    make_transaction(db_session, user, REFUND, "4999.00", at="2026-10-16 11:05", category=shopping)
    make_transaction(db_session, user, DEBIT, "1990.00", at="2026-10-16 19:00", category=food)
    make_transaction(db_session, user, CREDIT, "85000.00", at="2026-10-01 09:05", category=salary)

    params = {"year": 2026, "month": 10}
    spending = get_json(client, user, "/analytics/spending-by-category", **params)
    income = get_json(client, user, "/analytics/income-by-category", **params)
    summary = get_json(client, user, "/transactions/summary", **params)

    assert sum(Decimal(row["total"]) for row in spending) == Decimal(summary["total_spent"])
    assert sum(Decimal(row["total"]) for row in income) == Decimal(summary["total_earned"])


def test_no_month_is_still_all_time(client, db_session, freeze_now):
    freeze_now("2026-11-03 18:00")
    user = make_user(db_session)
    food = make_category(db_session, user, "Food")
    make_transaction(db_session, user, DEBIT, "100.00", at="2025-01-15 12:00", category=food)
    make_transaction(db_session, user, DEBIT, "200.00", at="2026-10-15 12:00", category=food)

    spending = get_json(client, user, "/analytics/spending-by-category")

    assert totals_by_name(spending) == {"Food": "300.00"}


@pytest.mark.parametrize("path", ["/analytics/spending-by-category", "/analytics/income-by-category"])
@pytest.mark.parametrize(
    "params",
    [
        {"year": 2026, "month": 12},           # after the frozen current month
        {"year": 2026},                        # year without month
        {"month": 9},                          # month without year
        {"year": 2019, "month": 12},           # before the 2020 floor
        {"year": 2026, "month": 13},
    ],
)
def test_invalid_month_is_rejected_with_422(client, db_session, freeze_now, path, params):
    freeze_now("2026-11-03 18:00")
    user = make_user(db_session)

    response = client.get(path, params=params, headers=auth_headers(user))

    assert response.status_code == 422, response.text
