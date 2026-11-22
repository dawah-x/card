"""Bengali, Banglish & English Islamic Linguistic Normalizer, Stemmer & Synonym Engine.

Matches DAWAH X's native `foldBn` phonetic folding rules while adding:
- Bengali inflectional suffix stemming
- 95+ Islamic Fiqh, Aqeedah, Hadith, Worship & Comparative-Dawah synonym clusters
- Banglish (Romanized Bengali) & English -> Bengali Islamic query mapping
- Query intent & question-word filtering so high-IDF domain terms drive retrieval
"""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, List, Set, Tuple

BN_DIGITS = "০১২৩৪৫৬৭৮৯"
FOLD_MAP = str.maketrans({
    "ী": "ি",
    "ূ": "ু",
    "ঈ": "ই",
    "ঊ": "উ",
    "ছ": "স",
    "শ": "স",
    "ষ": "স",
    "য": "জ",
    "ণ": "ন",
    "ৎ": "ত",
})

_ZW_CHARS_RE = re.compile(r"[\u200b-\u200d\u00ad\ufeff\u0981]")
_APOS_BETWEEN_LETTERS_RE = re.compile(r"([A-Za-z\u0980-\u09FF])[‘’'ʼ`ʻ](?=[A-Za-z\u0980-\u09FF])")
_WA_PHALA_RE = re.compile(r"([কত])\u09cd\u09ac")
_TOKEN_RE = re.compile(r"[a-z0-9\u0980-\u09ff]+")
_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+")


def bn_to_en_digits(text: str) -> str:
    return "".join(str(BN_DIGITS.index(ch)) if ch in BN_DIGITS else ch for ch in text)


def fold_bn(value: str) -> str:
    """Exact phonetic/orthographic folding aligned with DAWAH X's `foldBn`."""
    if not value:
        return ""
    s = unicodedata.normalize("NFC", str(value)).lower()
    s = bn_to_en_digits(s)
    s = _ZW_CHARS_RE.sub("", s)
    s = _APOS_BETWEEN_LETTERS_RE.sub(r"\1", s)
    # Nukta canonicalization: য+় -> য়, ড+় -> ড়, ঢ+় -> ঢ়
    s = s.replace("\u09af\u09bc", "\u09df").replace("\u09a1\u09bc", "\u09dc").replace("\u09a2\u09bc", "\u09dd")
    # ক্ব / ত্ব -> ক / ত (e.g., ক্বিয়ামত -> কিয়ামত, কুরআন/ক্বুরআন)
    s = _WA_PHALA_RE.sub(r"\1", s)
    s = s.translate(FOLD_MAP)
    return s


# Ordered longest-first so compound Bengali suffixes strip cleanly
_BN_SUFFIXES = (
    "গুলোর", "গুলোকে", "গুলোতে", "গুলোয়", "গুলো",
    "সমূহের", "সমূহকে", "সমূহে", "সমূহ",
    "দেরকে", "দেরই", "দের",
    "গুলোই", "টাকেই", "টাকে", "টিকে", "টির", "টার", "টিতে", "টাতে",
    "গুলোও", "খানার", "খানা",
    "কারীর", "কারীকে", "কারীদের", "কারী",
    "ভাবেই", "ভাবে", "গুলো",
    "কালীন", "গুলো",
    "তেও", "কেও", "য়েও",
    "গুলোর", "নের",
    "য়ের", "দের",
    "তে", "কে", "য়", "য়ে",
)


_D_FINAL_ROOTS = {
    fold_bn(w)
    for w in (
        "মসজিদ", "মাসজিদ", "তাওহীদ", "তৌহিদ", "জিহাদ", "সুদ", "ঈদ", "সনদ",
        "সম্পদ", "বিপদ", "মতভেদ", "অপবাদ", "অনুবাদ", "সংবাদ", "ফাসাদ",
        "ইজতিহাদ", "তাকলীদ", "মুরতাদ", "দাঊদ", "মাহমূদ", "মাজীদ", "হামীদ", "প্রাসাদ", "পরিষদ",
    )
}


def stem_bn(token: str) -> str:
    """Conservative Bengali inflectional stemmer preserving core root semantics."""
    n = len(token)
    if n <= 3 or token.isdigit():
        return token
    # Protect द/দ-final Islamic & Bengali roots taking genitive `-ের` (e.g. মসজিদের -> মসজিদ, তাওহীদের -> তাওহিদ)
    if token.endswith("দের") and token[:-2] in _D_FINAL_ROOTS:
        return token[:-2]
    for suf in _BN_SUFFIXES:
        if n - len(suf) >= 3 and token.endswith(suf):
            return token[: -len(suf)]
    # Genitive -ের / -র on words long enough not to collide with roots like কবর/নজর/শহর/ফজর/যোহর/আসর
    if n >= 6 and token.endswith("ের"):
        cand = token[:-2]
        if len(cand) >= 4:
            return cand
    if n >= 6 and token.endswith("ির"):
        return token[:-1]  # keep ি vowel (e.g., নামাজির -> নামাজি)
    if n >= 6 and token.endswith(("ার", "ুর")) and not token.endswith(("কার", "বার", "চার", "পার", "দার")):
        return token[:-1]
    return token


# Comprehensive Islamic Synonym & Concept Clusters (canonicalized via fold_bn at import time)
RAW_SYNONYM_GROUPS: List[List[str]] = [
    # DAWAH-X core synonyms + expanded Fiqh/Aqeedah equivalents
    ["নামাজ", "নামায", "সালাত", "ছালাত", "সলত"],
    ["রোজা", "রোযা", "সিয়াম", "ছিয়াম", "সাওম", "ছাওম"],
    ["কোরআন", "কুরআন", "কোরান", "কুরান", "আল-কুরআন", "কিতাবুল্লাহ"],
    ["হাদিস", "হাদীস", "হাদীছ", "হাদিছ", "সুন্নাহ", "সুন্নাত"],
    ["অজু", "ওজু", "উজু", "ওযু", "ওযূ", "অযু"],
    ["গোসল", "ফরজ গোসল", "জানাবাত", "নাপাকি"],
    ["তায়াম্মুম", "তায়ামমুম"],
    ["দোয়া", "দোআ", "দুআ", "দুয়া", "প্রার্থনা", "মুনাজাত", "মোনাজাত"],
    ["জুমা", "জুমআ", "জুমুআ", "জুমুয়া", "জুমার"],
    ["কুরবানি", "কোরবানি", "কুরবানী", "কোরবানী", "উযহিয়্যাহ"],
    ["আকিকা", "আকীকা", "আক্বীকা"],
    ["যাকাত", "জাকাত"],
    ["ফিতরা", "সদকাতুল ফিতর", "যাকাতুল ফিতর", "ফেতরা"],
    ["সদকা", "সাদাকাহ", "দান", "খয়রাত"],
    ["ওহি", "অহি", "ওয়াহী", "ওহী"],
    ["জয়িফ", "জইফ", "যঈফ", "দুর্বল হাদিস", "জাল হাদিস"],
    ["সহিহ", "সহীহ", "ছহীহ", "বিশুদ্ধ"],
    ["বিদআত", "বেদাত", "বিদআহ", "বেদআত"],
    ["শিরক", "শিরিক", "বহুঈশ্বরবাদ"],
    ["কুফর", "কুফরি", "কাফের", "কাফির"],
    ["তাওহীদ", "তৌহিদ", "তাওহিদ", "একত্ববাদ"],
    ["আকিদা", "আকীদা", "ঈমান", "বিশ্বাস"],
    ["ফেরেসতা", "ফিরিসতা", "ফেরেশতা", "মালাইকা"],
    ["রাসুল", "রসুল", "রাসূল", "নবী", "পয়গম্বর", "মুহাম্মদ", "মুহাম্মাদ", "মোহাম্মদ"],
    ["রাকাত", "রাকআত"],
    ["সিজদা", "সেজদা", "সাজদা", "সাজদাহ", "সাহু সিজদা"],
    ["হজ্জ", "হজ", "হজ্ব"],
    ["ওমরা", "উমরা", "ওমরাহ", "উমরাহ"],
    ["মসজিদ", "মাসজিদ"],
    ["বিতর", "বিতির", "বেতের"],
    ["তারাবি", "তারাবীহ", "তারাবিহ"],
    ["তাহাজ্জুদ", "কিয়ামুল লাইল"],
    ["ভঙ্গ", "ভঙ্গের", "ভাঙ্গা", "ভাঙ্গার", "ভাঙা", "ভাঙার", "ভেঙে", "ভাঙে", "নষ্ট"],
    ["আয়েশা", "আয়িশা"],
    ["জানাযা", "জানাজা", "মাইয়্যেত"],
    ["বিষন্নতা", "হতাশা", "দুশ্চিন্তা", "অশান্তি"],
    ["বিবর্তনবাদ", "ডারউইনবাদ", "ডারউইন"],
    ["সেহরি", "সাহরি", "সাহারি", "সাহরী"],
    ["ইফতার", "ইফতারি"],
    ["বিয়ে", "বিবাহ", "নিকাহ", "শাদি"],
    ["তালাক", "ডিভোর্স", "বিবাহবিচ্ছেদ", "খুলা"],
    ["মোহর", "দেনমোহর", "মাহর"],
    ["পর্দা", "হিজাব", "নিকাব", "বোরকা", "মাহরাম"],
    ["নারী", "মহিলা", "স্ত্রী", "মেয়ে"],
    ["স্রষ্টা", "সৃষ্টিকর্তা", "আল্লাহ", "রব", "ঈশ্বর", "খোদা"],
    ["নাস্তিক", "নাস্তিকতা", "অবিশ্বাসী", "সংশয়বাদী", "অ্যাগনস্টিক", "সংশয়"],
    ["তাকদীর", "তাকদির", "ভাগ্য", "নিয়তি"],
    ["আখিরাত", "পরকাল", "কিয়ামত", "হাশর", "জান্নাত", "জাহান্নাম"],
    ["কবর", "মাজার", "যিয়ারত", "জিয়ারত", "বারযাখ"],
    ["সুদ", "রিবা", "ব্যাংক সুদ", "লোন", "কিস্তি"],
    ["ভ্যাট", "ট্যাক্স", "কর", "শুল্ক"],
    ["গান", "বাদ্যযন্ত্র", "মিউজিক", "সংগীত", "বাজনা"],
    ["ছবি", "মূর্তি", "ভাস্কর্য", "প্রতিকৃতি", "ফটোগ্রাফি", "ভিডিও"],
    ["দাড়ি", "দাড়ি", "শ্মশ্রু"],
    ["টাখনু", "ইসাবাল", "প্যান্ট", "লুঙ্গি"],
    ["তাবিজ", "কবজ", "ঝাড়ফুঁক", "রুকইয়াহ", "যাদু", "জাদু", "ব্ল্যাক ম্যাজিক"],
    ["হালাল", "জায়েয", "জায়েজ", "বৈধ", "অনুমোদিত"],
    ["হারাম", "নাজায়েয", "নাজায়েজ", "নিষিদ্ধ", "অবৈধ", "গুনাহ", "পাপ"],
    ["মাকরুহ", "মাকরূহ", "অপছন্দনীয়"],
    ["ফরজ", "ফরয", "আবশ্যক", "ওয়াজিব"],
    ["তওবা", "তাওবা", "ইস্তিগফার", "ক্ষমা"],
    ["মিরাস", "উত্তরাধিকার", "ওয়ারিশ", "সম্পত্তি বণ্টন"],
    ["কুকুর", "বিড়াল", "পোষা প্রাণী"],
    ["ধূমপান", "সিগারেট", "মাদক", "নেশা", "মদ"],
    ["জন্মদিন", "বার্থডে", "দিবস পালন", "ভ্যালেন্টাইন", "বর্ষবরণ"],
    ["বিজ্ঞান", "বিবর্তনবাদ", "ডারউইন", "বিগ ব্যাং", "মহাবিশ্ব"],
]

# Build folded synonym lookup: folded_token -> set of folded single-word synonyms
SYNONYM_MAP: Dict[str, Set[str]] = {}
for _grp in RAW_SYNONYM_GROUPS:
    _folded_words: Set[str] = set()
    for _phrase in _grp:
        _f = fold_bn(_phrase).strip()
        if " " not in _f and len(_f) >= 2:
            _folded_words.add(_f)
            _folded_words.add(stem_bn(_f))
    for _w in _folded_words:
        _others = _folded_words - {_w}
        if _others:
            SYNONYM_MAP.setdefault(_w, set()).update(_others)


# Banglish (Romanized Bengali) & English -> Bengali Islamic Term Dictionary
BANGLISH_AND_EN_MAP: Dict[str, str] = {
    # Worship & Purification
    "namaz": "নামাজ সালাত",
    "namaj": "নামাজ সালাত",
    "salat": "সালাত নামাজ",
    "salah": "সালাত নামাজ",
    "prayer": "সালাত নামাজ দোয়া",
    "pray": "সালাত নামাজ দোয়া",
    "wudu": "ওযু অজু",
    "wadu": "ওযু অজু",
    "oju": "ওজু ওযু",
    "ozu": "ওযু ওজু",
    "ablution": "ওযু পবিত্রতা",
    "ghusl": "গোসল ফরজ গোসল",
    "gosol": "গোসল ফরজ গোসল",
    "tayammum": "তায়াম্মুম",
    "fazar": "ফজর সালাত",
    "fajr": "ফজর সালাত",
    "johor": "যোহর সালাত",
    "dhuhr": "যোহর সালাত",
    "zuhr": "যোহর সালাত",
    "asor": "আসর সালাত",
    "asr": "আসর সালাত",
    "magrib": "মাগরিব সালাত",
    "maghrib": "মাগরিব সালাত",
    "esha": "এশা সালাত",
    "isha": "এশা সালাত",
    "tahajjud": "তাহাজ্জুদ সালাত",
    "tarabi": "তারাবীহ সালাত",
    "tarawih": "তারাবীহ সালাত",
    "witr": "বিতর সালাত",
    "bitor": "বিতর সালাত",
    "juma": "জুমআ সালাত",
    "jumma": "জুমআ সালাত",
    "jumuah": "জুমআ সালাত",
    "janaza": "জানাযা সালাত",
    "janazah": "জানাযা সালাত",
    "rakat": "রাকআত",
    "rakaat": "রাকআত",
    "sijdah": "সিজদা সাহু",
    "sijda": "সিজদা",
    "sejda": "সিজদা",
    "sujood": "সিজদা",
    "sahu": "সাহু সিজদা",
    "imam": "ইমাম জামাআত",
    "jamat": "জামাআত",
    "masjid": "মসজিদ",
    "mosque": "মসজিদ",
    "azan": "আযান একামত",
    "adhan": "আযান",
    "dua": "দোয়া দুআ",
    "doa": "দোয়া দুআ",
    "zikir": "যিকির দোয়া",
    "dhikr": "যিকির",
    # Fasting, Zakat, Hajj, Qurbani
    "roja": "রোজা সিয়াম",
    "roza": "রোজা সিয়াম",
    "siyam": "সিয়াম রোজা",
    "saom": "সাওম রোজা",
    "fasting": "রোজা সিয়াম",
    "ramadan": "রমযান রোজা",
    "ramzan": "রমযান রোজা",
    "sehri": "সাহরী সেহরি",
    "suhoor": "সাহরী সেহরি",
    "iftar": "ইফতার রোজা",
    "zakat": "যাকাত নিসাব",
    "jakat": "যাকাত",
    "nisab": "নিসাব যাকাত",
    "fitra": "ফিতরা সদকাতুল ফিতর",
    "fitrah": "ফিতরা সদকাতুল ফিতর",
    "sadaqah": "সাদাকাহ দান",
    "sadaka": "সাদাকাহ দান",
    "charity": "দান সাদাকাহ যাকাত",
    "hajj": "হজ্জ হজ",
    "haj": "হজ্জ হজ",
    "umrah": "উমরাহ ওমরা",
    "omrah": "ওমরা উমরাহ",
    "qurbani": "কুরবানী পশু",
    "kurbani": "কুরবানী",
    "korbani": "কোরবানি কুরবানী",
    "aqiqah": "আকীকা",
    "akika": "আকীকা",
    # Aqeedah, Atheism, Science, Quran, Hadith
    "allah": "আল্লাহ স্রষ্টা",
    "god": "আল্লাহ স্রষ্টা অস্তিত্ব",
    "creator": "স্রষ্টা আল্লাহর অস্তিত্ব",
    "exist": "অস্তিত্ব প্রমাণ",
    "existence": "আল্লাহর অস্তিত্ব",
    "atheist": "নাস্তিক নাস্তিকতা সংশয়",
    "atheism": "নাস্তিকতা আল্লাহর অস্তিত্ব",
    "nastik": "নাস্তিক নাস্তিকতা",
    "agnostic": "সংশয়বাদী নাস্তিকতা",
    "evolution": "বিবর্তনবাদ বিজ্ঞান ডারউইন",
    "science": "বিজ্ঞান কুরআন",
    "bigbang": "মহাবিশ্ব বিজ্ঞান স্রষ্টা",
    "evil": "দুঃখ কষ্ট তাকদীর পরীক্ষা",
    "suffering": "দুঃখ কষ্ট তাকদীর বিপদ",
    "taqdeer": "তাকদীর ভাগ্য",
    "takdir": "তাকদীর ভাগ্য",
    "destiny": "তাকদীর ভাগ্য",
    "fate": "তাকদীর ভাগ্য",
    "akhirat": "আখিরাত পরকাল বিচার",
    "hereafter": "আখিরাত পরকাল জান্নাত জাহান্নাম",
    "jannah": "জান্নাত পরকাল",
    "jannat": "জান্নাত",
    "jahannam": "জাহান্নাম শাস্তি",
    "hell": "জাহান্নাম পরকাল",
    "heaven": "জান্নাত",
    "quran": "কুরআন আয়াত সংকলন",
    "koran": "কুরআন",
    "hadith": "হাদীস সুন্নাহ সহীহ",
    "hadis": "হাদিস হাদীস সুন্নাহ",
    "sunnah": "সুন্নাহ হাদীস",
    "prophet": "রাসূল মুহাম্মাদ নবী সীরাত",
    "muhammad": "মুহাম্মাদ রাসূল নবী",
    "rasul": "রাসূল নবী",
    "nabi": "নবী রাসূল",
    "shirk": "শিরক তাওহীদ",
    "bidat": "বিদআত সুন্নাহ",
    "bidah": "বিদআত সুন্নাহ",
    "tawheed": "তাওহীদ আকীদা",
    "iman": "ঈমান আকীদা",
    "aqeedah": "আকীদা বিশ্বাস",
    "akida": "আকীদা বিশ্বাস",
    # Family, Women, Finance, Daily Fiqh
    "biye": "বিবাহ বিয়ে নিকাহ",
    "bibah": "বিবাহ বিয়ে",
    "marriage": "বিবাহ বিয়ে স্ত্রী স্বামী",
    "marry": "বিবাহ বিয়ে",
    "polygamy": "বহুবিবাহ চারটি বিবাহ নারী",
    "wives": "চারটি বিবাহ স্ত্রী বহুবিবাহ",
    "wife": "স্ত্রী স্বামী পরিবার",
    "husband": "স্বামী স্ত্রী অধিকার",
    "talaq": "তালাক বিবাহবিচ্ছেদ",
    "talak": "তালাক বিবাহবিচ্ছেদ",
    "divorce": "তালাক খুলা বিবাহবিচ্ছেদ",
    "khula": "খুলা তালাক",
    "mohor": "মোহর দেনমোহর",
    "mahr": "মোহর দেনমোহর",
    "dowry": "যৌতুক দেনমোহর",
    "joutuk": "যৌতুক",
    "women": "নারী অধিকার পর্দা ইসলাম",
    "woman": "নারী অধিকার ইসলাম",
    "feminism": "নারীবাদ নারী অধিকার",
    "hijab": "পর্দা হিজাব নিকাব",
    "porda": "পর্দা হিজাব মাহরাম",
    "purdah": "পর্দা হিজাব",
    "niqab": "নিকাব পর্দা",
    "mahram": "মাহরাম পর্দা",
    "riba": "সুদ রিবা ব্যাংক",
    "shud": "সুদ রিবা",
    "sud": "সুদ রিবা",
    "interest": "সুদ ব্যাংক লোন",
    "bank": "ব্যাংক সুদ একাউন্ট",
    "loan": "ঋণ লোন সুদ",
    "tax": "ট্যাক্স ভ্যাট কর",
    "vat": "ভ্যাট ট্যাক্স",
    "share": "শেয়ার ব্যবসা",
    "business": "ব্যবসা ক্রয় বিক্রয়",
    "music": "গান বাদ্যযন্ত্র মিউজিক",
    "gan": "গান বাদ্যযন্ত্র",
    "song": "গান বাদ্যযন্ত্র",
    "singing": "গান বাদ্যযন্ত্র",
    "photo": "ছবি মূর্তি ফটোগ্রাফি",
    "picture": "ছবি মূর্তি প্রাণীর ছবি",
    "statue": "মূর্তি ভাস্কর্য ছবি",
    "video": "ভিডিও ছবি",
    "beard": "দাড়ি শ্মশ্রু",
    "dari": "দাড়ি রাখা",
    "ankle": "টাখনু প্যান্ট কাপড়",
    "takhnu": "টাখনু কাপড়",
    "smoking": "ধূমপান সিগারেট মাদক",
    "cigarette": "সিগারেট ধূমপান",
    "alcohol": "মদ নেশা হারাম",
    "dog": "কুকুর পালা নাপাকি",
    "kukur": "কুকুর পালা",
    "cat": "বিড়াল পালা",
    "biral": "বিড়াল",
    "tabij": "তাবিজ ঝাড়ফুঁক শিরক",
    "ruqyah": "রুকইয়াহ ঝাড়ফুঁক কুরআন",
    "magic": "যাদু ব্ল্যাক ম্যাজিক তাবিজ",
    "grave": "কবর যিয়ারত মাজার",
    "kobor": "কবর যিয়ারত আযাব",
    "mazar": "মাজার কবর শিরক",
    "birthday": "জন্মদিন পালন বিদআত",
    "inheritance": "মিরাস উত্তরাধিকার সম্পত্তি",
    "miras": "মিরাস উত্তরাধিকার সম্পত্তি",
    "suicide": "আত্মহত্যা গুনাহ হতাশা",
    "tauba": "তওবা ক্ষমা গুনাহ",
    "tawbah": "তওবা ক্ষমা আল্লাহর রহমত",
    "repentance": "তওবা ক্ষমা",
    "halal": "হালাল জায়েয বৈধ",
    "haram": "হারাম নাজায়েয নিষিদ্ধ",
    "jayej": "জায়েয বৈধ হালাল",
    "najayej": "নাজায়েয হারাম নিষিদ্ধ",
    "foroj": "ফরয আবশ্যক",
    "fard": "ফরয আবশ্যক",
    "sunnat": "সুন্নাত সুন্নাহ",
    "wajib": "ওয়াজিব ফরয",
    "makruh": "মাকরূহ অপছন্দনীয়",
    "gunah": "গুনাহ পাপ",
    "sin": "গুনাহ পাপ তওবা",
    # Common Banglish helper words mapped or ignored
    "venge": "ভঙ্গ নষ্ট ভেঙে",
    "bhenge": "ভঙ্গ ভেঙে নষ্ট",
    "nosto": "নষ্ট ভঙ্গ",
    "niyom": "নিয়ম পদ্ধতি বিধান",
    "poddoti": "পদ্ধতি নিয়ম",
    "bidhan": "বিধান হুকুম মাসআলা",
    "hukum": "হুকুম বিধান জায়েয",
    "masala": "মাসআলা ফতোয়া বিধান",
    "fatwa": "ফতোয়া মাসআলা",
    "proman": "প্রমাণ দলিল যুক্তি",
    "dalil": "দলিল প্রমাণ হাদীস আয়াত",
    "dolil": "দলিল প্রমাণ",
    "korbo": "করণীয়",
    "koroniyo": "করণীয় উপায়",
    "injection": "ইনজেকশন স্যালাইন রোজা",
    "saline": "স্যালাইন ইনজেকশন রোজা",
    "blood": "রক্ত দান ওযু রোজা",
    "rokto": "রক্ত ওযু",
    "ghush": "ঘুষ দুর্নীতি হারাম",
    "bribe": "ঘুষ দুর্নীতি",
    "gusul": "গোসল ফরয",
    "farz": "ফরয আবশ্যক",
    "foroj": "ফরয আবশ্যক",
    "karon": "কারণ ভঙ্গ",
    "kaza": "কাযা ক্বাযা ছালাত",
    "qaza": "কাযা ক্বাযা ছালাত",
    "mon": "মন মনোযোগ খুশু",
    "taka": "টাকা অর্থ সম্পদ",
    "takar": "টাকা অর্থ সম্পদ",
    "bkash": "বিকাশ ক্যাশব্যাক মোবাইল ব্যাংকিং",
    "nagad": "নগদ বিকাশ ক্যাশব্যাক",
    "cashback": "ক্যাশব্যাক ডিসকাউন্ট মূল্য ফেরত",
    "bitcoin": "বিটকয়েন ক্রিপ্টোকারেন্সি মুদ্রা",
    "crypto": "ক্রিপ্টোকারেন্সি বিটকয়েন",
    "period": "হায়েয পিরিয়ড ঋতুস্রাব",
    "hayez": "হায়েয পিরিয়ড ঋতুস্রাব",
    "swapnodosh": "স্বপ্নদোষ বীর্য গোসল ছিয়াম",
    "masturbation": "হস্তমৈথুন বীর্য গুনাহ",
    "hostomoithun": "হস্তমৈথুন গুনাহ",
    "kobor": "কবর আযাব যিয়ারত",
    "azab": "আযাব শাস্তি",
    "ajab": "আযাব শাস্তি",
    "milad": "মীলাদ বিদআত কিয়াম",
    "shobe": "শবে বরাত শাবান",
    "borat": "শবে বরাত শাবান",
    "kahf": "কাহফ সূরা",
    "kursi": "আয়াতুল কুরসী",
    "takhnu": "টাখনু গিরা প্যান্ট",
    "pant": "প্যান্ট টাখনু পোশাক",
    "chobi": "ছবি মূর্তি ভিডিও",
    "sigaret": "সিগারেট ধূমপান",
    # v5.0 Expanded Everyday Banglish & Medical/Fiqh Terms
    "vul": "ভুল সাহু সিজদা",
    "bhul": "ভুল সাহু সিজদা",
    "sofor": "সফর মুসাফির ক্বছর",
    "safar": "সফর মুসাফির ক্বছর",
    "kosor": "ক্বছর কসর ছালাত",
    "kasar": "ক্বছর কসর ছালাত",
    "qasr": "ক্বছর কসর ছালাত",
    "istikhara": "ইস্তেখারাহ ইস্তেখারা ছালাত",
    "istekhara": "ইস্তেখারাহ ইস্তেখারা ছালাত",
    "masbuk": "মাসবূক জামাআত ছালাত",
    "eid": "ঈদ ছালাত তাকবীর",
    "moja": "মোযা মাসাহ ওযূ",
    "masah": "মাসাহ মোযা ওযূ",
    "toothpaste": "টুথপেষ্ট ব্রাশ ছিয়াম",
    "paste": "টুথপেষ্ট ব্রাশ ছিয়াম",
    "brush": "ব্রাশ টুথপেষ্ট মিসওয়াক",
    "miswak": "মিসওয়াক ব্রাশ",
    "vag": "ভাগে শরীক পশুতে",
    "bhag": "ভাগে শরীক পশুতে",
    "goru": "গরু পশুতে সাত ভাগে",
    "bidaat": "বিদআত সুন্নাত",
    "bidah": "বিদআত সুন্নাত",
    "bod": "বদনযর নযর",
    "nojor": "বদনযর নযর রুকইয়াহ",
    "nazar": "বদনযর নযর রুকইয়াহ",
    "bacha": "রক্ষা প্রতিকার বাঁচার",
    "bachar": "রক্ষা প্রতিকার বাঁচার",
    "blood": "রক্ত রোগীকে দান",
    "rokto": "রক্ত রক্তদান",
    "donation": "দান রক্ত প্রতিস্থাপন",
    "organ": "অঙ্গ প্রতিস্থাপন দান",
    "abortion": "গর্ভপাত ভ্রূণ",
    "gorvopat": "গর্ভপাত ভ্রূণ",
    "shawwal": "শাওয়াল ছয়টি ছিয়াম",
    "ashura": "আশূরা মুহাররম ছিয়াম",
    "arafah": "আরাফা ছিয়াম",
    "kulkhani": "কুলখানী চল্লিশা বিদআত",
    "chollisha": "চল্লিশা কুলখানী বিদআত",
    "dottok": "দত্তক পালক সন্তান",
}

BANGLISH_STOP_WORDS: Set[str] = {
    "a", "e", "te", "er", "r", "ke", "re", "ta", "ti", "gulo", "gula", "ra", "der",
    "ki", "kii", "keno", "kn", "kno", "kokhon", "kkhn", "kivabe", "kibhabe", "kemne", "kemon", "kmn",
    "koto", "koy", "koyta", "kon", "konta", "kothay", "keu", "karo", "kake",
    "hoy", "hoi", "hobe", "hole", "hoile", "howa", "howar", "hocche", "hoise", "hoyeche", "holo",
    "jay", "jai", "jabe", "gele", "jawa", "pare", "parbo", "parbe", "pari", "para",
    "kora", "korar", "kore", "korle", "korbo", "korben", "korte", "koren", "kori",
    "dewa", "dewar", "dite", "dile", "debo", "newa", "newar", "nite", "nile", "nei", "nai",
    "bola", "bolen", "bolo", "bolun", "ache", "ase", "thake", "thakle",
    "pora", "porar", "pore", "porle", "porbo", "porte", "khawa", "khele", "khete",
    "bose", "boshe", "utha", "uthte", "rakha", "rakhle", "rekhe",
    "use", "using", "used", "vyabohar", "babohar",
    "na", "noy", "naki", "ba", "othoba", "ebong", "ar", "kintu", "tobe", "jodi", "tahole",
    "jonno", "jonyo", "theke", "sathe", "songe", "moddhe", "upor", "upore", "niche",
    "ami", "amar", "amader", "apni", "apnar", "tumi", "tomar", "se", "tar", "tader", "amra",
    "ekta", "ekti", "kichu", "sob", "shob", "onek", "khub", "beshi", "kom", "ektu",
    "valo", "bhalo", "kharap", "uchit", "dorkar", "niyom", "bidhan", "hukum", "somporke", "bishoye",
}

# Generic Bengali & English stop/question words (should NOT carry primary topical weight alone)
GENERIC_QUERY_WORDS: Set[str] = {
    fold_bn(w)
    for w in [
        "কি", "কী", "কেন", "কখন", "কোথায়", "কিভাবে", "কীভাবে", "কেমন", "কোন", "কোনো", "কোনটি",
        "কত", "কয়", "কয়টি", "কার", "কাকে", "কে", "কারা",
        "হয়", "হবে", "হলে", "হলো", "হল", "হয়েছে", "হচ্ছে", "হতে", "হওয়া", "হওয়ায়",
        "যায়", "যাবে", "গেলে", "যাওয়া", "পারে", "পারবে", "পারা", "পারি",
        "করা", "করে", "করলে", "করব", "করবো", "করতে", "করার", "করেন", "করেছেন",
        "দেওয়া", "দেয়া", "দিলে", "দিতে", "নেওয়া", "নেয়া", "নিলে", "নিতে",
        "বলা", "বলে", "বললে", "বলেন", "আছে", "নেই", "নাই", "থাকা", "থাকে", "থাকলে",
        "জন্য", "থেকে", "সাথে", "সঙ্গে", "মধ্যে", "ভেতরে", "উপর", "ওপর", "নিচে", "নীচে",
        "এবং", "ও", "বা", "অথবা", "কিন্তু", "তবে", "যদি", "তাহলে", "নাকি", "না", "নয়",
        "এই", "সেই", "ওই", "এটি", "সেটি", "এটা", "সেটা", "একটি", "একটা", "একজন", "কিছু", "সব", "সকল",
        "আমার", "আমাদের", "আপনার", "তাদের", "তার", "আমি", "আমরা", "তুমি", "আপনি", "সে", "তারা",
        "ইসলাম", "ইসলামে", "ইসলামের", "ইসলামিক", "ইসলামী", "মুসলিম", "মুসলমান", "শারঈ", "শরীয়ত", "শরীআত",
        "প্রশ্ন", "উত্তর", "জানতে", "চাই", "বলুন", "জানান", "দয়া", "প্লিজ", "বিষয়ে", "সম্পর্কে", "ব্যাপারে",
        "বিধান", "হুকুম", "নিয়ম", "মাসআলা", "ফতোয়া", "দৃষ্টিতে", "মতে", "আলোকে",
        # Conversational greetings & polite address words inside questions
        "আসসালামু", "আলাইকুম", "রাহমাতুল্লাহ", "রাহমাতুল্লাহি", "বারাকাতুহু", "ওয়া",
        "ভাই", "ভাইয়া", "বোন", "আপু", "হুজুর", "শায়খ", "শায়েখ", "স্যার", "বন্ধু",
        "দয়া", "অনুগ্রহ", "প্লিজ", "একটু", "আচ্ছা", "হ্যালো", "হাই", "ব্যবহার",
        # English / Banglish stop & address words
        "what", "why", "how", "when", "where", "who", "which", "is", "are", "was", "were",
        "do", "does", "did", "can", "could", "should", "would", "will", "in", "on", "of",
        "to", "for", "with", "about", "from", "the", "a", "an", "and", "or", "if", "it",
        "islam", "islamic", "muslim", "muslims", "ruling", "according", "tell", "me", "please",
        "assalamu", "alaikum", "bhai", "bhaiya", "hujur", "sheikh", "hello", "hi", "hey",
    ]
}

GREETING_PATTERNS = re.compile(
    r"^\s*(?:আসসালামু\s*আলাইকুম|সালাম|assalamu\s*alaikum|salam|hello|hi|hey|হ্যালো|হাই|সুপ্রভাত|শুভ\s*সকাল)"
    r"(?:\s+ওয়া\s*রাহমাতুল্লাহ(?:ি\s*ওয়া\s*বারাকাতুহু?)?)?[।!?.,\s]*$",
    re.IGNORECASE,
)

IDENTITY_PATTERNS = re.compile(
    r"(?:তুমি\s*কে|আপনি\s*কে|তোমার\s*নাম\s*ক[িী]|আপনার\s*নাম\s*ক[িী]|কে\s*তৈরি\s*করেছে|"
    r"ক[িী]ভাবে\s*কাজ\s*করো?|তুমি\s*ক[িী]\s*করতে\s*পারো?|who\s*are\s*you|what\s*are\s*you|"
    r"how\s*do\s*you\s*work|dawah\s*x\s*ai\s*ক[িী])",
    re.IGNORECASE,
)


_BANGLISH_INFLECTIONS = ("gulo", "gula", "der", "ter", "tar", "tir", "er", "te", "ke", "ta", "ti", "ra", "e", "y", "r", "s", "ing")
_COMPOUND_BN = [
    ("পিতামাতা", "পিতা মাতা"),
    ("মাবাবা", "মা বাবা পিতা মাতা"),
    ("স্বামীস্ত্রী", "স্বামী স্ত্রী"),
    ("ভাইবোন", "ভাই বোন"),
    ("ছেলেমেয়ে", "ছেলে মেয়ে"),
    ("শবেবরাত", "শবে বরাত"),
    ("শবে কদর", "শবে কদর লাইলাতুল কদর"),
    ("শবেকদর", "শবে কদর লাইলাতুল কদর"),
    ("বদ নজর", "বদনযর নযর রুকইয়াহ"),
    ("বদনজর", "বদনযর নযর রুকইয়াহ"),
    ("রক্তদান", "রক্ত দান রোগীকে"),
    ("অঙ্গদান", "অঙ্গ দান প্রতিস্থাপন"),
    ("সিজদায়ে সাহু", "সাহু সিজদা"),
    ("সিজদায়েসাহু", "সাহু সিজদা"),
    ("ঈদুলফিতর", "ঈদুল ফিতর"),
    ("ঈদুলআযহা", "ঈদুল আযহা"),
]


def translate_banglish_and_english(raw_query: str) -> Tuple[str, List[str]]:
    """Replace known Latin/Banglish/English tokens (including inflections) with Bengali Islamic terms."""
    mapped_phrases: List[str] = []

    def _repl(match: re.Match[str]) -> str:
        raw_w = match.group(0)
        low = raw_w.lower()
        for w in (low, re.sub(r"([aeiou])\1+", r"\1", low)):
            if w in BANGLISH_AND_EN_MAP:
                mapped_phrases.append(BANGLISH_AND_EN_MAP[w])
                return f" {BANGLISH_AND_EN_MAP[w]} "
            for suf in _BANGLISH_INFLECTIONS:
                if len(w) - len(suf) >= 3 and w.endswith(suf):
                    stem = w[: -len(suf)]
                    if stem in BANGLISH_AND_EN_MAP:
                        mapped_phrases.append(BANGLISH_AND_EN_MAP[stem])
                        return f" {BANGLISH_AND_EN_MAP[stem]} "
        if len(low) == 1 or low in BANGLISH_STOP_WORDS:
            return " "
        return raw_w

    converted = re.sub(r"[a-zA-Z]+", _repl, raw_query)
    return converted, mapped_phrases


def tokenize_folded(text: str, stem: bool = True) -> List[str]:
    """Tokenize into folded (and optionally stemmed) Bengali/Latin tokens."""
    expanded_text = text
    for comp, split_form in _COMPOUND_BN:
        if comp in expanded_text:
            expanded_text = expanded_text.replace(comp, split_form)
    folded = fold_bn(expanded_text)
    # Remove Arabic script tokens from Bengali lexical tokens
    folded = _ARABIC_RE.sub(" ", folded)
    raw_tokens = _TOKEN_RE.findall(folded)
    out: List[str] = []
    for tok in raw_tokens:
        if len(tok) < 2 or len(tok) > 32:
            continue
        if tok.isdigit() and len(tok) > 4:
            continue
        out.append(stem_bn(tok) if stem else tok)
    return out


def expand_query_tokens(tokens: List[str]) -> Tuple[List[str], Dict[str, float]]:
    """Expand query tokens with Islamic synonyms, assigning 1.0 weight to originals & 0.72 to synonyms."""
    weights: Dict[str, float] = {}
    ordered: List[str] = []
    for tok in tokens:
        if tok not in weights:
            ordered.append(tok)
        weights[tok] = max(weights.get(tok, 0.0), 1.0)
        for syn in SYNONYM_MAP.get(tok, ()):
            st = stem_bn(syn)
            if st not in weights:
                ordered.append(st)
                weights[st] = 0.72
    return ordered, weights


def is_core_content_token(tok: str) -> bool:
    """True when token represents substantive topical content rather than generic question syntax."""
    if len(tok) < 2 or tok.isdigit():
        return False
    if tok in GENERIC_QUERY_WORDS:
        return False
    # Also check unstemmed/stemmed overlap with generic words
    for gw in ("কর", "হও", "দেও", "নেও", "বল", "থাক", "পার", "যাও", "ইসলাম", "মুসলিম"):
        if tok == fold_bn(gw):
            return False
    return True


def detect_conversational_intent(query: str) -> str | None:
    """Return 'greeting' or 'identity' for pure meta/greeting messages, else None."""
    q = query.strip()
    if not q:
        return "empty"
    if GREETING_PATTERNS.match(q):
        return "greeting"
    if len(q) <= 70 and IDENTITY_PATTERNS.search(q):
        # Make sure they aren't asking an Islamic question like "আল্লাহ কে?"
        f = fold_bn(q)
        if "আল্লাহ" not in f and "রব" not in f and "নবি" not in f and "রাসুল" not in f:
            return "identity"
    return None
