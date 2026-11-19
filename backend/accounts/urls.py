from django.urls import path

from . import views

urlpatterns = [
    path("register/", views.register),
    path("verify-signup/", views.verify_signup),
    path("login/", views.login),
    path("verify-login/", views.verify_login),
    path("resend-otp/", views.resend_otp),
    path("forgot-password/", views.forgot_password),
    path("reset-password/", views.reset_password),
    path("me/", views.me),
    path("change-password/", views.change_password),
    path("logout/", views.logout),
]
