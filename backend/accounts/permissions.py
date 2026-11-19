from rest_framework.permissions import BasePermission

from .models import Profile


def role_of(user):
    if not user or not user.is_authenticated:
        return None
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile.role


class IsBuyer(BasePermission):
    message = "Please login with a buyer account to shop."

    def has_permission(self, request, view):
        return role_of(request.user) == Profile.ROLE_BUYER


class IsSeller(BasePermission):
    message = "Please login with a seller account."

    def has_permission(self, request, view):
        return role_of(request.user) == Profile.ROLE_SELLER


class IsApprovedSeller(BasePermission):
    message = "Your seller account is waiting for admin approval."

    def has_permission(self, request, view):
        return role_of(request.user) == Profile.ROLE_SELLER and request.user.profile.is_approved


class IsApprovedSellerOrReseller(BasePermission):
    """Order screens: approved sellers, and buyers who sell their own resale listings."""
    message = "Please login with a seller account."

    def has_permission(self, request, view):
        role = role_of(request.user)
        return role == Profile.ROLE_BUYER or (role == Profile.ROLE_SELLER and request.user.profile.is_approved)
