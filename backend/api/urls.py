from django.urls import path
from api.views import HistoricalPriceAnalyticsView, CropListView, MarketPriceSearchAPIView, RegisterUserView, TogglePinCropView, AgentMarketActionView
from  rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
urlpatterns = [
    path('crops/', CropListView.as_view(), name='crop-list'),
    path('prices/analytics/', HistoricalPriceAnalyticsView.as_view(), name='price-analytics'),
    path('prices/search/', MarketPriceSearchAPIView.as_view(), name='market-price-search'),
    # Auth & Customization Routes
    path('auth/register/', RegisterUserView.as_view(), name='auth-register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'), # Returns JWT Access Token
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('user/pin-crop/', TogglePinCropView.as_view(), name='user-pin-crop'),
    path('agent/market-action/', AgentMarketActionView.as_view(), name='agent-market-action'),
]