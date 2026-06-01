-- 074: Writing Templates
-- High-band essay templates for IELTS Task 1/2, TOEFL Integrated/Independent, TOEIC

CREATE TABLE IF NOT EXISTS writing_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_type TEXT NOT NULL,               -- TOEFL_IBT, IELTS, TOEIC
  task_type TEXT NOT NULL,                -- 'task1', 'task2', 'integrated', 'independent', 'email', 'review'
  title TEXT NOT NULL,                    -- e.g. 'IELTS Task 2: Opinion Essay'
  description TEXT,                       -- what this template is for
  cefr_level TEXT DEFAULT 'B2',           -- A1..C2
  structure TEXT NOT NULL,                -- paragraph-by-paragraph structure with placeholders
  example TEXT,                           -- example essay using the structure
  key_phrases TEXT,                       -- JSON array of useful phrases
  common_mistakes TEXT,                   -- what to avoid
  estimated_words INTEGER DEFAULT 250,    -- target word count
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wt_test ON writing_templates(test_type, task_type);
CREATE INDEX IF NOT EXISTS idx_wt_cefr ON writing_templates(cefr_level);

CREATE TABLE IF NOT EXISTS writing_template_uses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  used_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wtu_user ON writing_template_uses(user_id, used_at);

-- Seed: 12 high-band templates across test types
INSERT INTO writing_templates (test_type, task_type, title, description, cefr_level, structure, example, key_phrases, common_mistakes, estimated_words) VALUES
  ('IELTS', 'task2', 'Opinion Essay (Agree/Disagree)', 'Argue for or against a statement', 'B2',
   '**Paragraph 1 (Introduction)**
[Hook] — paraphrase the topic with a striking fact or rhetorical question
[Background] — provide brief context
[Thesis] — "In this essay, I will argue that [your position] because [reason 1] and [reason 2]."

**Paragraph 2 (Body 1)**
[Topic sentence] — "The first compelling argument is that [reason 1]."
[Explanation] — clarify why this matters
[Example] — "For instance, [concrete example]."
[Link back] — connect to thesis

**Paragraph 3 (Body 2)**
[Topic sentence] — "Furthermore, [reason 2] is equally important."
[Explanation + Example] — same structure

**Paragraph 4 (Conclusion)**
[Restate thesis in different words]
[Summarize main points]
[Final thought / recommendation]',
   'Topic: Some people think technology isolates people. Do you agree?

In this digital era, the question of whether technology isolates people is more relevant than ever. I strongly agree with this view, as research consistently shows that excessive screen time reduces face-to-face interaction, and digital communication lacks the emotional depth of in-person conversation.

The first compelling argument is that smartphones have replaced meaningful social activities. Studies from Stanford University in 2022 found that the average person spends over four hours per day on their phone, often at the expense of real-world relationships. For instance, families now eat meals together while scrolling through different feeds rather than engaging with one another.

Furthermore, technology-mediated communication strips away crucial non-verbal cues. A text message cannot convey tone of voice, facial expressions, or body language — all of which are essential for genuine human connection. When conflicts arise over text, misunderstandings are common precisely because these cues are missing.

In conclusion, technology has undeniably created new forms of isolation. To address this, individuals should set clear boundaries around device use and prioritize in-person interactions whenever possible.',
   '["In this essay, I will argue that...", "The first compelling argument is...", "Furthermore, ... is equally important.", "Studies from X show that...", "For instance, ...", "In conclusion, ..."]',
   'Stating your opinion without justification; using "I think" too often; one-sided arguments; over-generalizations like "all people" or "always"; weak examples; not linking back to thesis',
   285),

  ('IELTS', 'task2', 'Discussion Essay (Both Views)', 'Discuss both views and give your opinion', 'B2',
   '**Paragraph 1 (Introduction)**
[Hook] + [Background] — explain the debate
[Thesis] — "This essay will discuss both perspectives before arguing that [your stance]."

**Paragraph 2 (View 1)**
[Topic sentence] — "On one hand, those who advocate for [view 1] point out that [reason]."
[Explanation] + [Example]

**Paragraph 3 (View 2)**
[Topic sentence] — "On the other hand, supporters of [view 2] emphasize that [reason]."
[Explanation] + [Example]

**Paragraph 4 (Conclusion + Opinion)**
[Summarize both views]
[Your opinion with justification]',
   'Topic: Some say university should teach job skills, others say it should teach critical thinking. Discuss both views.

The role of universities has long been debated, particularly whether they should prioritize practical job training or broader intellectual development. This essay will discuss both perspectives before arguing that a balanced approach serves students best.

On one hand, those who advocate for job-focused education point out that most students attend university to improve their career prospects. With rising tuition fees, students reasonably expect a return on their investment in the form of employability. For example, engineering and medical degrees have long followed an applied model with clear career pathways.

On the other hand, supporters of liberal arts education emphasize that critical thinking, ethical reasoning, and cultural awareness are equally valuable. A philosophy graduate may not have a "vocational" skill, but their ability to analyze complex problems transfers to many careers. Moreover, the rapid pace of technological change means that specific job skills become outdated, while critical thinking remains timeless.

In conclusion, both views have merit. However, I believe universities should integrate both approaches — providing practical skills while nurturing the broader intellectual capacities that define an educated citizen.',
   '["This essay will discuss both perspectives...", "On one hand, ... point out that...", "On the other hand, ... emphasize that...", "Moreover, ...", "In conclusion, both views have merit."]',
   'Taking sides too early; not giving equal weight to both views in the body; weak or no opinion in conclusion; using the same example structure for both views',
   290),

  ('IELTS', 'task1', 'Graph/Chart Description', 'Describe trends in a graph or chart (Academic)', 'B1',
   '**Paragraph 1 (Overview)**
[What the graph shows] — type, subject, time period
[Main trend 1] — biggest change
[Main trend 2] — second biggest change
**No details yet — just the big picture.**

**Paragraph 2 (Detail 1)**
[Describe first major feature with specific numbers]
[Use "rose", "fell", "remained stable", "peaked at"]

**Paragraph 3 (Detail 2)**
[Describe second feature]
[Compare categories if applicable]

**Paragraph 4 (Optional Conclusion)**
[Highlight most striking point]',
   'The graph shows the percentage of households with internet access in three countries between 2010 and 2020. Overall, internet access increased significantly in all three countries, with South Korea maintaining the highest rate throughout the period.

In South Korea, internet penetration rose from 95% in 2010 to 99% in 2020, an increase of 4 percentage points. This was already near saturation at the start of the period. The United States saw more substantial growth, climbing from 70% to 92%, while Brazil experienced the most dramatic increase, jumping from 35% to 80%.

The gap between the highest and lowest countries narrowed considerably. In 2010, the difference between South Korea and Brazil was 60 percentage points, but by 2020 it had shrunk to just 19 points.',
   '["The graph shows...", "Overall, ...", "rose from X to Y", "climbed from X to Y", "jumped from X to Y", "remained stable at", "peaked at", "the gap narrowed"]',
   'Including unnecessary data; not providing an overview (worth 25% of grade); not using specific numbers; using future tenses; including personal opinion; one long paragraph instead of structured body',
   175),

  ('TOEFL_IBT', 'independent', 'Four-Paragraph Opinion', 'Agree/disagree, pref, choice essay', 'B1',
   '**Paragraph 1 (Intro, ~50 words)**
[Hook] — interesting statement or fact
[Background] — context of the prompt
[Thesis] — clear opinion + 2 reasons

**Paragraph 2 (Reason 1, ~100 words)**
[Topic sentence] — first reason
[Specific example from your life, history, or observation]
[Explanation of why this supports your thesis]

**Paragraph 3 (Reason 2, ~100 words)**
[Topic sentence] — second reason
[Different type of example]
[Explanation]

**Paragraph 4 (Conclusion, ~50 words)**
[Restate thesis]
[Brief summary]
[Final thought or recommendation]',
   'Topic: Do you prefer to study alone or in groups?

I believe that studying in groups is more effective than studying alone, primarily because group discussions expose students to multiple perspectives and because explaining concepts to others deepens one''s own understanding.

The first compelling reason is that group study exposes learners to diverse viewpoints. When classmates discuss a problem, they often propose solutions the others had not considered. For example, in my high school biology class, my study group frequently debated the causes of climate change, and each member brought a different cultural or scientific perspective to the conversation. This exposure broadened all of our understanding beyond what any of us could have achieved alone.

Furthermore, the act of teaching a concept to a peer reinforces one''s own learning. Cognitive research, often summarized in the "protégé effect," suggests that students who expect to teach material perform better on tests than those who merely review it. In my own experience, I have consistently found that explaining a math problem to a friend clarifies the steps in my own mind as well.

In conclusion, group study offers clear advantages over solitary study. I would recommend that students form small, focused study groups whenever possible.',
   '["I believe that ... because ...", "The first compelling reason is that ...", "Furthermore, ...", "In my experience, ...", "In conclusion, ..."]',
   'Off-topic examples; weak or generic examples; two reasons that are too similar; not using transitions; opinion without justification; examples without explanation',
   300),

  ('TOEFL_IBT', 'integrated', 'Reading + Listening Synthesis', 'Compare a reading passage and a lecture', 'B2',
   '**Paragraph 1 (Intro)**
[The reading claims that [concept/idea].]
[However, the lecture challenges/extends this by [main point of lecture].]

**Paragraph 2 (Reading in detail)**
[First, the reading explains that [point 1].]
[Specifically, [supporting detail from reading].]
[Additionally, the reading mentions [point 2].]

**Paragraph 3 (Lecture in detail)**
[In contrast, the lecturer argues that [lecture point 1].]
[He provides the example of [specific example from lecture].]
[Furthermore, the lecturer disputes [reading point 2] by [counter-argument].]

**Paragraph 4 (Conclusion)**
[Therefore, while the reading presents [summary of reading view], the lecture demonstrates [summary of lecture view].]',
   'Topic: Read about star formation; listen to a lecture.

The reading claims that stars form from the gravitational collapse of large molecular clouds. The lecture, however, challenges this simple model by highlighting the role of stellar winds and supernova explosions in regulating star formation.

The reading explains that dense regions within molecular clouds, called protostellar cores, gradually accumulate mass until nuclear fusion begins. Specifically, the passage notes that this process takes millions of years and produces stars of varying masses. Additionally, the reading mentions that the most massive stars consume their fuel quickly and end their lives in supernova explosions.

In contrast, the lecturer argues that stellar winds and supernovae actually prevent some regions from forming new stars. He provides the example of the Orion Nebula, where intense radiation from massive young stars disperses surrounding gas, halting further star formation in those areas. Furthermore, the lecturer disputes the idea that all molecular clouds form stars by pointing out that many clouds are too disrupted by external forces to ever collapse.

Therefore, while the reading presents star formation as a primarily internal process, the lecture demonstrates that external feedback mechanisms play a crucial role in determining which clouds actually form stars.',
   '["The reading claims that ...", "In contrast, the lecturer argues that ...", "The passage notes that ...", "He provides the example of ...", "While the reading presents ..., the lecture demonstrates ..."]',
   'Confusing reading and lecture points; not signaling which is which; missing key examples; not making the relationship between reading and lecture clear',
   225),

  ('TOEFL_IBT', 'integrated', 'Campus Announcement Response', 'Respond to a campus policy change', 'B1',
   '**Paragraph 1**
[The school has announced that [policy].]
[The student in the conversation agrees/disagrees because [main reason].]

**Paragraph 2**
[First, the student points out that [reason 1].]
[Specifically, [supporting detail from conversation].]
[This shows that [implication].]

**Paragraph 3**
[Furthermore, the student argues that [reason 2].]
[For example, [example].]
[This means that [conclusion].]

**Paragraph 4 (Optional)**
[In summary, the student believes [position] because [reasons].]',
   'Topic: University announces new policy closing the dormitory cafeteria on weekends.

The university has announced that the dormitory cafeteria will be closed on weekends, beginning next month. The student in the conversation disagrees with this policy because it will inconvenience students who rely on the cafeteria for meals and because it will negatively affect the campus community.

First, the student points out that many students, especially those who live far from off-campus restaurants, depend on the cafeteria as their primary food source on weekends. Specifically, she mentions that international students often do not have cooking facilities and that the nearby grocery store is a 30-minute walk. This shows that the policy will create real hardship for a vulnerable group of students.

Furthermore, the student argues that the cafeteria serves an important social function beyond just providing food. For example, she notes that study groups often meet there on weekend mornings, and removing this gathering space will weaken student community. This means the policy, while perhaps saving money, will damage the social fabric of campus life.

In summary, the student believes the weekend closure is a poor decision because it both creates practical hardships and undermines community.',
   '["The school has announced that ...", "The student ... because ...", "Specifically, ...", "This shows that ...", "Furthermore, ...", "This means that ..."]',
   'Using only the conversation (need both reading/listening context); not signaling whose opinion it is; missing specific details; weak conclusion',
   230),

  ('TOEIC', 'email', 'Request Email', 'Write an email asking for information or action', 'A2',
   '**Subject:** [Clear subject line]

Dear [Name],

I am writing to inquire about [topic]. I would appreciate it if you could [specific request].

[Provide context: who you are, why you need this, when you need it by]

If you require any further information from my side, please do not hesitate to contact me. I look forward to hearing from you at your earliest convenience.

Thank you for your time and assistance.

Best regards,
[Your name]',
   'Subject: Inquiry About Conference Room Availability

Dear Ms. Chen,

I am writing to inquire about the availability of Conference Room B on Friday, October 18th, from 2:00 PM to 4:00 PM. We would like to hold a quarterly review meeting and prefer to use this room due to its video conferencing equipment.

Currently, our team has 8 members attending in person and 3 joining remotely. If the room is not available, would you be able to suggest an alternative space with similar facilities?

I would appreciate a response by Wednesday, October 16th, so that we can finalize logistics and notify the attendees.

Thank you for your time and assistance.

Best regards,
[Your name]',
   '["I am writing to inquire about...", "I would appreciate it if you could...", "If you require any further information, please do not hesitate to contact me.", "I look forward to hearing from you.", "Thank you for your time."]',
   'Too informal; missing subject line; not specifying deadline; vague requests; wrong tone (too aggressive or too casual); missing signature',
   130),

  ('TOEIC', 'email', 'Apology/Explanation Email', 'Apologize for a mistake or delay', 'A2',
   '**Subject:** [Apology + Brief Description]

Dear [Name],

Thank you for your message regarding [issue]. I would like to sincerely apologize for [the problem] and any inconvenience it may have caused.

[Explain what happened briefly and honestly — do not over-excuse]
[Explain what you are doing to fix it or prevent recurrence]

I understand that [acknowledge impact on recipient]. Please let me know if there is anything else I can do to address this situation. I am committed to ensuring that this does not happen again.

Thank you for your patience and understanding.

Best regards,
[Your name]',
   'Subject: Apology for Late Shipment

Dear Mr. Anderson,

Thank you for your message regarding the late delivery of order #4521. I would like to sincerely apologize for the delay and any inconvenience it may have caused to your business.

After investigating, we found that the delay was due to a customs processing issue at the port. We have since worked with our logistics partner to expedite the remaining items, and your complete order should arrive by Friday, October 18th.

I understand that this delay may have disrupted your inventory planning. As a small gesture of goodwill, we would like to offer you a 15% discount on your next order. Please let me know if there is anything else I can do to address this situation.

Thank you for your patience and understanding.

Best regards,
[Your name]',
   '["Thank you for your message regarding...", "I would like to sincerely apologize for...", "I understand that...", "Please let me know if there is anything else I can do.", "Thank you for your patience."]',
   'Blaming others; over-explaining; being too vague; not offering a solution; too defensive; missing subject line',
   150),

  ('IELTS', 'task2', 'Problem-Solution Essay', 'Discuss a problem and propose solutions', 'B2',
   '**Paragraph 1 (Introduction)**
[Hook — show the problem is significant]
[Background — explain the problem]
[Thesis — "This essay will analyze the causes of [problem] and propose practical solutions."

**Paragraph 2 (Causes)**
[Topic sentence — "The primary cause of [problem] is [cause 1]."]
[Explanation + example]
[Additional cause with example]

**Paragraph 3 (Solutions)**
[Topic sentence — "Several measures could address this issue."]
[Solution 1 with explanation]
[Solution 2 with explanation]

**Paragraph 4 (Conclusion)**
[Restate the problem]
[Emphasize that solutions are achievable]
[Call to action or final thought]',
   'Topic: Many young people are leaving rural areas for cities. What are the causes and solutions?

The migration of young people from rural to urban areas is a significant issue affecting many countries today. This essay will analyze the causes of this trend and propose practical solutions to revitalize rural communities.

The primary cause of rural depopulation is the concentration of employment opportunities in cities. Young people move to urban areas seeking higher-paying jobs, modern lifestyles, and access to better education and healthcare. Additionally, the perception that rural areas offer limited career prospects has made cities seem more attractive, even when housing costs are high.

Several measures could address this issue. First, governments could invest in rural infrastructure — improving internet connectivity, transportation, and local schools — to make rural living more viable. Second, tax incentives could encourage businesses to establish operations in rural regions, creating local employment. For instance, countries like South Korea have successfully reversed rural decline through such policies.

In conclusion, the migration of young people from rural areas is a solvable problem. With targeted investment and policy support, governments can make rural communities viable and attractive places to live and work.',
   '["This essay will analyze ... and propose ...", "The primary cause of ... is ...", "Several measures could address this issue.", "For instance, ...", "In conclusion, ... is a solvable problem."]',
   'Confusing causes and solutions; not providing concrete solutions; weak examples; missing call to action in conclusion',
   280),

  ('TOEFL_IBT', 'independent', 'Compare & Choose Essay', 'Choose between two options and justify', 'B2',
   '**Paragraph 1 (Intro)**
[Hook]
[Restate the two options briefly]
[Thesis — "While both [option A] and [option B] have merit, I prefer [choice] because [reason 1] and [reason 2]."

**Paragraph 2 (Why you prefer choice)**
[Topic sentence — "The most important reason I prefer [choice] is [reason 1]."]
[Specific example]
[Explanation]

**Paragraph 3 (Second reason OR why the other is less appealing)**
[Topic sentence — "Additionally, [reason 2]."]
[Example + explanation]
**OR**
[I acknowledge that [option B] may appeal to some because [reason]. However, [counter-argument showing your choice is better].]

**Paragraph 4 (Conclusion)**
[Restate preference]
[Brief summary of reasons]',
   'Topic: Would you prefer to work for a large company or a small startup?

The choice between working for a large corporation and joining a small startup is one that many professionals face. While both environments offer unique advantages, I would prefer to work at a large company because of the structured career development opportunities and the stability it provides.

The most important reason I prefer a large company is the formal training and mentorship programs. Many large corporations invest heavily in employee development, offering tuition reimbursement, leadership training programs, and clear promotion tracks. For example, my cousin joined a Fortune 500 technology company and has been able to take courses at company expense, attend three industry conferences, and rotate through four different departments in his first two years.

Additionally, the financial stability of a large company provides peace of mind. Large companies are less likely to lay off employees during economic downturns, and they typically offer comprehensive benefits packages. While I acknowledge that startups may offer faster career growth and equity compensation, the risk of company failure makes this less attractive to me.

In conclusion, I prefer working for a large company because of the structured development opportunities and the security it provides. This is the best fit for my long-term career goals.',
   '["While both ... have merit, I prefer ...", "The most important reason is ...", "For example, ...", "I acknowledge that ... However, ...", "In conclusion, I prefer ... because ..."]',
   'Not actually choosing one option; weak comparison; missing both reasons; not acknowledging the other option; using "you" instead of "I"',
   305),

  ('TOEFL_IBT', 'integrated', 'Cafeteria Food Survey Response', 'Read about a survey, listen to students, summarize both', 'B1',
   '**Paragraph 1**
[The reading describes a survey about [topic] conducted at [place].]
[According to the reading, [main finding 1] and [main finding 2].]
[However, the two students in the conversation have different opinions about the results.]

**Paragraph 2 — First student**
[The first student agrees/disagrees with the survey because [reason 1].]
[She points out that [specific point from her experience].]
[This suggests that [implication for the survey].]

**Paragraph 3 — Second student**
[The second student takes the opposite view, arguing that [reason 2].]
[He notes that [specific point].]
[This shows that [implication].]

**Paragraph 4 (Optional)**
[In summary, the survey indicates [summary], but the students'' experiences suggest [alternative view].]',
   'The reading describes a survey of 200 students about the quality of cafeteria food at Greenfield University. According to the reading, 65% of students rated the food as "satisfactory" or better, and the average satisfaction score was 3.4 out of 5. However, the two students in the conversation have different opinions about the reliability of these results.

The first student agrees with the survey, pointing out that the sample size of 200 students is statistically significant. She notes that she has eaten in the cafeteria for three years and has generally found the food to be acceptable, especially considering the affordable price. This suggests that the survey results align with her own experience and probably reflect the views of most students.

The second student takes the opposite view, arguing that the survey methodology was flawed. He notes that the survey was conducted during the first week of the semester, when the cafeteria menus had just been refreshed, and that students tend to be more positive in their first weeks before the menus become repetitive. This shows that the timing of the survey likely skewed the results in a positive direction.

In summary, while the survey suggests that students are satisfied with the cafeteria, the second student''s observation about timing raises legitimate questions about the validity of those results.',
   '["The reading describes ...", "According to the reading, ...", "She points out that ...", "He notes that ...", "This shows that ...", "In summary, while ..., ..."]',
   'Confusing reading and conversation; not providing specific details from each source; missing both students'' views; weak synthesis',
   230),

  ('IELTS', 'task2', 'Advantages/Disadvantages Essay', 'Discuss pros and cons of a phenomenon', 'B2',
   '**Paragraph 1 (Introduction)**
[Hook + Background — describe the phenomenon]
[Thesis — "This essay will examine both the benefits and drawbacks of [topic]."

**Paragraph 2 (Advantages)**
[Topic sentence — "There are several notable advantages to [topic]."]
[Advantage 1 with example]
[Advantage 2 with example]

**Paragraph 3 (Disadvantages)**
[Topic sentence — "However, [topic] also has its downsides."]
[Disadvantage 1 with example]
[Disadvantage 2 with example]

**Paragraph 4 (Conclusion)**
[Summarize both sides]
[Your judgment: which outweighs, and in what circumstances]
[No new points here]',
   'Topic: Discuss the advantages and disadvantages of remote work.

The shift to remote work, accelerated by the COVID-19 pandemic, has fundamentally changed how many people earn a living. This essay will examine both the benefits and drawbacks of working from home.

There are several notable advantages to remote work. First, employees save significant time and money by eliminating their daily commute, which can be reallocated to family time, exercise, or professional development. Second, companies can reduce their overhead costs by shrinking office space, and they can hire talent from a wider geographic area. For example, many tech companies now recruit engineers from across the globe rather than restricting hires to a single city.

However, remote work also has its downsides. Workers often report feelings of isolation and blurred boundaries between professional and personal life, leading to burnout in some cases. Additionally, junior employees miss out on the informal mentorship that occurs naturally in shared workspaces, which can slow their career development.

In conclusion, while remote work offers real benefits in flexibility and cost, its drawbacks are most pronounced for early-career professionals and those living alone. A hybrid model may offer the best balance for many organizations.',
   '["This essay will examine both ... and ...", "There are several notable advantages to ...", "However, ... also has its downsides.", "For example, ...", "In conclusion, while ..., ..."]',
   'Confusing advantages with disadvantages; no clear structure; missing examples; weak conclusion that introduces new points',
   280);
