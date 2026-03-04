# ml-serving/src/models/acceptance_predictor.py
import xgboost as xgb
import redis
import feast
from pydantic import BaseModel
from typing import List, Dict
import numpy as np

class DriverFeatures(BaseModel):
    driver_id: str
    current_location: tuple  # (lat, lng)
    time_of_day: int  # minutos desde meia-noite
    day_of_week: int  # 0-6
    weather_condition: str
    local_demand_index: float
    driver_historical_features: Dict

class AcceptancePredictor:
    def __init__(self):
        self.model = xgb.Booster()
        self.model.load_model('models/acceptance_v2.xgb')
        self.feature_store = feast.FeatureStore(repo_path='feature_repo')
        self.redis = redis.Redis.from_url(os.getenv('REDIS_URL'))
        
        # Feature importance aprendido
        self.feature_names = [
            'driver_rating', 'driver_completion_rate', 'driver_response_time_avg',
            'time_since_last_ride', 'earnings_today', 'earnings_this_week',
            'distance_to_pickup', 'eta_to_pickup', 'pickup_zone_demand',
            'dropoff_zone_demand', 'surge_multiplier', 'ride_estimated_value',
            'weather_score', 'traffic_factor', 'day_of_week', 'hour',
            'driver_fatigue_score', 'customer_rating', 'ride_distance',
            'historical_acceptance_this_route', 'device_battery_level',
            'network_quality', 'app_version_score'
        ]
    
    async def predict_acceptance_probability(
        self, 
        driver: DriverFeatures, 
        ride_request: Dict
    ) -> float:
        """
        Prediz probabilidade de aceitação (0-1)
        Latência alvo: <5ms p99
        """
        
        # 1. Fetch real-time features (cache local)
        real_time_features = await self._get_realtime_features(driver.driver_id)
        
        # 2. Fetch pre-computed batch features
        batch_features = self.feature_store.get_online_features(
            feature_refs=[
                "driver_stats:avg_daily_rides",
                "driver_stats:preferred_areas",
                "driver_stats:cancellation_rate_7d",
                "market_conditions:zone_demand_index"
            ],
            entity_rows=[{"driver_id": driver.driver_id}]
        ).to_dict()
        
        # 3. Compute on-demand features
        on_demand_features = self._compute_features(driver, ride_request)
        
        # 4. Merge all features
        feature_vector = self._build_feature_vector(
            real_time_features, 
            batch_features, 
            on_demand_features
        )
        
        # 5. Predict
        dmatrix = xgb.DMatrix([feature_vector], feature_names=self.feature_names)
        probability = self.model.predict(dmatrix)[0]
        
        # 6. Calibração (evitar overconfidence)
        calibrated_prob = self._calibrate(probability)
        
        return float(calibrated_prob)
    
    def _compute_features(self, driver: DriverFeatures, ride: Dict) -> Dict:
        """Features computadas em tempo real"""
        
        # Feature de fadiga (motorista trabalhando muito?)
        hours_online_today = self._get_hours_online(driver.driver_id)
        fatigue_score = min(1.0, hours_online_today / 12)  # Normaliza em 12h
        
        # Feature de rota familiar
        route_key = f"{ride['pickup_zone']}:{ride['dropoff_zone']}"
        familiar_routes = self.redis.hget(
            f"driver:{driver.driver_id}:routes", 
            route_key
        ) or 0
        
        return {
            'driver_fatigue_score': fatigue_score,
            'familiar_route_count': int(familiar_routes),
            'battery_impact': 1.0 if driver.driver_historical_features.get('battery', 100) > 20 else 0.7
        }
    
    def _calibrate(self, raw_prob: float) -> float:
        """Calibração de Platt scaling para evitar overconfidence"""
        # Ajusta baseado em performance real do modelo
        return 1 / (1 + np.exp(-(raw_prob - 0.1) * 1.2))