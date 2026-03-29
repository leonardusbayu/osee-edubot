"""Parse IELTS Extra + Anas materials into D1"""
import sys, os, json, re, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
import fitz

DB_ID = 'd501b671-128e-4a45-9d90-74b22e6691ce'
ACCOUNT_ID = '6d55097e8961e881b77a4108e1ae40c2'
API_TOKEN = 'cfut_28l0tEkYzywTicfRbbRcRAl8VLuvTDhBfItQPB5Udca04c87'

def query_d1(sql, params=None):
    url = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DB_ID}/query'
    body = {'sql': sql}
    if params: body['params'] = params
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={
        'Authorization': f'Bearer {API_TOKEN}', 'Content-Type': 'application/json',
    })
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except:
        return None

def insert_q(section, qtype, title, content):
    r = query_d1(
        "INSERT INTO test_contents (test_type, section, question_type, title, content, media_url, difficulty, topic, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ['IELTS', section, qtype, title, json.dumps(content, ensure_ascii=False), '', '3', title, 'curated', 'published']
    )
    return r and r.get('success')

inserted = 0

# === IELTS Extra — Official sample tasks ===
extra_dir = 'ielts-materials/ielts-extra/IELTS'

for subdir in ['Academic reading', 'Listening', 'Academic Writing']:
    full_dir = os.path.join(extra_dir, subdir)
    if not os.path.exists(full_dir):
        continue

    for f in sorted(os.listdir(full_dir)):
        if not f.endswith('.pdf'):
            continue
        path = os.path.join(full_dir, f)
        try:
            doc = fitz.open(path)
            text = ''
            for page in doc:
                text += page.get_text() + '\n'
            doc.close()
            if len(text.strip()) < 50:
                continue

            fname = f.lower()
            section = 'reading' if 'reading' in subdir.lower() else 'listening' if 'listening' in subdir.lower() else 'writing'

            # Determine question type
            qtype = 'multiple_choice'
            if 'matching_information' in fname: qtype = 'matching_information'
            elif 'matching_headings' in fname or 'headings' in fname: qtype = 'matching_headings'
            elif 'matching_features' in fname: qtype = 'matching_information'
            elif 'identifying' in fname or 'views' in fname: qtype = 'true_false_not_given'
            elif 'table' in fname: qtype = 'sentence_completion'
            elif 'diagram' in fname or 'label' in fname: qtype = 'sentence_completion'
            elif 'multiple' in fname: qtype = 'multiple_choice'
            elif 'form' in fname or 'completion' in fname: qtype = 'fill_in_blank'
            elif 'matching' in fname: qtype = 'matching'
            elif 'sentence' in fname: qtype = 'sentence_completion'
            elif 'short' in fname: qtype = 'sentence_completion'
            elif 'plan' in fname or 'map' in fname: qtype = 'map_diagram_labeling'
            elif 'task_1' in fname or 'task 1' in fname: qtype = 'task1'
            elif 'task_2' in fname or 'task 2' in fname: qtype = 'task2'

            if section == 'listening':
                qtype = 'fill_in_blank' if 'completion' in fname or 'form' in fname else qtype

            # Extract questions
            parts = re.split(r'Questions?\s+\d', text, 1)
            passage = parts[0].strip()[:3000]
            q_text = parts[1].strip()[:2000] if len(parts) > 1 else text[:2000]

            q_lines = re.findall(r'(\d+)\s*[.)]\s*(.+?)(?=\n\d+\s*[.)]\s|\n\n|$)', q_text)
            questions = []
            for num_str, qt in q_lines:
                qt = qt.strip()
                if 5 < len(qt) < 300:
                    options = []
                    if qtype == 'true_false_not_given':
                        options = [{'key':'TRUE','text':'TRUE'},{'key':'FALSE','text':'FALSE'},{'key':'NOT GIVEN','text':'NOT GIVEN'}]
                    questions.append({'index': len(questions), 'question_text': qt, 'answers': [], 'options': options, 'explanation': ''})

            if not questions and section == 'writing':
                questions = [{'index': 0, 'passage': passage[:1500], 'question_text': 'Write your response.', 'model_answer': '', 'illustrated_passages': []}]

            if questions:
                title_clean = f.replace('.pdf', '').replace('_', ' ').replace('-', ' ').strip()[:100]

                if section == 'writing':
                    content = {'type': 'grouped_writing', 'group_name': title_clean, 'direction': passage[:500], 'questions': questions, 'question_count': len(questions)}
                elif section == 'listening':
                    content = {'type': 'grouped_listening', 'group_name': title_clean, 'direction': 'Complete the answers.', 'passage_script': passage[:2000], 'questions': questions, 'question_count': len(questions)}
                else:
                    content = {'type': 'grouped_reading', 'group_name': title_clean, 'passage': passage[:3000], 'direction': 'Read and answer.', 'questions': questions, 'question_count': len(questions)}

                if insert_q(section, qtype, title_clean, content):
                    inserted += 1
                    print(f'  [{section}/{qtype}] {title_clean}: {len(questions)} Qs')
        except Exception as e:
            print(f'  Error {f}: {e}')

# === Writing sample PDFs ===
for f in os.listdir(extra_dir):
    if f.endswith('.pdf') and 'writing' in f.lower():
        path = os.path.join(extra_dir, f)
        try:
            doc = fitz.open(path)
            text = ''
            for page in doc:
                text += page.get_text() + '\n'
            doc.close()
            if len(text.strip()) < 50:
                continue

            qtype = 'task1' if 'task-1' in f.lower() or 'task_1' in f.lower() else 'task2'
            title = f.replace('.pdf', '').replace('-', ' ').replace('_', ' ').strip()[:100]
            content = {
                'type': 'grouped_writing', 'group_name': title,
                'direction': text[:500].strip(),
                'questions': [{'index': 0, 'passage': text[:1500].strip(), 'question_text': 'Write your response.', 'model_answer': '', 'illustrated_passages': []}],
                'question_count': 1,
            }
            if insert_q('writing', qtype, title, content):
                inserted += 1
                print(f'  [writing/{qtype}] {title}')
        except Exception as e:
            print(f'  Error {f}: {e}')

# === IELTS Anas — Speaking topics ===
anas_dir = 'ielts-materials/ielts-anas/IELTS Anas '
speaking_pdf = os.path.join(anas_dir, '42-topics-for-ielts-speaking-part-1-suggested-answers-2016.pdf')
if os.path.exists(speaking_pdf):
    try:
        doc = fitz.open(speaking_pdf)
        text = ''
        for page in doc:
            text += page.get_text() + '\n'
        doc.close()
        all_qs = [q.strip() for q in re.findall(r'[A-Z][^?]+\?', text) if 15 < len(q) < 200]
        print(f'\n  42 Topics PDF: {len(all_qs)} speaking questions')

        for i in range(0, min(len(all_qs), 100), 5):
            batch = all_qs[i:i+5]
            title = f'Speaking Part 1 - Set {i//5 + 1}'
            content = {
                'type': 'grouped_speaking', 'group_name': title,
                'direction': 'Answer each question in 2-3 sentences.',
                'questions': [{'index': j, 'script': q, 'question_text': ''} for j, q in enumerate(batch)],
                'question_count': len(batch),
            }
            if insert_q('speaking', 'part1', title, content):
                inserted += 1
    except Exception as e:
        print(f'  Speaking PDF error: {e}')

# === IELTS Anas — Speaking Part 1 2020 ===
speaking2_pdf = os.path.join(anas_dir, 'IELTs spekaing part 1 2020.pdf')
if os.path.exists(speaking2_pdf):
    try:
        doc = fitz.open(speaking2_pdf)
        text = ''
        for page in doc:
            text += page.get_text() + '\n'
        doc.close()
        all_qs = [q.strip() for q in re.findall(r'[A-Z][^?]+\?', text) if 15 < len(q) < 200]
        print(f'  Speaking 2020 PDF: {len(all_qs)} questions')

        for i in range(0, min(len(all_qs), 100), 5):
            batch = all_qs[i:i+5]
            title = f'Speaking Part 1 2020 - Set {i//5 + 1}'
            content = {
                'type': 'grouped_speaking', 'group_name': title,
                'direction': 'Answer each question about familiar topics.',
                'questions': [{'index': j, 'script': q, 'question_text': ''} for j, q in enumerate(batch)],
                'question_count': len(batch),
            }
            if insert_q('speaking', 'part1', title, content):
                inserted += 1
    except Exception as e:
        print(f'  Speaking 2020 error: {e}')

# === IELTS Book Test 1 ===
book_pdf = os.path.join(anas_dir, 'IELTS BOOK  TEST 1.pdf')
if os.path.exists(book_pdf):
    try:
        doc = fitz.open(book_pdf)
        text = ''
        for page in doc:
            text += page.get_text() + '\n'
        doc.close()
        print(f'\n  IELTS Book Test 1: {len(text)} chars')

        passages = re.split(r'READING PASSAGE\s*\d', text, flags=re.IGNORECASE)
        for pi, passage in enumerate(passages[1:], 1):
            q_lines = re.findall(r'(\d+)\s*[.)]\s*(.+?)(?=\n\d+\s*[.)]\s|\n\n|$)', passage)
            questions = [{'index': i, 'question_text': qt.strip(), 'answers': [], 'options': [], 'explanation': ''}
                        for i, (_, qt) in enumerate(q_lines) if 5 < len(qt.strip()) < 300]
            if questions:
                content = {
                    'type': 'grouped_reading', 'group_name': f'IELTS Book Test 1 Passage {pi}',
                    'passage': passage[:3000], 'direction': 'Answer the questions.',
                    'questions': questions[:15], 'question_count': min(len(questions), 15),
                }
                if insert_q('reading', 'multiple_choice', f'IELTS Book Test 1 P{pi}', content):
                    inserted += 1
                    print(f'  Book Test 1 Passage {pi}: {min(len(questions), 15)} Qs')
    except Exception as e:
        print(f'  Book error: {e}')

print(f'\n=== TOTAL NEW: {inserted} IELTS groups inserted ===')
