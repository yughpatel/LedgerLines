import pytest

from tests.factories import auth_headers, make_category, make_user


def create(client, db_session, user, transaction_date):
    return client.post(
        "/transactions",
        json={
            "type": "DEBIT",
            "amount": "10.00",
            "category_id": make_category(db_session, user).id,
            "transaction_date": transaction_date,
        },
        headers=auth_headers(user),
    )


@pytest.mark.parametrize(
    "transaction_date",
    [
        "2020-01-01T00:00:00+05:30",   # the floor itself
        "2020-01-01T00:30:00+05:30",   # 19:00 UTC on Dec 31, rejected while the floor was UTC midnight
        "2019-12-31T18:30:00+00:00",   # the same floor instant written in UTC
    ],
)
def test_first_moments_of_2020_in_ist_are_accepted(client, db_session, transaction_date):
    user = make_user(db_session)

    response = create(client, db_session, user, transaction_date)

    assert response.status_code == 201, response.text


def test_last_moment_of_2019_in_ist_is_rejected(client, db_session):
    user = make_user(db_session)

    response = create(client, db_session, user, "2019-12-31T23:59:59+05:30")

    assert response.status_code == 422
    assert "2020-01-01" in response.text
