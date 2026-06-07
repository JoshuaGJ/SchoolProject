from django.urls import path
from .views import trigger_scrape

urlpatterns = [
    path('scrape/', trigger_scrape, name='trigger-scrape'),
]
