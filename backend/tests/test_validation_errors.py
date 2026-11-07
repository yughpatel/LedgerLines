import pytest

PASSWORD = "MySecretPass1"


@pytest.mark.parametrize(
    ("path", "body"),
    [
        # Fails the complexity rule (no special character)
        ("/auth/signup", {"email": "leak@example.com", "password": PASSWORD}),
        # Fails max_length=72
        ("/auth/login", {"email": "leak@example.com", "password": PASSWORD * 7}),
    ],
)
def test_rejected_password_is_never_echoed_back(client, path, body):
    response = client.post(path, json=body)

    assert response.status_code == 422, response.text
    assert PASSWORD not in response.text
    for error in response.json()["detail"]:
        assert set(error) <= {"type", "loc", "msg"}


def test_validation_errors_still_say_what_is_wrong(client):
    response = client.post("/auth/signup", json={"email": "leak@example.com", "password": PASSWORD})

    [error] = response.json()["detail"]
    assert error["loc"] == ["body", "password"]
    assert "special character" in error["msg"]
