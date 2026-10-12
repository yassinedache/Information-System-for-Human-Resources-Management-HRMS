from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .rules import RuleError


def exception_handler(exc, context):
    """Business-rule violations become 400 responses with a stable code the frontend translates."""
    if isinstance(exc, RuleError):
        return Response({"detail": exc.message.format(**exc.params), "code": exc.code, "field": exc.field,
                         "params": exc.params}, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(exc, ProtectedError):
        return Response({"detail": "This item is still used elsewhere and cannot be deleted.", "code": "protected"},
                        status=status.HTTP_400_BAD_REQUEST)
    return drf_exception_handler(exc, context)
