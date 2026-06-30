from rest_framework import serializers
from .models import Market, Crop, PriceRecord, AgentProfile, UserPreference
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class MarketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Market
        fields = ["id", "name", "region_location", "village"]
        read_only_fields = ["id"]


class CropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crop
        fields = ["id", "name", "category"]
        read_only_fields = ["id"]


class PriceRecordSerializer(serializers.ModelSerializer):
    market = MarketSerializer(read_only=True)
    market_id = serializers.PrimaryKeyRelatedField(
        queryset=Market.objects.all(), source="market", write_only=True
    )

    crop = CropSerializer(read_only=True)
    crop_id = serializers.PrimaryKeyRelatedField(
        queryset=Crop.objects.all(), source="crop", write_only=True
    )

    class Meta:
        model = PriceRecord
        fields = [
            "id",
            "market",
            "market_id",
            "crop",
            "crop_id",
            "wholesale_price",
            "retail_price",
            "timestamp",
        ]
        read_only_fields = ["id", "timestamp"]


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    is_agent = serializers.BooleanField(write_only=True, default=False)
    assigned_region = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")
    farmer_location = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'is_agent', 'assigned_region', 'farmer_location']

    def create(self, validated_data):
        # 1. Strip the custom agent data completely away from the User data fields
        is_agent = validated_data.pop('is_agent', False)
        assigned_region = validated_data.pop('assigned_region', "")
        farmer_location = validated_data.pop('farmer_location', "")
        
        # 2. Extract clean auth credentials
        username = validated_data['username']
        email = validated_data.get('email', '')
        password = validated_data['password']
        
        # 3. Create the clean baseline User instance safely
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        pref, _ = UserPreference.objects.get_or_create(user=user)
        if farmer_location:
            pref.location = farmer_location.strip()
            pref.save(update_fields=['location'])
        
        # 4. Use the custom fields to build our separate AgentProfile relational row
        if is_agent and assigned_region:
            AgentProfile.objects.create(user=user, assigned_region=assigned_region.strip())
            
        return user
    
    #User preference / pinned Crops
class UserPreferenceSerializer(serializers.ModelSerializer):
    pinned_crops = CropSerializer(many=True, read_only=True)

    class Meta:
        model = UserPreference
        fields = ['location', 'pinned_crops']


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = serializers.EmailField()

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('Unable to log in with the provided email and password.')

        authenticated_user = authenticate(username=user.username, password=password)
        if not authenticated_user:
            raise serializers.ValidationError('Unable to log in with the provided email and password.')

        refresh = self.get_token(authenticated_user)

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }

 
@receiver(post_save, sender=User)
def create_user_preference(sender, instance, created, **kwargs):
    if created: 
        UserPreference.objects.create(user=instance)