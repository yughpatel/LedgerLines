from app.models.transaction import TransactionType
from tests.factories import auth_headers, make_category, make_transaction, make_user

CREDIT, DEBIT, REFUND = TransactionType.CREDIT, TransactionType.DEBIT, TransactionType.REFUND


def get_json(client, user, path):
    response = client.get(path, headers=auth_headers(user))
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
