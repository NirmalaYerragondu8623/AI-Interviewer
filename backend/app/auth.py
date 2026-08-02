from fastapi import Header, HTTPException, status

from app.supabase_client import get_supabase


def require_user(authorization: str | None = Header(default=None)) -> dict:
    """Validates the Supabase session JWT sent by the frontend.

    Every candidate- and admin-facing endpoint sits behind this — the
    interview link is not enough on its own, per the project's auth
    requirement that candidates log in via Supabase Auth.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    try:
        response = get_supabase().auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session") from exc

    if not response or not response.user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")

    return {"id": response.user.id, "email": response.user.email}
