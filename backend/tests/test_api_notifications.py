from app.services import notifications


def test_notifications_requires_authentication(client):
    assert client.get("/api/v1/notifications").status_code == 401
    assert client.get("/api/v1/audit").status_code == 401


def test_notifications_flow(auth_client):
    notification = notifications.create_notification(
        severity="info", title="Test notification", message="détail", source="tests"
    )

    response = auth_client.get("/api/v1/notifications")

    assert response.status_code == 200
    body = response.json()
    assert body["unread"] >= 1
    assert any(item["id"] == notification.id for item in body["items"])

    marked = auth_client.patch(f"/api/v1/notifications/{notification.id}/read")

    assert marked.status_code == 200
    assert marked.json()["read_at"] is not None

    assert auth_client.post("/api/v1/notifications/read-all").status_code == 200
    assert auth_client.get("/api/v1/notifications").json()["unread"] == 0


def test_mark_unknown_notification(auth_client):
    assert auth_client.patch("/api/v1/notifications/999999/read").status_code == 404


def test_notification_events_stream_once(auth_client):
    notification = notifications.create_notification(severity="warning", title="Alerte test")

    with auth_client.stream(
        "GET", f"/api/v1/notifications/events?after={notification.id - 1}&once=true"
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        body = "".join(response.iter_text())

    assert '{"ready": true}' in body
    assert f'"id": {notification.id}' in body
    assert "Alerte test" in body


def test_audit_lists_login(auth_client):
    response = auth_client.get("/api/v1/audit")

    assert response.status_code == 200
    events = response.json()
    assert any(
        event["action"] == "login" and event["username"] == "admin" and event["status"] == "success"
        for event in events
    )
