from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """Server-side Supabase client authenticated with the service role key.

    Bypasses RLS — this app enforces access control in the API layer
    (see app/auth.py), not by relying on the client's own permissions.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
