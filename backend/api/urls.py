from django.urls import path
from api.views import AnalyticsOverviewView, HistoricalPriceAnalyticsView, CropListView,UserProfileView, MarketPriceSearchAPIView, RegisterUserView, TogglePinCropView, UserFavoritesView, AgentMarketActionView, EmailLoginView
from  rest_framework_simplejwt.views import TokenRefreshView
urlpatterns = [
    path('crops/', CropListView.as_view(), name='crop-list'),
    path('analytics/', AnalyticsOverviewView.as_view(), name='analytics-overview'),
    path('prices/analytics/', HistoricalPriceAnalyticsView.as_view(), name='price-analytics'),
    path('prices/search/', MarketPriceSearchAPIView.as_view(), name='market-price-search'),
    # Auth & Customization Routes
    path('auth/register/', RegisterUserView.as_view(), name='auth-register'),
    path('auth/login/', EmailLoginView.as_view(), name='token_obtain_pair'), # Returns JWT Access Token
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('user/pin-crop/', TogglePinCropView.as_view(), name='user-pin-crop'),
    path('user/favorites/', UserFavoritesView.as_view(), name='user-favorites'),
    path('agent/market-action/', AgentMarketActionView.as_view(), name='agent-market-action'),
    path('auth/user-profile/', UserProfileView.as_view(), name='user-profile'),
    
]