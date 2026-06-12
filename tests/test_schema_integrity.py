import os
import yaml
import pytest

def test_schema_configuration_file_metadata():
    """verify layout structural attributes for schema configuration mapping"""
    target_schema = "schema.yaml"
    
    # verify tracking path 
    assert os.path.exists(target_schema), f"target configuration object data mapping asset missing: {target_schema}"
    
    # safely parse serialization strings to capture syntax exceptions
    with open(target_schema, "r") as stream:
        try:
            parsed_payload = yaml.safe_load(stream)
        except yaml.YAMLError as error_instance:
            pytest.fail(f"fatal syntax parsing exception detected within schema metrics block: {error_instance}")
            
    assert parsed_payload is not None, "target validation data payload returned an empty block state"
    
    # verify the exact columns 
    assert "COLUMNS" in parsed_payload, "expected 'COLUMNS' block header not found in schema.yaml"
    active_features = parsed_payload["COLUMNS"]
    
    # evaluate required baseline
    assert isinstance(active_features, dict), "extracted validation feature properties configuration block must resolve as a map layout"
    assert len(active_features.keys()) > 0, "no operational configuration properties detected within the feature map validation schema"

