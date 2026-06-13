import type { Env } from '../types';

// ─────────────────────────────────────────────────────────────────────────
// Channel micro-series engine
//
// A micro-series is a multi-day themed thread of bite-sized lessons. Each part
// teaches exactly ONE concept and ends on a cliffhanger that teases the next
// installment ("Besok: ..."). This builds a habit loop — followers come back
// tomorrow for the payoff. Think Duolingo's streak psychology, but for a
// Telegram channel.
//
// Content lives here in code (hardcoded SERIES array). The DB table
// channel_series_state (migration 102) tracks ONLY which part of which series
// posts next. One series is "active" at a time; when its parts are exhausted
// the engine marks it finished and seeds the next series, wrapping around.
//
// All DB ops are best-effort. If the table is missing (migration not run yet)
// getNextSeriesPost falls back to statelessly returning Part 1 of Series 1, so
// the channel never goes dark.
// ─────────────────────────────────────────────────────────────────────────

const OSEE_BOT = 'https://t.me/osee_IBT_IELTS_tutor_bot?start=';

export interface SeriesPart {
  hook: string;        // 1-line opener that grabs attention
  body: string;        // bite-sized lesson, 8-12 lines, *bold* key terms, ONE concept
  cliffhanger: string; // teases the next part: "Besok: ..."
}

export interface Series {
  id: string;
  title: string;
  parts: SeriesPart[];
}

// ─────────────────────────────────────────────────────────────────────────
// The series catalog. Order matters — the engine cycles through them in
// sequence and wraps back to index 0 after the last one finishes.
// ─────────────────────────────────────────────────────────────────────────

export const SERIES: Series[] = [
  {
    id: 'articles-5-hari',
    title: '5 Hari Kuasai Articles (a / an / the)',
    parts: [
      {
        hook: 'Hari 1: kapan pakai *a* dan kapan pakai *an*? 90% orang masih nebak. 🎲',
        body:
          'Aturannya BUKAN soal huruf — tapi soal *bunyi* kata berikutnya.\n\n' +
          '• Pakai *a* kalau kata berikutnya diawali bunyi *konsonan*.\n' +
          '  → *a* university (dibaca "yuu-niversity" → bunyi Y)\n' +
          '  → *a* European country (bunyi "yu")\n\n' +
          '• Pakai *an* kalau diawali bunyi *vokal*.\n' +
          '  → *an* hour (huruf H, tapi bunyinya "aw-er" → vokal)\n' +
          '  → *an* MBA (huruf M, tapi dibaca "em-bi-ei" → vokal)\n\n' +
          'Jadi lupakan "huruf vokal a-i-u-e-o". Ucapin kata-nya dulu, dengerin bunyi pertamanya.',
        cliffhanger:
          'Besok Hari 2: *a* vs *the* — kapan barangnya "umum" dan kapan "yang itu". Salah satu paling sering kena di TOEFL Structure. 👀',
      },
      {
        hook: 'Hari 2: *a* book vs *the* book — bedanya satu kata, artinya beda jauh. 📚',
        body:
          'Kunci-nya: apakah lawan bicara *tau persis* benda mana yang lo maksud?\n\n' +
          '• *a/an* = first mention, masih umum, belum spesifik.\n' +
          '  → "I read *a* book yesterday." (buku apa? belum penting)\n\n' +
          '• *the* = both of us tau benda mana.\n' +
          '  → "*The* book was amazing." (buku yang tadi disebut)\n\n' +
          'Pola klasik exam:\n' +
          '"I saw *a* dog. *The* dog was barking."\n' +
          '→ Pertama *a* (baru kenalan), kedua *the* (udah kenal).\n\n' +
          'Rumus cepat: *new info → a* | *known info → the*.',
        cliffhanger:
          'Besok Hari 3: kapan article-nya HARUS dihapus (zero article). Banyak yang overpakai *the* di sini. ⛔',
      },
      {
        hook: 'Hari 3: kadang article yang BENAR justru... nggak ada. (zero article) 🚫',
        body:
          'Beberapa kata tolak *a/an/the* — disebut *zero article*.\n\n' +
          'Dipakai untuk hal yang dibicarakan secara *umum / general*:\n' +
          '• Plural umum → "*Cats* are independent." (bukan "The cats")\n' +
          '• Uncountable umum → "*Water* is essential." (bukan "The water")\n' +
          '• Abstract umum → "*Knowledge* is power."\n\n' +
          'Juga untuk:\n' +
          '• Nama orang/negara/kota → "I live in *Indonesia*."\n' +
          '• Makanan/olahraga → "I play *football*."\n\n' +
          'Trap exam: "_____ honesty is important." → jawabannya *zero* (∅), bukan *The*.',
        cliffhanger:
          'Besok Hari 4: *the* + superlatif & benda unik (the sun, the best). Aturan yang bikin kalimat lo langsung kedengeran rapi. ☀️',
      },
      {
        hook: 'Hari 4: ada benda yang WAJIB pakai *the* — selalu, tanpa kecuali. ✅',
        body:
          'Pakai *the* kalau benda-nya cuma ADA SATU di dunia / konteks:\n\n' +
          '• Benda unik → *the* sun, *the* moon, *the* sky, *the* internet\n' +
          '• Superlatif → *the* best, *the* tallest, *the* most important\n' +
          '  → "She is *the* smartest in class." (cuma 1 ter-pintar)\n' +
          '• Ordinal → *the* first, *the* second, *the* last\n' +
          '• Grup unik → *the* government, *the* police\n\n' +
          'Kenapa? Karena cuma ada satu → lawan bicara langsung tau yang mana → *the*.\n\n' +
          'Quick check: "_____ highest mountain is Everest." → *The* (cuma 1 tertinggi).',
        cliffhanger:
          'Besok Hari 5 (FINALE): 1 menit mini-test gabungin semua aturan. Berani buktiin lo udah jago? 🏁',
      },
      {
        hook: 'Hari 5 FINALE: waktunya buktiin. 5 soal, isi article yang benar. 🏁',
        body:
          'Isi titik-titik (a / an / the / ∅):\n\n' +
          '1. She is _____ honest person. → *an* (bunyi vokal "o")\n' +
          '2. _____ Mount Everest is tall. → *∅* (nama gunung, zero article)\n' +
          '3. I need _____ advice. → *∅* (uncountable umum)\n' +
          '4. He bought _____ car. _____ car is red. → *a* ... *the*\n' +
          '5. It was _____ best day ever. → *the* (superlatif)\n\n' +
          'Berapa benar lo? 🎯\n' +
          '5/5 = mastery! | 3-4 = solid, tinggal poles | <3 = ulang dari Hari 1.\n\n' +
          'Articles itu "kecil tapi mematikan" di TOEFL/IELTS — sekarang lo udah pegang aturannya.',
        cliffhanger:
          'Series baru mulai besok. Mau latihan lebih banyak + auto-koreksi? Bawa skill ini ke bot. 👇',
      },
    ],
  },
  {
    id: 'grammar-7-kesalahan',
    title: '7 Kesalahan Grammar Orang Indonesia',
    parts: [
      {
        hook: 'Kesalahan #1: "I am *agree* with you." — kedengeran bener, padahal salah. ❌',
        body:
          '*Agree* itu KATA KERJA (verb), bukan kata sifat (adjective).\n\n' +
          'Jadi nggak butuh "am/is/are" di depannya.\n\n' +
          '❌ I *am agree* with you.\n' +
          '✅ I *agree* with you.\n\n' +
          'Kenapa orang Indo sering salah? Karena di Bahasa Indonesia "setuju" terasa seperti kata sifat ("aku setuju").\n\n' +
          'Kata kerja lain yang sering kena trap sama:\n' +
          '❌ I am *understand* → ✅ I *understand*\n' +
          '❌ I am *know* → ✅ I *know*\n\n' +
          'Rule: kalau udah ada verb-nya, jangan tambah "to be" lagi.',
        cliffhanger:
          'Besok #2: "*Although... but...*" — dobel connector yang bikin examiner ngernyit. Lo mungkin sering pakai ini. 😬',
      },
      {
        hook: 'Kesalahan #2: "Although it was raining, *but* we went out." — double connector! 🚫',
        body:
          'Dalam English, satu hubungan = satu connector. Nggak boleh dobel.\n\n' +
          '❌ *Although* it rained, *but* we went out.\n' +
          '✅ *Although* it rained, we went out.\n' +
          '✅ It rained, *but* we went out.\n\n' +
          'Pilih SALAH SATU, jangan dua-duanya.\n\n' +
          'Pasangan yang sering di-dobel orang Indo:\n' +
          '❌ *Because*... *so*... → pilih satu\n' +
          '❌ *Even though*... *but*... → pilih satu\n\n' +
          'Asalnya dari pola Indonesia "Walaupun... tapi..." yang dobelnya wajar. Di English: haram. 🙅',
        cliffhanger:
          'Besok #3: "people *is*" vs "people *are*" — kata yang kelihatan singular tapi sebenarnya plural. 👥',
      },
      {
        hook: 'Kesalahan #3: "People *is* nice here." — *people* itu jamak! 👥',
        body:
          '*People* = bentuk jamak dari *person*. Jadi verb-nya harus plural.\n\n' +
          '❌ People *is* friendly.\n' +
          '✅ People *are* friendly.\n\n' +
          'Kata "jebakan" yang bentuknya nggak keliatan plural tapi PLURAL:\n' +
          '• *people* → are (bukan is)\n' +
          '• *children* → are\n' +
          '• *men / women* → are\n\n' +
          'Sebaliknya, kelihatan plural tapi SINGULAR:\n' +
          '• *news* → "The news *is* good." ✅\n' +
          '• *physics / mathematics* → is\n\n' +
          'Jangan percaya akhiran -s mentah-mentah. Cek arti-nya dulu.',
        cliffhanger:
          'Besok #4: "I have *visited* Bali *last year*." — kombinasi tense yang nggak boleh ketemu. ⏰',
      },
      {
        hook: 'Kesalahan #4: "I have visited Bali *last year*." — present perfect + waktu spesifik = tabrakan! ⏰',
        body:
          'Aturan emas: *present perfect* (have/has + V3) TIDAK BOLEH dipakai dengan waktu lampau yang spesifik.\n\n' +
          '❌ I *have visited* Bali *last year*.\n' +
          '✅ I *visited* Bali last year. (simple past — ada "last year")\n' +
          '✅ I *have visited* Bali. (present perfect — tanpa waktu spesifik)\n\n' +
          'Kapan pakai apa:\n' +
          '• Ada *yesterday / last week / in 2020* → *simple past*\n' +
          '• Pengalaman tanpa waktu jelas → *present perfect*\n' +
          '  → "I *have been* to Japan." (kapan? nggak penting)\n\n' +
          'Trik: kalau lo bisa tunjuk KAPAN-nya → simple past.',
        cliffhanger:
          'Besok #5: "*Everyday* I study" vs "I study *every day*" — beda spasi, beda makna total. 📅',
      },
      {
        hook: 'Kesalahan #5: "*Everyday* I study English." — spasinya salah, artinya berubah! 📅',
        body:
          'Dua kata yang KELIHATAN sama tapi beda fungsi:\n\n' +
          '• *every day* (2 kata) = setiap hari (keterangan waktu)\n' +
          '  → "I study English *every day*." ✅\n\n' +
          '• *everyday* (1 kata) = sehari-hari / biasa (kata sifat)\n' +
          '  → "This is an *everyday* problem." ✅ (masalah sehari-hari)\n\n' +
          'Tes cepat: kalau artinya "each day / tiap hari" → *every day* (pisah).\n\n' +
          'Saudara-nya yang sama jebakannya:\n' +
          '• *everyone* (semua orang) vs *every one* (setiap satu)\n' +
          '• *anytime* vs *any time*\n\n' +
          'Di writing exam, spasi salah = poin grammar melayang.',
        cliffhanger:
          'Besok #6: "*Make* homework" atau "*do* homework"? Verb kolokasi yang sering ketuker. 🔧',
      },
      {
        hook: 'Kesalahan #6: "*Make* homework" — harusnya *do* homework. Salah pasangan kata! 🔧',
        body:
          '*Make* dan *do* sama-sama "melakukan", tapi pasangannya beda (collocation).\n\n' +
          'Pakai *DO* untuk tugas/pekerjaan & aktivitas:\n' +
          '✅ *do* homework, *do* the dishes, *do* exercise, *do* a job\n\n' +
          'Pakai *MAKE* untuk menciptakan/menghasilkan:\n' +
          '✅ *make* a mistake, *make* a decision, *make* money, *make* friends\n\n' +
          'Yang sering ketuker orang Indo:\n' +
          '❌ make homework → ✅ *do* homework\n' +
          '❌ do a mistake → ✅ *make* a mistake\n' +
          '❌ make a research → ✅ *do* research\n\n' +
          'Collocation nggak ada logikanya — harus dihafal pola-nya.',
        cliffhanger:
          'Besok #7 (FINALE): "*explain me*" — preposisi hilang yang bikin kalimat lo "rasa terjemahan". 🎯',
      },
      {
        hook: 'Kesalahan #7 FINALE: "Please *explain me* this." — ada kata yang hilang! 🎯',
        body:
          'Beberapa verb butuh *to* sebelum orangnya. *Explain* salah satunya.\n\n' +
          '❌ Please *explain me* this.\n' +
          '✅ Please *explain* this *to me*.\n' +
          '✅ Please *explain* it *to me*.\n\n' +
          'Verb "wajib pakai *to*" yang sering kena:\n' +
          '• explain *to* me\n' +
          '• describe *to* me\n' +
          '• say *to* me ("say to me", bukan "say me")\n' +
          '• suggest *to* me\n\n' +
          'Bandingkan — yang ini JUSTRU tanpa to:\n' +
          '✅ tell me, give me, show me, send me\n\n' +
          'Itu dia 7 kesalahan paling umum. Sekarang lo udah selangkah di atas rata-rata. 💪',
        cliffhanger:
          'Series baru mulai besok! Mau di-koreksi real-time pas nulis & ngomong? Lanjut latihan di bot. 👇',
      },
    ],
  },
  {
    id: 'speaking-5-hari-pede',
    title: '5 Hari Speaking Pede',
    parts: [
      {
        hook: 'Hari 1: rahasia speaking lancar BUKAN vocab gede — tapi *filler phrases*. 🗣️',
        body:
          'Native speaker juga mikir saat ngomong. Bedanya, mereka isi jeda pakai *filler* — bukan diam canggung atau "eee...".\n\n' +
          'Ganti "eee / emm" dengan frasa natural:\n' +
          '• "*Well,* let me think..."\n' +
          '• "*That\'s a good question.*"\n' +
          '• "*Actually,* I\'d say..."\n' +
          '• "*You know,* it depends..."\n\n' +
          'Kenapa ampuh? Filler kasih lo *2-3 detik* buat nyusun kalimat — TANPA keliatan blank. Di IELTS Speaking, fluency dinilai dari *kelancaran*, bukan kecepatan.\n\n' +
          'Latihan: hari ini, tiap mau jawab apa pun, mulai dari satu filler di atas.',
        cliffhanger:
          'Besok Hari 2: teknik *PREP* — kerangka 4 langkah biar jawaban lo selalu terstruktur & nggak muter-muter. 🧩',
      },
      {
        hook: 'Hari 2: kenapa jawaban lo muter-muter? Karena nggak ada kerangka. Pakai *PREP*. 🧩',
        body:
          '*PREP* = formula 4 langkah biar jawaban panjang tetap rapi:\n\n' +
          '• *P* — Point (poin utama): "I think online class is better."\n' +
          '• *R* — Reason (alasan): "because it saves a lot of time."\n' +
          '• *E* — Example (contoh): "For example, I don\'t need to commute 2 hours."\n' +
          '• *P* — Point lagi (tutup): "So that\'s why I prefer it."\n\n' +
          'Cuma dengan PREP, jawaban 5 detik bisa jadi 30 detik yang *terstruktur*.\n\n' +
          'Examiner suka ini — coherence (keterhubungan ide) itu salah satu kriteria skor.',
        cliffhanger:
          'Besok Hari 3: cara "ngarang" jawaban kalau lo nggak tau topiknya. (Iya, boleh bohong di speaking!) 🤫',
      },
      {
        hook: 'Hari 3: ditanya topik yang lo nggak ngerti? *Boleh ngarang.* Examiner nggak fact-check. 🤫',
        body:
          'IELTS/TOEFL Speaking nilai BAHASA lo, bukan KEBENARAN jawaban. Jadi kalau topiknya asing — karang aja yang masuk akal.\n\n' +
          'Frasa "buang waktu sambil mikir" + buka jalan ngarang:\n' +
          '• "I\'m not an expert, but I\'d imagine that..."\n' +
          '• "I\'ve heard that... though I\'m not 100% sure."\n' +
          '• "From what I understand,..."\n\n' +
          'Contoh: ditanya soal "traditional music" yang lo nggak tau →\n' +
          '"Honestly I rarely listen to it, *but I\'d imagine* it plays a big role in ceremonies..."\n\n' +
          'Lihat? Lo tetap ngomong lancar tanpa benar-benar tau topiknya.',
        cliffhanger:
          'Besok Hari 4: upgrade kata "boring" — ganti vocab basic jadi band-7 dalam 1 menit. 📈',
      },
      {
        hook: 'Hari 4: "It was *good*." → band 5. Upgrade kata basic = naik band instan. 📈',
        body:
          'Examiner bosan denger *good, bad, nice, very*. Ganti dengan versi "naik kelas":\n\n' +
          '• good → *excellent / fantastic / impressive*\n' +
          '• bad → *terrible / disappointing / awful*\n' +
          '• nice → *lovely / pleasant / enjoyable*\n' +
          '• very tired → *exhausted*\n' +
          '• very happy → *thrilled / delighted*\n' +
          '• very big → *enormous / massive*\n\n' +
          'Trik "very + adjective": ganti jadi SATU kata kuat.\n' +
          '→ "very tired" jadi "*exhausted*" — langsung kedengeran advanced.\n\n' +
          'Hari ini: pilih 3 kata di atas, paksa diri pakai pas ngomong.',
        cliffhanger:
          'Besok Hari 5 (FINALE): rahasia intonasi — kenapa kalimat lo kedengeran "robot" & cara fix-nya. 🎵',
      },
      {
        hook: 'Hari 5 FINALE: kenapa English lo kedengeran "robot"? Soal *intonasi*, bukan grammar. 🎵',
        body:
          'Orang Indo sering ngomong datar (flat) karena Bahasa Indonesia memang lebih rata nada-nya. English itu naik-turun.\n\n' +
          '2 aturan intonasi cepat:\n\n' +
          '• *Tekankan kata penting* (content words): noun, verb, adjective.\n' +
          '  → "I *really* LOVE this CITY." (tekan yang kapital)\n\n' +
          '• *Nada naik* di pertanyaan yes/no, *turun* di pernyataan & WH-question.\n' +
          '  → "Are you ready?↗" | "Where are you?↘"\n\n' +
          'Latihan ampuh: rekam diri lo baca 1 paragraf, dengerin lagi. Datar? Ulangi dengan "nyanyiin" kata pentingnya.\n\n' +
          'Itu dia 5 hari speaking pede — sekarang giliran lo praktek beneran. 🔥',
        cliffhanger:
          'Series baru besok! Mau rekam suara & dapat skor pronunciation per kata dari AI? Cobain di bot. 👇',
      },
    ],
  },
  {
    id: 'vocab-beasiswa-5-hari',
    title: 'Vocab Beasiswa: 5 Hari',
    parts: [
      {
        hook: 'Hari 1: 3 kata yang bikin motivation letter beasiswa lo langsung "naik kelas". ✍️',
        body:
          'Kata basic bikin essay lo terdengar biasa. Ganti dengan academic vocab:\n\n' +
          '• *endeavor* (n/v) = usaha keras, upaya\n' +
          '  → "my academic *endeavors*" (bukan "my efforts")\n\n' +
          '• *aspire to* = bercita-cita\n' +
          '  → "I *aspire to* become a researcher." (bukan "I want to be")\n\n' +
          '• *foster* (v) = memupuk, menumbuhkan\n' +
          '  → "to *foster* collaboration" (bukan "to make")\n\n' +
          'Satu kata academic yang tepat > tiga kalimat basic. Komite beasiswa baca ribuan essay — vocab yang matang bikin lo stand out.',
        cliffhanger:
          'Besok Hari 2: kata-kata buat nunjukin "dampak & kontribusi" — yang dicari banget di essay beasiswa. 🌍',
      },
      {
        hook: 'Hari 2: komite beasiswa cari kandidat yang bikin *impact*. Ini kata-katanya. 🌍',
        body:
          'Tunjukin kontribusi lo dengan verb yang kuat:\n\n' +
          '• *contribute to* = berkontribusi pada\n' +
          '  → "to *contribute to* sustainable development"\n\n' +
          '• *empower* (v) = memberdayakan\n' +
          '  → "to *empower* underprivileged students"\n\n' +
          '• *address* (v) = menangani (masalah)\n' +
          '  → "to *address* climate challenges" (bukan "to fix")\n\n' +
          '• *bridge the gap* = menjembatani kesenjangan\n' +
          '  → "to *bridge the gap* between theory and practice"\n\n' +
          'Pola juara: hubungkan studi lo ke masalah nyata + kata "impact" di atas.',
        cliffhanger:
          'Besok Hari 3: linking words biar essay lo ngalir mulus, bukan kayak daftar belanja. 🔗',
      },
      {
        hook: 'Hari 3: essay lo lompat-lompat antar ide? Butuh *linking words* yang tepat. 🔗',
        body:
          'Penghubung antar kalimat bikin tulisan ngalir & terstruktur:\n\n' +
          'Menambah ide:\n' +
          '• *Furthermore,* / *Moreover,* = lebih lanjut\n' +
          'Menunjukkan akibat:\n' +
          '• *Consequently,* / *As a result,* = akibatnya\n' +
          'Kontras:\n' +
          '• *Nevertheless,* = meskipun demikian\n' +
          '• *In contrast,* = sebaliknya\n' +
          'Memberi contoh:\n' +
          '• *For instance,* = sebagai contoh\n\n' +
          'Tips: jangan mulai TIAP kalimat dengan "And" / "But". Variasikan dengan linking words formal di atas — itu ciri tulisan akademik.',
        cliffhanger:
          'Besok Hari 4: kata kerja "prestasi" buat CV & essay — ganti "I did" jadi yang berbobot. 🏅',
      },
      {
        hook: 'Hari 4: di CV beasiswa, "I did a project" itu lemah. Pakai *action verb* berbobot. 🏅',
        body:
          'Action verb bikin pencapaian lo terdengar profesional:\n\n' +
          '• *spearheaded* = memimpin/memprakarsai\n' +
          '  → "*spearheaded* a community project"\n' +
          '• *initiated* = memulai/mencetuskan\n' +
          '  → "*initiated* a recycling program"\n' +
          '• *facilitated* = memfasilitasi\n' +
          '  → "*facilitated* workshops for 50 students"\n' +
          '• *achieved* = mencapai\n' +
          '  → "*achieved* a 20% increase in..."\n\n' +
          'Rumus CV juara: *action verb* + apa yang dilakukan + *angka/hasil*.\n' +
          '→ "*Spearheaded* a literacy drive, *reaching* 200 children."',
        cliffhanger:
          'Besok Hari 5 (FINALE): 5 frasa penutup essay yang bikin komite inget nama lo. 🎓',
      },
      {
        hook: 'Hari 5 FINALE: kalimat penutup essay = kesan terakhir. Bikin berkesan. 🎓',
        body:
          'Tutup essay beasiswa dengan frasa kuat yang nunjukin visi & komitmen:\n\n' +
          '• "I am *firmly committed to*..." = sangat berkomitmen pada\n' +
          '• "This scholarship would be *instrumental in*..." = sangat berperan dalam\n' +
          '• "I am *determined to* make a *meaningful contribution*."\n' +
          '• "*Equipped with* this opportunity, I will..."\n' +
          '• "I look forward to *giving back to* my community."\n\n' +
          'Pola penutup juara:\n' +
          'Visi masa depan + bagaimana beasiswa membantu + janji kontribusi.\n\n' +
          'Itu dia 5 hari vocab beasiswa. Sekarang essay lo punya senjata baru. ✨',
        cliffhanger:
          'Series baru besok! Mau essay & speaking lo dikoreksi AI sebelum kirim aplikasi? Lanjut di bot. 👇',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Formatter — turns one part into a channel-ready post string.
//
// Output uses *bold* / _italic_ markers (postToChannel runs them through
// channelMarkdownToHtml). Layout: SERIES badge + Part N/Total + series title +
// hook + body + cliffhanger + bot CTA + hashtags.
// ─────────────────────────────────────────────────────────────────────────

export function formatSeriesPart(series: Series, partIndex: number): string | null {
  const part = series.parts[partIndex];
  if (!part) return null;

  const partNum = partIndex + 1;
  const total = series.parts.length;
  const isFinale = partNum === total;

  // start payload encodes which series the follower came from, for attribution.
  const startCtx = `series_${series.id}`;

  let text = `📚 SERIES | *${series.title}*\n`;
  text += `▫️ Part ${partNum}/${total}${isFinale ? ' · FINALE 🏁' : ''}\n`;
  text += `━━━━━━━━━━━━━━━\n\n`;

  // Hook
  text += `${part.hook}\n\n`;

  // Body (the bite-sized lesson)
  text += `${part.body}\n\n`;

  text += `━━━━━━━━━━━━━━━\n`;

  // Cliffhanger — the habit-loop driver
  text += `🔜 ${part.cliffhanger}\n\n`;

  // Soft CTA to the bot
  text += `💪 Mau latihan langsung sambil dikoreksi AI?\n`;
  text += `👉 ${OSEE_BOT}${startCtx}\n\n`;

  // Hashtags
  const tag = series.id.replace(/-/g, '');
  text += `#series #belajaringgris #toefl #ielts #${tag}`;

  return text;
}

// ─────────────────────────────────────────────────────────────────────────
// State helpers (all best-effort; table may not exist if migration not run).
// ─────────────────────────────────────────────────────────────────────────

interface SeriesStateRow {
  id: number;
  series_id: string;
  current_part: number;
  total_parts: number;
  status: string;
}

// Find the active series row (the one whose next part we should post).
async function getActiveState(env: Env): Promise<SeriesStateRow | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT id, series_id, current_part, total_parts, status
         FROM channel_series_state
        WHERE status = 'active'
        ORDER BY id ASC
        LIMIT 1`
    ).first<SeriesStateRow>();
    return row || null;
  } catch (e) {
    console.error('[series] getActiveState error (non-fatal):', e);
    return null;
  }
}

// Seed the very first series row (called when the table is empty).
async function seedSeries(env: Env, series: Series): Promise<SeriesStateRow | null> {
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO channel_series_state
         (series_id, current_part, total_parts, status, started_at, updated_at)
       VALUES (?, 0, ?, 'active', datetime('now'), datetime('now'))`
    ).bind(series.id, series.parts.length).run();
    return await getActiveState(env);
  } catch (e) {
    console.error('[series] seedSeries error (non-fatal):', e);
    return null;
  }
}

// Pick the series that should run after `finishedSeriesId` — the next one in
// the SERIES array, wrapping to index 0. Returns the first series whose state
// row isn't already finished, so we cycle through all of them before repeating.
function nextSeriesAfter(finishedSeriesId: string): Series {
  const idx = SERIES.findIndex((s) => s.id === finishedSeriesId);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % SERIES.length;
  return SERIES[nextIdx];
}

// ─────────────────────────────────────────────────────────────────────────
// Main entry: format the current part, then advance state for next time.
//
// Posted once daily via:  postToChannel(env, text, 'series')
//
// Behavior:
//  - No table / DB error  → statelessly return Part 1 of Series 1.
//  - Empty table          → seed Series 1, return its Part 1.
//  - Active series        → return current part, advance current_part. When
//                           the last part is served, mark this series finished
//                           and seed/activate the next series (wraps around).
// ─────────────────────────────────────────────────────────────────────────

export async function getNextSeriesPost(env: Env): Promise<string | null> {
  const fallback = () => formatSeriesPart(SERIES[0], 0);

  try {
    let state = await getActiveState(env);

    // Table empty → seed the first series and use it.
    if (!state) {
      state = await seedSeries(env, SERIES[0]);
      // seedSeries failed (likely table missing) → stateless fallback.
      if (!state) return fallback();
    }

    // Resolve the series definition from the active state row. If a stored
    // series_id no longer exists in code (renamed/removed), fall back to the
    // first series and re-seed cleanly.
    const series = SERIES.find((s) => s.id === state!.series_id);
    if (!series) {
      try {
        await env.DB.prepare(
          `UPDATE channel_series_state SET status = 'finished', updated_at = datetime('now') WHERE id = ?`
        ).bind(state!.id).run();
      } catch { /* best-effort */ }
      await seedSeries(env, SERIES[0]);
      return fallback();
    }

    // Clamp the part index defensively (in case total_parts drifted from code).
    const partIndex = Math.max(0, Math.min(state.current_part, series.parts.length - 1));
    const text = formatSeriesPart(series, partIndex);

    // Advance state for the NEXT post.
    const nextPart = partIndex + 1;
    if (nextPart >= series.parts.length) {
      // This series is done. Mark finished + activate the next one.
      try {
        await env.DB.prepare(
          `UPDATE channel_series_state
              SET current_part = ?, status = 'finished', updated_at = datetime('now')
            WHERE id = ?`
        ).bind(series.parts.length, state.id).run();
      } catch (e) {
        console.error('[series] mark-finished error (non-fatal):', e);
      }

      const upcoming = nextSeriesAfter(series.id);
      try {
        // Reset the upcoming series so re-running the full cycle works: if its
        // row already exists (from a prior cycle), reactivate from part 0;
        // otherwise insert fresh.
        await env.DB.prepare(
          `INSERT INTO channel_series_state
             (series_id, current_part, total_parts, status, started_at, updated_at)
           VALUES (?, 0, ?, 'active', datetime('now'), datetime('now'))
           ON CONFLICT(series_id) DO UPDATE SET
             current_part = 0,
             status = 'active',
             started_at = datetime('now'),
             updated_at = datetime('now')`
        ).bind(upcoming.id, upcoming.parts.length).run();
      } catch (e) {
        console.error('[series] activate-next error (non-fatal):', e);
      }
    } else {
      // Just advance to the next part within this series.
      try {
        await env.DB.prepare(
          `UPDATE channel_series_state
              SET current_part = ?, updated_at = datetime('now')
            WHERE id = ?`
        ).bind(nextPart, state.id).run();
      } catch (e) {
        console.error('[series] advance error (non-fatal):', e);
      }
    }

    return text;
  } catch (e) {
    console.error('[series] getNextSeriesPost error (non-fatal):', e);
    return fallback();
  }
}
