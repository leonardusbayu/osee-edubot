-- 054 — Conversational onboarding fields.
--
-- The old onboarding was 2 steps (target test → level). Clueless first-time
-- students still dropped off at the post-setup "suggest /diagnostic" line
-- because they had no sense of what the bot actually does.
--
-- New flow is 6 screens led by the companion: welcome → target → deadline
-- → level → daily-commitment → try-one-question → handoff to diagnostic.
-- We persist the step so /start mid-flow resumes from the last screen.

ALTER TABLE users ADD COLUMN onboarding_step TEXT DEFAULT 'welcome';
-- Values: welcome | target | deadline | level | commitment | tryone | done

ALTER TABLE users ADD COLUMN exam_deadline TEXT;
-- Values: month | 1-3m | 3-6m | unknown — drives companion urgency tone

ALTER TABLE users ADD COLUMN daily_minutes_goal INTEGER;
-- 5 / 15 / 30 / 60 — feeds reminder cron + quota nudges

ALTER TABLE users ADD COLUMN tips_enabled INTEGER DEFAULT 1;
-- /quiet toggles this to 0 to mute feature-discovery nudges
