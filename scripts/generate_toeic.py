#!/usr/bin/env python3
"""
Generate TOEIC question bank SQL inserts.
TOEIC has 7 parts: Listening (Part 1-4) + Reading (Part 5-7)
"""
import json

questions = []

# ─── PART 1: PHOTOGRAPHS (Listening) ───────────────────────
# 30 questions: describe what you see in a photo
photo_scenarios = [
    ("A man is typing on a laptop at a desk.", [
        ("A", "A man is repairing a computer."),
        ("B", "A man is typing on a laptop."),
        ("C", "A man is reading a newspaper."),
        ("D", "A man is making a phone call.")
    ], "B", "The man is clearly using a laptop keyboard, which matches option B.", "office"),
    ("A woman is presenting in front of a whiteboard.", [
        ("A", "A woman is cleaning a window."),
        ("B", "A woman is writing on a board."),
        ("C", "A woman is leaving a room."),
        ("D", "A woman is arranging chairs.")
    ], "B", "The woman is standing in front of a whiteboard presenting, which involves writing on the board.", "office"),
    ("Two people are shaking hands in a lobby.", [
        ("A", "Two people are waving goodbye."),
        ("B", "Two people are exchanging business cards."),
        ("C", "Two people are shaking hands."),
        ("D", "Two people are carrying boxes.")
    ], "C", "The description clearly matches a handshake in a lobby.", "business"),
    ("Packages are stacked on shelves in a warehouse.", [
        ("A", "Workers are loading a truck."),
        ("B", "Boxes are arranged on shelves."),
        ("C", "The warehouse is empty."),
        ("D", "A forklift is moving pallets.")
    ], "B", "Packages stacked on shelves = boxes arranged on shelves.", "logistics"),
    ("A chef is preparing food in a kitchen.", [
        ("A", "A chef is serving customers."),
        ("B", "A chef is washing dishes."),
        ("C", "A chef is preparing food."),
        ("D", "A chef is ordering supplies.")
    ], "C", "The chef is clearly in the act of food preparation.", "food_service"),
    ("Cars are parked in an outdoor lot.", [
        ("A", "Cars are driving on a highway."),
        ("B", "Cars are lined up at a gas station."),
        ("C", "Cars are parked in a lot."),
        ("D", "Cars are being washed.")
    ], "C", "The vehicles are stationary in a parking area.", "transportation"),
    ("A receptionist is answering a telephone.", [
        ("A", "A receptionist is filing papers."),
        ("B", "A receptionist is answering the phone."),
        ("C", "A receptionist is greeting a guest."),
        ("D", "A receptionist is typing an email.")
    ], "B", "The receptionist is using a telephone.", "office"),
    ("Workers are wearing hard hats at a construction site.", [
        ("A", "Workers are relaxing in a break room."),
        ("B", "Workers are painting a building."),
        ("C", "Workers are wearing safety equipment at a site."),
        ("D", "Workers are planting trees.")
    ], "C", "Hard hats are safety equipment, and they are at a construction site.", "construction"),
    ("A flight attendant is serving beverages on a plane.", [
        ("A", "A pilot is checking instruments."),
        ("B", "A flight attendant is distributing drinks."),
        ("C", "Passengers are boarding the aircraft."),
        ("D", "Luggage is being loaded into cargo.")
    ], "B", "Serving beverages = distributing drinks.", "travel"),
    ("A woman is scanning documents at a copier.", [
        ("A", "A woman is using a copy machine."),
        ("B", "A woman is writing a report."),
        ("C", "A woman is organizing binders."),
        ("D", "A woman is talking on a phone.")
    ], "A", "Scanning documents at a copier = using a copy machine.", "office"),
    ("People are seated around a conference table.", [
        ("A", "People are standing in a hallway."),
        ("B", "People are eating at a restaurant."),
        ("C", "People are attending a meeting."),
        ("D", "People are waiting at a bus stop.")
    ], "C", "Seated around a conference table = attending a meeting.", "business"),
    ("A delivery truck is parked outside a store.", [
        ("A", "A taxi is picking up passengers."),
        ("B", "A delivery vehicle is outside a shop."),
        ("C", "A bus is at a terminal."),
        ("D", "A car is in a garage.")
    ], "B", "Delivery truck outside a store = delivery vehicle outside a shop.", "logistics"),
    ("A pharmacist is handing medicine to a customer.", [
        ("A", "A doctor is examining a patient."),
        ("B", "A pharmacist is dispensing medication."),
        ("C", "A nurse is taking blood pressure."),
        ("D", "A patient is filling out forms.")
    ], "B", "Handing medicine = dispensing medication.", "healthcare"),
    ("Hotel guests are checking in at the front desk.", [
        ("A", "Guests are checking into a hotel."),
        ("B", "Guests are swimming in a pool."),
        ("C", "Guests are dining in a restaurant."),
        ("D", "Guests are leaving the hotel.")
    ], "A", "Checking in at the front desk = checking into a hotel.", "hospitality"),
    ("An electrician is inspecting wiring in a ceiling.", [
        ("A", "A plumber is fixing a pipe."),
        ("B", "An electrician is examining electrical wires."),
        ("C", "A painter is applying paint to a wall."),
        ("D", "A carpenter is building a shelf.")
    ], "B", "Inspecting wiring = examining electrical wires.", "construction"),
    ("Shoppers are browsing clothing racks in a store.", [
        ("A", "Customers are looking at clothes."),
        ("B", "Employees are stocking shelves."),
        ("C", "A store is closed for renovation."),
        ("D", "A cashier is processing returns.")
    ], "A", "Browsing clothing racks = looking at clothes.", "retail"),
    ("A janitor is mopping the floor in a hallway.", [
        ("A", "A janitor is cleaning the floor."),
        ("B", "A janitor is emptying trash cans."),
        ("C", "A janitor is replacing light bulbs."),
        ("D", "A janitor is locking doors.")
    ], "A", "Mopping = cleaning the floor.", "facilities"),
    ("A librarian is shelving books.", [
        ("A", "A librarian is reading to children."),
        ("B", "A librarian is placing books on shelves."),
        ("C", "A librarian is using a computer."),
        ("D", "A librarian is stamping passports.")
    ], "B", "Shelving books = placing books on shelves.", "education"),
    ("Passengers are waiting on a train platform.", [
        ("A", "Passengers are boarding a bus."),
        ("B", "Passengers are exiting a taxi."),
        ("C", "Passengers are standing on a platform."),
        ("D", "Passengers are buying plane tickets.")
    ], "C", "Waiting on a train platform = standing on a platform.", "transportation"),
    ("A mechanic is working under a car on a lift.", [
        ("A", "A mechanic is inspecting a vehicle."),
        ("B", "A mechanic is driving a car."),
        ("C", "A mechanic is washing a car."),
        ("D", "A mechanic is selling auto parts.")
    ], "A", "Working under a car = inspecting a vehicle.", "automotive"),
    ("A gardener is watering plants in a greenhouse.", [
        ("A", "A gardener is mowing a lawn."),
        ("B", "A gardener is watering plants."),
        ("C", "A gardener is trimming hedges."),
        ("D", "A gardener is raking leaves.")
    ], "B", "Watering plants in a greenhouse matches B.", "agriculture"),
    ("A nurse is adjusting equipment beside a hospital bed.", [
        ("A", "A nurse is checking medical equipment."),
        ("B", "A nurse is administering an injection."),
        ("C", "A nurse is making a bed."),
        ("D", "A nurse is recording patient data.")
    ], "A", "Adjusting equipment = checking medical equipment.", "healthcare"),
    ("A security guard is monitoring screens at a desk.", [
        ("A", "A security guard is patrolling a building."),
        ("B", "A security guard is watching surveillance monitors."),
        ("C", "A security guard is checking IDs."),
        ("D", "A security guard is directing traffic.")
    ], "B", "Monitoring screens = watching surveillance monitors.", "security"),
    ("A barista is making coffee behind a counter.", [
        ("A", "A barista is preparing a beverage."),
        ("B", "A barista is cleaning tables."),
        ("C", "A barista is taking inventory."),
        ("D", "A barista is locking the store.")
    ], "A", "Making coffee = preparing a beverage.", "food_service"),
    ("An architect is reviewing blueprints at a desk.", [
        ("A", "An architect is visiting a construction site."),
        ("B", "An architect is studying building plans."),
        ("C", "An architect is meeting with clients."),
        ("D", "An architect is taking photographs.")
    ], "B", "Reviewing blueprints = studying building plans.", "construction"),
    ("Diners are seated at outdoor tables of a cafe.", [
        ("A", "People are eating outdoors at a cafe."),
        ("B", "People are jogging in a park."),
        ("C", "People are waiting for a bus."),
        ("D", "People are attending a concert.")
    ], "A", "Seated at outdoor tables of a cafe = eating outdoors at a cafe.", "food_service"),
    ("A technician is repairing a printer in an office.", [
        ("A", "A technician is installing software."),
        ("B", "A technician is fixing a printer."),
        ("C", "A technician is setting up a projector."),
        ("D", "A technician is running network cables.")
    ], "B", "Repairing a printer = fixing a printer.", "office"),
    ("A bank teller is counting money at a window.", [
        ("A", "A bank teller is processing a transaction."),
        ("B", "A bank teller is opening an account."),
        ("C", "A bank teller is shredding documents."),
        ("D", "A bank teller is greeting customers.")
    ], "A", "Counting money = processing a transaction.", "finance"),
    ("A fitness trainer is demonstrating exercises in a gym.", [
        ("A", "A trainer is selling memberships."),
        ("B", "A trainer is showing exercise techniques."),
        ("C", "A trainer is cleaning equipment."),
        ("D", "A trainer is scheduling appointments.")
    ], "B", "Demonstrating exercises = showing exercise techniques.", "fitness"),
    ("Workers are loading cargo onto a ship at a dock.", [
        ("A", "Workers are unloading a plane."),
        ("B", "Workers are loading goods onto a vessel."),
        ("C", "Workers are building a boat."),
        ("D", "Workers are fishing at a pier.")
    ], "B", "Loading cargo onto a ship = loading goods onto a vessel.", "logistics"),
]

for i, (desc, opts, ans, expl, topic) in enumerate(photo_scenarios):
    q = {
        "type": "grouped_listening",
        "group_name": f"TOEIC Part 1 - Set {i//5 + 1}",
        "direction": "For each question, you will hear four statements about a picture. Select the one statement that best describes what you see in the picture.",
        "passage_script": desc,
        "questions": [{
            "index": 0,
            "question_text": f"Question {i+1}: {desc}",
            "options": [{"key": k, "text": t} for k, t in opts],
            "answers": [ans],
            "explanation": expl
        }],
        "question_count": 1
    }
    questions.append(("TOEIC", "listening", "photographs", f"Part 1 Set {i//5+1}", json.dumps(q),
                       2 if i < 15 else 3, topic,
                       '["photograph_description","vocabulary_context"]', 'A2' if i < 15 else 'B1', 'understand'))


# ─── PART 2: QUESTION-RESPONSE (Listening) ─────────────────
# 30 questions: hear a question, pick the best response
qr_items = [
    ("When is the deadline for the report?", [
        ("A", "It's due by Friday."),
        ("B", "The report has three sections."),
        ("C", "I'll email it to you.")
    ], "A", "The question asks about timing; only A provides a date.", "office"),
    ("Where should I park my car?", [
        ("A", "The car needs gas."),
        ("B", "There's a visitor lot on the left."),
        ("C", "I took the bus today.")
    ], "B", "The question asks about location; B gives a specific parking location.", "facilities"),
    ("Who is in charge of the marketing campaign?", [
        ("A", "The campaign starts next month."),
        ("B", "Ms. Chen is leading it."),
        ("C", "We need more budget.")
    ], "B", "Asks who; B identifies a person.", "business"),
    ("How long will the renovation take?", [
        ("A", "About six weeks."),
        ("B", "The building is on Main Street."),
        ("C", "We hired a new contractor.")
    ], "A", "Asks duration; A gives a time period.", "construction"),
    ("Would you like coffee or tea?", [
        ("A", "The meeting starts at 10."),
        ("B", "Coffee, please."),
        ("C", "I had lunch already.")
    ], "B", "A choice question; B selects one option.", "hospitality"),
    ("Has the shipment arrived yet?", [
        ("A", "It should be here by noon."),
        ("B", "The warehouse is full."),
        ("C", "We ordered fifty units.")
    ], "A", "Asks about arrival status; A gives estimated time.", "logistics"),
    ("Why was the meeting postponed?", [
        ("A", "The conference room is on the second floor."),
        ("B", "Because the director is traveling."),
        ("C", "The meeting lasted two hours.")
    ], "B", "Asks reason; B gives a cause.", "business"),
    ("Could you help me carry these boxes?", [
        ("A", "Sure, I'd be happy to."),
        ("B", "The boxes are brown."),
        ("C", "I ordered them online.")
    ], "A", "A request; A agrees to help.", "office"),
    ("What time does the store close?", [
        ("A", "It's a clothing store."),
        ("B", "At nine o'clock."),
        ("C", "They have a sale this week.")
    ], "B", "Asks time; B provides closing time.", "retail"),
    ("Don't you think we should update the website?", [
        ("A", "Yes, it definitely needs a refresh."),
        ("B", "The website has a search function."),
        ("C", "I bookmarked the page.")
    ], "A", "A tag question seeking agreement; A agrees.", "technology"),
    ("Where can I find the HR department?", [
        ("A", "They recently hired ten people."),
        ("B", "It's on the third floor."),
        ("C", "Human resources is very helpful.")
    ], "B", "Asks location; B gives a floor number.", "office"),
    ("How much does the annual subscription cost?", [
        ("A", "It's two hundred dollars per year."),
        ("B", "The subscription includes magazines."),
        ("C", "You can cancel anytime.")
    ], "A", "Asks price; A gives cost.", "finance"),
    ("Shall I book a meeting room for tomorrow?", [
        ("A", "Yes, please reserve Room B."),
        ("B", "The room has a projector."),
        ("C", "Tomorrow is Wednesday.")
    ], "A", "An offer; A accepts and specifies.", "office"),
    ("When did the new policy take effect?", [
        ("A", "The policy covers all employees."),
        ("B", "Starting from January first."),
        ("C", "The manager announced it.")
    ], "B", "Asks when; B gives a date.", "business"),
    ("Who should I contact about the invoice?", [
        ("A", "The invoice was sent last week."),
        ("B", "Try the accounting department."),
        ("C", "The amount is correct.")
    ], "B", "Asks who; B suggests a department.", "finance"),
    ("Have you finished reviewing the contract?", [
        ("A", "Almost — I'll be done by this afternoon."),
        ("B", "The contract is twenty pages long."),
        ("C", "Our lawyer drafted it.")
    ], "A", "Asks about status; A gives progress.", "legal"),
    ("Why don't we take a short break?", [
        ("A", "The break room has a coffee machine."),
        ("B", "That's a good idea."),
        ("C", "We started at eight.")
    ], "B", "A suggestion; B agrees.", "office"),
    ("Which vendor did you choose for the event?", [
        ("A", "We went with Sunrise Catering."),
        ("B", "The event is on Saturday."),
        ("C", "There were five proposals.")
    ], "A", "Asks which; A names a vendor.", "events"),
    ("Is the software update ready to install?", [
        ("A", "Yes, you can start the installation now."),
        ("B", "The software costs fifty dollars."),
        ("C", "We use version 3.0.")
    ], "A", "Asks readiness; A confirms.", "technology"),
    ("How often do we need to submit progress reports?", [
        ("A", "The report template is online."),
        ("B", "Every two weeks."),
        ("C", "I submitted mine yesterday.")
    ], "B", "Asks frequency; B gives interval.", "business"),
    ("What's the best way to reach the airport?", [
        ("A", "The airport is international."),
        ("B", "Take the express train from Central Station."),
        ("C", "My flight leaves at six.")
    ], "B", "Asks method; B gives directions.", "transportation"),
    ("Can you recommend a good restaurant nearby?", [
        ("A", "I usually eat at my desk."),
        ("B", "Try the Italian place on Oak Street."),
        ("C", "Lunch is from twelve to one.")
    ], "B", "Asks for recommendation; B suggests one.", "food_service"),
    ("Hasn't the printer been repaired yet?", [
        ("A", "The technician is coming this afternoon."),
        ("B", "We need more paper."),
        ("C", "The printer is next to the copier.")
    ], "A", "Asks about repair status; A gives update.", "office"),
    ("Would you prefer to meet in person or online?", [
        ("A", "Online would be more convenient."),
        ("B", "The meeting is about the budget."),
        ("C", "I have a meeting at three.")
    ], "A", "A choice question; A selects one option.", "business"),
    ("What's included in the basic package?", [
        ("A", "The package arrived yesterday."),
        ("B", "It includes email support and five user licenses."),
        ("C", "The premium package is more expensive.")
    ], "B", "Asks what; B lists inclusions.", "sales"),
    ("How do I reset my password?", [
        ("A", "Click 'Forgot Password' on the login page."),
        ("B", "Your password must be eight characters."),
        ("C", "I changed mine last month.")
    ], "A", "Asks how; A gives instructions.", "technology"),
    ("Are you attending the conference next week?", [
        ("A", "The conference is in Chicago."),
        ("B", "Yes, I've already registered."),
        ("C", "Last year's conference was excellent.")
    ], "B", "Asks attendance; B confirms.", "events"),
    ("What department are you transferring to?", [
        ("A", "I'm moving to the sales team."),
        ("B", "The transfer takes three days."),
        ("C", "My current department is finance.")
    ], "A", "Asks which department; A names it.", "business"),
    ("Don't we need approval from management first?", [
        ("A", "Management is on the fifth floor."),
        ("B", "You're right — let me email the director."),
        ("C", "The approval process is documented.")
    ], "B", "A tag question; B agrees and takes action.", "business"),
    ("Could you forward me the meeting minutes?", [
        ("A", "The meeting lasted about an hour."),
        ("B", "Of course, I'll send them right away."),
        ("C", "The minutes are very detailed.")
    ], "B", "A request; B agrees.", "office"),
]

for i, (prompt, opts, ans, expl, topic) in enumerate(qr_items):
    q = {
        "type": "grouped_listening",
        "group_name": f"TOEIC Part 2 - Set {i//6 + 1}",
        "direction": "You will hear a question or statement and three responses. Select the best response.",
        "passage_script": prompt,
        "questions": [{
            "index": 0,
            "question_text": prompt,
            "options": [{"key": k, "text": t} for k, t in opts],
            "answers": [ans],
            "explanation": expl
        }],
        "question_count": 1
    }
    questions.append(("TOEIC", "listening", "question_response", f"Part 2 Set {i//6+1}", json.dumps(q),
                       2, topic,
                       '["question_response","function"]', 'B1', 'understand'))


# ─── PART 3: CONVERSATIONS (Listening) ─────────────────────
# 10 conversations × 3 questions each = 30 questions
conversations = [
    {
        "topic": "office_schedule",
        "script": "W: Have you seen the updated schedule for next week? M: Yes, we have a team meeting on Monday and a client presentation on Wednesday. W: What about the training session? M: That's been moved to Thursday afternoon.",
        "questions": [
            ("When is the team meeting?", [("A","Monday"),("B","Tuesday"),("C","Wednesday"),("D","Thursday")], "A", "The man says 'team meeting on Monday.'"),
            ("What is happening on Wednesday?", [("A","A training session"),("B","A client presentation"),("C","A team meeting"),("D","A day off")], "B", "The man says 'client presentation on Wednesday.'"),
            ("When is the training session?", [("A","Monday morning"),("B","Wednesday afternoon"),("C","Thursday afternoon"),("D","Friday morning")], "C", "The man says 'moved to Thursday afternoon.'"),
        ]
    },
    {
        "topic": "business_travel",
        "script": "M: I need to book a flight to Singapore for the trade show. W: When is it? M: It starts on the 15th, so I should arrive on the 14th. W: I'll check available flights. Economy or business class? M: Business class — the company is covering it.",
        "questions": [
            ("Why is the man traveling to Singapore?", [("A","For vacation"),("B","For a trade show"),("C","For a job interview"),("D","For a conference")], "B", "He says 'trade show.'"),
            ("When does he need to arrive?", [("A","The 13th"),("B","The 14th"),("C","The 15th"),("D","The 16th")], "B", "He says 'arrive on the 14th.'"),
            ("What class will he fly?", [("A","Economy"),("B","First class"),("C","Business class"),("D","Premium economy")], "C", "He says 'Business class.'"),
        ]
    },
    {
        "topic": "hiring",
        "script": "W: We received over a hundred applications for the marketing position. M: That's a lot. How many made it to the interview stage? W: Twelve candidates. We're scheduling interviews for next week. M: Make sure to include the department head in the panel.",
        "questions": [
            ("How many applications were received?", [("A","About fifty"),("B","Over a hundred"),("C","Twelve"),("D","Twenty")], "B", "The woman says 'over a hundred applications.'"),
            ("How many candidates will be interviewed?", [("A","A hundred"),("B","Twenty"),("C","Twelve"),("D","Five")], "C", "She says 'Twelve candidates.'"),
            ("Who should be included in the interview panel?", [("A","The CEO"),("B","The HR manager"),("C","The department head"),("D","An external consultant")], "C", "The man says 'include the department head.'"),
        ]
    },
    {
        "topic": "product_launch",
        "script": "M: The new product launch has been moved to March instead of February. W: Is it because of the manufacturing delay? M: Partly, but mainly because marketing wants more time for the campaign. W: That makes sense. We should update the press release.",
        "questions": [
            ("When will the product launch now take place?", [("A","January"),("B","February"),("C","March"),("D","April")], "C", "The man says 'moved to March.'"),
            ("What is the main reason for the delay?", [("A","Manufacturing problems"),("B","Marketing needs more time"),("C","Budget constraints"),("D","Staff shortages")], "B", "He says 'mainly because marketing wants more time.'"),
            ("What does the woman suggest?", [("A","Cancel the launch"),("B","Hire more staff"),("C","Update the press release"),("D","Reduce the budget")], "C", "She says 'update the press release.'"),
        ]
    },
    {
        "topic": "customer_complaint",
        "script": "W: A customer called to complain about a late delivery. M: Which order? W: Order number 4582. It was supposed to arrive on Monday. M: Let me check the tracking. It looks like it was delayed at the distribution center. W: Should we offer a discount on their next order? M: Yes, give them fifteen percent off.",
        "questions": [
            ("What is the customer's complaint?", [("A","A defective product"),("B","A wrong item"),("C","A late delivery"),("D","Poor customer service")], "C", "The woman says 'complain about a late delivery.'"),
            ("Where was the order delayed?", [("A","At the factory"),("B","At the distribution center"),("C","At customs"),("D","At the post office")], "B", "The man says 'delayed at the distribution center.'"),
            ("What discount will the customer receive?", [("A","Ten percent"),("B","Fifteen percent"),("C","Twenty percent"),("D","Free shipping")], "B", "The man says 'fifteen percent off.'"),
        ]
    },
    {
        "topic": "office_renovation",
        "script": "M: The third-floor renovation will start next Monday. W: Will we need to relocate? M: Yes, your team will move to the fifth floor temporarily. W: How long will the renovation take? M: About three weeks.",
        "questions": [
            ("Which floor is being renovated?", [("A","Second"),("B","Third"),("C","Fourth"),("D","Fifth")], "B", "The man says 'third-floor renovation.'"),
            ("Where will the team move to?", [("A","The second floor"),("B","The third floor"),("C","The fourth floor"),("D","The fifth floor")], "D", "He says 'move to the fifth floor.'"),
            ("How long will the renovation take?", [("A","One week"),("B","Two weeks"),("C","Three weeks"),("D","Four weeks")], "C", "He says 'about three weeks.'"),
        ]
    },
    {
        "topic": "budget_review",
        "script": "W: The quarterly budget review is this Friday. Are you ready? M: Almost. I still need the sales figures from the Asia-Pacific region. W: I can get those from the regional manager. M: Great. Also, could you prepare a comparison chart? W: Sure, I'll have it ready by Thursday.",
        "questions": [
            ("When is the budget review?", [("A","Wednesday"),("B","Thursday"),("C","Friday"),("D","Monday")], "C", "The woman says 'this Friday.'"),
            ("What does the man still need?", [("A","Marketing data"),("B","Sales figures from Asia-Pacific"),("C","A budget proposal"),("D","Employee headcount")], "B", "He says 'sales figures from the Asia-Pacific region.'"),
            ("When will the comparison chart be ready?", [("A","Wednesday"),("B","Thursday"),("C","Friday"),("D","Next week")], "B", "She says 'ready by Thursday.'"),
        ]
    },
    {
        "topic": "new_employee",
        "script": "M: The new graphic designer starts tomorrow. W: Which department? M: She'll be in the creative team on the fourth floor. W: Should I prepare her workstation? M: Yes, and make sure she has access to the design software. W: I'll set up her computer and email account today.",
        "questions": [
            ("When does the new employee start?", [("A","Today"),("B","Tomorrow"),("C","Next week"),("D","Next month")], "B", "The man says 'starts tomorrow.'"),
            ("What is the new employee's role?", [("A","Accountant"),("B","Marketing manager"),("C","Graphic designer"),("D","Sales representative")], "C", "He says 'new graphic designer.'"),
            ("What will the woman prepare?", [("A","A training schedule"),("B","An ID badge"),("C","A parking pass"),("D","A workstation and accounts")], "D", "She says 'set up her computer and email account' and 'prepare her workstation.'"),
        ]
    },
    {
        "topic": "inventory",
        "script": "W: We're running low on printer paper and toner cartridges. M: I'll place an order today. How many boxes do we need? W: At least twenty boxes of paper and ten cartridges. M: Got it. I'll also order some envelopes since we're almost out.",
        "questions": [
            ("What supplies are running low?", [("A","Pens and notebooks"),("B","Paper and toner"),("C","Staplers and tape"),("D","Folders and binders")], "B", "She says 'printer paper and toner cartridges.'"),
            ("How many boxes of paper are needed?", [("A","Ten"),("B","Fifteen"),("C","Twenty"),("D","Twenty-five")], "C", "She says 'at least twenty boxes.'"),
            ("What additional item will the man order?", [("A","Sticky notes"),("B","Envelopes"),("C","File folders"),("D","Ink pens")], "B", "He says 'also order some envelopes.'"),
        ]
    },
    {
        "topic": "client_meeting",
        "script": "M: The clients from Tokyo are arriving at two o'clock. W: Should I book the large conference room? M: Yes, and order some refreshments. W: How many people are coming? M: Five from their side, plus our team of four. W: I'll make sure there are enough chairs.",
        "questions": [
            ("What time are the clients arriving?", [("A","One o'clock"),("B","Two o'clock"),("C","Three o'clock"),("D","Four o'clock")], "B", "The man says 'arriving at two o'clock.'"),
            ("How many total people will attend?", [("A","Five"),("B","Seven"),("C","Nine"),("D","Ten")], "C", "Five from their side plus four from our team = nine.", ),
            ("What does the man ask the woman to order?", [("A","Lunch"),("B","Office supplies"),("C","Refreshments"),("D","Taxi service")], "C", "He says 'order some refreshments.'"),
        ]
    },
]

for ci, conv in enumerate(conversations):
    qs = []
    for qi, (qt, opts, ans, expl) in enumerate(conv["questions"]):
        qs.append({
            "index": qi,
            "question_text": qt,
            "options": [{"key": k, "text": t} for k, t in opts],
            "answers": [ans],
            "explanation": expl
        })
    q = {
        "type": "grouped_listening",
        "group_name": f"TOEIC Part 3 - Conversation {ci+1}",
        "direction": "You will hear a conversation between two or more people. Select the best answer to each question.",
        "passage_script": conv["script"],
        "questions": qs,
        "question_count": len(qs)
    }
    questions.append(("TOEIC", "listening", "conversations", f"Part 3 Conv {ci+1}", json.dumps(q),
                       3, conv["topic"],
                       '["conversation_detail","inference","main_idea"]', 'B1', 'understand'))


# ─── PART 4: TALKS (Listening) ─────────────────────────────
# 10 talks × 3 questions each = 30 questions
talks = [
    {
        "topic": "company_announcement",
        "script": "Good morning, everyone. I'm pleased to announce that our company has been awarded the contract to build the new civic center downtown. Construction will begin in April and is expected to be completed by December of next year. We'll be hiring an additional fifty workers for this project. Please see your department heads for more details.",
        "questions": [
            ("What has the company been awarded?", [("A","A research grant"),("B","A construction contract"),("C","An industry award"),("D","A government license")], "B", "The speaker says 'awarded the contract to build the new civic center.'"),
            ("When will construction begin?", [("A","March"),("B","April"),("C","May"),("D","June")], "B", "The speaker says 'begin in April.'"),
            ("How many additional workers will be hired?", [("A","Thirty"),("B","Forty"),("C","Fifty"),("D","Sixty")], "C", "The speaker says 'additional fifty workers.'"),
        ]
    },
    {
        "topic": "training_session",
        "script": "Welcome to the new employee orientation. Today we'll cover company policies, benefits, and safety procedures. After the morning session, we'll take a lunch break from twelve to one. In the afternoon, you'll tour the facilities with your team leaders. Please make sure you have your employee ID badges before the tour.",
        "questions": [
            ("What is the purpose of this event?", [("A","A product launch"),("B","New employee orientation"),("C","A board meeting"),("D","A safety drill")], "B", "The speaker says 'new employee orientation.'"),
            ("When is the lunch break?", [("A","11:00 to 12:00"),("B","12:00 to 1:00"),("C","1:00 to 2:00"),("D","12:30 to 1:30")], "B", "The speaker says 'twelve to one.'"),
            ("What should employees bring on the tour?", [("A","A notebook"),("B","Safety equipment"),("C","Their ID badges"),("D","A laptop")], "C", "The speaker says 'make sure you have your employee ID badges.'"),
        ]
    },
    {
        "topic": "weather_report",
        "script": "This is your morning weather update. Today will be mostly cloudy with temperatures reaching a high of twenty-two degrees. There's a sixty percent chance of rain this afternoon, so don't forget your umbrella. Tomorrow should be clearer with sunshine expected throughout the day.",
        "questions": [
            ("What is today's weather forecast?", [("A","Sunny and warm"),("B","Mostly cloudy with possible rain"),("C","Snowy and cold"),("D","Windy and dry")], "B", "The speaker says 'mostly cloudy' and 'sixty percent chance of rain.'"),
            ("What is today's high temperature?", [("A","18 degrees"),("B","20 degrees"),("C","22 degrees"),("D","25 degrees")], "C", "The speaker says 'twenty-two degrees.'"),
            ("What is tomorrow's forecast?", [("A","More rain"),("B","Cloudy"),("C","Clear with sunshine"),("D","Thunderstorms")], "C", "The speaker says 'clearer with sunshine.'"),
        ]
    },
    {
        "topic": "store_announcement",
        "script": "Attention shoppers. We're having a special sale this weekend only. All winter clothing is thirty percent off, and selected footwear is buy one get one free. The sale starts Saturday morning at nine and ends Sunday at closing. Members of our loyalty program will receive an additional five percent discount.",
        "questions": [
            ("How much is the discount on winter clothing?", [("A","Twenty percent"),("B","Thirty percent"),("C","Forty percent"),("D","Fifty percent")], "B", "The speaker says 'thirty percent off.'"),
            ("What is the footwear offer?", [("A","Half price"),("B","Free delivery"),("C","Buy one get one free"),("D","Twenty percent off")], "C", "The speaker says 'buy one get one free.'"),
            ("What extra benefit do loyalty members get?", [("A","Free gift wrapping"),("B","Early access"),("C","Five percent additional discount"),("D","Free shipping")], "C", "The speaker says 'additional five percent discount.'"),
        ]
    },
    {
        "topic": "airport_announcement",
        "script": "Attention passengers on Flight 472 to London Heathrow. Due to a mechanical issue, departure has been delayed by approximately two hours. The new departure time is four forty-five PM. We apologize for the inconvenience. Meal vouchers will be distributed at the gate. Please see the gate agent for assistance.",
        "questions": [
            ("What is the destination of Flight 472?", [("A","Paris"),("B","London"),("C","New York"),("D","Tokyo")], "B", "The speaker says 'London Heathrow.'"),
            ("Why is the flight delayed?", [("A","Bad weather"),("B","A mechanical issue"),("C","A security check"),("D","Crew availability")], "B", "The speaker says 'mechanical issue.'"),
            ("What will passengers receive?", [("A","Hotel rooms"),("B","Meal vouchers"),("C","Flight credits"),("D","Lounge access")], "B", "The speaker says 'meal vouchers will be distributed.'"),
        ]
    },
    {
        "topic": "museum_tour",
        "script": "Welcome to the National Art Museum. Today's guided tour will last approximately ninety minutes. We'll start in the Renaissance gallery, then move to the Modern Art wing. Photography is permitted without flash. Please do not touch the artwork. The gift shop closes at five o'clock, so plan your visit accordingly.",
        "questions": [
            ("How long is the guided tour?", [("A","Sixty minutes"),("B","Ninety minutes"),("C","Two hours"),("D","Forty-five minutes")], "B", "The speaker says 'approximately ninety minutes.'"),
            ("Where will the tour start?", [("A","Modern Art wing"),("B","Sculpture garden"),("C","Renaissance gallery"),("D","Photography exhibit")], "C", "The speaker says 'start in the Renaissance gallery.'"),
            ("What photography rule is mentioned?", [("A","No photography allowed"),("B","Photography without flash is permitted"),("C","Only in designated areas"),("D","With a special permit only")], "B", "The speaker says 'photography is permitted without flash.'"),
        ]
    },
    {
        "topic": "voicemail",
        "script": "Hello, this is David Chen from Apex Financial Services. I'm calling to confirm our meeting scheduled for Thursday at ten AM. I'd like to discuss the quarterly investment report and the new retirement plan options. If you need to reschedule, please call me back at 555-0142. I look forward to speaking with you.",
        "questions": [
            ("Who is calling?", [("A","A doctor"),("B","A lawyer"),("C","A financial advisor"),("D","A real estate agent")], "C", "David Chen is from Apex Financial Services.", ),
            ("When is the meeting scheduled?", [("A","Wednesday at ten"),("B","Thursday at ten"),("C","Thursday at two"),("D","Friday at ten")], "B", "He says 'Thursday at ten AM.'"),
            ("What will be discussed at the meeting?", [("A","A merger proposal"),("B","Investment report and retirement plans"),("C","Marketing strategy"),("D","Hiring decisions")], "B", "He says 'quarterly investment report and new retirement plan options.'"),
        ]
    },
    {
        "topic": "factory_safety",
        "script": "Good afternoon. Before we begin the shift, I want to remind everyone about the updated safety protocols. All workers must wear protective goggles in the assembly area. Hard hats are now required on the entire factory floor, not just in the loading dock. Also, emergency exits have been repainted with green markers for better visibility. Please review the safety handbook that was distributed this morning.",
        "questions": [
            ("What new requirement applies to the entire factory floor?", [("A","Safety vests"),("B","Hard hats"),("C","Ear protection"),("D","Steel-toed boots")], "B", "The speaker says 'hard hats are now required on the entire factory floor.'"),
            ("Where are protective goggles required?", [("A","The parking lot"),("B","The break room"),("C","The assembly area"),("D","The office")], "C", "The speaker says 'protective goggles in the assembly area.'"),
            ("What color marks the emergency exits?", [("A","Red"),("B","Yellow"),("C","Green"),("D","Blue")], "C", "The speaker says 'repainted with green markers.'"),
        ]
    },
    {
        "topic": "conference_intro",
        "script": "Good morning and welcome to the annual Technology Innovation Summit. I'm Dr. Sarah Park, your host for today. We have an exciting lineup of speakers from leading tech companies. The keynote address will begin at ten o'clock in the main auditorium. After that, breakout sessions will be held in rooms A through D. Lunch will be served in the garden terrace at twelve thirty.",
        "questions": [
            ("What is the event?", [("A","A job fair"),("B","A technology summit"),("C","A graduation ceremony"),("D","A product launch")], "B", "She says 'Technology Innovation Summit.'"),
            ("When is the keynote address?", [("A","Nine o'clock"),("B","Ten o'clock"),("C","Eleven o'clock"),("D","Twelve o'clock")], "B", "She says 'ten o'clock.'"),
            ("Where will lunch be served?", [("A","In the auditorium"),("B","In Room A"),("C","In the garden terrace"),("D","In the lobby")], "C", "She says 'garden terrace at twelve thirty.'"),
        ]
    },
    {
        "topic": "real_estate",
        "script": "Thank you for joining us at Greenfield Properties. The apartment complex we're viewing today features one and two-bedroom units with modern kitchens and in-unit laundry. The building has a fitness center, a rooftop lounge, and underground parking. Rent starts at fifteen hundred dollars for a one-bedroom. Move-in specials include one month free with a twelve-month lease.",
        "questions": [
            ("What amenity is mentioned?", [("A","A swimming pool"),("B","A tennis court"),("C","A fitness center"),("D","A playground")], "C", "The speaker mentions 'a fitness center.'"),
            ("What is the starting rent for a one-bedroom?", [("A","$1,200"),("B","$1,500"),("C","$1,800"),("D","$2,000")], "B", "The speaker says 'fifteen hundred dollars.'"),
            ("What is the move-in special?", [("A","No security deposit"),("B","Free parking for a year"),("C","One month free with a 12-month lease"),("D","Half rent for three months")], "C", "The speaker says 'one month free with a twelve-month lease.'"),
        ]
    },
]

for ti, talk in enumerate(talks):
    qs = []
    for qi, (qt, opts, ans, expl) in enumerate(talk["questions"]):
        qs.append({
            "index": qi,
            "question_text": qt,
            "options": [{"key": k, "text": t} for k, t in opts],
            "answers": [ans],
            "explanation": expl
        })
    q = {
        "type": "grouped_listening",
        "group_name": f"TOEIC Part 4 - Talk {ti+1}",
        "direction": "You will hear a talk given by a single speaker. Select the best answer to each question.",
        "passage_script": talk["script"],
        "questions": qs,
        "question_count": len(qs)
    }
    questions.append(("TOEIC", "listening", "talks", f"Part 4 Talk {ti+1}", json.dumps(q),
                       3, talk["topic"],
                       '["talk_detail","main_idea","inference"]', 'B1', 'understand'))


# ─── PART 5: INCOMPLETE SENTENCES (Reading) ────────────────
# 40 questions: grammar + vocabulary in business context
part5 = [
    ("All employees must submit their time sheets _______ the end of each month.", [("A","by"),("B","until"),("C","since"),("D","from")], "A", "'By' indicates a deadline.", "prepositions", "B1"),
    ("The quarterly report was _______ reviewed by the finance department.", [("A","careful"),("B","carefully"),("C","care"),("D","caring")], "B", "'Carefully' is an adverb modifying 'reviewed.'", "word_form", "B1"),
    ("Ms. Garcia is _______ for coordinating the annual company retreat.", [("A","responsive"),("B","responsible"),("C","responding"),("D","respective")], "B", "'Responsible for' is the correct collocation.", "vocabulary_context", "B1"),
    ("The shipment will arrive _______ than expected due to favorable weather.", [("A","early"),("B","earlier"),("C","earliest"),("D","the earliest")], "B", "Comparative form 'earlier' with 'than.'", "grammar_range", "A2"),
    ("_______ the renovations are complete, the office will reopen to the public.", [("A","Once"),("B","During"),("C","While"),("D","Despite")], "A", "'Once' means 'as soon as,' fitting completed future action.", "clause", "B1"),
    ("The CEO emphasized the _______ of maintaining high customer satisfaction.", [("A","important"),("B","importantly"),("C","importance"),("D","importing")], "C", "After 'the,' a noun is needed: 'importance.'", "word_form", "B1"),
    ("Each branch office is required to _______ a safety drill every quarter.", [("A","conduct"),("B","contain"),("C","consist"),("D","consume")], "A", "'Conduct a drill' is the correct business collocation.", "vocabulary_context", "B1"),
    ("The meeting room on the third floor is currently _______ renovation.", [("A","in"),("B","under"),("C","at"),("D","over")], "B", "'Under renovation' is a fixed expression.", "prepositions", "B1"),
    ("If you _______ any errors in the report, please notify your supervisor.", [("A","find"),("B","found"),("C","will find"),("D","finding")], "A", "Present simple in the if-clause of a first conditional.", "conditional", "B1"),
    ("The company _______ its profits by twenty percent last fiscal year.", [("A","increases"),("B","increased"),("C","increasing"),("D","has increased")], "B", "'Last fiscal year' requires past simple.", "tense", "A2"),
    ("Mr. Tanaka was promoted _______ his outstanding performance.", [("A","despite"),("B","because"),("C","due to"),("D","although")], "C", "'Due to' + noun phrase for reason.", "clause", "B1"),
    ("Employees who wish to work remotely must _______ a formal request.", [("A","submit"),("B","submitting"),("C","submitted"),("D","submits")], "A", "'Must + base form' is correct.", "grammar_range", "A2"),
    ("The annual _______ will take place at the downtown convention center.", [("A","confer"),("B","conferring"),("C","conference"),("D","conferred")], "C", "Noun form 'conference' is needed after 'annual.'", "word_form", "B1"),
    ("The company offers a _______ benefits package to all full-time employees.", [("A","comprehend"),("B","comprehensive"),("C","comprehension"),("D","comprehensively")], "B", "Adjective 'comprehensive' modifies 'package.'", "word_form", "B2"),
    ("Neither the manager _______ the assistant was available for comment.", [("A","or"),("B","and"),("C","but"),("D","nor")], "D", "'Neither...nor' is the correct correlative conjunction.", "grammar_range", "B1"),
    ("Sales figures for the third quarter _______ a significant improvement.", [("A","show"),("B","shows"),("C","showing"),("D","shown")], "A", "'Figures' is plural, so 'show' (plural verb).", "subject_verb", "B1"),
    ("The warranty is _______ for products purchased within the last year.", [("A","valid"),("B","validate"),("C","validity"),("D","validly")], "A", "Adjective 'valid' after 'is.'", "word_form", "B1"),
    ("Applicants should have at least five years of _______ in project management.", [("A","experiment"),("B","experience"),("C","expert"),("D","expedition")], "B", "'Experience in' is the correct phrase.", "vocabulary_context", "B1"),
    ("The new software will _______ employees to track their work hours more efficiently.", [("A","able"),("B","enable"),("C","unable"),("D","capability")], "B", "'Enable someone to do' is the correct structure.", "vocabulary_context", "B1"),
    ("Please ensure that all documents are _______ before the audit.", [("A","organize"),("B","organizing"),("C","organized"),("D","organizes")], "C", "Past participle 'organized' in passive construction.", "passive", "B1"),
    ("The budget proposal needs to be _______ by the board of directors.", [("A","approve"),("B","approving"),("C","approved"),("D","approval")], "C", "Passive: 'to be + past participle.'", "passive", "B1"),
    ("We are looking for candidates who can work _______ under pressure.", [("A","effect"),("B","effective"),("C","effectively"),("D","effecting")], "C", "Adverb 'effectively' modifies 'work.'", "word_form", "B1"),
    ("The contract will be _______ once both parties sign it.", [("A","binding"),("B","bound"),("C","bind"),("D","binds")], "A", "'Binding' means legally enforceable.", "vocabulary_context", "B2"),
    ("_______ to the new policy, all overtime must be pre-approved.", [("A","According"),("B","Regarding"),("C","Despite"),("D","Besides")], "A", "'According to' introduces a policy reference.", "prepositions", "B1"),
    ("The factory _______ more than five thousand units per day.", [("A","produce"),("B","produces"),("C","producing"),("D","production")], "B", "Third person singular present: 'produces.'", "subject_verb", "A2"),
    ("Management decided to _______ the project deadline by two weeks.", [("A","expand"),("B","extend"),("C","extent"),("D","extensive")], "B", "'Extend a deadline' is the correct collocation.", "vocabulary_context", "B1"),
    ("The building's security system has been _______ to include facial recognition.", [("A","upgrade"),("B","upgrading"),("C","upgraded"),("D","upgrades")], "C", "Present perfect passive: 'has been upgraded.'", "passive", "B1"),
    ("Participants are advised to arrive fifteen minutes _______ the seminar begins.", [("A","after"),("B","before"),("C","during"),("D","while")], "B", "'Before' indicates arriving prior to the start.", "prepositions", "A2"),
    ("The marketing team developed a _______ to increase brand awareness.", [("A","strategic"),("B","strategize"),("C","strategy"),("D","strategically")], "C", "Noun 'strategy' is needed after 'a.'", "word_form", "B1"),
    ("Customer feedback _______ that the new product is well received.", [("A","indicate"),("B","indicates"),("C","indicating"),("D","indicated")], "B", "'Feedback' is uncountable/singular: 'indicates.'", "subject_verb", "B1"),
    ("The merger is expected to be _______ by the end of this quarter.", [("A","complete"),("B","completed"),("C","completing"),("D","completion")], "B", "Passive: 'to be completed.'", "passive", "B1"),
    ("Ms. Kim _______ as the regional director for over a decade.", [("A","serves"),("B","serving"),("C","has served"),("D","serve")], "C", "'For over a decade' requires present perfect.", "tense", "B1"),
    ("The seminar will provide _______ information about investment strategies.", [("A","value"),("B","valued"),("C","valuable"),("D","valuing")], "C", "Adjective 'valuable' modifies 'information.'", "word_form", "B1"),
    ("All staff members are _______ to attend the mandatory training session.", [("A","require"),("B","required"),("C","requiring"),("D","requirement")], "B", "Passive: 'are required to.'", "passive", "B1"),
    ("The hotel offers a complimentary shuttle service _______ the airport.", [("A","to"),("B","at"),("C","in"),("D","on")], "A", "'Shuttle service to' a destination.", "prepositions", "A2"),
    ("The board will _______ whether to approve the expansion plan at tomorrow's meeting.", [("A","determine"),("B","determined"),("C","determining"),("D","determination")], "A", "'Will + base form.'", "grammar_range", "B1"),
    ("The maintenance team is responsible for _______ that all equipment functions properly.", [("A","ensure"),("B","ensures"),("C","ensuring"),("D","ensured")], "C", "'Responsible for + gerund.'", "grammar_range", "B1"),
    ("Clients who are _______ with the service may request a full refund.", [("A","satisfy"),("B","satisfied"),("C","dissatisfied"),("D","satisfying")], "C", "Context: requesting refund implies dissatisfaction.", "vocabulary_context", "B1"),
    ("The new branch _______ in the heart of the financial district.", [("A","locates"),("B","is located"),("C","locating"),("D","location")], "B", "Passive: 'is located in.'", "passive", "B1"),
    ("Annual performance reviews will be _______ starting next month.", [("A","conducting"),("B","conduct"),("C","conducted"),("D","conductor")], "C", "Passive: 'will be conducted.'", "passive", "B1"),
]

for i, (stem, opts, ans, expl, skill, cefr) in enumerate(part5):
    q = {
        "question_id": 3000 + i,
        "question_text": stem,
        "options": [{"key": k, "text": t, "is_answer": k == ans} for k, t in opts],
        "answers": [ans],
        "explanation": expl,
        "group_name": f"TOEIC Part 5 - Set {i//10 + 1}",
        "test_name": f"Reading - Incomplete Sentences"
    }
    questions.append(("TOEIC", "reading", "incomplete_sentences", f"Part 5 Set {i//10+1}", json.dumps(q),
                       2 if cefr == "A2" else 3, skill,
                       json.dumps([skill, "grammar_range"]), cefr, 'apply'))


# ─── PART 6: TEXT COMPLETION (Reading) ─────────────────────
# 4 texts × 4 questions = 16 questions
text_completions = [
    {
        "topic": "business_memo",
        "passage": "Dear Team,\n\nI am writing to inform you that the company picnic has been __(1)__ to August 15th. All employees and their families are __(2)__ to attend. Food and beverages will be __(3)__ by the company. Please RSVP by August 1st so we can make the __(4)__ arrangements.\n\nBest regards,\nHuman Resources",
        "questions": [
            ("__(1)__", [("A","scheduled"),("B","canceled"),("C","postponed"),("D","rejected")], "A", "'Scheduled to' a date indicates planning.", "vocabulary_context"),
            ("__(2)__", [("A","required"),("B","forbidden"),("C","invited"),("D","obligated")], "C", "'Invited to attend' a picnic is correct.", "vocabulary_context"),
            ("__(3)__", [("A","charged"),("B","billed"),("C","sold"),("D","provided")], "D", "'Provided by the company' means supplied free.", "vocabulary_context"),
            ("__(4)__", [("A","necessary"),("B","emergency"),("C","private"),("D","optional")], "A", "'Necessary arrangements' fits the planning context.", "vocabulary_context"),
        ]
    },
    {
        "topic": "job_posting",
        "passage": "Position: Marketing Coordinator\n\nWe are __(1)__ a dynamic marketing coordinator to join our team. The ideal candidate should have a bachelor's degree in marketing or a __(2)__ field. Strong communication skills are __(3)__. The position offers a competitive salary and __(4)__ benefits including health insurance and retirement plans.",
        "questions": [
            ("__(1)__", [("A","firing"),("B","seeking"),("C","losing"),("D","replacing")], "B", "'Seeking' means looking for/recruiting.", "vocabulary_context"),
            ("__(2)__", [("A","different"),("B","unrelated"),("C","related"),("D","separate")], "C", "'Related field' means similar discipline.", "vocabulary_context"),
            ("__(3)__", [("A","essential"),("B","optional"),("C","unlikely"),("D","forbidden")], "A", "'Essential' means required.", "vocabulary_context"),
            ("__(4)__", [("A","limited"),("B","reduced"),("C","comprehensive"),("D","expired")], "C", "'Comprehensive benefits' is a standard business phrase.", "vocabulary_context"),
        ]
    },
    {
        "topic": "product_notice",
        "passage": "Important Notice:\n\nDue to a __(1)__ defect found in Model X200 batteries, we are issuing a voluntary recall. Customers who purchased this product should __(2)__ using it immediately. To receive a full __(3)__, please return the item to any authorized dealer. We sincerely __(4)__ for any inconvenience caused.",
        "questions": [
            ("__(1)__", [("A","temporary"),("B","manufacturing"),("C","artificial"),("D","natural")], "B", "'Manufacturing defect' is the standard term.", "vocabulary_context"),
            ("__(2)__", [("A","continue"),("B","begin"),("C","stop"),("D","enjoy")], "C", "'Stop using' a recalled product.", "vocabulary_context"),
            ("__(3)__", [("A","refund"),("B","invoice"),("C","charge"),("D","penalty")], "A", "'Full refund' for returned recalled products.", "vocabulary_context"),
            ("__(4)__", [("A","celebrate"),("B","apologize"),("C","congratulate"),("D","complain")], "B", "'Apologize for inconvenience' is standard business language.", "vocabulary_context"),
        ]
    },
    {
        "topic": "company_policy",
        "passage": "Effective January 1st, all employees will be __(1)__ to complete an online cybersecurity training module. This __(2)__ was developed in response to the increasing number of phishing attacks targeting businesses. The training must be completed __(3)__ the end of the first quarter. Employees who fail to complete the training may face __(4)__ action.",
        "questions": [
            ("__(1)__", [("A","allowed"),("B","required"),("C","prevented"),("D","excused")], "B", "'Required to complete' = mandatory.", "vocabulary_context"),
            ("__(2)__", [("A","vacation"),("B","ceremony"),("C","initiative"),("D","celebration")], "C", "'Initiative' fits a new program/policy.", "vocabulary_context"),
            ("__(3)__", [("A","by"),("B","since"),("C","from"),("D","after")], "A", "'By the end of' = deadline.", "prepositions"),
            ("__(4)__", [("A","rewarding"),("B","promotional"),("C","disciplinary"),("D","voluntary")], "C", "'Disciplinary action' for non-compliance.", "vocabulary_context"),
        ]
    },
]

for ti, tc in enumerate(text_completions):
    qs = []
    for qi, (label, opts, ans, expl, skill) in enumerate(tc["questions"]):
        qs.append({
            "index": qi,
            "question_text": label,
            "options": [{"key": k, "text": t} for k, t in opts],
            "answers": [ans],
            "explanation": expl
        })
    q = {
        "type": "grouped_reading",
        "group_name": f"TOEIC Part 6 - Text {ti+1}",
        "passage": tc["passage"],
        "direction": "Read the text and select the best word or phrase for each blank.",
        "questions": qs,
        "question_count": len(qs)
    }
    questions.append(("TOEIC", "reading", "text_completion", f"Part 6 Text {ti+1}", json.dumps(q),
                       3, tc["topic"],
                       '["vocabulary_context","text_completion"]', 'B1', 'apply'))


# ─── PART 7: READING COMPREHENSION (Reading) ───────────────
# 10 passages × 3-5 questions = ~40 questions
reading_passages = [
    {
        "topic": "business_email",
        "passage": "From: j.martinez@globaltech.com\nTo: all-staff@globaltech.com\nSubject: Office Relocation Update\n\nDear Team,\n\nI'm pleased to announce that our move to the new headquarters at 500 Innovation Drive is on schedule. The moving date is set for March 15th. Each department will be assigned a specific moving time to minimize disruption. IT will begin setting up equipment at the new location starting March 10th. Please pack your personal belongings by March 14th. Boxes will be provided by the facilities team starting next Monday.\n\nBest regards,\nJuan Martinez\nOperations Director",
        "questions": [
            ("What is the purpose of this email?", [("A","To announce a company merger"),("B","To provide relocation details"),("C","To introduce a new employee"),("D","To request budget approval")], "B", "The email provides updates about the office move."),
            ("When will the move take place?", [("A","March 10th"),("B","March 14th"),("C","March 15th"),("D","Next Monday")], "C", "The email states 'moving date is set for March 15th.'"),
            ("What should employees do by March 14th?", [("A","Set up equipment"),("B","Pack personal belongings"),("C","Confirm attendance"),("D","Submit a budget")], "B", "'Pack your personal belongings by March 14th.'"),
        ]
    },
    {
        "topic": "advertisement",
        "passage": "SKYVIEW BUSINESS CENTER\n\nPremium office space now available in the heart of downtown. Features include high-speed internet, 24-hour security, conference rooms, and a cafeteria. Flexible lease terms from 6 to 36 months. Spaces range from 200 to 2,000 square feet. First month free for leases of 12 months or longer. Virtual office packages also available starting at $99/month. Contact our leasing office at 555-0199 or visit skyviewbc.com for a tour.",
        "questions": [
            ("What is being advertised?", [("A","Residential apartments"),("B","Office space"),("C","A restaurant"),("D","A fitness center")], "B", "'Premium office space' is the main subject."),
            ("What special offer is available?", [("A","Free parking"),("B","Discounted internet"),("C","First month free for 12+ month leases"),("D","Half price rent")], "C", "'First month free for leases of 12 months or longer.'"),
            ("How much is the virtual office package?", [("A","$49/month"),("B","$79/month"),("C","$99/month"),("D","$129/month")], "C", "'Starting at $99/month.'"),
        ]
    },
    {
        "topic": "policy_document",
        "passage": "EMPLOYEE TRAVEL POLICY\n\nAll business travel must be approved by a department manager at least two weeks in advance. Employees should book the most economical transportation option available. Hotel accommodations should not exceed $150 per night unless prior approval is obtained. Meal expenses are reimbursable up to $50 per day with original receipts. Rental cars are permitted only when public transportation is unavailable or impractical. All expense reports must be submitted within 10 business days of return.",
        "questions": [
            ("How far in advance must travel be approved?", [("A","One week"),("B","Two weeks"),("C","One month"),("D","Three days")], "B", "'At least two weeks in advance.'"),
            ("What is the maximum daily meal allowance?", [("A","$25"),("B","$50"),("C","$75"),("D","$100")], "B", "'Up to $50 per day.'"),
            ("When must expense reports be submitted?", [("A","Before traveling"),("B","Within 5 business days"),("C","Within 10 business days of return"),("D","At the end of the month")], "C", "'Within 10 business days of return.'"),
            ("When are rental cars permitted?", [("A","Always"),("B","Only for executives"),("C","When public transport is unavailable"),("D","Only for international trips")], "C", "'Only when public transportation is unavailable or impractical.'"),
        ]
    },
    {
        "topic": "article",
        "passage": "The global market for electric vehicles is expected to grow significantly over the next decade. Industry analysts predict that EV sales will account for over 40% of all new car sales by 2030. This growth is being driven by stricter emissions regulations, declining battery costs, and increasing consumer awareness of environmental issues. Major automakers have announced plans to invest billions in EV development, with several pledging to phase out internal combustion engines entirely by 2035. However, challenges remain, including the need for more charging infrastructure and concerns about battery disposal.",
        "questions": [
            ("What percentage of car sales will EVs account for by 2030?", [("A","20%"),("B","30%"),("C","40%"),("D","50%")], "C", "'Over 40% of all new car sales by 2030.'"),
            ("What is NOT mentioned as a growth driver?", [("A","Emissions regulations"),("B","Lower battery costs"),("C","Government subsidies"),("D","Consumer awareness")], "C", "Government subsidies are not mentioned in the passage."),
            ("What challenge is mentioned regarding EVs?", [("A","High speed limits"),("B","Lack of charging infrastructure"),("C","Too many models"),("D","Excessive noise")], "B", "'The need for more charging infrastructure.'"),
        ]
    },
    {
        "topic": "notice",
        "passage": "LIBRARY RENOVATION NOTICE\n\nThe Westfield Public Library will be closed for renovations from April 1 to May 31. During this period, the following services will remain available:\n- The online catalog and e-book lending will continue as normal\n- The book drop-off box outside the main entrance will remain open\n- A temporary book pickup point will be established at the Community Center on Elm Street\n\nAll due dates for currently borrowed items will be automatically extended until June 15. We apologize for any inconvenience and look forward to welcoming you to our improved facilities in June.",
        "questions": [
            ("How long will the library be closed?", [("A","One month"),("B","Two months"),("C","Three months"),("D","Six months")], "B", "April 1 to May 31 = two months."),
            ("Where will the temporary pickup point be?", [("A","At the main entrance"),("B","At the Community Center"),("C","At the school"),("D","Online only")], "B", "'At the Community Center on Elm Street.'"),
            ("Until when are due dates extended?", [("A","April 30"),("B","May 31"),("C","June 15"),("D","July 1")], "C", "'Automatically extended until June 15.'"),
        ]
    },
]

for pi, rp in enumerate(reading_passages):
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
        "group_name": f"TOEIC Part 7 - Passage {pi+1}",
        "passage": rp["passage"],
        "direction": "Read the passage and select the best answer for each question.",
        "questions": qs,
        "question_count": len(qs)
    }
    questions.append(("TOEIC", "reading", "reading_comprehension", f"Part 7 Passage {pi+1}", json.dumps(q),
                       3, rp["topic"],
                       '["detail","inference","main_idea","scanning"]', 'B1', 'analyze'))


# ─── OUTPUT SQL ────────────────────────────────────────────
print(f"-- TOEIC Question Bank: {len(questions)} rows")
print(f"-- Generated for EduBot")
print()

for i, (tt, sec, qt, title, content, diff, topic, tags, cefr, bloom) in enumerate(questions):
    # Escape single quotes in content
    safe_content = content.replace("'", "''")
    safe_title = title.replace("'", "''")
    safe_topic = topic.replace("'", "''")
    safe_tags = tags.replace("'", "''")
    print(f"INSERT INTO test_contents (test_type, section, question_type, title, content, difficulty, topic, status, skill_tags, cefr_level, bloom_level) VALUES ('{tt}', '{sec}', '{qt}', '{safe_title}', '{safe_content}', {diff}, '{safe_topic}', 'published', '{safe_tags}', '{cefr}', '{bloom}');")

print()
print(f"-- Total: {len(questions)} TOEIC questions inserted")
