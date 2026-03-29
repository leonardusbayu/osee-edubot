import json, sys, urllib.request
sys.stdout.reconfigure(encoding='utf-8')

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
        ['TOEIC', section, qtype, title, json.dumps(content, ensure_ascii=False), '', '3', title, 'curated', 'published'])
    return r and r.get('success')

inserted = 0
base = '//wsl.localhost/Ubuntu/home/leonardusbayu/.openclaw-toeicbot/workspace/curriculum/toeic'

# Listening full
with open(f'{base}/listening_full.json', encoding='utf-8') as f:
    data = json.load(f)

ls = data.get('listening', {})
ak = data.get('answer_key', {}).get('listening', {})

# Part 1
p1 = ls.get('part_1', {})
if p1.get('questions'):
    qs = [{'index': i, 'question_text': f'Question {q["number"]}', 'options': [{'key':'A','text':q.get('A','')},{'key':'B','text':q.get('B','')},{'key':'C','text':q.get('C','')},{'key':'D','text':q.get('D','')}], 'answers': [q.get('answer_key','')], 'explanation': ''} for i, q in enumerate(p1['questions'])]
    if insert_q('listening', 'photographs', 'TOEIC Part 1', {'type':'grouped_listening','group_name':'TOEIC Photographs','direction':p1.get('directions',''),'passage_script':'','questions':qs,'question_count':len(qs)}):
        inserted += 1; print(f'Part 1: {len(qs)} Qs')

# Part 2
p2 = ls.get('part_2', {})
if p2.get('questions'):
    qs = [{'index': i, 'question_text': q.get('question',''), 'script': q.get('question',''), 'options': [{'key':'A','text':q.get('A','')},{'key':'B','text':q.get('B','')},{'key':'C','text':q.get('C','')}], 'answers': [q.get('answer_key','')], 'explanation': ''} for i, q in enumerate(p2['questions'])]
    if insert_q('listening', 'question_response', 'TOEIC Part 2', {'type':'grouped_listening','group_name':'TOEIC Q&R','direction':p2.get('directions',''),'passage_script':'','questions':qs,'question_count':len(qs)}):
        inserted += 1; print(f'Part 2: {len(qs)} Qs')

# Part 1 detailed
with open(f'{base}/listening_part1.json', encoding='utf-8') as f:
    p1d = json.load(f)
if p1d.get('questions'):
    qs = []
    for i, q in enumerate(p1d['questions']):
        opts = q.get('options', {})
        qs.append({'index': i, 'question_text': f'Question {q["number"]}', 'script': q.get('transcript',''), 'options': [{'key':k,'text':v} for k,v in opts.items()], 'answers': [q.get('answer_key','')], 'explanation': ''})
    if insert_q('listening', 'photographs', 'TOEIC Part 1 ETS', {'type':'grouped_listening','group_name':'ETS Part 1','direction':'Look at the photograph and choose the best description.','passage_script':'','questions':qs,'question_count':len(qs)}):
        inserted += 1; print(f'Part 1 ETS: {len(qs)} Qs')

# Generate Reading Part 5 (Incomplete Sentences) — business English MCQ
sets = [
    [
        {'q': 'The sales team ___ their monthly targets last quarter.', 'A': 'exceed', 'B': 'exceeded', 'C': 'exceeding', 'D': 'exceeds', 'a': 'B'},
        {'q': 'Please submit your expense report ___ Friday.', 'A': 'until', 'B': 'by', 'C': 'since', 'D': 'from', 'a': 'B'},
        {'q': 'The new policy will ___ effective immediately.', 'A': 'become', 'B': 'becoming', 'C': 'became', 'D': 'becomes', 'a': 'A'},
        {'q': 'Ms. Kim is ___ for coordinating the annual conference.', 'A': 'response', 'B': 'responding', 'C': 'responsible', 'D': 'responsive', 'a': 'C'},
        {'q': 'The company plans to ___ its operations to Southeast Asia.', 'A': 'expand', 'B': 'expanse', 'C': 'expansion', 'D': 'expanding', 'a': 'A'},
        {'q': '___ the bad weather, the outdoor event was postponed.', 'A': 'Although', 'B': 'Despite', 'C': 'Due to', 'D': 'However', 'a': 'C'},
        {'q': 'All employees must attend the ___ training session.', 'A': 'mandate', 'B': 'mandatory', 'C': 'mandating', 'D': 'mandated', 'a': 'B'},
        {'q': 'The report should be submitted ___ than December 15.', 'A': 'not later', 'B': 'no later', 'C': 'latest', 'D': 'not latest', 'a': 'B'},
        {'q': 'Customer satisfaction has ___ significantly since the new system was implemented.', 'A': 'improve', 'B': 'improving', 'C': 'improved', 'D': 'improvement', 'a': 'C'},
        {'q': 'The factory produces approximately 500 units ___ day.', 'A': 'each', 'B': 'every', 'C': 'per', 'D': 'all', 'a': 'C'},
    ],
    [
        {'q': 'The marketing department is ___ a new advertising campaign.', 'A': 'developing', 'B': 'development', 'C': 'develop', 'D': 'developed', 'a': 'A'},
        {'q': 'All visitors must ___ at the front desk before entering.', 'A': 'register', 'B': 'registered', 'C': 'registration', 'D': 'registering', 'a': 'A'},
        {'q': 'The project was completed ___ schedule and under budget.', 'A': 'behind', 'B': 'ahead of', 'C': 'after', 'D': 'before', 'a': 'B'},
        {'q': '___ reviewing the proposal, the committee approved the funding.', 'A': 'When', 'B': 'After', 'C': 'Although', 'D': 'Unless', 'a': 'B'},
        {'q': 'The hotel offers a ___ range of services for business travelers.', 'A': 'width', 'B': 'widely', 'C': 'wide', 'D': 'widen', 'a': 'C'},
        {'q': 'The company ___ a significant increase in revenue this quarter.', 'A': 'experience', 'B': 'experienced', 'C': 'experiencing', 'D': 'experiences', 'a': 'B'},
        {'q': 'The warehouse is ___ located near the highway.', 'A': 'convenient', 'B': 'convenience', 'C': 'conveniently', 'D': 'convene', 'a': 'C'},
        {'q': 'Due to high demand, the product is ___ out of stock.', 'A': 'current', 'B': 'currently', 'C': 'currency', 'D': 'currents', 'a': 'B'},
        {'q': 'Mr. Park will ___ the Seoul office next week.', 'A': 'visit', 'B': 'visiting', 'C': 'visited', 'D': 'visitor', 'a': 'A'},
        {'q': 'The ___ of the conference will be announced next month.', 'A': 'locate', 'B': 'location', 'C': 'located', 'D': 'locating', 'a': 'B'},
    ],
    [
        {'q': 'Employees are ___ to submit their timesheets by Friday.', 'A': 'require', 'B': 'required', 'C': 'requiring', 'D': 'requirement', 'a': 'B'},
        {'q': 'The new software is ___ user-friendly than the previous version.', 'A': 'more', 'B': 'most', 'C': 'much', 'D': 'very', 'a': 'A'},
        {'q': 'Please ___ your seatbelt while the aircraft is taxiing.', 'A': 'fasten', 'B': 'fastened', 'C': 'fastening', 'D': 'fastens', 'a': 'A'},
        {'q': 'The quarterly report ___ an increase in customer complaints.', 'A': 'indicate', 'B': 'indicates', 'C': 'indicating', 'D': 'indication', 'a': 'B'},
        {'q': 'The renovation of the office building is expected to be ___ by March.', 'A': 'complete', 'B': 'completed', 'C': 'completing', 'D': 'completely', 'a': 'B'},
        {'q': 'Participants should arrive ___ 15 minutes before the seminar begins.', 'A': 'at least', 'B': 'at last', 'C': 'at once', 'D': 'at most', 'a': 'A'},
        {'q': 'The manager ___ the team for their excellent work on the project.', 'A': 'praise', 'B': 'praised', 'C': 'praising', 'D': 'praises', 'a': 'B'},
        {'q': 'The company offers ___ health insurance benefits to all full-time employees.', 'A': 'comprehend', 'B': 'comprehensive', 'C': 'comprehension', 'D': 'comprehensively', 'a': 'B'},
        {'q': '___ of the budget has been allocated to marketing activities.', 'A': 'Most', 'B': 'Almost', 'C': 'Mostly', 'D': 'The most', 'a': 'A'},
        {'q': 'The shipment is ___ to arrive by the end of the week.', 'A': 'expect', 'B': 'expected', 'C': 'expecting', 'D': 'expectation', 'a': 'B'},
    ],
]

for si, qset in enumerate(sets):
    qs = [{'index': i, 'question_text': q['q'], 'options': [{'key':'A','text':q['A']},{'key':'B','text':q['B']},{'key':'C','text':q['C']},{'key':'D','text':q['D']}], 'answers': [q['a']], 'explanation': ''} for i, q in enumerate(qset)]
    title = f'TOEIC Part 5 Set {si+1}'
    if insert_q('reading', 'incomplete_sentences', title, {'type':'grouped_reading','group_name':title,'passage':'','direction':'Choose the best answer to complete each sentence.','questions':qs,'question_count':len(qs)}):
        inserted += 1; print(f'Part 5 Set {si+1}: {len(qs)} Qs')

print(f'\nTOTAL TOEIC: {inserted} groups inserted')
