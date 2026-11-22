# DAWAH X AI — ইসলামিক প্রশ্নোত্তর এআই মডেল

**[DAWAH X (https://ebrahim-ead.github.io/DAWAH-X/)](https://ebrahim-ead.github.io/DAWAH-X/)**-এর সম্পূর্ণ জ্ঞানভাণ্ডার (**২৪,২০৭+ ফতোয়া, প্রশ্নোত্তর ও প্রবন্ধ** এবং **৯,৩১০+ ইসলামিক ভিডিও**) থেকে দলিলভিত্তিক ও মনগড়া-ফতোয়ামুক্ত উত্তর প্রদানকারী হাইব্রিড এআই মডেল ও ওয়েব অ্যাপ্লিকেশন।

---

## মূল বৈশিষ্ট্যসমূহ (Key Features)

1. **শতভাগ DAWAH X দলিলনির্ভর (Zero-Hallucination Grounding)**:
   - মডেলটি **মাসিক আত-তাহরীক**, **মাসিক আল-ইতিছাম**, **মাসিক আল-ইখলাছ**, **From Muslims**, **Response to Anti-Islam**, **Insight Zone** এবং **Islamic Authors**—এই ৭টি যাচাইকৃত উৎসের ২৪,২০৭+ লেখা ও ৯,৩১০+ ইউটিউব ভিডিও থেকে সরাসরি উত্তর প্রদান করে।
   - প্রতিটি উত্তরে কুরআন ও সহীহ হাদীসের উদ্ধৃত দলিল এবং সরাসরি `https://ebrahim-ead.github.io/DAWAH-X/read.html?k=...` রেফারেন্স লিংক থাকে।
   - ওয়েবসাইটে নেই এমন কোনো মাসআলা বা অপ্রাসঙ্গিক প্রশ্নের ক্ষেত্রে অনুমানভিত্তিক ফতোয়া না দিয়ে বিনয়ের সাথে বিরত থাকে এবং DAWAH X টিমে প্রশ্ন পাঠানোর (`ask.html`) লিংক দেয়।

2. **মাল্টি-স্টেজ হাইব্রিড এনএলপি ও নিউরাল রির‍্যাঙ্কার আর্কিটেকচার**:
   - **বাংলা + Banglish + English প্রসেসর**: হাদিস/হাদীছ, সালাত/ছালাত/নামাজ, সিয়াম/ছিয়াম/রোজা ইত্যাদি বানানভেদ একীভূতকরণ (`fold_bn`), বাংলা বিভক্তি স্টেমিং (`stem_bn`), ৯৫+ ইসলামিক প্রতিশব্দ ক্লাস্টার এবং Banglish (`namaz e sahu sijda dewar niyom`) ও ইংরেজি প্রশ্ন রূপান্তর।
   - **Dual-Field BM25F + 65K Bigram TF-IDF**: শিরোনাম, প্রশ্ন ও মূল উত্তরের ওপর দ্রুতগতির স্পার্স রিট্রিভাল।
   - **192-Dim TruncatedSVD Semantic Embeddings**: ভিন্ন শব্দে করা প্রশ্নের অর্থগত মিল খুঁজে বের করার ডেনস ভেক্টর স্পেস।
   - **Supervised MLP(48, 24) Neural Reranker**: ১২টি লেক্সিকাল, সেমান্টিক ও IDF-কভারেজ ফিচারের ওপর ট্রেইনকৃত নিউরাল রির‍্যাঙ্কার (**Recall@1: 98.5%**, **Recall@5: 100%**, **MRR@10: 0.9917**, গড় সময় **~48ms**)।

3. **আপনার GitHub Pages সাইটে (`DAWAH-X`) সরাসরি যুক্ত করার উইজেট (`static/dawahx-ai-widget.js`)**:
   - কোনো পেইড ব্যাকএন্ড সার্ভার ছাড়াই সরাসরি GitHub Pages-এর স্ট্যাটিক `search/` শার্ড ও `texts/` ফাইল পড়ে কাজ করতে পারে, অথবা চাইলে Python FastAPI সার্ভারের সাথেও যুক্ত করা যায়।

---

## কীভাবে চালাবেন (Cloudflare Workers AI, GitHub Pages ও Local)

### ১. ☁️ Cloudflare Workers AI-এ ফ্রি জেনারেটিভ এআই ডিপ্লয় (সবচেয়ে শক্তিশালী মোড)
এই রিপোজিটরিতে `wrangler.toml`, `cloudflare/worker.js` ও `cloudflare/ai-handler.js` আগে থেকেই সম্পূর্ণ প্রস্তুত রয়েছে। এটি যুক্ত করলে ভিজিটররা কোনো API Key ছাড়াই **Llama 3.3 70B** মডেলের মাধ্যমে লাইভ স্ট্রিমিং কথোপকথন ও শতভাগ DAWAH X দলিলভিত্তিক সুবিন্যস্ত উত্তর পাবেন।

**পদ্ধতি ক — Cloudflare Dashboard থেকে ১ ক্লিকে (সবচেয়ে সহজ, কোনো টোকেন লাগবে না):**
1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create**-এ যান।
2. **Import a repository** নির্বাচন করে আপনার GitHub রিপোজিটরি `dawah-x/card` যুক্ত করুন এবং **Deploy** চাপুন।
3. ডিপ্লয় শেষ হলে `https://dawahx-ai.<subdomain>.workers.dev` লিংকে পূর্ণ সাইট + লাইভ এআই একসাথে চালু হয়ে যাবে! চাইলে এই URL-টি `https://dawah-x.github.io/card/`-এর **মডেল ও সেটিংস** বক্সেও সেভ করতে পারেন।

**পদ্ধতি খ — GitHub Actions অটো-ডিপ্লয় (ঐচ্ছিক):**
- আপনার GitHub রিপোজিটরির **Settings → Secrets and variables → Actions**-এ গিয়ে দুটি Secret যুক্ত করুন:
  - `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit + Workers AI Read পারমিশনসহ)
  - `CLOUDFLARE_ACCOUNT_ID`
- এরপর থেকে `main` ব্রাঞ্চে যেকোনো পরিবর্তন মার্জ হলেই `.github/workflows/deploy-cloudflare.yml` স্বয়ংক্রিয়ভাবে আপনার Cloudflare Worker আপডেট করে দেবে।

### ২. GitHub Pages-এ সরাসরি (কোনো সার্ভার ছাড়াই)
রিপোজিটরির রুটে থাকা `index.html`, `.nojekyll`, `styles.css`, `browser-ai.js` ও `app.js` সরাসরি **GitHub Pages** (`https://dawah-x.github.io/card/`)-এ চলে এবং ব্রাউজার থেকেই সরাসরি `https://ebrahim-ead.github.io/DAWAH-X/`-এর স্ট্যাটিক ইনডেক্স ও লেখা পড়ে উত্তর দেয়।

### ৩. লোকাল কম্পিউটারে বা Python সার্ভারে

```bash
# স্ট্যাটিক মোডে চালাতে:
python3 -m http.server 8000

# অথবা পূর্ণ Python FastAPI + Neural Reranker মোডে চালাতে:
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python run.py
```

ব্রাউজারে খুলুন: `http://localhost:8000`

### নতুন লেখা/ভিডিও আপডেট সিঙ্ক ও পুনঃট্রেইন

```bash
.venv/bin/python train.py --sync
```

অথবা সার্ভার চালু অবস্থায় UI-এর **"↻ DAWAH X থেকে লাইভ আপডেট সিঙ্ক"** বোতামে ক্লিক করুন (`POST /api/sync`)।

---

## DAWAH-X ওয়েবসাইটে ভাসমান এআই চ্যাটবট যুক্ত করার নিয়ম

`static/dawahx-ai-widget.js` ফাইলটি আপনার `Ebrahim-ead/DAWAH-X` রিপোজিটরির root ফোল্ডারে রেখে `index.html` (বা সব পাতার) `</body>`-এর ঠিক আগে নিচের লাইনটি যোগ করুন:

```html
<script src="dawahx-ai-widget.js" defer></script>
```

যদি আলাদা সার্ভারে হোস্ট করা Python AI API ব্যবহার করতে চান, তবে তার আগে দিন:

```html
<script>
  window.DAWAHX_AI_API_URL = "https://your-dawahx-ai-server.example.com";
</script>
<script src="dawahx-ai-widget.js" defer></script>
```
