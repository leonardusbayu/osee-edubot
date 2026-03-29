import json, sys, re, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
import fitz

DB_ID = 'd501b671-128e-4a45-9d90-74b22e6691ce'
ACCOUNT_ID = '6d55097e8961e881b77a4108e1ae40c2'
API_TOKEN = 'cfut_28l0tEkYzywTicfRbbRcRAl8VLuvTDhBfItQPB5Udca04c87'

def query_d1(sql, params=None):
    url = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DB_ID}/query'
    body = {'sql': sql}
    if params: body['params'] = params
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Authorization': f'Bearer {API_TOKEN}', 'Content-Type': 'application/json'})
    try: resp = urllib.request.urlopen(req); return json.loads(resp.read())
    except: return None

def insert_q(section, qtype, title, content):
    r = query_d1('INSERT INTO test_contents (test_type, section, question_type, title, content, media_url, difficulty, topic, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['TOEFL_ITP', section, qtype, title, json.dumps(content, ensure_ascii=False), '', '3', title, 'curated', 'published'])
    return r and r.get('success')

inserted = 0

# === 1. Parse quizData.ts from interactive quiz ===
print('=== Interactive Quiz Data ===')
with open('itp-materials/quiz/constants/quizData.ts', encoding='utf-8') as f:
    ts_content = f.read()

# Extract questions using regex — find each question object
# Listening Part A questions
listening_qs = re.findall(r"id: '(LPA-\d+)'.*?questionNumber: (\d+).*?options: \[(.*?)\]", ts_content, re.DOTALL)
questions = []
for qid, num, opts_str in listening_qs:
    opts = re.findall(r"id: '([A-D])', text: \"(.*?)\"", opts_str)
    questions.append({
        'index': len(questions),
        'question_text': f'Question {num}',
        'options': [{'key': k, 'text': v} for k, v in opts],
        'answers': [],
        'explanation': '',
    })

if questions:
    content = {'type': 'grouped_listening', 'group_name': 'ITP Listening Part A', 'direction': 'Listen to the conversation and choose the best answer.', 'passage_script': '', 'questions': questions, 'question_count': len(questions)}
    if insert_q('listening', 'short_dialogues', 'ITP Listening Part A', content):
        inserted += 1
        print(f'  Listening Part A: {len(questions)} Qs')

# Structure questions
struct_qs = re.findall(r"id: '(S-\d+)'.*?questionNumber: (\d+).*?questionText: \"(.*?)\".*?options: \[(.*?)\]", ts_content, re.DOTALL)
questions = []
for qid, num, qtext, opts_str in struct_qs:
    opts = re.findall(r"id: '([A-D])', text: \"(.*?)\"", opts_str)
    questions.append({
        'index': len(questions),
        'question_text': qtext,
        'options': [{'key': k, 'text': v} for k, v in opts],
        'answers': [],
        'explanation': '',
    })

if questions:
    content = {'type': 'grouped_reading', 'group_name': 'ITP Structure', 'passage': '', 'direction': 'Choose the word or phrase that best completes the sentence.', 'questions': questions, 'question_count': len(questions)}
    if insert_q('structure', 'sentence_completion', 'ITP Structure', content):
        inserted += 1
        print(f'  Structure: {len(questions)} Qs')

# === 2. Parse Structure PDF ===
print('\n=== Structure PDF ===')
doc = fitz.open('itp-materials/mat/TOEFL_ITP_Structure_Written_Expression_Practice.pdf')
text = ''
for i in range(doc.page_count):
    text += doc[i].get_text() + '\n'
doc.close()

# Extract numbered questions with options
q_pattern = re.compile(r'(\d+)\.\s+(.+?)\n\s*\(A\)\s*(.+?)\n\s*\(B\)\s*(.+?)\n\s*\(C\)\s*(.+?)\n\s*\(D\)\s*(.+?)(?=\n\d+\.|\n\n|$)', re.DOTALL)
matches = q_pattern.findall(text)
questions = []
for num, qtext, a, b, c, d in matches:
    questions.append({
        'index': len(questions),
        'question_text': qtext.strip().replace('\n', ' '),
        'options': [{'key': 'A', 'text': a.strip()}, {'key': 'B', 'text': b.strip()}, {'key': 'C', 'text': c.strip()}, {'key': 'D', 'text': d.strip()}],
        'answers': [],
        'explanation': '',
    })

# Insert in batches of 10
for i in range(0, len(questions), 10):
    batch = questions[i:i+10]
    title = f'ITP Structure Practice {i//10 + 1}'
    content = {'type': 'grouped_reading', 'group_name': title, 'passage': '', 'direction': 'Choose the best answer.', 'questions': batch, 'question_count': len(batch)}
    if insert_q('structure', 'sentence_completion', title, content):
        inserted += 1
        print(f'  {title}: {len(batch)} Qs')

# === 3. Parse Reading PDF ===
print('\n=== Reading PDF ===')
doc = fitz.open('itp-materials/mat/TOEFL_Reading_Comprehension_Collection.pdf')
text = ''
for i in range(doc.page_count):
    text += doc[i].get_text() + '\n'
doc.close()
print(f'  {len(text)} chars extracted')

# Split by "PRACTICE TEST" markers
tests = re.split(r'PRACTICE TEST\s*(\d+)', text, flags=re.IGNORECASE)
for ti in range(1, min(len(tests) - 1, 20), 2):
    test_num = tests[ti]
    test_content = tests[ti + 1] if ti + 1 < len(tests) else ''

    # Extract questions
    q_matches = re.findall(r'(\d+)\.\s*(.+?)(?=\n\d+\.|\n\n|$)', test_content[:3000])
    questions = [{'index': i, 'question_text': qt.strip()[:200], 'options': [], 'answers': [], 'explanation': ''} for i, (_, qt) in enumerate(q_matches) if len(qt.strip()) > 10]

    if questions:
        passage = test_content[:2000].strip()
        title = f'ITP Reading Test {test_num}'
        content = {'type': 'grouped_reading', 'group_name': title, 'passage': passage, 'direction': 'Read the passage and answer.', 'questions': questions[:15], 'question_count': min(len(questions), 15)}
        if insert_q('reading', 'reading_comprehension', title, content):
            inserted += 1
            print(f'  {title}: {min(len(questions), 15)} Qs')

# === 4. Parse Practice Questions Collection ===
print('\n=== Practice Collection PDF ===')
doc = fitz.open('itp-materials/mat/TOEFL_Practice_Questions_Collection.pdf')
text = ''
for i in range(doc.page_count):
    text += doc[i].get_text() + '\n'
doc.close()
print(f'  {len(text)} chars')

# Extract MCQ questions
mcq = re.findall(r'(\d+)\.\s+(.+?)\n\s*(?:\(A\)|a\))\s*(.+?)\n\s*(?:\(B\)|b\))\s*(.+?)\n\s*(?:\(C\)|c\))\s*(.+?)\n\s*(?:\(D\)|d\))\s*(.+?)(?=\n\d+\.|\n\n|$)', text, re.DOTALL)
questions = []
for num, qtext, a, b, c, d in mcq:
    questions.append({
        'index': len(questions),
        'question_text': qtext.strip().replace('\n', ' ')[:200],
        'options': [{'key': 'A', 'text': a.strip()[:100]}, {'key': 'B', 'text': b.strip()[:100]}, {'key': 'C', 'text': c.strip()[:100]}, {'key': 'D', 'text': d.strip()[:100]}],
        'answers': [],
        'explanation': '',
    })

for i in range(0, len(questions), 10):
    batch = questions[i:i+10]
    title = f'ITP Practice Collection {i//10 + 1}'
    section = 'structure' if i < 30 else 'reading'
    content = {'type': 'grouped_reading', 'group_name': title, 'passage': '', 'direction': 'Choose the best answer.', 'questions': batch, 'question_count': len(batch)}
    if insert_q(section, 'multiple_choice', title, content):
        inserted += 1
        print(f'  {title}: {len(batch)} Qs')

print(f'\nTOTAL TOEFL ITP: {inserted} groups inserted')
