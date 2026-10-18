import uuid

# The rest of the suite signs tokens directly with auth_headers(); this file is the one
# place the real signup and login path (hashing, rate limiter, refresh cookie) is covered.
# Signup is limited to 2/minute per process, so a third signup here would get a 429


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
