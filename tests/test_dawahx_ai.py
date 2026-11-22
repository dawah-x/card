"""Automated test suite for DAWAH X AI Model, Guardrails & FastAPI Server."""

from __future__ import annotations

from pathlib import Path
import unittest

from dawahx_ai import DAWAHX_SITE_URL
from dawahx_ai.dialogue import augment_query_with_history, build_conversational_opening, handle_dialogue_turn
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

    def test_natural_everyday_dialogue_and_memory(self) -> None:
        summary = {"total_documents": 24207, "total_videos": 9310}
        r_intro = handle_dialogue_turn("আমার নাম ইব্রাহিম", summary, history=[])
        self.assertIsNotNone(r_intro)
        self.assertIn("ইব্রাহিম", r_intro["direct_answer"])

        hist = [{"role": "user", "text": "আমার নাম ইব্রাহিম"}]
        r_how = handle_dialogue_turn("কেমন আছো তুমি?", summary, history=hist)
        self.assertIsNotNone(r_how)
        self.assertIn("আলহামদুলিল্লাহ", r_how["direct_answer"])

        r_eat = handle_dialogue_turn("ভাত খাইছো?", summary, history=hist)
        self.assertIsNotNone(r_eat)
        self.assertIn("ইব্রাহিম", r_eat["direct_answer"])

        r_sad = handle_dialogue_turn("আজকে মনটা খুব খারাপ", summary, history=hist)
        self.assertIsNotNone(r_sad)
        self.assertEqual(r_sad["status"], "conversational")

        # Real Islamic question must NOT be intercepted as small talk
        self.assertIsNone(handle_dialogue_turn("আসসালামু আলাইকুম, রোজা অবস্থায় ইনজেকশন নিলে কি রোজা ভাঙে?", summary, history=hist))
        opening = build_conversational_opening("আসসালামু আলাইকুম, রোজায় ইনজেকশন নিলে কি রোজা ভাঙে?", "fatwa", "মাসিক আত-তাহরীক")
        self.assertIn("ওয়া আলাইকুমুস সালাম", opening)

        # Multi-turn follow-up augmentation
        hist_with_ans = [
            {
                "role": "assistant",
                "primary_title": "রোযা অবস্থায় ইনজেকশন নিলে রোযা ভঙ্গ হবে কি?",
                "extra_body": "প্রথম অনুচ্ছেদ।\n\nদ্বিতীয় অনুচ্ছেদ বিস্তারিত ব্যাখ্যা।",
                "evidences": [{"text": "হাদীস দলিল", "source_name": "আত-তাহরীক", "dawahx_url": DAWAHX_SITE_URL}],
            }
        ]
        aug_q, used = augment_query_with_history("আর স্যালাইন নিলে?", history=hist_with_ans)
        self.assertTrue(used)
        self.assertIn("ইনজেকসন", aug_q)

        elab = handle_dialogue_turn("আরেকটু বিস্তারিত বলো", summary, history=hist_with_ans)
        self.assertIsNotNone(elab)
        self.assertGreaterEqual(len(elab["explanation_paragraphs"]), 1)

    def test_v3_everyday_banglish_and_utilities(self) -> None:
        # Everyday Banglish retrieval (clean token replacement without unmapped Latin noise)
        q_bg = "namaj e mon bose na ki korbo?"
        ret = self.model.retrieve(q_bg, top_k=5)
        ans = synthesize_response(q_bg, ret, self.model.summary)
        self.assertEqual(ans["status"], "answered")

        # Zakat calculator & district prayer schedule
        summary = {"total_documents": 24207, "total_videos": 9310}
        z_res = handle_dialogue_turn("৫ লক্ষ টাকায় কত টাকা যাকাত দিতে হবে?", summary)
        self.assertIsNotNone(z_res)
        self.assertIn("১২,৫০০", z_res["direct_answer"])

        p_res = handle_dialogue_turn("চট্টগ্রামে ইফতার কয়টায়?", summary)
        self.assertIsNotNone(p_res)
        self.assertIn("চট্টগ্রাম", p_res["direct_answer"])

        # English & Bengali secular OOD queries stay strictly not_found
        ood_en = self.model.retrieve("python deep learning gpu cluster setup code", top_k=5)
        ans_en = synthesize_response("python deep learning gpu cluster setup code", ood_en, self.model.summary)
        self.assertEqual(ans_en["status"], "not_found")

        ood_bn = self.model.retrieve("ঢাকা থেকে কক্সবাজার ট্রেনের টিকেট ভাড়া কত?", top_k=5)
        ans_bn = synthesize_response("ঢাকা থেকে কক্সবাজার ট্রেনের টিকেট ভাড়া কত?", ood_bn, self.model.summary)
        self.assertEqual(ans_bn["status"], "not_found")

    def test_v5_inflected_banglish_salam_and_complete_verdict(self) -> None:
        # 1) Inflected Banglish (-e locative) + stretched vowel handling
        q1 = "namaje vul hole ki korbo?"
        r1 = synthesize_response(q1, self.model.retrieve(q1, top_k=5), self.model.summary)
        self.assertEqual(r1["status"], "answered")
        self.assertFalse(r1["direct_answer"].rstrip().endswith((":", "ঃ")))
        self.assertGreaterEqual(len(r1["direct_answer"]), 60)

        # 2) 'সালাম' preserved as core Islamic topic in "অমুসলিমকে সালাম দেওয়া যাবে কি?"
        q2 = "অমুসলিমকে সালাম দেওয়া যাবে কি?"
        r2 = synthesize_response(q2, self.model.retrieve(q2, top_k=5), self.model.summary)
        self.assertEqual(r2["status"], "answered")
        self.assertIn("সালাম", r2["headline"] + " " + r2["direct_answer"])

        # 3) No dangling-colon short direct_answer on Sahu Sajdah
        q3 = "সিজদায়ে সাহু দেওয়ার নিয়ম কি?"
        r3 = synthesize_response(q3, self.model.retrieve(q3, top_k=5), self.model.summary)
        self.assertEqual(r3["status"], "answered")
        self.assertFalse(r3["direct_answer"].rstrip().endswith((":", "ঃ")))
        self.assertGreaterEqual(len(r3["direct_answer"]), 85)

        # 4) Granular single-publication source_filter ('at')
        ret_at = self.model.retrieve("ওযু ভাঙ্গার কারণ কি?", top_k=5, source_filter="at")
        self.assertTrue(len(ret_at["candidates"]) >= 1)
        self.assertTrue(all(c["source_code"] == "at" for c in ret_at["candidates"]))


if __name__ == "__main__":
    unittest.main()
