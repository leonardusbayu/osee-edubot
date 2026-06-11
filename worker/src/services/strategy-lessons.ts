// ═══════════════════════════════════════════════════════════════
// Strategy Lessons — test-strategy as first-class content (M3 §3.3)
//
// Score gains in short time come MORE from test strategy than English
// level. These are hardcoded, hand-written thread-style lessons in
// Bahasa Indonesia (private-tutor FORMAT rules: plain text, no markdown,
// "Aku/kamu", hook → skenario → langkah strategi → contoh → motivasi).
// ═══════════════════════════════════════════════════════════════

export interface StrategyLesson {
  id: string;
  title: string;
  body: string;
  quiz?: {
    question: string;
    options: string[];
    correct: string; // must match one of options exactly
  };
}

export const STRATEGY_LESSONS: Record<string, StrategyLesson[]> = {
  TOEFL_IBT: [
    {
      id: 'ibt_time',
      title: '⏱ Time Management per Section',
      body: `Banyak yang gagal TOEFL iBT bukan karena bahasa Inggrisnya jelek — tapi karena kehabisan waktu di Reading.

Bayangin: kamu lagi tes buat syarat LPDP. Passage pertama kamu baca pelan-pelan biar "paham total". Tau-tau sisa 12 menit buat 2 passage. Panik. Skor hancur.

Aturannya gini:

1. Reading: 35 menit untuk 2 passage = 18 menit per passage. Pasang patokan: soal nomor 10 harus selesai di menit 18. Lewat? Tebak, tandai, lanjut.
2. Listening: audio jalan terus, kamu nggak bisa pause. Fokus catat main idea + sikap pembicara, bukan detail angka.
3. Speaking: cuma 16 menit total. Prep time 15-30 detik itu sakral — jangan bengong.
4. Writing: Integrated 20 menit, Academic Discussion 10 menit. Sisain 2 menit terakhir buat cek typo.

Contoh nyata: soal Reading yang kamu pelototin 4 menit nilainya SAMA dengan soal yang kamu jawab 30 detik. Satu poin. Nggak ada bonus buat kerja keras.

Prinsip emas: jangan pernah korbankan 3 soal gampang demi 1 soal susah.

Latihan pakai timer mulai hari ini — otak kamu perlu kebiasaan, bukan teori.`,
      quiz: {
        question: 'Kamu sudah 3 menit stuck di satu soal Reading yang susah. Apa langkah paling strategis?',
        options: [
          'Terus dikerjakan sampai ketemu jawabannya',
          'Tebak jawaban terbaik, tandai, lanjut ke soal berikutnya',
          'Baca ulang seluruh passage dari awal',
          'Skip tanpa menjawab sama sekali',
        ],
        correct: 'Tebak jawaban terbaik, tandai, lanjut ke soal berikutnya',
      },
    },
    {
      id: 'ibt_integrated_writing',
      title: '📝 Integrated Writing: Bukan Opini!',
      body: `Kesalahan paling fatal di Integrated Writing: nulis opini kamu sendiri. Padahal soalnya sama sekali nggak nanya pendapat kamu.

Skenarionya: kamu baca passage tentang teori X, terus dengar professor di lecture yang MENYANGGAH teori itu. Tugas kamu cuma satu — laporkan gimana lecture merespons reading. Titik.

Template 4 paragraf yang aman:

1. Intro: "The reading and the lecture both discuss [topik]. While the author argues [klaim utama], the professor challenges this view."
2. Body 1: poin 1 reading → gimana professor membantahnya. Pakai "The professor casts doubt on this by..."
3. Body 2: poin 2 reading → bantahan kedua.
4. Body 3: poin 3 reading → bantahan ketiga.

Selalu ada 3 poin paralel. Reading kasih 3 argumen, lecture bantah 3-3-nya. Itu pola tetapnya.

Contoh frasa penyelamat: "contrary to what the passage suggests", "the lecturer refutes this point by stating that..."

Kata "I think", "in my opinion", "I believe" = lampu merah. Hapus.

Hafalkan template ini sampai bisa nulis sambil merem — pas tes, energi kamu fokus ke isi, bukan struktur.`,
      quiz: {
        question: 'Di Integrated Writing TOEFL iBT, apa yang TIDAK boleh kamu tulis?',
        options: [
          'Ringkasan poin dari lecture',
          'Hubungan antara reading dan lecture',
          'Opini pribadi kamu tentang topiknya',
          'Frasa seperti "the professor refutes this"',
        ],
        correct: 'Opini pribadi kamu tentang topiknya',
      },
    },
    {
      id: 'ibt_speaking_template',
      title: '🎤 Speaking: Template 15-Detik Prep',
      body: `15 detik prep time Speaking Task 1 itu pendek banget. Kalau kamu pakai buat "mikir ide bagus", kamu kalah sebelum mulai.

Bayangin lagi interview kerja terus HRD nanya mendadak — orang yang punya kerangka jawaban selalu kedengeran lebih siap, walau idenya biasa aja.

Strateginya: jangan cari ide TERBAIK, cari ide TERCEPAT yang bisa kamu dukung 2 alasan.

Template 45 detik untuk independent task:

1. Posisi (5 detik): "I believe that... / If I had to choose, I would pick..."
2. Alasan 1 + contoh (18 detik): "First, ... For example, ..."
3. Alasan 2 + contoh (18 detik): "Second, ... In my experience, ..."
4. Penutup singkat kalau sempat: "That's why I think..."

Pas 15 detik prep, tulis cuma 3 kata di kertas: posisi, alasan 1, alasan 2. Contohnya soal "study alone vs group": tulis "alone - fokus - jadwal bebas". Selesai. Sisanya improvisasi pakai template.

Penilai nggak peduli ide kamu cemerlang atau nggak — mereka nilai kelancaran, struktur, dan bahasa.

Rekam diri kamu jawab 1 soal tiap hari. Seminggu aja, template-nya udah otomatis keluar.`,
      quiz: {
        question: 'Apa cara terbaik memakai 15 detik prep time di Speaking independent task?',
        options: [
          'Memikirkan ide yang paling cerdas dan orisinal',
          'Menulis kalimat pembuka lengkap kata per kata',
          'Menulis 3 kata kunci: posisi + 2 alasan',
          'Diam dan menenangkan diri sampai waktu habis',
        ],
        correct: 'Menulis 3 kata kunci: posisi + 2 alasan',
      },
    },
    {
      id: 'ibt_reading_types',
      title: '📖 Reading: Playbook per Tipe Soal',
      body: `Soal Reading TOEFL iBT itu cuma ada beberapa tipe, dan tiap tipe punya cara bongkar yang beda. Yang nggak tau tipenya, ngerjain semua soal dengan cara sama — boros waktu.

Tiga tipe paling sering muncul:

1. DETAIL ("According to paragraph 2..."): jawabannya TERTULIS di passage. Cari kata kunci dari soal, scan paragraf yang disebut, cocokkan parafrase. Jangan pakai logika sendiri.
2. INFERENCE ("What can be inferred..."): jawabannya TIDAK tertulis, tapi pasti benar berdasarkan teks. Hati-hati: pilihan yang menyalin kata-kata passage mentah-mentah biasanya jebakan.
3. VOCAB-IN-CONTEXT ("The word X is closest in meaning to..."): jangan andalkan hafalan doang. Ganti kata itu dengan tiap pilihan, baca ulang kalimatnya — mana yang tetap masuk akal.

Contoh vocab: "The results were striking." Kamu hafal striking = memukul? Coba masukkan: "hasilnya memukul"? Aneh. "Hasilnya mencolok/remarkable"? Nah, itu.

Bedakan detail vs inference dalam 2 detik: ada kata "infer/imply/suggest" = inference. Ada "according to/stated" = detail.

Kenali tipe soalnya dulu, baru cari jawabannya. Itu bedanya 20 detik vs 2 menit per soal.`,
      quiz: {
        question: 'Soal berbunyi "What can be inferred about the experiment?" — pilihan mana yang paling patut dicurigai sebagai jebakan?',
        options: [
          'Pilihan yang menyalin kata-kata persis dari passage',
          'Pilihan yang merupakan kesimpulan logis dari teks',
          'Pilihan dengan parafrase dari ide passage',
          'Pilihan yang konsisten dengan sikap penulis',
        ],
        correct: 'Pilihan yang menyalin kata-kata persis dari passage',
      },
    },
  ],

  TOEFL_ITP: [
    {
      id: 'itp_error_id',
      title: '🔍 Error Identification: Urutan Eliminasi',
      body: `Di soal Error Identification ITP, kamu nggak perlu tau jawaban yang BENAR — kamu cuma perlu nemuin satu yang SALAH. Itu game yang beda total.

Banyak peserta baca kalimatnya berulang-ulang berharap errornya "kerasa". Cara itu lambat dan nggak konsisten.

Pakai urutan cek yang tetap, dari error paling sering muncul:

1. Subject-verb agreement: subjeknya tunggal atau jamak? Hati-hati subjek yang dipisah frasa panjang. "The list of items ARE..." → salah, subjeknya "list".
2. Bentuk kata (word form): harusnya noun tapi ditulis adjective? "He spoke with great clearness"? Cek: clarity.
3. Paralelisme: "swimming, running, and to bike" → harus "biking".
4. Pronoun: "Everyone must bring THEIR book" → di ITP, everyone itu tunggal: his/her.
5. Word order & preposisi: "enough tall" → "tall enough".

Cek opsi A, B, C, D satu per satu pakai daftar ini. Begitu nemu pelanggaran — pilih, lanjut. Jangan validasi ulang tiga opsi lainnya.

Satu soal idealnya 30-40 detik. Checklist di kepala lebih cepat dari feeling.`,
      quiz: {
        question: '"The list of new students are posted on the board." Di mana errornya?',
        options: [
          '"list" seharusnya "lists"',
          '"are" seharusnya "is" karena subjeknya "the list"',
          '"posted" seharusnya "posting"',
          'Tidak ada error',
        ],
        correct: '"are" seharusnya "is" karena subjeknya "the list"',
      },
    },
    {
      id: 'itp_structure',
      title: '🧱 Structure: Cari S+V Dulu',
      body: `Soal Structure ITP itu sebenarnya cuma satu pertanyaan yang diulang 15 kali: "bagian mana dari kalimat ini yang hilang?"

Skenarionya: kamu lihat kalimat panjang penuh koma, panik, langsung baca opsi A-D. Itu kebalik. Opsi dilihat TERAKHIR.

Langkahnya:

1. Cari subjek utama. Ada?
2. Cari verb utama (yang berkonjugasi, bukan -ing doang). Ada?
3. Yang hilang itulah yang dicari jawabannya.

Contoh: "___ in 1945, the United Nations has grown to include 193 members."
S ada? "the United Nations" — ada. V ada? "has grown" — ada. Berarti yang hilang bukan S/V, tapi modifier. Jawabannya bentuk participle: "Founded".

Pola yang wajib hafal: kalimat lengkap + koma = butuh modifier atau klausa dependen. Belum ada verb = jawaban pasti mengandung verb. Dua klausa tanpa penghubung = butuh conjunction.

Ingat: satu klausa = satu S + satu V berkonjugasi. "Being" dan "to be" bukan verb utama.

Kalimat sepanjang apapun nggak nakutin lagi kalau kamu selalu mulai dari pertanyaan yang sama: mana S, mana V?`,
      quiz: {
        question: '"___ in 1945, the United Nations has grown rapidly." Apa yang hilang dari kalimat ini?',
        options: [
          'Subjek utama, karena belum ada subjek',
          'Verb utama, karena belum ada verb',
          'Modifier (participle), karena S dan V utama sudah lengkap',
          'Object, karena kalimatnya menggantung',
        ],
        correct: 'Modifier (participle), karena S dan V utama sudah lengkap',
      },
    },
    {
      id: 'itp_listening_predict',
      title: '🎧 Listening: Strategi Prediksi',
      body: `Listening ITP itu cepat dan nggak bisa diulang. Senjata rahasianya bukan kuping super — tapi prediksi sebelum audio mulai.

Bayangin nonton film yang kamu udah baca sinopsisnya. Kamu nangkep lebih banyak, kan? Sama persis.

Strateginya:

1. Pas narator baca instruksi (yang isinya selalu sama), JANGAN dengerin. Pakai waktunya buat baca pilihan jawaban soal berikutnya.
2. Dari pilihan, tebak konteksnya. Pilihan tentang "appointment, doctor, reschedule"? Siap-siap dialog soal janji temu.
3. Di Part A (dialog pendek), jawabannya hampir selalu di kalimat pembicara KEDUA. Fokus ke situ.
4. Waspadai jebakan klasik: idiom. "He's on the fence" bukan soal pagar — artinya belum memutuskan. Jawaban yang mengandung kata yang persis kedengeran di audio (fence → fence) biasanya jebakan.

Contoh: Woman: "Are you coming to the seminar?" Man: "I'm up to my ears in work." Jawaban benar: he is too busy. Jebakannya: opsi yang menyebut "ears" atau "hearing problem".

Jawab langsung, jangan ditunda — soal berikutnya nggak nunggu kamu.

Prediksi 5 detik sebelum audio nilainya lebih besar dari 10 menit nyesel setelahnya.`,
      quiz: {
        question: 'Di dialog pendek Part A Listening ITP, di mana jawaban paling sering berada?',
        options: [
          'Di kalimat pembicara pertama',
          'Di kalimat pembicara kedua',
          'Di instruksi narator',
          'Tersebar merata di kedua pembicara',
        ],
        correct: 'Di kalimat pembicara kedua',
      },
    },
    {
      id: 'itp_time_budget',
      title: '⏱ Reading: Budget Waktu 50 Soal',
      body: `Section 3 ITP: 50 soal reading dalam 55 menit. Itu 66 detik per soal, udah termasuk baca passage. Yang nggak punya rencana, pasti keteteran di passage terakhir.

Cerita klasik: peserta tryout ngerjain 2 passage pertama dengan teliti banget, dapat skor bagus di situ — terus 15 soal terakhir diisi asal karena waktu habis. Totalnya malah jeblok.

Rencana perangnya:

1. 5 passage, masing-masing sekitar 10 soal → patok 11 menit per passage, sisa buffer.
2. Jangan baca passage sampai paham total. Baca kalimat pertama tiap paragraf (60% soal nanya main idea atau letak informasi), langsung serbu soal, balik ke teks per soal.
3. Soal vocabulary ("the word X in line Y") kerjakan duluan — 20 detik selesai, nggak perlu paham passage.
4. Tiap selesai 1 passage, cek jam. Lewat budget 2 menit? Percepat di passage berikutnya.
5. Lima menit terakhir: pastikan SEMUA terisi. ITP nggak ada pengurangan nilai untuk jawaban salah — kosong = buang poin gratis.

Skor ITP itu maraton dengan checkpoint, bukan sprint buta.

Disiplin waktu bisa naikin skor 30-50 poin tanpa belajar grammar satu pun.`,
      quiz: {
        question: 'Sisa 3 menit dan masih ada 8 soal Reading ITP yang kosong. Apa yang harus kamu lakukan?',
        options: [
          'Kerjakan 2 soal dengan teliti, sisanya biarkan kosong',
          'Isi semua 8 soal dengan tebakan, karena jawaban salah tidak mengurangi nilai',
          'Baca passage-nya dulu baru menjawab sebisanya',
          'Berhenti, karena tebakan hanya merugikan',
        ],
        correct: 'Isi semua 8 soal dengan tebakan, karena jawaban salah tidak mengurangi nilai',
      },
    },
  ],

  IELTS: [
    {
      id: 'ielts_tfng',
      title: '🌳 True/False/Not Given: Decision Tree',
      body: `True/False/Not Given itu pembantai skor Reading IELTS nomor satu. Dan 90% korbannya jatuh di lubang yang sama: mengira NOT GIVEN itu sama dengan FALSE.

Skenarionya: statement bilang "Einstein was the most influential scientist of the 20th century." Passage bilang Einstein itu berpengaruh. Kamu mikir "iya bener dong" → jawab TRUE. Salah.

Pakai pohon keputusan ini, urut:

1. Cari bagian passage yang membahas topik statement.
2. Tanya: apakah passage MENGKONFIRMASI statement ini? Ya → TRUE.
3. Apakah passage MENGKONTRADIKSI statement ini (bilang sebaliknya)? Ya → FALSE.
4. Passage diam soal klaim spesifik itu? → NOT GIVEN. Walau "rasanya" masuk akal.

Kuncinya: FALSE butuh bukti bahwa statement SALAH. Nggak ada bukti = NOT GIVEN, bukan FALSE.

Contoh tadi: passage bilang Einstein influential, tapi nggak pernah bilang dia yang PALING influential. Klaim "most" nggak dikonfirmasi dan nggak dibantah → NOT GIVEN.

Waspadai kata ekstrem di statement: all, only, most, never, always. Itu sinyal cek ekstra teliti.

Pengetahuan umum kamu nggak dihitung. Hakimnya cuma satu: teks di depan kamu.`,
      quiz: {
        question: 'Statement: "The factory was the largest in the country." Passage hanya menyebut "the factory was large and employed 500 workers." Jawabannya?',
        options: [
          'TRUE, karena 500 pekerja itu banyak',
          'FALSE, karena passage tidak bilang "largest"',
          'NOT GIVEN, karena klaim "largest" tidak dikonfirmasi maupun dibantah',
          'TRUE, karena passage mendukung kesan pabrik besar',
        ],
        correct: 'NOT GIVEN, karena klaim "largest" tidak dikonfirmasi maupun dibantah',
      },
    },
    {
      id: 'ielts_task2',
      title: '✍️ Writing Task 2: Kerangka 4 Paragraf',
      body: `Band 7 Writing itu jarang soal vocabulary mewah. Examiner pertama-tama lihat: apakah esai ini punya struktur dan posisi yang jelas?

Bayangin kamu nulis esai LPDP. Yang lolos bukan yang kata-katanya paling indah, tapi yang argumennya paling gampang diikuti. IELTS sama.

Kerangka 4 paragraf untuk hampir semua soal opinion/discussion:

1. Intro (2-3 kalimat): parafrase soal + posisi kamu yang TEGAS. "This essay argues that the advantages outweigh the drawbacks."
2. Body 1 (5-6 kalimat): 1 ide utama → jelaskan → contoh konkret → kaitkan balik ke posisi.
3. Body 2: ide utama kedua, pola sama. SATU ide per paragraf — dua ide setengah matang lebih buruk dari satu ide tuntas.
4. Conclusion (2 kalimat): tegaskan ulang posisi. Tanpa ide baru.

Bagi 40 menit: 5 menit planning, 30 menit nulis, 5 menit cek. Yang skip planning biasanya nulis 100 kata lalu sadar argumennya muter.

Target 270-290 kata. Di bawah 250 kena penalti; di atas 320 biasanya makin banyak error.

Posisi yang jelas dari kalimat pertama sampai terakhir — itu separuh nilai Task Response kamu.`,
      quiz: {
        question: 'Apa kesalahan struktur yang paling merusak skor Task Response di Writing Task 2?',
        options: [
          'Menulis 290 kata',
          'Posisi tidak jelas atau berubah-ubah di tengah esai',
          'Memakai contoh dari pengalaman pribadi',
          'Hanya satu ide utama per body paragraph',
        ],
        correct: 'Posisi tidak jelas atau berubah-ubah di tengah esai',
      },
    },
    {
      id: 'ielts_cuecard',
      title: '🎤 Cue Card: Struktur Prep 1 Menit',
      body: `Speaking Part 2: kamu dapat cue card, 1 menit nyiapkan, lalu harus ngomong 2 menit nonstop. Momen paling ditakuti seluruh peserta IELTS Indonesia.

Yang bikin blank bukan bahasa Inggrisnya — tapi nggak punya rencana cerita.

Pakai kerangka KADIBEK: KApan - DImana - kenapa BErkesan - Kesimpulan. Apapun topiknya (orang, tempat, benda, pengalaman), cerita selalu bisa digantung ke kerangka ini.

Cara pakai 1 menit prep:

1. 10 detik: pilih topik PERTAMA yang kepikiran. Jangan ganti-ganti — ganti topik di detik 40 itu bunuh diri.
2. 50 detik: tulis 4 kata kunci, satu per cabang. Misal cue card "describe a memorable trip": "2022 - Bromo - sama temen kantor - sunrise gagal tapi lucu".
3. Pas ngomong, tiap kata kunci dikembangkan 25-30 detik. Empat kata kunci = 2 menit. Pas.

Bumbui dengan perasaan dan detail kecil: "I was freezing, but honestly nobody cared because we were laughing the whole time." Detail begini yang bikin examiner betah dengerin.

Kehabisan bahan di menit 1.5? Tambahkan perbandingan: "compared to my other trips..." — perpanjangan paling gampang.

Cerita kamu nggak harus keren. Yang dinilai cara kamu menceritakannya.`,
      quiz: {
        question: 'Saat 1 menit persiapan cue card, strategi mana yang paling tepat?',
        options: [
          'Menulis kalimat pembuka lengkap kata per kata',
          'Memikirkan topik terbaik sampai detik ke-50',
          'Pilih topik pertama yang muncul, tulis 4 kata kunci (kapan-dimana-kenapa-berkesan)',
          'Menghafal idiom yang mau dipakai',
        ],
        correct: 'Pilih topik pertama yang muncul, tulis 4 kata kunci (kapan-dimana-kenapa-berkesan)',
      },
    },
    {
      id: 'ielts_skim_scan',
      title: '📖 Skimming vs Scanning: Kapan Pakai Apa',
      body: `Reading IELTS: 3 passage, 40 soal, 60 menit. Kalau kamu baca tiap kata, kamu butuh 90 menit. Matematikanya nggak bohong — kamu HARUS baca selektif.

Dua mode baca, jangan ketuker:

1. SKIMMING = baca cepat untuk dapat gambaran besar. Baca judul, kalimat pertama tiap paragraf, kata yang dicetak beda. Tujuannya tau "paragraf ini ngomongin apa". Maksimal 2-3 menit per passage.
2. SCANNING = berburu informasi spesifik. Mata kamu cuma cari satu hal: nama, angka, tahun, istilah. Kayak nyari nama kamu di pengumuman kelulusan — kamu nggak baca nama orang lain, kan?

Kapan pakai yang mana:

- Soal matching headings → SKIM tiap paragraf, jangan baca detail.
- Soal berisi nama/angka/tanggal (misal "What did Dr. Chen discover in 1998?") → SCAN cari "Chen" atau "1998", baru baca teliti 2-3 kalimat di sekitarnya.
- TF/NG dan completion → scan kata kunci dari statement, lalu baca cermat area kecil itu.

Urutan kerja per passage: skim 2 menit → baca soal → scan per soal → baca intensif hanya di kalimat target.

Membaca lebih sedikit, menjawab lebih banyak. Itu intinya Reading IELTS.`,
      quiz: {
        question: 'Soal menanyakan "In what year was the bridge completed?" Teknik baca apa yang paling efisien?',
        options: [
          'Skimming seluruh passage dari awal',
          'Membaca intensif paragraf demi paragraf',
          'Scanning untuk mencari angka tahun di teks',
          'Membaca kesimpulan passage saja',
        ],
        correct: 'Scanning untuk mencari angka tahun di teks',
      },
    },
  ],

  TOEIC: [
    {
      id: 'toeic_part5',
      title: '🔧 Part 5: Eliminasi by Grammar Slot',
      body: `Part 5 TOEIC (incomplete sentences) itu bisa dikerjakan TANPA paham arti kalimatnya. Serius. Rahasianya: lihat slot kosongnya butuh jenis kata apa.

Skenario kantor: kamu disuruh ngisi formulir yang kolomnya udah jelas — kolom tanggal ya diisi tanggal, bukan nama. Part 5 sama.

Langkahnya:

1. Lihat 4 pilihan dulu, SEBELUM baca kalimat. Kalau pilihannya "decide / decision / decisive / decisively" — ini soal word form, bukan arti.
2. Lihat kata sebelum dan sesudah blank. "The ___ was approved" → setelah The, sebelum verb = butuh noun → decision. Selesai, 10 detik.
3. "She spoke ___" → setelah verb, modifikasi cara = adverb → decisively.
4. Kalau 4 pilihan beda arti tapi sama jenis kata (mis. 4 preposisi), baru baca kalimat penuh.

Patokan slot cepat: setelah a/the/possessive = noun. Sebelum noun = adjective. Modif verb/adjective = adverb. Setelah preposisi = noun/gerund.

Budget: 30 soal Part 5 maksimal 10 menit. Tiap detik yang kamu hemat di sini adalah napas tambahan buat Part 7.

Grammar slot itu kayak kunci pas — begitu hafal ukurannya, bautnya kebuka cepat.`,
      quiz: {
        question: '"The committee reached a ___ after two hours." Pilihannya: decide / decision / decisive / decisively. Mana dan kenapa?',
        options: [
          'decide, karena kalimat butuh aksi',
          'decision, karena setelah artikel "a" slot-nya butuh noun',
          'decisive, karena menjelaskan committee',
          'decisively, karena menjelaskan reached',
        ],
        correct: 'decision, karena setelah artikel "a" slot-nya butuh noun',
      },
    },
    {
      id: 'toeic_part7',
      title: '📄 Part 7: Baca Pertanyaan Dulu',
      body: `Part 7 itu 54 soal reading di ujung tes, pas otak kamu udah lelah. Yang baca semua teks dari awal sampai habis, tamat di sini.

Bayangin kamu HRD yang nerima 50 email sehari. Kamu nggak baca semua kata, kan? Kamu lihat subject, pengirim, dan langsung lompat ke bagian yang relevan. Part 7 melatih skill yang sama persis.

Urutannya DIBALIK:

1. Baca PERTANYAAN dulu (bukan teksnya). Garis bawahi kata kunci: nama, tanggal, "why", "what is suggested".
2. Lihat jenis teks: email? iklan? invoice? Header (From/To/Subject/Date) sering jadi jawaban soal pertama.
3. Scan teks cuma untuk kata kunci pertanyaan, baca teliti 2-3 kalimat di sekitarnya.
4. Untuk double/triple passage: soal-soal akhir hampir selalu butuh MENGGABUNGKAN info dari 2 teks. Contoh: teks 1 bilang "diskon untuk member gold", teks 2 nunjukkin si pembeli member gold → jawabannya dia dapat diskon.

Soal "What is the purpose of this email?" → jawaban biasanya di paragraf pertama. Soal "What is suggested/implied" → butuh gabung 2 info, jangan pilih yang cuma nyalin teks mentah.

Sisakan minimal 55 menit untuk Part 7. Kalau Part 5-6 molor, korbankan kesempurnaan di sana — bukan di sini.

Baca seperlunya, jawab sebanyaknya.`,
      quiz: {
        question: 'Apa langkah PERTAMA yang paling efisien saat mengerjakan satu set soal Part 7?',
        options: [
          'Membaca seluruh passage dengan teliti dari awal',
          'Membaca pertanyaan dulu dan menandai kata kuncinya',
          'Menerjemahkan paragraf pertama dalam hati',
          'Melihat pilihan jawaban A sampai D dulu',
        ],
        correct: 'Membaca pertanyaan dulu dan menandai kata kuncinya',
      },
    },
    {
      id: 'toeic_part2',
      title: '🎧 Part 2: Jebakan Kata Mirip',
      body: `Part 2 Listening: kamu dengar satu pertanyaan, lalu 3 respons. Nggak ada teks, nggak ada gambar. Murni kuping. Dan di sinilah jebakan paling licik TOEIC dipasang.

Jebakan utamanya: similar-sounding words. Pertanyaan menyebut "copy", salah satu opsi nyebut "coffee". Otak capek kamu denger bunyi familiar → langsung pilih → salah.

Aturan mainnya:

1. Opsi yang MENGULANG kata dari pertanyaan, atau yang bunyinya mirip, itu 80% jebakan. "Where did you PARK?" → opsi dengan kata "PARK is beautiful" hampir pasti salah.
2. Fokus mati-matian ke KATA PERTAMA pertanyaan: Where butuh tempat, When butuh waktu, Who butuh orang. Where dijawab "yesterday" = salah, sefasih apapun kedengerannya.
3. Pertanyaan yes/no nggak selalu dijawab yes/no. "Have you finished the report?" → "The printer was broken" itu jawaban valid (alasan belum selesai). Jawaban tidak langsung kayak gini makin sering jadi yang benar.
4. Ragu antara 2 opsi? Buang yang ada kata mirip, pilih sisanya.

Contoh: "When does the meeting start?" — (A) "In the meeting room" (mengulang meeting, jebakan) (B) "At two o'clock" (benar) (C) "He's been eating" (bunyi mirip meeting, jebakan).

Telinga kamu suka yang familiar. Penyusun soal tau itu, dan masang perangkap di sana. Sekarang kamu juga tau.`,
      quiz: {
        question: '"Where did you put the file?" — opsi mana yang paling mungkin BENAR?',
        options: [
          '"I feel fine, thanks" (bunyi mirip file)',
          '"The file is important"  (mengulang kata file)',
          '"On your desk, next to the printer"',
          '"Yesterday afternoon"',
        ],
        correct: '"On your desk, next to the printer"',
      },
    },
    {
      id: 'toeic_pacing',
      title: '⏱ Pacing Reading: 100 Soal, 75 Menit',
      body: `Reading TOEIC: 100 soal dalam 75 menit. Itu 45 detik per soal. Nggak ada section lain di dunia tes bahasa Inggris yang sebrutal ini soal waktu.

Cerita yang kejadian terus: peserta tryout perfeksionis di Part 5, mikirin satu soal grammar 3 menit. Hasilnya: 20 soal terakhir Part 7 diisi ngasal. Padahal soal Part 7 yang dia korbankan itu banyak yang gampang.

Pembagian waktunya, hafalkan:

1. Part 5 (30 soal): 10 menit. Rata-rata 20 detik per soal. Lewat 30 detik di satu soal? Tebak, lanjut.
2. Part 6 (16 soal): 8 menit.
3. Part 7 (54 soal): 55 menit, sisanya buffer 2 menit.
4. Checkpoint: pas mulai Part 7, jam harus menunjukkan maksimal menit ke-20. Telat = ngebut di Part 6.

Aturan tambahan:

- TOEIC nggak ada penalti jawaban salah. Menjelang waktu habis, isi SEMUA yang kosong. Pilih satu huruf andalan dan konsisten — secara statistik lebih baik dari ganti-ganti.
- Single passage Part 7 lebih cepat dikerjakan daripada triple passage. Kalau kepepet, prioritaskan yang single.

Skor TOEIC 800+ itu bukan yang bahasa Inggrisnya sempurna — tapi yang nggak pernah kehabisan waktu.

Latih pacing pakai timer tiap latihan. Hari-H bukan waktunya nyoba pertama kali.`,
      quiz: {
        question: 'Berapa budget waktu ideal untuk 30 soal Part 5 agar Part 7 kebagian cukup waktu?',
        options: [
          'Sekitar 10 menit (±20 detik per soal)',
          'Sekitar 25 menit biar teliti',
          'Sekitar 40 menit, karena grammar paling penting',
          'Tidak perlu dibatasi, kerjakan sampai yakin',
        ],
        correct: 'Sekitar 10 menit (±20 detik per soal)',
      },
    },
  ],
};

/** Look up a lesson by id across all test types. */
export function findStrategyLesson(id: string): { testType: string; lesson: StrategyLesson } | null {
  for (const [testType, lessons] of Object.entries(STRATEGY_LESSONS)) {
    const lesson = lessons.find((l) => l.id === id);
    if (lesson) return { testType, lesson };
  }
  return null;
}

/** Inline keyboard rows listing the 4 lessons for a test type. */
export function strategyMenuKeyboard(testType: string) {
  const lessons = STRATEGY_LESSONS[testType] || STRATEGY_LESSONS['TOEFL_IBT'];
  return {
    inline_keyboard: lessons.map((l) => [{ text: l.title, callback_data: `strategy:${l.id}` }]),
  };
}
