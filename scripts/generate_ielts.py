#!/usr/bin/env python3
"""Generate IELTS question bank SQL inserts."""
import json

questions = []

# ─── LISTENING SECTION 1: Social/everyday (fill in blank + MCQ) ─────
listening_s1 = [
    {
        "topic": "accommodation",
        "script": "Agent: Good morning, City Apartments. How can I help you? Caller: I'm looking for a two-bedroom flat near the university. Agent: We have one available on Park Road. It's on the third floor with a balcony. The rent is eight hundred and fifty pounds per month, including water but not electricity. Caller: When can I view it? Agent: How about this Thursday at two PM?",
        "questions": [
            ("The flat is located on _______ Road.", "Park", "The agent says 'Park Road.'"),
            ("The flat is on the _______ floor.", "third", "The agent says 'third floor.'"),
            ("The monthly rent is £_______.", "850", "The agent says 'eight hundred and fifty pounds.'"),
            ("The viewing is on Thursday at _______ PM.", "2", "The agent says 'two PM.'"),
        ]
    },
    {
        "topic": "course_enrollment",
        "script": "Receptionist: Welcome to Greenfield Language School. Student: I'd like to enroll in an evening English course. Receptionist: Our next course starts on September fifth and runs for twelve weeks. Classes are on Tuesdays and Thursdays from six to eight PM. The total fee is four hundred and twenty pounds. Student: Is there a placement test? Receptionist: Yes, on August twenty-eighth.",
        "questions": [
            ("The course starts on September _______.", "5/fifth", "The receptionist says 'September fifth.'"),
            ("The course lasts _______ weeks.", "12/twelve", "The receptionist says 'twelve weeks.'"),
            ("The total fee is £_______.", "420", "The receptionist says 'four hundred and twenty pounds.'"),
            ("The placement test is on August _______.", "28/twenty-eighth", "The receptionist says 'August twenty-eighth.'"),
        ]
    },
    {
        "topic": "library_membership",
        "script": "Librarian: Hello, would you like to register for a library card? Visitor: Yes, please. Librarian: I'll need your full name. Visitor: It's Sarah Mitchell, M-I-T-C-H-E-L-L. Librarian: And your date of birth? Visitor: The fifteenth of March, nineteen ninety-two. Librarian: Your card will be ready in three working days. The annual fee is fifteen pounds.",
        "questions": [
            ("The visitor's surname is _______.", "Mitchell", "She spells it out: M-I-T-C-H-E-L-L."),
            ("Her date of birth is _______ March 1992.", "15/fifteenth", "She says 'the fifteenth of March.'"),
            ("The card takes _______ working days.", "3/three", "The librarian says 'three working days.'"),
            ("The annual fee is £_______.", "15/fifteen", "The librarian says 'fifteen pounds.'"),
        ]
    },
    {
        "topic": "travel_booking",
        "script": "Agent: Sunrise Travel, how may I help? Customer: I'd like to book a return flight to Barcelona. Agent: When would you like to depart? Customer: On the tenth of November. Agent: We have a flight at seven thirty AM with Iberia Airlines. The return would be on the seventeenth. The economy fare is three hundred and sixty-five pounds. Customer: That's fine. My passport number is HC452178.",
        "questions": [
            ("The destination is _______.", "Barcelona", "The customer says 'to Barcelona.'"),
            ("The departure date is November _______.", "10/tenth", "The customer says 'the tenth of November.'"),
            ("The airline is _______.", "Iberia", "The agent says 'Iberia Airlines.'"),
            ("The economy fare is £_______.", "365", "The agent says 'three hundred and sixty-five pounds.'"),
        ]
    },
    {
        "topic": "gym_membership",
        "script": "Staff: Welcome to FitZone Gym. How can I help? Visitor: I'm interested in a membership. Staff: Our standard membership is forty-five pounds per month. That includes access to the gym, swimming pool, and group classes. We also offer personal training sessions at twenty pounds each. The gym is open from six AM to ten PM on weekdays. Visitor: Is there a joining fee? Staff: Yes, it's thirty pounds, but we're waiving it this month.",
        "questions": [
            ("The monthly membership fee is £_______.", "45", "The staff says 'forty-five pounds per month.'"),
            ("Personal training sessions cost £_______ each.", "20/twenty", "The staff says 'twenty pounds each.'"),
            ("The gym closes at _______ PM on weekdays.", "10", "The staff says 'ten PM.'"),
            ("The joining fee is normally £_______.", "30/thirty", "The staff says 'thirty pounds.'"),
        ]
    },
]

for si, s in enumerate(listening_s1):
    qs = []
    for qi, (qt, ans, expl) in enumerate(s["questions"]):
        qs.append({
            "index": qi,
            "question_text": qt,
            "answers": [ans],
            "options": [],
            "explanation": expl
        })
    q = {
        "type": "grouped_listening",
        "group_name": f"IELTS Listening Section 1 - {s['topic'].replace('_',' ').title()}",
        "direction": "Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
        "passage_script": s["script"],
        "questions": qs,
        "question_count": len(qs)
    }
    questions.append(("IELTS", "listening", "fill_in_blank", f"Section 1 - {s['topic']}", json.dumps(q),
                       2, s["topic"],
                       '["detail","scanning","note_completion"]', 'A2', 'remember'))


# ─── LISTENING SECTION 2: Social monologue (MCQ) ───────────
listening_s2 = [
    {
        "topic": "museum_guide",
        "script": "Welcome to the National History Museum. The museum was founded in 1881 and houses over eighty million specimens. Today's special exhibition is on marine life and is located on the second floor. Photography is allowed but please don't use flash. The gift shop closes at five thirty, thirty minutes before the museum itself. Guided tours depart every hour from the main entrance.",
        "questions": [
            ("When was the museum founded?", [("A","1881"),("B","1891"),("C","1981")], "A", "The guide says 'founded in 1881.'"),
            ("Where is the special exhibition?", [("A","Ground floor"),("B","Second floor"),("C","Third floor")], "B", "The guide says 'second floor.'"),
            ("When does the gift shop close?", [("A","5:00"),("B","5:30"),("C","6:00")], "B", "The guide says 'five thirty.'"),
        ]
    },
    {
        "topic": "campus_tour",
        "script": "Hello everyone, and welcome to Riverside University. I'll be showing you around campus today. The main library is straight ahead — it's open twenty-four hours during exam periods. To your left is the Student Union building where you'll find the cafeteria, a bookshop, and various club offices. The sports center is a ten-minute walk from here, past the science building. Free shuttle buses run between campus buildings every fifteen minutes.",
        "questions": [
            ("The library is open 24 hours during _______.", [("A","Weekends"),("B","Exam periods"),("C","Summer")], "B", "'Open twenty-four hours during exam periods.'"),
            ("Where is the cafeteria located?", [("A","In the library"),("B","In the Student Union"),("C","In the sports center")], "B", "'Student Union building where you'll find the cafeteria.'"),
            ("How often do shuttle buses run?", [("A","Every 10 minutes"),("B","Every 15 minutes"),("C","Every 20 minutes")], "B", "'Every fifteen minutes.'"),
        ]
    },
    {
        "topic": "local_festival",
        "script": "The Hillside Summer Festival returns this August for its twentieth year. The festival runs from August eighth to the twelfth. Tickets are twenty-five pounds for a day pass or eighty pounds for the full five days. Children under twelve get in free. This year's headliners include The Silver Notes and Echo Chamber. Food stalls will be open from eleven AM to nine PM. Free parking is available at the North Field car park, with shuttle buses to the main stage area.",
        "questions": [
            ("How many years has the festival been running?", [("A","15"),("B","20"),("C","25")], "B", "'Its twentieth year.'"),
            ("How much is a full festival pass?", [("A","£25"),("B","£50"),("C","£80")], "C", "'Eighty pounds for the full five days.'"),
            ("When do food stalls close?", [("A","8 PM"),("B","9 PM"),("C","10 PM")], "B", "'Eleven AM to nine PM.'"),
        ]
    },
    {
        "topic": "recycling_info",
        "script": "Good evening, residents. I'm here to explain the new recycling scheme starting next month. Green bins are for paper and cardboard. Blue bins are for plastic and metal containers. Brown bins are for food waste and garden waste. Collections will be every Wednesday for green and blue, and every other Friday for brown. Please have your bins at the curb by seven AM. Contaminated bins — those with incorrect items — will not be collected.",
        "questions": [
            ("What goes in the green bin?", [("A","Plastic"),("B","Paper and cardboard"),("C","Food waste")], "B", "'Green bins are for paper and cardboard.'"),
            ("When are brown bins collected?", [("A","Every Wednesday"),("B","Every Friday"),("C","Every other Friday")], "C", "'Every other Friday for brown.'"),
            ("By what time should bins be at the curb?", [("A","6 AM"),("B","7 AM"),("C","8 AM")], "B", "'By seven AM.'"),
        ]
    },
    {
        "topic": "health_center",
        "script": "Welcome to Parkview Health Center. We offer GP appointments Monday to Friday, nine AM to five PM. For urgent care, walk-in hours are eight to ten AM. The pharmacy is located on the ground floor and is open until six thirty PM. Blood tests are done by appointment only on Tuesdays and Thursdays. Please note that our phone lines are open from eight AM, but the busiest time is between nine and ten, so we recommend calling after ten for shorter wait times.",
        "questions": [
            ("Walk-in hours are from _______ to 10 AM.", [("A","7 AM"),("B","8 AM"),("C","9 AM")], "B", "'Walk-in hours are eight to ten AM.'"),
            ("The pharmacy closes at _______.", [("A","5:30 PM"),("B","6:00 PM"),("C","6:30 PM")], "C", "'Open until six thirty PM.'"),
            ("When are blood tests available?", [("A","Mondays and Wednesdays"),("B","Tuesdays and Thursdays"),("C","Every day")], "B", "'Tuesdays and Thursdays.'"),
        ]
    },
]

for si, s in enumerate(listening_s2):
    qs = []
    for qi, (qt, opts, ans, expl) in enumerate(s["questions"]):
        qs.append({
            "index": qi,
            "question_text": qt,
            "options": [{"key": k, "text": t} for k, t in opts],
            "answers": [ans],
            "explanation": expl
        })
    q = {
        "type": "grouped_listening",
        "group_name": f"IELTS Listening Section 2 - {s['topic'].replace('_',' ').title()}",
        "direction": "Choose the correct letter, A, B, or C.",
        "passage_script": s["script"],
        "questions": qs,
        "question_count": len(qs)
    }
    questions.append(("IELTS", "listening", "multiple_choice", f"Section 2 - {s['topic']}", json.dumps(q),
                       3, s["topic"],
                       '["detail","main_idea","inference"]', 'B1', 'understand'))


# ─── READING: True/False/Not Given ─────────────────────────
reading_tfng = [
    {
        "topic": "remote_work",
        "passage": "The shift to remote work has accelerated dramatically since 2020. A recent survey found that 74% of companies plan to permanently adopt some form of hybrid working. Employees report higher job satisfaction when given flexibility, though managers express concern about maintaining team cohesion. Studies show that productivity often increases for individual tasks but may decrease for collaborative projects. Some companies have reduced their office space by up to 40%, reinvesting the savings into technology infrastructure.",
        "questions": [
            ("Most companies intend to continue with hybrid working arrangements.", "TRUE", "The passage states '74% of companies plan to permanently adopt some form of hybrid working,' which supports this."),
            ("All employees prefer working from home full-time.", "NOT GIVEN", "The passage mentions 'higher job satisfaction when given flexibility' but does not say all prefer full-time remote work."),
            ("Productivity for collaborative projects has improved with remote work.", "FALSE", "The passage says productivity 'may decrease for collaborative projects.'"),
            ("Some companies have used savings from reduced office space for technology.", "TRUE", "The passage says 'reinvesting the savings into technology infrastructure.'"),
        ]
    },
    {
        "topic": "sleep_science",
        "passage": "Sleep scientists have identified four distinct stages of sleep that cycle throughout the night. Stage 1 is light sleep lasting about five to ten minutes. Stage 2 involves a drop in body temperature and slowed heart rate, lasting approximately twenty minutes. Stage 3, known as deep sleep, is when the body repairs tissues and strengthens the immune system. REM sleep, the fourth stage, is when most dreaming occurs and is crucial for memory consolidation. Adults typically need seven to nine hours of sleep per night, though individual needs vary.",
        "questions": [
            ("Stage 1 sleep typically lasts between five and ten minutes.", "TRUE", "The passage states 'light sleep lasting about five to ten minutes.'"),
            ("Body temperature rises during Stage 2 sleep.", "FALSE", "The passage says 'a drop in body temperature' during Stage 2."),
            ("Deep sleep is important for tissue repair.", "TRUE", "The passage says 'deep sleep is when the body repairs tissues.'"),
            ("Children need more sleep than adults.", "NOT GIVEN", "The passage only mentions adult sleep needs, not children's."),
            ("REM sleep helps with memory consolidation.", "TRUE", "The passage says REM sleep 'is crucial for memory consolidation.'"),
        ]
    },
    {
        "topic": "urban_farming",
        "passage": "Urban farming has emerged as a growing trend in cities worldwide. Rooftop gardens, vertical farms, and community allotments are transforming unused spaces into productive growing areas. In Singapore, vertical farms now supply around 10% of the city's vegetable needs. Urban farms typically use 95% less water than conventional agriculture through hydroponic and aeroponic systems. Critics argue that urban farming cannot replace large-scale agriculture, but proponents see it as a valuable supplement that reduces food miles and provides fresh produce to food deserts.",
        "questions": [
            ("Singapore's vertical farms provide all of the city's vegetables.", "FALSE", "The passage says 'around 10%,' not all."),
            ("Urban farming uses significantly less water than traditional farming.", "TRUE", "'95% less water than conventional agriculture.'"),
            ("Hydroponic systems were invented in Singapore.", "NOT GIVEN", "The passage mentions hydroponics but says nothing about where it was invented."),
            ("Some people believe urban farming can fully replace conventional agriculture.", "NOT GIVEN", "Critics say it cannot, but the passage doesn't say anyone claims it can fully replace it."),
        ]
    },
]

for ri, rp in enumerate(reading_tfng):
    qs = []
    for qi, (qt, ans, expl) in enumerate(rp["questions"]):
        qs.append({
            "index": qi,
            "question_text": qt,
            "answers": [ans],
            "options": [{"key": "TRUE", "text": "TRUE"}, {"key": "FALSE", "text": "FALSE"}, {"key": "NOT GIVEN", "text": "NOT GIVEN"}],
            "explanation": expl
        })
    q = {
        "type": "grouped_reading",
        "group_name": f"IELTS Reading - TFNG {ri+1}",
        "passage": rp["passage"],
        "direction": "Do the following statements agree with the information given in the passage? Write TRUE, FALSE, or NOT GIVEN.",
        "questions": qs,
        "question_count": len(qs)
    }
    questions.append(("IELTS", "reading", "true_false_not_given", f"TFNG - {rp['topic']}", json.dumps(q),
                       3, rp["topic"],
                       '["true_false_ng","inference","detail"]', 'B2', 'analyze'))


# ─── READING: Matching Headings ────────────────────────────
matching_headings = [
    {
        "topic": "renewable_energy",
        "passage": "Paragraph A: Solar power has become the fastest-growing energy source globally. The cost of solar panels has dropped by 89% since 2010, making it cheaper than fossil fuels in many regions. China leads the world in solar installation capacity.\n\nParagraph B: Wind energy presents both opportunities and challenges. While offshore wind farms can generate enormous amounts of electricity, they face opposition from coastal communities concerned about visual impact and effects on marine ecosystems.\n\nParagraph C: Hydrogen fuel cells are gaining attention as a clean energy solution for transportation. Unlike batteries, hydrogen can be refueled in minutes rather than hours. However, most hydrogen is currently produced from natural gas, which still generates carbon emissions.\n\nParagraph D: Energy storage remains the biggest obstacle to renewable adoption. Without reliable storage, solar and wind energy cannot provide consistent power supply. Battery technology is improving rapidly, with lithium-ion costs falling 97% since 1991.",
        "headings": [
            "i. The dramatic cost reduction in solar technology",
            "ii. Storage: the key challenge for green energy",
            "iii. Wind power: benefits and controversies",
            "iv. Hydrogen: a promising but imperfect solution",
            "v. Nuclear energy's role in the energy mix",
            "vi. Government subsidies for renewable energy",
        ],
        "questions": [
            ("Paragraph A", "i", "Paragraph A discusses solar power's cost drop and growth."),
            ("Paragraph B", "iii", "Paragraph B discusses wind energy's opportunities and opposition."),
            ("Paragraph C", "iv", "Paragraph C discusses hydrogen as promising but with carbon emission issues."),
            ("Paragraph D", "ii", "Paragraph D discusses energy storage as the biggest obstacle."),
        ]
    },
]

for ri, rp in enumerate(matching_headings):
    qs = []
    for qi, (qt, ans, expl) in enumerate(rp["questions"]):
        qs.append({
            "index": qi,
            "question_text": f"Choose the correct heading for {qt}",
            "answers": [ans],
            "options": [{"key": h.split(".")[0], "text": h} for h in rp["headings"]],
            "explanation": expl
        })
    q = {
        "type": "grouped_reading",
        "group_name": f"IELTS Reading - Matching Headings {ri+1}",
        "passage": rp["passage"],
        "direction": "Choose the correct heading for each paragraph from the list of headings below.",
        "questions": qs,
        "question_count": len(qs)
    }
    questions.append(("IELTS", "reading", "matching_headings", f"Headings - {rp['topic']}", json.dumps(q),
                       4, rp["topic"],
                       '["matching_headings","main_idea","paraphrase"]', 'B2', 'analyze'))


# ─── READING: Sentence Completion ──────────────────────────
sentence_completion = [
    {
        "topic": "ocean_pollution",
        "passage": "Plastic pollution in the world's oceans has reached crisis levels, with an estimated 8 million metric tons entering the sea each year. The Great Pacific Garbage Patch, located between Hawaii and California, covers an area roughly twice the size of Texas. Marine animals frequently mistake plastic debris for food, leading to starvation and death. Microplastics — fragments smaller than 5 millimeters — have been found in drinking water, seafood, and even human blood. Several nations have implemented bans on single-use plastics, and new technologies are being developed to remove plastic from waterways before it reaches the ocean.",
        "questions": [
            ("Approximately _______ metric tons of plastic enter the ocean annually.", "8 million", "'An estimated 8 million metric tons entering the sea each year.'"),
            ("The Great Pacific Garbage Patch is roughly _______ the size of Texas.", "twice", "'Covers an area roughly twice the size of Texas.'"),
            ("Microplastics are defined as fragments smaller than _______ millimeters.", "5", "'Fragments smaller than 5 millimeters.'"),
            ("Some countries have banned _______ plastics.", "single-use", "'Bans on single-use plastics.'"),
        ]
    },
    {
        "topic": "artificial_intelligence",
        "passage": "Artificial intelligence has made remarkable progress in recent years, particularly in natural language processing and computer vision. Large language models can now generate human-like text, translate between languages, and summarize complex documents. In healthcare, AI systems have demonstrated the ability to detect certain cancers more accurately than experienced radiologists. However, concerns about bias in AI systems remain significant, as training data often reflects existing societal prejudices. The European Union has proposed comprehensive AI regulations that would classify systems by risk level and impose strict requirements on high-risk applications.",
        "questions": [
            ("AI has particularly advanced in natural language processing and _______.", "computer vision", "'Particularly in natural language processing and computer vision.'"),
            ("AI can detect some cancers better than _______.", "radiologists", "'More accurately than experienced radiologists.'"),
            ("AI bias occurs because training data reflects _______.", "societal prejudices", "'Training data often reflects existing societal prejudices.'"),
            ("The EU plans to classify AI by _______ level.", "risk", "'Classify systems by risk level.'"),
        ]
    },
]

for ri, rp in enumerate(sentence_completion):
    qs = []
    for qi, (qt, ans, expl) in enumerate(rp["questions"]):
        qs.append({
            "index": qi,
            "question_text": qt,
            "answers": [ans],
            "options": [],
            "explanation": expl
        })
    q = {
        "type": "grouped_reading",
        "group_name": f"IELTS Reading - Sentence Completion {ri+1}",
        "passage": rp["passage"],
        "direction": "Complete each sentence below using NO MORE THAN THREE WORDS from the passage.",
        "questions": qs,
        "question_count": len(qs)
    }
    questions.append(("IELTS", "reading", "sentence_completion", f"Completion - {rp['topic']}", json.dumps(q),
                       3, rp["topic"],
                       '["detail","paraphrase","scanning"]', 'B2', 'understand'))


# ─── READING: Multiple Choice ──────────────────────────────
reading_mcq = [
    {
        "topic": "space_exploration",
        "passage": "The commercialization of space travel represents a paradigm shift in human exploration. Companies like SpaceX and Blue Origin have dramatically reduced launch costs, with SpaceX's reusable Falcon 9 rocket cutting the price per kilogram to orbit by approximately 90%. Space tourism is becoming a reality, with several companies offering suborbital flights to wealthy customers. Meanwhile, NASA's Artemis program aims to return humans to the Moon by the mid-2020s as a stepping stone to Mars. The establishment of a permanent lunar base could serve as a testing ground for technologies needed for longer missions and as a refueling station for deep space exploration.",
        "questions": [
            ("What has SpaceX achieved with the Falcon 9?", [("A","Traveled to Mars"),("B","Reduced launch costs by about 90%"),("C","Built a space station"),("D","Landed on the Moon")], "B", "'Cutting the price per kilogram to orbit by approximately 90%.'"),
            ("What is the Artemis program's goal?", [("A","To build a space hotel"),("B","To explore Jupiter"),("C","To return humans to the Moon"),("D","To launch satellites")], "C", "'Aims to return humans to the Moon.'"),
            ("How could a lunar base help with Mars missions?", [("A","By providing entertainment"),("B","By mining lunar resources"),("C","By testing technologies and serving as a refueling station"),("D","By training astronauts in zero gravity")], "C", "'A testing ground for technologies needed for longer missions and as a refueling station.'"),
        ]
    },
    {
        "topic": "language_extinction",
        "passage": "Linguists estimate that one language dies approximately every two weeks. Of the roughly 7,000 languages currently spoken worldwide, nearly half are considered endangered. The loss of a language means far more than the disappearance of a communication system; it represents the loss of unique cultural knowledge, oral histories, and ways of understanding the world. Indigenous languages often contain specialized vocabulary for local plants, animals, and ecological processes that has no equivalent in dominant languages. Efforts to preserve endangered languages include documentation projects, immersion schools, and the development of digital tools and apps for language learning.",
        "questions": [
            ("How often does a language die?", [("A","Every day"),("B","Every week"),("C","Every two weeks"),("D","Every month")], "C", "'One language dies approximately every two weeks.'"),
            ("What is lost when a language disappears?", [("A","Only vocabulary"),("B","Cultural knowledge, history, and worldviews"),("C","Just grammar rules"),("D","Writing systems")], "B", "'Loss of unique cultural knowledge, oral histories, and ways of understanding the world.'"),
            ("Why are indigenous languages particularly valuable?", [("A","They are the oldest languages"),("B","They have the most speakers"),("C","They contain specialized ecological vocabulary"),("D","They are easiest to learn")], "C", "'Specialized vocabulary for local plants, animals, and ecological processes.'"),
        ]
    },
]

for ri, rp in enumerate(reading_mcq):
    qs = []
    for qi, (qt, opts, ans, expl) in enumerate(rp["questions"]):
        qs.append({
            "index": qi,
            "question_text": qt,
            "options": [{"key": k, "text": t} for k, t in opts],
            "answers": [ans],
            "explanation": expl
        })
    q = {
        "type": "grouped_reading",
        "group_name": f"IELTS Reading - MCQ {ri+1}",
        "passage": rp["passage"],
        "direction": "Choose the correct letter, A, B, C or D.",
        "questions": qs,
        "question_count": len(qs)
    }
    questions.append(("IELTS", "reading", "multiple_choice", f"MCQ - {rp['topic']}", json.dumps(q),
                       4, rp["topic"],
                       '["main_idea","detail","inference"]', 'B2', 'analyze'))


# ─── SPEAKING Part 1 ───────────────────────────────────────
speaking_p1_topics = [
    ("work_study", "Do you work or are you a student?", "Talk about your job or studies, what you enjoy about it, and your future plans.", '["fluency","coherence","task_response"]'),
    ("hometown", "Where is your hometown?", "Describe your hometown, what you like about it, and how it has changed.", '["fluency","lexical_range","coherence"]'),
    ("hobbies", "What do you do in your free time?", "Describe your hobbies, how often you do them, and why you enjoy them.", '["fluency","lexical_range","task_response"]'),
    ("food", "What kind of food do you like?", "Talk about your food preferences, cooking habits, and favorite dishes.", '["fluency","lexical_range","coherence"]'),
    ("travel", "Do you like traveling?", "Discuss your travel experiences, favorite destinations, and travel preferences.", '["fluency","coherence","lexical_range"]'),
    ("technology", "How often do you use technology?", "Talk about the technology you use daily and how it helps you.", '["fluency","lexical_range","task_response"]'),
    ("reading", "Do you enjoy reading?", "Discuss your reading habits, favorite genres, and recent books.", '["fluency","lexical_range","task_response"]'),
    ("weather", "What kind of weather do you prefer?", "Talk about the climate in your country and your weather preferences.", '["fluency","coherence","lexical_range"]'),
    ("music", "What type of music do you like?", "Discuss your music tastes, favorite artists, and how music makes you feel.", '["fluency","lexical_range","coherence"]'),
    ("sports", "Do you play any sports?", "Talk about sports you play or watch, and the importance of exercise.", '["fluency","task_response","coherence"]'),
]

for i, (topic, question, prompt, tags) in enumerate(speaking_p1_topics):
    q = {
        "question_id": 5000 + i,
        "question_text": question,
        "direction": "The examiner will ask you questions about familiar topics. Speak for 1-2 minutes.",
        "prompt": prompt,
        "rubric": {
            "fluency_coherence": "Speaks at length without noticeable effort. Uses connectors naturally.",
            "lexical_resource": "Uses a range of vocabulary with flexibility. Paraphrases effectively.",
            "grammar": "Uses a mix of simple and complex structures with good control.",
            "pronunciation": "Is easy to understand throughout. Uses features of connected speech."
        }
    }
    questions.append(("IELTS", "speaking", "part1", f"Part 1 - {topic}", json.dumps(q),
                       2, topic, tags, 'B1', 'create'))


# ─── SPEAKING Part 2 (Cue Card) ────────────────────────────
speaking_p2 = [
    ("memorable_trip", "Describe a memorable trip you have taken.", "You should say:\n- where you went\n- who you went with\n- what you did there\nand explain why it was memorable.", '["coherence","fluency","lexical_range","task_response"]'),
    ("helpful_person", "Describe a person who has helped you.", "You should say:\n- who the person is\n- how you know them\n- what they helped you with\nand explain how you felt about their help.", '["coherence","fluency","lexical_range","task_response"]'),
    ("favorite_place", "Describe a place you like to visit.", "You should say:\n- where it is\n- how often you go there\n- what you do there\nand explain why you like it.", '["coherence","fluency","lexical_range","task_response"]'),
    ("achievement", "Describe an achievement you are proud of.", "You should say:\n- what you achieved\n- when it happened\n- how you felt\nand explain why you are proud of it.", '["coherence","fluency","lexical_range","task_response"]'),
    ("book_movie", "Describe a book or movie that impressed you.", "You should say:\n- what it was about\n- when you read/watched it\n- what you liked about it\nand explain why it made an impression on you.", '["coherence","fluency","lexical_range","task_response"]'),
    ("skill", "Describe a skill you would like to learn.", "You should say:\n- what the skill is\n- why you want to learn it\n- how you would learn it\nand explain how it would benefit you.", '["coherence","fluency","lexical_range","task_response"]'),
    ("important_decision", "Describe an important decision you made.", "You should say:\n- what the decision was\n- when you made it\n- what factors you considered\nand explain the outcome of your decision.", '["coherence","fluency","lexical_range","task_response"]'),
    ("tradition", "Describe a tradition in your country.", "You should say:\n- what the tradition is\n- when it takes place\n- what people do\nand explain why it is important.", '["coherence","fluency","lexical_range","task_response"]'),
    ("technology_item", "Describe a piece of technology you find useful.", "You should say:\n- what it is\n- how you use it\n- when you started using it\nand explain why it is useful to you.", '["coherence","fluency","lexical_range","task_response"]'),
    ("challenge", "Describe a challenge you have faced.", "You should say:\n- what the challenge was\n- when you faced it\n- how you dealt with it\nand explain what you learned from it.", '["coherence","fluency","lexical_range","task_response"]'),
]

for i, (topic, question, prompt, tags) in enumerate(speaking_p2):
    q = {
        "question_id": 5100 + i,
        "question_text": question,
        "direction": "You will have 1 minute to prepare and then should speak for 1-2 minutes.",
        "prompt": prompt,
        "rubric": {
            "fluency_coherence": "Speaks at length with minimal hesitation. Develops topics coherently.",
            "lexical_resource": "Uses vocabulary with flexibility and precision. Uses less common items.",
            "grammar": "Uses a range of complex structures. Makes only occasional errors.",
            "pronunciation": "Uses a range of pronunciation features. Is easy to understand."
        }
    }
    questions.append(("IELTS", "speaking", "part2", f"Part 2 - {topic}", json.dumps(q),
                       3, topic, tags, 'B2', 'create'))


# ─── SPEAKING Part 3 ───────────────────────────────────────
speaking_p3 = [
    ("education_future", "How do you think education will change in the future?", "Discuss technology in education, online learning, changing skill requirements.", '["coherence","fluency","lexical_range","task_response"]'),
    ("environment_responsibility", "Who should be most responsible for protecting the environment?", "Discuss government, corporations, and individual responsibility.", '["coherence","fluency","lexical_range","task_response"]'),
    ("work_life_balance", "Is work-life balance important?", "Discuss modern work culture, stress, productivity, and quality of life.", '["coherence","fluency","lexical_range","task_response"]'),
    ("globalization_culture", "How has globalization affected local cultures?", "Discuss cultural exchange, preservation, and homogenization.", '["coherence","fluency","lexical_range","task_response"]'),
    ("technology_society", "Has technology made people more or less social?", "Discuss social media, face-to-face interaction, and community.", '["coherence","fluency","lexical_range","task_response"]'),
    ("health_modern_life", "What are the biggest health challenges in modern life?", "Discuss sedentary lifestyles, mental health, diet, and healthcare access.", '["coherence","fluency","lexical_range","task_response"]'),
    ("cities_countryside", "Do you think more people will move to cities in the future?", "Discuss urbanization trends, quality of life, opportunities.", '["coherence","fluency","lexical_range","task_response"]'),
    ("leadership_qualities", "What qualities make a good leader?", "Discuss communication, empathy, decision-making, and integrity.", '["coherence","fluency","lexical_range","task_response"]'),
]

for i, (topic, question, prompt, tags) in enumerate(speaking_p3):
    q = {
        "question_id": 5200 + i,
        "question_text": question,
        "direction": "The examiner will ask you abstract questions related to the Part 2 topic. Give extended answers with reasons and examples.",
        "prompt": prompt,
        "rubric": {
            "fluency_coherence": "Speaks at length without loss of coherence. Uses a full range of connectors.",
            "lexical_resource": "Uses vocabulary with full flexibility. Uses idiomatic language naturally.",
            "grammar": "Uses a wide range of structures with full flexibility and accuracy.",
            "pronunciation": "Uses the full range of features with precision and subtlety."
        }
    }
    questions.append(("IELTS", "speaking", "part3", f"Part 3 - {topic}", json.dumps(q),
                       4, topic, tags, 'B2', 'evaluate'))


# ─── WRITING Task 1 (Academic) ─────────────────────────────
writing_t1 = [
    ("bar_chart_energy", "The bar chart below shows the sources of energy used for electricity generation in Country X in 2000 and 2020.", "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.", '["task_achievement","coherence","data_description"]'),
    ("line_graph_internet", "The line graph below shows internet usage rates in four countries between 2000 and 2020.", "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.", '["task_achievement","coherence","data_description"]'),
    ("pie_chart_spending", "The pie charts below show household spending in a European country in 1990 and 2020.", "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.", '["task_achievement","coherence","data_description"]'),
    ("table_transport", "The table below shows the number of passengers using different types of public transport in a city over three years.", "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.", '["task_achievement","coherence","data_description"]'),
    ("process_recycling", "The diagram below shows the process of recycling glass bottles.", "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.", '["task_achievement","coherence","process_description"]'),
]

for i, (topic, question, prompt, tags) in enumerate(writing_t1):
    q = {
        "question_id": 6000 + i,
        "question_text": question,
        "direction": prompt,
        "task_type": "academic_task1",
        "rubric": {
            "task_achievement": "Covers all requirements. Presents a clear overview with key features highlighted.",
            "coherence_cohesion": "Information and ideas are logically organized. Uses a range of cohesive devices.",
            "lexical_resource": "Uses a sufficient range of vocabulary. Uses less common items with awareness of style.",
            "grammar": "Uses a mix of simple and complex sentences. Good control of grammar and punctuation."
        },
        "min_words": 150
    }
    questions.append(("IELTS", "writing", "task1", f"Task 1 - {topic}", json.dumps(q),
                       3, topic, tags, 'B2', 'create'))


# ─── WRITING Task 2 (Essay) ───────────────────────────────
writing_t2 = [
    ("technology_education", "Some people believe that technology has made education better, while others think it has had a negative impact. Discuss both views and give your own opinion.", '["task_achievement","coherence","lexical_resource","grammar_range"]'),
    ("environment_individual", "Some people think that individuals can do nothing to improve the environment. Only governments and large companies can make a real difference. To what extent do you agree or disagree?", '["task_achievement","coherence","lexical_resource","grammar_range"]'),
    ("university_experience", "Some people believe that university education should focus on job skills, while others think it should focus on general knowledge. Discuss both views and give your opinion.", '["task_achievement","coherence","lexical_resource","grammar_range"]'),
    ("advertising_children", "In many countries, children are exposed to a lot of advertising. What are the effects of this? Should advertising to children be regulated?", '["task_achievement","coherence","lexical_resource","grammar_range"]'),
    ("public_transport", "In many cities, the use of private cars is increasing. What problems does this cause? What solutions can you suggest?", '["task_achievement","coherence","lexical_resource","grammar_range"]'),
    ("cultural_traditions", "Many traditional customs and ways of life are disappearing. Is it important to preserve them, or should we focus on the future?", '["task_achievement","coherence","lexical_resource","grammar_range"]'),
    ("health_lifestyle", "In some countries, an increasing number of people are suffering from health problems as a result of eating too much fast food. It is therefore necessary for governments to impose a higher tax on this kind of food. To what extent do you agree or disagree?", '["task_achievement","coherence","lexical_resource","grammar_range"]'),
    ("remote_work_society", "Working from home has become increasingly common. What are the advantages and disadvantages of this trend?", '["task_achievement","coherence","lexical_resource","grammar_range"]'),
    ("social_media_impact", "Social media has had a significant impact on how people communicate. Do the advantages outweigh the disadvantages?", '["task_achievement","coherence","lexical_resource","grammar_range"]'),
    ("crime_punishment", "Some people think that the best way to reduce crime is to give longer prison sentences. Others believe there are better ways to reduce crime. Discuss both views and give your opinion.", '["task_achievement","coherence","lexical_resource","grammar_range"]'),
]

for i, (topic, question, tags) in enumerate(writing_t2):
    q = {
        "question_id": 6100 + i,
        "question_text": question,
        "direction": "Write at least 250 words.",
        "task_type": "essay_task2",
        "rubric": {
            "task_response": "Addresses all parts of the task. Presents a clear position throughout.",
            "coherence_cohesion": "Information and ideas are logically organized. Paragraphing is well-managed.",
            "lexical_resource": "Uses a wide range of vocabulary naturally. Rare minor errors in word choice.",
            "grammar": "Uses a wide range of structures. Majority of sentences are error-free."
        },
        "min_words": 250
    }
    questions.append(("IELTS", "writing", "task2", f"Task 2 - {topic}", json.dumps(q),
                       4, topic, tags, 'B2', 'create'))


# ─── OUTPUT SQL ────────────────────────────────────────────
print(f"-- IELTS Question Bank: {len(questions)} rows")
print()

for i, (tt, sec, qt, title, content, diff, topic, tags, cefr, bloom) in enumerate(questions):
    safe_content = content.replace("'", "''")
    safe_title = title.replace("'", "''")
    safe_topic = topic.replace("'", "''")
    safe_tags = tags.replace("'", "''") if isinstance(tags, str) else tags
    print(f"INSERT INTO test_contents (test_type, section, question_type, title, content, difficulty, topic, status, skill_tags, cefr_level, bloom_level) VALUES ('{tt}', '{sec}', '{qt}', '{safe_title}', '{safe_content}', {diff}, '{safe_topic}', 'published', '{safe_tags}', '{cefr}', '{bloom}');")

print(f"\n-- Total: {len(questions)} IELTS questions inserted")
