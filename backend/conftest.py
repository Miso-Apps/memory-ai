"""Shared pytest configuration for the Memory AI backend.

Disables email verification in all integration tests so that
POST /auth/register returns tokens immediately (as before), while
the production application keeps EMAIL_VERIFICATION_ENABLED=true.
"""
import pytest
from app.config import settings


@pytest.fixture(autouse=True)
def disable_email_verification_for_tests():
    """Override EMAIL_VERIFICATION_ENABLED to False for every test.

    Tests exercise application logic, not the email-delivery pipeline.
    Email delivery is covered separately by unit-testing email_service.py.
    """
    original = settings.EMAIL_VERIFICATION_ENABLED
    settings.EMAIL_VERIFICATION_ENABLED = False
    yield
    settings.EMAIL_VERIFICATION_ENABLED = original
