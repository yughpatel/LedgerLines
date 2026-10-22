import uuid

# The rest of the suite signs tokens directly with auth_headers(); this file is the one
# place the real signup and login path (hashing, rate limiter, refresh cookie) is covered.
# The client fixture resets the limiter, so each test starts with a fresh 2/minute budget


def test_signup_then_login_then_me(client):
    email = f"login-{uuid.uuid4().hex[:8]}@example.com"
    password = "Str0ng!pass"

    signup = client.post("/auth/signup", json={"email": email, "password": password})
    login = client.post("/auth/login", json={"email": email, "password": password})

    assert signup.status_code == 201, signup.text
    assert login.status_code == 200, login.text
    assert "refresh_token" in login.cookies
    token = login.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert "hashed_password" not in me.json()


def test_login_with_wrong_password_is_401(client):
    email = f"wrong-{uuid.uuid4().hex[:8]}@example.com"
    signup = client.post("/auth/signup", json={"email": email, "password": "Str0ng!pass"})

    response = client.post("/auth/login", json={"email": email, "password": "Wr0ng!pass"})

    # Without this, a failed or rate-limited signup would also give 401 and pass for the wrong reason
    assert signup.status_code == 201, signup.text
    assert response.status_code == 401


def test_third_signup_in_a_minute_is_rate_limited(client):
    # Proves the limiter is enforced, and (passing in any test order) that the fixture's
    # reset is what keeps other tests' signups from counting here
    statuses = [
        client.post("/auth/signup", json={"email": f"rl-{uuid.uuid4().hex[:8]}@example.com", "password": "Str0ng!pass"}).status_code
        for _ in range(3)
    ]

    assert statuses == [201, 201, 429]
