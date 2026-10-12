from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView


def user_payload(user):
    emp = user.employee
    return {
        "id": user.id, "email": user.email, "first_name": user.first_name, "last_name": user.last_name,
        "role": "hr" if user.is_hr else "employee", "must_change_password": user.must_change_password,
        "employee": None if emp is None else {
            "id": emp.id, "first_name": emp.first_name, "last_name": emp.last_name, "position": emp.position,
            "service": emp.service.name if emp.service_id else None,
        },
    }


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    """Sets the csrftoken cookie; the frontend sends the token back in the X-CSRFToken header."""
    return Response({"csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")   # DRF exempts anonymous requests from CSRF; logging in must not be
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        password = str(request.data.get("password", ""))
        user = authenticate(request, username=email, password=password)
        if user is None:
            return Response({"detail": "Invalid email or password.", "code": "invalid_credentials"},
                            status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        return Response({**user_payload(user), "csrfToken": get_token(request)})


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)
    return Response({"ok": True, "csrfToken": get_token(request)})


@api_view(["GET"])
@permission_classes([AllowAny])
def me(request):
    """The logged-in user, or null for a visitor."""
    if not request.user.is_authenticated:
        return JsonResponse(None, safe=False)
    return Response(user_payload(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    if not user.check_password(str(request.data.get("old_password", ""))):
        return Response({"detail": "Wrong password.", "code": "wrong_password", "field": "old_password"},
                        status=status.HTTP_400_BAD_REQUEST)
    new = str(request.data.get("new_password", ""))
    try:
        validate_password(new, user)
    except ValidationError as e:
        return Response({"new_password": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(new)
    user.must_change_password = False
    user.save()
    update_session_auth_hash(request, user)
    return Response({"ok": True, "csrfToken": get_token(request)})
