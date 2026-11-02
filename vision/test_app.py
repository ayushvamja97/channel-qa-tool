"""Boundary tests and real pretrained-CNN smoke test, not a screenshot accuracy benchmark."""
import io
import os
import unittest

os.environ["VISION_SERVICE_TOKEN"] = "synthetic-local-test-token"
os.environ.pop("CLASSIFIER_PATH", None)
from fastapi.testclient import TestClient
from PIL import Image
from app import app, decode_image


def png(color):
    data = io.BytesIO()
    Image.new("RGB", (320, 240), color).save(data, format="PNG")
    return data.getvalue()


class VisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context = TestClient(app)
        cls.client = cls.context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None, None, None)

    def test_authentication(self):
        self.assertEqual(self.client.post("/analyze", content=png("red")).status_code, 401)

    def test_invalid_image(self):
        response = self.client.post("/analyze", content=b"not an image", headers={"Authorization": "Bearer synthetic-local-test-token"})
        self.assertEqual(response.status_code, 400)

    def test_oversized_body(self):
        response = self.client.post("/analyze", content=b"x" * (5 * 1024 * 1024 + 1), headers={"Authorization": "Bearer synthetic-local-test-token"})
        self.assertEqual(response.status_code, 413)

    def test_pretrained_features_are_repeatable_and_normalized(self):
        headers = {"Authorization": "Bearer synthetic-local-test-token"}
        first = self.client.post("/analyze", content=png("navy"), headers=headers)
        self.assertEqual(first.status_code, 200)
        a = first.json()
        b = self.client.post("/analyze", content=png("navy"), headers=headers).json()
        self.assertEqual(len(a["vector"]), 576)
        self.assertAlmostEqual(sum(x * x for x in a["vector"]), 1, places=5)
        self.assertEqual(a["vector"], b["vector"])
        self.assertIsNone(a["category"])
        self.assertIsNone(a["confidence"])

    def test_decoder_does_not_trust_filename_or_mime(self):
        with self.assertRaises(ValueError):
            decode_image(b"fake PNG")
        self.assertEqual(decode_image(png("white")).mode, "RGB")


if __name__ == "__main__":
    unittest.main()
