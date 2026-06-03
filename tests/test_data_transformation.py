import tempfile
import unittest
from pathlib import Path

import pandas as pd

from mlProject.components.data_transformation import DataTransformation
from mlProject.entity.config_entity import DataTransformationConfig


class DataTransformationSplitTest(unittest.TestCase):
    def test_train_test_split_is_deterministic_and_stratified(self):
        with tempfile.TemporaryDirectory() as tmp:
            root_dir = Path(tmp)
            data_path = root_dir / "wine.csv"
            rows = []
            for quality in (5, 6):
                for index in range(20):
                    rows.append(
                        {
                            "fixed acidity": index,
                            "volatile acidity": index / 10,
                            "quality": quality,
                        }
                    )
            pd.DataFrame(rows).to_csv(data_path, index=False)

            config = DataTransformationConfig(
                root_dir=root_dir,
                data_path=data_path,
                test_size=0.25,
                random_state=42,
                stratify_column="quality",
            )

            DataTransformation(config).train_test_spliting()
            first_train = pd.read_csv(root_dir / "train.csv")
            first_test = pd.read_csv(root_dir / "test.csv")

            DataTransformation(config).train_test_spliting()
            second_train = pd.read_csv(root_dir / "train.csv")
            second_test = pd.read_csv(root_dir / "test.csv")

            pd.testing.assert_frame_equal(first_train, second_train)
            pd.testing.assert_frame_equal(first_test, second_test)
            self.assertEqual(len(first_train), 30)
            self.assertEqual(len(first_test), 10)
            self.assertEqual(first_test["quality"].value_counts().to_dict(), {5: 5, 6: 5})


if __name__ == "__main__":
    unittest.main()
