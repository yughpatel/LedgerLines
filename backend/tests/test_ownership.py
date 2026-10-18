from app.models.transaction import TransactionType
from tests.factories import auth_headers, make_transaction, make_user

CREDIT, DEBIT = TransactionType.CREDIT, TransactionType.DEBIT


def test_analytics_and_summary_never_include_another_users_rows(client, db_session, freeze_now):
    freeze_now("2026-10-15 12:00")
    alice = make_user(db_session)
    bob = make_user(db_session)
    make_transaction(db_session, alice, DEBIT, "100.00", at="2026-10-05 12:00")
    make_transaction(db_session, alice, CREDIT, "1000.00", at="2026-10-05 12:00")
    # Distinctive amounts, so any leak shows up in Alice's totals
    make_transaction(db_session, bob, DEBIT, "7777.00", at="2026-10-05 12:00")
    make_transaction(db_session, bob, CREDIT, "8888.00", at="2026-10-05 12:00")
    headers = auth_headers(alice)

    summary = client.get("/transactions/summary", headers=headers).json()
    trend = client.get("/analytics/trend", params={"year": 2026, "month": 10}, headers=headers).json()
    spending = client.get("/analytics/spending-by-category", headers=headers).json()
    income = client.get("/analytics/income-by-category", headers=headers).json()

    assert (summary["total_spent"], summary["total_earned"]) == ("100.00", "1000.00")
    assert trend[4] == {"start": "2026-10-05", "end": "2026-10-06", "income": "1000.00", "spending": "100.00"}
    assert [row["total"] for row in spending] == ["100.00"]
    assert [row["total"] for row in income] == ["1000.00"]


def test_another_users_transaction_is_404_not_403(client, db_session):
    alice = make_user(db_session)
    bob = make_user(db_session)
    bobs = make_transaction(db_session, bob, DEBIT, "10.00", at="2026-10-05 12:00")

    response = client.get(f"/transactions/{bobs.id}", headers=auth_headers(alice))

    assert response.status_code == 404
