"""Natural Bengali, Banglish & English Conversational Dialogue & Multi-Turn Context Engine.

Enables DAWAH X AI to chat naturally like a warm, polite, intelligent human companion
for greetings, small talk, emotional support, gratitude, daily reminders, and multi-turn
follow-ups — while keeping all Islamic rulings 100% grounded in DAWAH X without hallucination.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
from typing import Any, Dict, List, Optional, Tuple

from . import DAWAHX_SITE_URL
from .normalizer import fold_bn, is_core_content_token, tokenize_folded

BN_DIGITS = "০১২৩৪৫৬৭৮৯"
BN_WEEKDAYS = ["সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার", "রবিবার"]
BN_MONTHS = [
    "", "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
]

# Curated authentic Quran & Hadith reminders featured on DAWAH X homepage
DAWAHX_REMINDERS = [
    {
        "arabic": "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا",
        "meaning": "কষ্টের সাথেই স্বস্তি আছে। নিশ্চয়ই কষ্টের সাথেই স্বস্তি আছে।",
        "ref": "সূরা আল-ইনশিরাহ ৯৪:৫–৬",
        "reflection": "জীবনে যত কঠিন সময়ই আসুক, হতাশ হবেন না—আল্লাহ প্রতিশ্রুতি দিয়েছেন যে প্রতিটি কষ্টের পরেই তিনি স্বস্তি ও পথ খুলে দেবেন।",
    },
    {
        "arabic": "قُلۡ يَٰعِبَادِيَ ٱلَّذِينَ أَسْرَفُوا عَلَىٰٓ أَنفُسِهِمۡ لَا تَقۡنَطُوا مِن رَّحۡمَةِ ٱللَّهِ ۚ إِنَّ ٱللَّهَ يَغۡفِرُ ٱلذُّنُوبَ جَمِيعًا",
        "meaning": "বলুন, হে আমার বান্দাগণ! যারা নিজেদের প্রতি অবিচার করেছ, আল্লাহর রহমত থেকে নিরাশ হয়ো না। নিশ্চয় আল্লাহ সকল পাপ ক্ষমা করেন।",
        "ref": "সূরা আয-যুমার ৩৯:৫৩",
        "reflection": "মানুষ মাত্রই ভুল হয়, কিন্তু আন্তরিক তওবা করলে আল্লাহর দয়া সব গুনাহের চেয়ে বড়।",
    },
    {
        "arabic": "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
        "meaning": "তোমাদের মধ্যে সর্বোত্তম সে, যে কুরআন শেখে এবং অন্যকে শেখায়।",
        "ref": "সহীহ আল-বুখারী ৫০২৭",
        "reflection": "প্রতিদিন অল্প হলেও অর্থসহ কুরআন পড়া ও বোঝা অন্তরে অসাধারণ প্রশান্তি আনে।",
    },
    {
        "arabic": "ٱدْعُ إِلَىٰ سَبِيلِ رَبِّكَ بِٱلْحِكْمَةِ وَٱلْمَوْعِظَةِ ٱلْحَسَنَةِ",
        "meaning": "তোমার রবের পথে আহ্বান করো প্রজ্ঞা ও উত্তম উপদেশের মাধ্যমে।",
        "ref": "সূরা আন-নাহল ১৬:১২৫",
        "reflection": "সুন্দর ব্যবহার, ধৈর্য ও প্রজ্ঞাই মানুষের হৃদয়ে সত্য পৌঁছে দেওয়ার সর্বোত্তম মাধ্যম।",
    },
]


def _to_bn_digits(val: Any) -> str:
    return "".join(BN_DIGITS[int(ch)] if ch.isdigit() else ch for ch in str(val))


def _dhaka_now_text() -> str:
    now = datetime.now(timezone(timedelta(hours=6)))
    weekday = BN_WEEKDAYS[now.weekday()]
    hour12 = now.hour % 12 or 12
    period = (
        "ভোর" if 4 <= now.hour < 6 else
        "সকাল" if 6 <= now.hour < 12 else
        "দুপুর" if 12 <= now.hour < 15 else
        "বিকাল" if 15 <= now.hour < 18 else
        "সন্ধ্যা" if 18 <= now.hour < 20 else
        "রাত"
    )
    time_str = _to_bn_digits(f"{hour12}:{now.minute:02d}")
    date_str = f"{_to_bn_digits(now.day)} {BN_MONTHS[now.month]}, {_to_bn_digits(now.year)}"
    return f"এখন বাংলাদেশ সময় **{period} {time_str} মিনিট** — আজ **{weekday}, {date_str}**।"


# Regexes carefully anchored/scoped so genuine Islamic questions still go to DAWAH X retrieval
_SALAM_RE = re.compile(
    r"^\s*(?:আসসালামু\s*আলাইকুম|সালামু?\s*আলাইকুম|সালাম|assalamu\s*alaikum|salam|slm)"
    r"(?:\s+ওয়া\s*রাহমাতুল্লাহ(?:ি\s*ওয়া\s*বারাকাতুহু?)?)?"
    r"(?:\s*[।,!?\-]*\s*(?:ভাই|ভাইয়া|আপা|বন্ধু|তুমি\s*কেমন\s*আছো?|কেমন\s*আছো?(?:\s*তুমি)?|কেমন\s*আছেন(?:\s*আপনি)?|kemon\s*acho|kmn\s*acho))?[।!?.,\s]*$",
    re.IGNORECASE,
)
_HELLO_RE = re.compile(
    r"^\s*(?:হ্যালো|হাই|হেলো|ওহে|এই\s*যে|শুনছো|শুনছেন|hello|hi+|hey+|hlw|yo|সুপ্রভাত|শুভ\s*সকাল|শুভ\s*দুপুর|শুভ\s*বিকাল|শুভ\s*সন্ধ্যা|good\s*morning|good\s*afternoon|good\s*evening)"
    r"(?:\s*[।,!?\-]*\s*(?:ভাই|ভাইয়া|বন্ধু|দোস্ত|কেমন\s*আছো?(?:\s*তুমি)?|কেমন\s*আছেন?))?[।!?.,\s]*$",
    re.IGNORECASE,
)
_HOW_ARE_YOU_RE = re.compile(
    r"^\s*(?:(?:হ্যালো|সালাম|ভাই|ভাইয়া|আচ্ছা|ওহে)\s*,?\s*)?"
    r"(?:তুমি\s+|আপনি\s+)?(?:কেমন\s*আছো?|কেমন\s*আছেন|কেমন\s*আছিস|ক[িী]\s*অবস্থা|ক[িী]\s*খবর|দিনকাল\s*কেমন(?:\s*যাচ্ছে|\s*কাটছে)?|সব\s*ভালো\s*তো|"
    r"kemon\s*acho|kemon\s*aso|kemon\s*achen|ki\s*khobor|ki\s*obostha|how\s*are\s*you|how\s*r\s*u|whats?\s*up)"
    r"(?:\s*(?:তুমি|আপনি|ভাই|ভাইয়া|বন্ধু|বলো|তো|এখন|আজকে?|tumi|apni|bhai|bro))?[।!?.,\s]*$",
    re.IGNORECASE,
)
_USER_GOOD_RE = re.compile(
    r"^\s*(?:আলহামদুলিল্লাহ\s*,?\s*)?(?:আমিও?\s+)?(?:ভালো(?:\s*আছি)?|বেশ\s*ভালো(?:\s*আছি)?|অনেক\s*ভালো(?:\s*আছি)?|সুস্থ\s*আছি|চলে\s*যাচ্ছে|আলহামদুলিল্লাহ|"
    r"alhamdulillah(?:\s*bhalo|\s*valo)?|bhalo\s*achi|valo\s*achi|i\s*am\s*(?:fine|good|great|well)|doing\s*(?:good|well)|fine)[।!?.,\s]*$",
    re.IGNORECASE,
)
_USER_SAD_RE = re.compile(
    r"(?:মন(?:টা)?\s*(?:আজকে?\s*)?(?:খুব\s*|একটু\s*|অনেক\s*|বেশ\s*|বড্ড\s*)?খারাপ|মন\s*ভালো\s*(?:নেই|না)|ভালো\s*লাগছে\s*না|(?:খুব|অনেক|বড্ড)\s*(?:কষ্টে|কষ্ট|হতাশায়|টেনশনে|দুশ্চিন্তায়)\s*(?:আছি|পাচ্ছি|লাগছে)|"
    r"হতাশ\s*লাগছে|একা\s*লাগছে|কান্না\s*পাচ্ছে|ডিপ্রেশনে?\s*আছি|মানসিকভাবে\s*ভেঙে\s*পড়েছি|দুশ্চিন্তা\s*(?:লাগছে|হচ্ছে)|"
    r"mon(?:\s*ta)?\s*(?:ektu\s*|khub\s*)?kharap|valo\s*lagche\s*na|khub\s*koste\s*achi|depressed|feeling\s*(?:sad|down|lonely|anxious)|i\s*am\s*sad)",
    re.IGNORECASE,
)
_WHAT_DOING_RE = re.compile(
    r"^\s*(?:তুমি\s+|আপনি\s+|এখন\s+)?(?:ক[িী]\s*করছো?|ক[িী]\s*করছেন|ক[িী]\s*করো|কাজ\s*করছো\s*ক[িী]|"
    r"ki\s*korcho|ki\s*koro|ki\s*korchen|what\s*are\s*you\s*doing|wyd)[।!?.,\s]*$",
    re.IGNORECASE,
)
_CAN_WE_CHAT_RE = re.compile(
    r"^\s*(?:তুমি\s*কি\s*|আপনি\s*কি\s*)?(?:আমার\s*সাথে\s*)?(?:নরমাল\s*|স্বাভাবিক\s*)?(?:কথা\s*বলতে\s*পারো?|কথাবার্তা\s*বলতে\s*পারো?|"
    r"গল্প\s*করবে|গল্প\s*করতে\s*পারো?|একটু\s*কথা\s*বলি|একটা\s*প্রশ্ন\s*করতে\s*পারি|একটা\s*কথা\s*(?:বলব|জিজ্ঞেস\s*করি|ছিল)|"
    r"আচ্ছা\s*শোনো|ভাই\s*শুনছেন|তুমি\s*কি\s*বাংলা\s*(?:বোঝো|পারো)|"
    r"kotha\s*bolte\s*paro|golpo\s*korbe|ekta\s*proshno\s*kori|can\s*we\s*(?:talk|chat)|can\s*i\s*ask\s*(?:something|a\s*question))[।!?.,\s]*$",
    re.IGNORECASE,
)
_THANKS_RE = re.compile(
    r"^\s*(?:অনেক\s*|অসংখ্য\s*)?(?:ধন্যবাদ|থ্যাংক\s*ইউ|থ্যাংকস|শুকরিয়া|জাযাকাল্লাহ(?:ু\s*খাইরান)?|জাজাকাল্লাহ(?:ু\s*খাইরান)?|বারাকাল্লাহ(?:ু\s*ফিকুম)?|"
    r"dhonnobad|shukriya|jazakallah(?:\s*khair(?:an)?)?|thanks?(?:\s*a\s*lot)?|thank\s*you(?:\s*so\s*much)?|ty|tnx)[।!?.,\s]*$",
    re.IGNORECASE,
)
_PRAISE_RE = re.compile(
    r"^\s*(?:মাশাআল্লাহ|সুবহানাল্লাহ|আলহামদুলিল্লাহ\s*অনেক\s*সুন্দর|খুব\s*সুন্দর(?:\s*বলেছো|\s*হয়েছে)?|অসাধারণ|দারুণ|চমৎকার|"
    r"অনেক\s*ভালো\s*লাগলো|অনেক\s*উপকার\s*হলো|খুব\s*ভালো\s*লেগেছে|"
    r"mashallah|masha\s*allah|subhanallah|khub\s*sundor|awesome|great(?:\s*answer)?|nice|wonderful)[।!?.,\s]*$",
    re.IGNORECASE,
)
_ACK_RE = re.compile(
    r"^\s*(?:আচ্ছা|ও\s*আচ্ছা|ওহ\s*আচ্ছা|হুম+|ঠিক\s*আছে|বুঝলাম|বুঝতে\s*পেরেছি|জি\s*বুঝেছি|হ্যাঁ|জি|ওকে|সহমত|ইনশাআল্লাহ|আমিন|সুম্মা\s*আমিন|"
    r"accha|oh\s*accha|hmm+|ok+|okay|bujhlam|bujhte\s*perechi|thik\s*ache|inshallah|ameen)[।!?.,\s]*$",
    re.IGNORECASE,
)
_FAREWELL_RE = re.compile(
    r"^\s*(?:আল্লাহ\s*হাফেজ|খোদা\s*হাফেজ|ফি\s*আমানিল্লাহ|বিদায়|আসি\s*তাহলে|পরে\s*কথা\s*হবে|ভালো\s*থেকো|ভালো\s*থাকবেন|শুভ\s*রাত্রি|"
    r"allah\s*hafez|fi\s*amanillah|bye+|good\s*bye|good\s*night|tata|see\s*you)[।!?.,\s]*$",
    re.IGNORECASE,
)
_DUA_REQ_RE = re.compile(
    r"^\s*(?:আমার\s*জন্য\s*|আমাদের\s*জন্য\s*)?(?:দোয়া\s*করো?|দোয়া\s*করবেন|দোয়া\s*রেখো|doa\s*koro|dua\s*korben|pray\s*for\s*me)[।!?.,\s]*$",
    re.IGNORECASE,
)
_IDENTITY_RE = re.compile(
    r"^\s*(?:তুমি\s*কে|আপনি\s*কে|তোমার\s*পরিচয়\s*ক[িী]|তোমার\s*নাম\s*ক[িী]|আপনার\s*নাম\s*ক[িী]|কে\s*তৈরি\s*করেছে|তোমাকে\s*কে\s*বানিয়েছে|"
    r"ক[িী]ভাবে\s*কাজ\s*করো?|তুমি\s*ক[িী]\s*ক[িী]\s*করতে\s*পারো?|তুমি\s*কি\s*এআই|তুমি\s*কি\s*চ্যাটজিপিটি|"
    r"tumi\s*ke|tomar\s*nam\s*ki|ke\s*baniyeche|who\s*are\s*you|what\s*is\s*your\s*name|who\s*created\s*you|how\s*do\s*you\s*work)[।!?.,\s]*$",
    re.IGNORECASE,
)
_TIME_DATE_RE = re.compile(
    r"^\s*(?:এখন\s*|আজকে?\s*)?(?:কয়টা\s*বাজে|সময়\s*কত|আজকে?\s*ক[িী]\s*বার|ক[িী]\s*বার\s*আজকে?|আজকের?\s*তারিখ\s*কত|আজ\s*কত\s*তারিখ|কয়\s*তারিখ\s*আজকে?|"
    r"koyta\s*baje|ajke\s*ki\s*bar|aj\s*koto\s*tarikh|what\s*time\s*is\s*it|what\s*day\s*is\s*today|today'?s?\s*date)(?:\s*(?:এখন|আজকে?|বলো(?:\s*তো)?|now))?[।!?.,\s]*$",
    re.IGNORECASE,
)
_EAT_SLEEP_RE = re.compile(
    r"^\s*(?:তুমি\s*ক[িী]\s*)?(?:ভাত\s*(?:খেয়েছো?|খাইছো?|খান)|চা\s*(?:খেয়েছো?|খাইছো?)|নাস্তা\s*(?:করেছো?|করছো?)|"
    r"খাবার\s*খেয়েছো?|ক[িী]\s*খেয়েছো?|ঘুমাও\s*না|তুমি\s*ক[িী]\s*ঘুমাও|তুমি\s*ক[িী]\s*খাও|"
    r"bhat\s*khaicho|vat\s*khaicho|nasta\s*korcho|khawa\s*dawa\s*korcho|have\s*you\s*eaten)[।!?.,\s]*$",
    re.IGNORECASE,
)
_WHERE_LIVE_RE = re.compile(
    r"^\s*(?:তুমি\s*কোথায়\s*থাকো|আপনি\s*কোথায়\s*থাকেন|তোমার\s*বাসা\s*কোথায়|তোমার\s*বাড়ি\s*কোথায়|"
    r"তোমার\s*বয়স\s*কত|তুমি\s*ক[িী]\s*মানুষ\s*(?:না|নাকি)\s*(?:রোবট|এআই)|তুমি\s*ক[িী]\s*রোবট|"
    r"kothay\s*thako|tomar\s*bari\s*kothay|where\s*do\s*you\s*live|how\s*old\s*are\s*you|are\s*you\s*human)[।!?.,\s]*$",
    re.IGNORECASE,
)
_MY_NAME_RE = re.compile(
    r"^\s*(?:আমার\s*নাম\s*(?:হলো\s*|হচ্ছে\s*)?|আমি\s*হলাম\s*|my\s*name\s*is\s+|i\s*am\s+)"
    r"([^\d?!।.,;:\n]{2,28})[।!?.,\s]*$",
    re.IGNORECASE,
)
_STORY_RE = re.compile(
    r"^\s*(?:একটা\s*(?:গল্প|ঘটনা|শিক্ষণীয়\s*গল্প|ইসলামিক\s*গল্প)\s*(?:বলো|বলেন|শোনাও)|"
    r"গল্প\s*বলো|tell\s*me\s*a\s*story|ekta\s*golpo\s*bolo)[।!?.,\s]*$",
    re.IGNORECASE,
)
_LEADING_SALAM_RE = re.compile(
    r"^\s*(?:আসসালামু\s*আলাইকুম|আস-সালামু\s*আলাইকুম|সালাম|assalamu\s*alaikum|salam)(?=\s|[।,!?:;\-]|$)",
    re.IGNORECASE,
)
_INSPIRE_RE = re.compile(
    r"^\s*(?:আমাকে\s*)?(?:একটা\s*|কিছু\s*)?(?:সুন্দর\s*|ভালো\s*|ইসলামিক\s*)?(?:উপদেশ\s*দাও|নসিহত\s*(?:করো|দাও)|হাদ[িী]স\s*(?:বলো|শোনাও)|"
    r"আয়াত\s*(?:বলো|শোনাও)|অনুপ্রেরণা\s*দাও|মন\s*ভালো\s*করার\s*কিছু\s*বলো|give\s*me\s*(?:some\s*)?advice|tell\s*me\s*a\s*hadith)[।!?.,\s]*$",
    re.IGNORECASE,
)

# Multi-turn follow-up commands referencing previous answer
_ELABORATE_RE = re.compile(
    r"^\s*(?:আরেকটু\s*|আরও\s*|একটু\s*)?(?:বিস্তারিত\s*(?:বলো|বলুন|বোঝাও)|সহজ\s*করে\s*(?:বলো|বোঝাও|বুঝিয়ে\s*বলো)|"
    r"পুরোটা\s*(?:বলো|বলুন)|ব্যাখ্যা\s*(?:করো|দাও)|আরও\s*জানতে\s*চাই|আরেকটু\s*বলো|"
    r"aro\s*bolo|bistarito\s*bolo|explain\s*more|tell\s*me\s*more|elaborate)[।!?.,\s]*$",
    re.IGNORECASE,
)
_ASK_DALIL_RE = re.compile(
    r"^\s*(?:এর\s*|এটার\s*|এই\s*বিষয়ের\s*)?(?:দলিল\s*ক[িী]|দলিল\s*দাও|কোন\s*হাদ[িী]সে\s*আছে|কুরআনের?\s*আয়াত\s*(?:ক[িী]|আছে)|রেফারেন্স\s*দাও|প্রমাণ\s*দাও|"
    r"dalil\s*(?:ki|dao)|reference\s*dao|what\s*is\s*the\s*(?:evidence|dalil|proof))[।!?.,\s]*$",
    re.IGNORECASE,
)
_ASK_VIDEO_RE = re.compile(
    r"^\s*(?:এ\s*বিষয়ে\s*|এই\s*নিয়ে\s*|এর\s*)?(?:কোনো?\s*)?(?:ভিডিও\s*আছে|ভিডিও\s*দাও|লেকচার\s*আছে|ওয়াজ\s*আছে|"
    r"video\s*(?:ache|dao)|any\s*video)[।!?.,\s]*$",
    re.IGNORECASE,
)
_ELLIPSIS_FOLLOWUP_START_RE = re.compile(
    r"^\s*(?:আর\s+|তাহলে\s+|তবে\s+|কিন্তু\s+|এতে\s+|এক্ষেত্রে\s+|সেক্ষেত্রে\s+|ওটা\s+|এটা\s+|যদি\s+এমন\s+|নাকি\s+)",
    re.UNICODE,
)


def handle_dialogue_turn(
    query: str,
    summary: Dict[str, Any],
    history: Optional[List[Dict[str, Any]]] = None,
) -> Optional[Dict[str, Any]]:
    """If `query` is a pure conversational turn or direct meta-followup, return a warm natural response."""
    q = (query or "").strip()
    if not q:
        return None

    total_docs = summary.get("total_documents", 24207)
    total_vids = summary.get("total_videos", 9310)
    last_ctx = None
    user_name = None
    if history:
        for item in history:
            if item.get("role") == "user":
                m_hist = _MY_NAME_RE.match((item.get("text") or "").strip())
                if m_hist:
                    cand_name = m_hist.group(1).strip()
                    if len(cand_name.split()) <= 3 and "খারাপ" not in cand_name and "ভালো" not in cand_name:
                        user_name = cand_name
        for item in reversed(history):
            if item.get("role") == "assistant" and item.get("primary_title"):
                last_ctx = item
                break
    name_tag = f", {user_name}" if user_name else ""

    def _chat_payload(
        reply_text: str,
        extra_paras: Optional[List[str]] = None,
        follow_ups: Optional[List[str]] = None,
        evidences: Optional[List[Dict[str, str]]] = None,
        videos: Optional[List[Dict[str, Any]]] = None,
        sources: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        return {
            "status": "conversational",
            "is_chat": True,
            "query": q,
            "headline": "",
            "direct_answer": reply_text,
            "explanation_paragraphs": extra_paras or [],
            "additional_perspectives": [],
            "evidences": evidences or [],
            "sources": sources or [],
            "videos": videos or [],
            "follow_ups": follow_ups or [],
            "confidence": 1.0,
            "latency_ms": 0.6,
            "ask_team_url": f"{DAWAHX_SITE_URL}/ask.html",
        }

    # 1. Salam / Hello
    if _SALAM_RE.match(q):
        return _chat_payload(
            "ওয়া আলাইকুমুস সালাম ওয়া রাহমাতুল্লাহি ওয়া বারাকাতুহু! 😊 কেমন আছেন আপনি?",
            [
                "আপনি আমার সাথে একদম স্বাভাবিকভাবে যেকোনো কথাবার্তা বলতে পারেন, আবার ইসলামিক কোনো মাসআলা বা প্রশ্ন থাকলে সেটিও জিজ্ঞেস করতে পারেন—আমি **DAWAH X**-এর দলিলসহ উত্তর দেব।"
            ],
            follow_ups=[
                "কেমন আছো তুমি?",
                "মন ভালো করার একটা ইসলামিক উপদেশ দাও",
                "সালাতে মনোযোগ বাড়ানোর উপায় কী?",
            ],
        )

    if _HELLO_RE.match(q):
        return _chat_payload(
            "হ্যালো! আসসালামু আলাইকুম। কেমন আছেন আপনি?",
            [
                "আমি **DAWAH X AI**—আপনার সাথে স্বাভাবিক আলাপচারিতা কিংবা কুরআন-সুন্নাহভিত্তিক যেকোনো প্রশ্নের আলোচনায় আছি। আজ কী নিয়ে কথা বলব?"
            ],
            follow_ups=[
                "তুমি কী কী করতে পারো?",
                "একটা সুন্দর হাদীস শোনাও",
                "আল্লাহর অস্তিত্বের প্রমাণ কী?",
            ],
        )

    # 2. How are you
    if _HOW_ARE_YOU_RE.match(q):
        return _chat_payload(
            "আলহামদুলিল্লাহ, আমি বেশ ভালো আছি! আন্তরিকভাবে খোঁজ নেওয়ার জন্য আপনাকে অনেক ধন্যবাদ। আপনি কেমন আছেন? আজকের দিনটা কেমন কাটছে আপনার?",
            follow_ups=[
                "আলহামদুলিল্লাহ, আমিও ভালো আছি",
                "আজকে মনটা একটু খারাপ",
                "একটা সুন্দর ইসলামিক উপদেশ দাও",
            ],
        )

    # 3. User says they are doing well
    if _USER_GOOD_RE.match(q):
        topic_hint = (
            f"আমরা একটু আগে **‘{last_ctx['primary_title']}’** নিয়ে কথা বলছিলাম—চাইলে সে বিষয়ে আরও আলাপ করতে পারি, অথবা নতুন যেকোনো কথা বলতে পারেন!"
            if last_ctx
            else "কোনো বিষয়ে গল্প করতে চাইলে বা ইসলামিক কোনো প্রশ্ন মনে এলে নির্দ্বিধায় বলতে পারেন!"
        )
        return _chat_payload(
            "আলহামদুলিল্লাহ, শুনে খুব ভালো লাগলো! আল্লাহ তাআলা আপনাকে সবসময় সুস্থ, প্রশান্ত ও নিরাপদে রাখুন।",
            [topic_hint],
        )

    # 4. What are you doing / Can we chat
    if _WHAT_DOING_RE.match(q):
        return _chat_payload(
            f"এই তো, আপনার সাথেই গল্প করছি! পাশাপাশি **DAWAH X**-এর {total_docs:,}+ ফতোয়া ও প্রবন্ধের জ্ঞানভাণ্ডার নিয়ে প্রস্তুত আছি। আপনি এখন কী করছেন?",
        )

    if _CAN_WE_CHAT_RE.match(q):
        return _chat_payload(
            "জি অবশ্যই! একদম নিঃসংকোচে স্বাভাবিক বাংলায়, Banglish-এ বা ইংরেজিতে আমার সাথে কথা বলতে পারেন। আমি মনোযোগ দিয়ে শুনছি—বলুন কী বলবেন?",
        )

    # 5. Gratitude / Praise / Short Acknowledgements
    if _THANKS_RE.match(q):
        return _chat_payload(
            "ওয়া ইয়্যাকুম—আল্লাহ আপনাকেও উত্তম প্রতিদান দিন! আপনার উপকারে আসতে পেরে আমারও খুব ভালো লাগলো। আর কোনো প্রশ্ন বা কথা থাকলে নির্দ্বিধায় বলুন।",
        )

    if _PRAISE_RE.match(q):
        return _chat_payload(
            "আলহামদুলিল্লাহ, আপনার ভালো লেগেছে জেনে খুব আনন্দিত হলাম! সব প্রশংসা মহান আল্লাহর। আরও কিছু নিয়ে আলোচনা করতে চাইলে বলুন।",
        )

    if _ACK_RE.match(q):
        follow_msg = (
            f"জি! **‘{last_ctx['primary_title']}’** বিষয়ে আরও কিছু জানার থাকলে বা অন্য কোনো প্রসঙ্গে কথা বলতে চাইলে নির্দ্বিধায় বলুন।"
            if last_ctx
            else "জি, বলুন—কোন বিষয়ে কথা বলতে বা জানতে চান?"
        )
        return _chat_payload(follow_msg)

    # 6. Farewell & Dua request
    if _FAREWELL_RE.match(q):
        return _chat_payload(
            "আল্লাহ হাফেজ! ফি আমানিল্লাহ—মহান আল্লাহ আপনাকে ও আপনার পরিবারকে সবসময় সুস্থ, নিরাপদ ও ঈমানের ওপর অবিচল রাখুন। আবার যেকোনো সময় কথা বলতে চলে আসবেন!",
        )

    if _DUA_REQ_RE.match(q):
        return _chat_payload(
            "মহান আল্লাহ আপনার সকল বৈধ আশা পূরণ করুন, আপনার দুশ্চিন্তা দূর করে অন্তরে প্রশান্তি দান করুন এবং দুনিয়া ও আখিরাতে কল্যাণ দান করুন—আমিন!",
        )

    # 7. Identity / Who made you
    if _IDENTITY_RE.match(q):
        f = fold_bn(q)
        if "আল্লাহ" not in f and "নবি" not in f and "রাসুল" not in f:
            return _chat_payload(
                f"আমি **DAWAH X AI**। আমি আপনার সাথে যেমন বন্ধুভাবাপন্নভাবে স্বাভাবিক কথাবার্তা বলতে পারি, তেমনি কোনো ইসলামিক প্রশ্ন করলে **DAWAH X** ওয়েবসাইটের **{total_docs:,}টি** যাচাইকৃত ফতোয়া ও প্রবন্ধ এবং **{total_vids:,}টি** ভিডিও থেকে দলিলসহ উত্তর দিই।",
                [
                    "আমার বিশেষত্ব হলো—সাধারণ কথাবার্তায় আমি আপনার সাথে সহজভাবে আলাপ করি, কিন্তু শরীআতের মাসআলা বা ফতোয়ার ক্ষেত্রে কখনোই নিজের থেকে মনগড়া কিছু বলি না; সবসময় DAWAH X-এর নির্ভরযোগ্য সূত্রসহ উত্তর দিই।"
                ],
            )

    # 8. Time & Date / Everyday Bangladeshi small talk / User introduction / Story
    if _TIME_DATE_RE.match(q):
        return _chat_payload(_dhaka_now_text())

    if _EAT_SLEEP_RE.match(q):
        return _chat_payload(
            f"হা হা, আমি তো এআই{name_tag}—আমার ভাত-চা বা ঘুমের প্রয়োজন হয় না! 😄 তবে আপনার সাথে কথা বলেই আমার দারুণ সময় কাটছে। আপনি খাওয়া-দাওয়া করেছেন তো?",
        )

    if _WHERE_LIVE_RE.match(q):
        return _chat_payload(
            "আমি কোনো রক্ত-মাংসের মানুষ নই, আমি **DAWAH X**-এর ডিজিটাল জগতে থাকি—যেন দিন-রাত যেকোনো সময় আপনার সাথে কথা বলতে পারি এবং কুরআন-সুন্নাহর নির্ভরযোগ্য তথ্য খুঁজে দিতে পারি!",
        )

    m_name = _MY_NAME_RE.match(q)
    if m_name:
        extracted = m_name.group(1).strip()
        if len(extracted.split()) <= 3 and not _USER_SAD_RE.search(extracted) and not _USER_GOOD_RE.search(extracted):
            return _chat_payload(
                f"মাশাআল্লাহ, আপনার সাথে পরিচিত হয়ে খুব ভালো লাগলো, **{extracted}**! আমি আপনার নামটি মনে রাখলাম। বলুন, আজ কী নিয়ে আলাপ করব?",
            )

    if _STORY_RE.match(q):
        return _chat_payload(
            "একটি ছোট ও হৃদয়স্পর্শী হাদীসের ঘটনা শোনাই—",
            [
                "একবার এক ব্যক্তি রাসূলুল্লাহ ﷺ-এর কাছে এসে জিজ্ঞেস করলেন: *‘হে আল্লাহর রাসূল! আমার উত্তম আচরণের সবচেয়ে বেশি হকদার কে?’* নবীজি ﷺ বললেন: **‘তোমার মা।’** লোকটি বললেন, *‘তারপর কে?’* নবীজি ﷺ বললেন: **‘তোমার মা।’** লোকটি তৃতীয়বার জিজ্ঞেস করলে নবীজি ﷺ আবারও বললেন: **‘তোমার মা।’** চতুর্থবার জিজ্ঞেস করলে তিনি বললেন: **‘তোমার বাবা।’** (সহীহ বুখারী ও মুসলিম)",
                "এই ছোট্ট ঘটনাটি আমাদের মনে করিয়ে দেয়—বাবা-মায়ের প্রতি একটুখানি হাসিমুখে কথা বলা ও তাঁদের খোঁজখবর নেওয়া কত বড় ইবাদত!",
            ],
            follow_ups=[
                "পিতা-মাতার অবাধ্যতার পরিণাম কী?",
                "মৃত পিতা-মাতার জন্য সন্তানের করণীয় আমল কী কী?",
            ],
        )

    # 9. Daily Reminder / Advice / Hadith
    if _INSPIRE_RE.match(q):
        idx = datetime.now().minute % len(DAWAHX_REMINDERS)
        rem = DAWAHX_REMINDERS[idx]
        return _chat_payload(
            f"নিশ্চয়ই! কুরআন ও হাদীস থেকে একটি হৃদয়স্পর্শী বাণী শেয়ার করছি—\n\n{rem['arabic']}\n\n**অর্থ:** “{rem['meaning']}” ({rem['ref']})",
            [rem["reflection"]],
            follow_ups=[
                "তওবা করার সঠিক নিয়ম কী?",
                "সালাতে খুশু-খুযু বা মনোযোগ বাড়ানোর উপায় কী?",
                "পৃথিবীতে বিপদ ও পরীক্ষা কেন আসে?",
            ],
        )

    # 10. Emotional sadness / distress (if short casual sharing without specific fiqh question)
    if len(q) <= 95 and _USER_SAD_RE.search(q) and "?" not in q:
        rem = DAWAHX_REMINDERS[0]
        return _chat_payload(
            "শুনে খারাপ লাগলো যে আপনার মন ভালো নেই। জীবনে কখনো কখনো এমন ভারাক্রান্ত সময় আসে—নিজেকে একা ভাববেন না। একটু গভীর শ্বাস নিন, আল্লাহর কাছে মনের কথাগুলো খুলে বলুন।",
            [
                f"মহান আল্লাহ কুরআনে সান্ত্বনা দিয়ে বলেছেন: {rem['arabic']} — **“{rem['meaning']}”** ({rem['ref']})।",
                "চাইলে আমাকে খুলে বলতে পারেন কী নিয়ে দুশ্চিন্তা বা কষ্ট লাগছে—আমি শুনছি।",
            ],
            follow_ups=[
                "হতাশা ও দুশ্চিন্তা দূর করার ইসলামিক উপায় কী?",
                "গুনাহ হয়ে গেলে আল্লাহর ক্ষমা পাওয়ার উপায় কী?",
                "দোয়া কবুল হওয়ার উত্তম সময় কোনটি?",
            ],
        )

    # 11. Multi-turn context commands ("বিস্তারিত বলো", "দলিল কী?", "ভিডিও দাও")
    if last_ctx:
        if _ELABORATE_RE.match(q) and last_ctx.get("extra_body"):
            return _chat_payload(
                f"অবশ্যই, **‘{last_ctx['primary_title']}’** বিষয়ে আরও বিস্তারিত তুলে ধরছি—",
                [p for p in last_ctx["extra_body"].split("\n\n") if p.strip()][:4],
                sources=last_ctx.get("sources", [])[:2],
            )
        if _ASK_DALIL_RE.match(q):
            evs = last_ctx.get("evidences", [])
            if evs:
                return _chat_payload(
                    f"**‘{last_ctx['primary_title']}’** বিষয়ে উদ্ধৃত কুরআন ও হাদীসের দলিলসমূহ নিচে দেওয়া হলো—",
                    evidences=evs,
                    sources=last_ctx.get("sources", [])[:2],
                )
        if _ASK_VIDEO_RE.match(q):
            vids = last_ctx.get("videos", [])
            if vids:
                return _chat_payload(
                    f"**‘{last_ctx['primary_title']}’** বিষয়ে DAWAH X ভিডিও গ্যালারি থেকে প্রাসঙ্গিক আলোচনাসমূহ—",
                    videos=vids,
                )

    return None


def augment_query_with_history(query: str, history: Optional[List[Dict[str, Any]]] = None) -> Tuple[str, bool]:
    """If the user asks a short contextual follow-up (e.g. 'আর স্যালাইন নিলে?', 'তাহলে কি কাযা করতে হবে?'),
    prepend key subject context from the previous assistant turn so retrieval stays on topic.
    """
    if not history:
        return query, False

    last_ctx = None
    for item in reversed(history):
        if item.get("role") == "assistant" and item.get("primary_title"):
            last_ctx = item
            break
    if not last_ctx:
        return query, False

    q_toks = [t for t in tokenize_folded(query, stem=True) if is_core_content_token(t)]
    starts_contextual = bool(_ELLIPSIS_FOLLOWUP_START_RE.match(query))

    if starts_contextual or (1 <= len(q_toks) <= 2 and len(query.strip()) <= 55):
        prev_title = last_ctx.get("primary_title", "")
        prev_core = [t for t in tokenize_folded(prev_title, stem=True) if is_core_content_token(t)][:4]
        if prev_core:
            return f"{query} {' '.join(prev_core)}", True

    return query, False


def build_conversational_opening(query: str, doc_type: str, source_name: str, used_history: bool = False) -> str:
    """Create a warm, natural conversational Bengali lead-in before presenting the DAWAH X answer."""
    salam_prefix = "ওয়া আলাইকুমুস সালাম ওয়া রাহমাতুল্লাহ! " if _LEADING_SALAM_RE.match(query or "") else ""
    if used_history:
        return f"{salam_prefix}জি, আগের আলোচনার সূত্র ধরে **DAWAH X** ({source_name})-এর দলিল থেকে বিষয়টি পরিষ্কার করছি—"
    if doc_type == "fatwa":
        return f"{salam_prefix}জি, আপনার প্রশ্নটির বিষয়ে **DAWAH X** ({source_name})-এ সুস্পষ্ট দলিলভিত্তিক উত্তর রয়েছে—"
    if doc_type == "rebuttal":
        return f"{salam_prefix}অবশ্যই, এ বিষয়ে **DAWAH X** ({source_name})-এর প্রামাণ্য বিশ্লেষণ থেকে মূল উত্তরটি তুলে ধরছি—"
    return f"{salam_prefix}জি নিশ্চয়ই, **DAWAH X** ({source_name})-এর সংগৃহীত প্রবন্ধ ও দলিলের আলোকে বিষয়টি সহজভাবে তুলে ধরছি—"
