from flask import Flask, render_template, request, jsonify
import os
import numpy as np
import pandas as pd
from mlProject.pipeline.prediction import PredictionPipeline
from mlProject.config.configuration import ConfigurationManager
from mlProject.constants import ENV_FLASK_PORT, ENV_FLASK_DEBUG, ENV_TAG
from mlProject.utils.common import load_env_file, get_env_or_config
from pathlib import Path
import subprocess
import threading
import sys

load_env_file()

app = Flask(__name__)

training_lock = threading.Lock()
is_training = False
training_log = []


def validate_config_at_startup():
    """Validate all required configs are present before starting the server."""
    required_configs = [
        ("config/config.yaml", "Main configuration file"),
        ("params.yaml", "Parameters file"),
        ("schema.yaml", "Schema file"),
    ]
    missing = []
    for path, desc in required_configs:
        if not Path(path).exists():
            missing.append(f"{desc} ({path})")
    if missing:
        print(f"ERROR: Missing required configuration files: {', '.join(missing)}")
        sys.exit(1)
    print(f"Configuration validation passed. Environment: {os.environ.get(ENV_TAG, 'development')}")


def run_training_in_background():
    """Run training in background so web app doesn't freeze"""
    global is_training, training_log
    training_log = []

    try:
        training_log.append("Training started...")
        result = subprocess.run(
            ["python", "main.py"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            training_log.append("Training completed successfully!")
            training_log.append(result.stdout)
        else:
            training_log.append("Training failed!")
            training_log.append(result.stderr or result.stdout)
    except Exception as e:
        training_log.append(f"Training error: {e}")
    finally:
        is_training = False

def ensure_model_trained():
    """Auto-train model if it doesn't exist"""
    try:
        config_manager = ConfigurationManager()
        eval_config = config_manager.get_model_evaluation_config()
        model_path = eval_config.model_path
    except Exception:
        model_path = Path('artifacts/model_trainer/model.joblib')
    if not model_path.exists():
        print("Model not found. Starting automatic training...")
        try:
            os.system("python main.py")
            print("Auto-training completed!")
        except Exception as e:
            print(f"Auto-training failed: {e}")
    else:
        print("Model already exists, ready for predictions!")

@app.route('/', methods=['GET'])
def homePage():
    return render_template("index.html")

@app.route('/train', methods=['GET'])
def training():
    global is_training, training_log

    # If already training, don't start another one
    if is_training:
        return render_template(
            "train_status.html",
            training_success=None,
            training_log="Training is already in progress! Please wait..."
        )

    # Set the flag and start training in background
    is_training = True
    training_log = []
    thread = threading.Thread(target=run_training_in_background)
    thread.start()

    return render_template(
        "train_status.html",
        training_success=True,
        training_log="Training started in background! Check /train/status for updates."
    )

@app.route('/train/status', methods=['GET'])
def training_status():
    """Check if training is still running"""
    global is_training, training_log
    return jsonify({
        "is_training": is_training,
        "log": training_log
    })

@app.route('/predict', methods=['POST', 'GET'])
def index():
    if request.method == 'POST':
        try:
            fixed_acidity = float(request.form['fixed_acidity'])
            volatile_acidity = float(request.form['volatile_acidity'])
            citric_acid = float(request.form['citric_acid'])
            residual_sugar = float(request.form['residual_sugar'])
            chlorides = float(request.form['chlorides'])
            free_sulfur_dioxide = float(request.form['free_sulfur_dioxide'])
            total_sulfur_dioxide = float(request.form['total_sulfur_dioxide'])
            density = float(request.form['density'])
            pH = float(request.form['pH'])
            sulphates = float(request.form['sulphates'])
            alcohol = float(request.form['alcohol'])
       
            data_list = [fixed_acidity, volatile_acidity, citric_acid, residual_sugar, 
                         chlorides, free_sulfur_dioxide, total_sulfur_dioxide, density, pH, sulphates, alcohol]
                    
            data = np.array(data_list).reshape(1, 11)
            obj = PredictionPipeline()
            predict = obj.predict(data)

            final_prediction = round(float(predict[0]), 2)

            return render_template('results.html', prediction=final_prediction)

        except Exception as e:
            print('The Exception message is: ', e) 
            return render_template('results.html', error_msg="Unable to compute prediction. Please ensure all fields are filled with valid numbers.")

    else:
        return render_template('index.html')


if __name__ == "__main__":
    print("Starting Wine Quality Prediction App...")
    validate_config_at_startup()
    ensure_model_trained()
    port = int(get_env_or_config(ENV_FLASK_PORT, "8080", transform=int))
    debug = get_env_or_config(ENV_FLASK_DEBUG, "false").lower() in ("1", "true")
    app.run(host="0.0.0.0", port=port, debug=debug)