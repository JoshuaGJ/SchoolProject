from django.urls import path
from api.views import HistoricalPriceAnalyticsView, CropListView, MarketPriceSearchAPIView

urlpatterns = [
    path('crops/', CropListView.as_view(), name='crop-list'),
    path('prices/analytics/', HistoricalPriceAnalyticsView.as_view(), name='price-analytics'),
    path('prices/search/', MarketPriceSearchAPIView.as_view(), name='market-price-search'),
]