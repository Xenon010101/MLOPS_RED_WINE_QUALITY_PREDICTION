import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from mlProject.config.configuration import ConfigurationManager
from mlProject.utils.common import load_env_file

class PredictionPipeline:
    def __init__(self, model_path: Path = None):
        self.model = None
        self._model_path = model_path
        if model_path is None:
            load_env_file()
            try:
                config_manager = ConfigurationManager()
                registry_config = config_manager.get_model_registry_config()
                self._model_path = registry_config.registry_path.parent / "model.joblib"
                if not self._model_path.exists():
                    model_eval_config = config_manager.get_model_evaluation_config()
                    self._model_path = model_eval_config.model_path
            except Exception:
                self._model_path = Path('artifacts/model_trainer/model.joblib')

    def predict(self, data):
        if self.model is None:
            model_path = self._model_path or Path('artifacts/model_trainer/model.joblib')
            self.model = joblib.load(model_path)
        
        prediction = self.model.predict(data)
        return prediction