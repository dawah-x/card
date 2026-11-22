"""Automated test suite for DAWAH X AI Model, Guardrails & FastAPI Server."""

from __future__ import annotations

from pathlib import Path
import unittest

from dawahx_ai import DAWAHX_SITE_URL
from dawahx_ai.model import DawahXAIModel
from dawahx_ai.normalizer import (
    detect_conversational_intent,
    fold_bn,
    stem_bn,
    translate_banglish_and_english,
)
from dawahx_ai.synthesizer import synthesize_response


CACHE_DIR = Path(__file__).resolve().parent.parent / ".cache"


class TestDawahXAI(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.model = DawahXAIModel(CACHE_DIR)
        cls.model.load_or_train()

    def test_orthographic_folding_and_stemming(self) -> None:
        self.assertEqual(fold_bn("হাদীছ"), fold_bn("হাদিস"))
        self.assertEqual(fold_bn("ছালাত"), fold_bn("সালাত"))
        self.assertEqual(fold_bn("ছিয়াম"), fold_bn("সিয়াম"))
        self.assertEqual(stem_bn(fold_bn("মসজিদের")), fold_bn("মসজিদ"))

    def test_banglish_and_english_expansion(self) -> None:
        expanded, mapped = translate_banglish_and_english("namaz e sahu sijda dewar niyom")
        self.assertTrue(len(mapped) >= 2)
        self.assertIn("সালাত", expanded)
        self.assertIn("সাহু", expanded)

    def test_greeting_intent(self) -> None:
        self.assertEqual(detect_conversational_intent("আসসালামু আলাইকুম"), "greeting")
        self.assertIsNone(detect_conversational_intent("আল্লাহ কে এবং তাঁর অস্তিত্বের প্রমাণ কী?"))

    def test_direct_fatwa_retrieval_and_citation(self) -> None:
        q = "মসজিদের সিঁড়ির নিচে ইমাম ও মুয়াজ্জিনের ঘর করা যাবে কি?"
        ret = self.model.retrieve(q, top_k=5)
        ans = synthesize_response(q, ret, self.model.summary)
        self.assertEqual(ans["status"], "answered")
        self.assertIn("বাধা নেই", ans["direct_answer"])
        self.assertTrue(ans["primary_url"].startswith(f"{DAWAHX_SITE_URL}/read.html?k="))
        self.assertGreaterEqual(len(ans["sources"]), 1)

    def test_aqeedah_and_dawah_question(self) -> None:
        q = "যাদের কাছে ইসলামের দাওয়াত পৌঁছায়নি তাদের বিচার কীভাবে হবে?"
        ret = self.model.retrieve(q, top_k=5)
        ans = synthesize_response(q, ret, self.model.summary)
        self.assertEqual(ans["status"], "answered")
        self.assertGreater(len(ans["direct_answer"]), 80)
        self.assertTrue(any(s["dawahx_url"].startswith(DAWAHX_SITE_URL) for s in ans["sources"]))

    def test_strict_out_of_domain_abstention(self) -> None:
        q = "পাইথন ডিপ লার্নিং জিপিইউ ক্লাস্টার সেটআপ করার কোড দাও"
        ret = self.model.retrieve(q, top_k=5)
        ans = synthesize_response(q, ret, self.model.summary)
        self.assertEqual(ans["status"], "not_found")
        self.assertEqual(len(ans["videos"]), 0)


if __name__ == "__main__":
    unittest.main()
