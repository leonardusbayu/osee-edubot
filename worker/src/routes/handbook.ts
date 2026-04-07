import { Hono } from 'hono';
import type { Env } from '../types';

export const handbookRoutes = new Hono<{ Bindings: Env }>();

const STUDENT_HANDBOOK_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>EduBot - Student Handbook</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.7; color: #1a1a2e; background: white; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px 30px; }
    .cover { text-align: center; padding: 80px 0; border-bottom: 3px solid #168acd; margin-bottom: 40px; }
    .cover .logo { font-size: 3rem; font-weight: 800; color: #168acd; margin-bottom: 20px; }
    .cover .logo span { color: #ffd700; }
    .cover h1 { font-size: 2.2rem; color: #1a1a2e; margin-bottom: 15px; }
    .cover .subtitle { font-size: 1.1rem; color: #666; margin-bottom: 30px; }
    .cover .url { font-size: 1.2rem; color: #168acd; font-weight: 600; }
    .cover .version { font-size: 0.9rem; color: #999; margin-top: 20px; }
    h2 { font-size: 1.6rem; color: #168acd; margin: 35px 0 20px; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0; }
    h3 { font-size: 1.2rem; color: #1a1a2e; margin: 25px 0 15px; }
    p { margin-bottom: 15px; color: #444; }
    ul, ol { margin: 15px 0 15px 25px; }
    li { margin-bottom: 10px; color: #444; }
    .highlight { background: #f0f7ff; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #168acd; }
    .highlight.success { background: #f0fff0; border-left-color: #28a745; }
    .highlight.warning { background: #fff9e6; border-left-color: #ffc107; }
    .highlight.info { background: #f0f7ff; border-left-color: #168acd; }
    .command { background: #1a1a2e; color: #ffd700; padding: 12px 20px; border-radius: 8px; font-family: 'Consolas', monospace; font-size: 1rem; margin: 10px 0; display: inline-block; }
    .command-block { background: #1a1a2e; color: #ffd700; padding: 15px 20px; border-radius: 8px; font-family: 'Consolas', monospace; font-size: 0.95rem; margin: 15px 0; overflow-x: auto; }
    .tip-box { background: linear-gradient(135deg, #168acd 0%, #0d5c8a 100%); color: white; padding: 25px; border-radius: 15px; margin: 25px 0; }
    .tip-box h4 { font-size: 1.1rem; margin-bottom: 10px; }
    .tip-box p { color: rgba(255,255,255,0.9); }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #1a1a2e; }
    tr:hover { background: #f8f9fa; }
    .page-break { page-break-after: always; }
    .footer { text-align: center; padding: 40px 0; margin-top: 40px; border-top: 2px solid #f0f0f0; color: #999; font-size: 0.9rem; }
    .toc { background: #f8f9fa; padding: 25px; border-radius: 15px; margin: 25px 0; }
    .toc h3 { margin-top: 0; }
    .toc ul { list-style: none; margin-left: 0; }
    .toc li { padding: 5px 0; }
    .toc li a { color: #168acd; text-decoration: none; }
    .toc li a:hover { text-decoration: underline; }
    .emoji { font-size: 1.3em; margin-right: 8px; }
    .badge { background: #ffd700; color: #1a1a2e; padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
    .premium-badge { background: linear-gradient(135deg, #ffd700, #ff8c00); color: #1a1a2e; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
  </style>
</head>
<body>
  <div class="page">
    <div class="cover">
      <div class="logo">Edu<span>Bot</span></div>
      <h1>Student Handbook</h1>
      <p class="subtitle">AI-Powered TOEFL & IELTS Preparation</p>
      <p class="url">osee.co.id</p>
      <p class="version">Version 1.0 | April 2025</p>
    </div>
    <h2>Welcome to EduBot! 🎉</h2>
    <p>Hello, student! Congratulations on joining EduBot — your personal AI-powered TOEFL and IELTS preparation assistant. This handbook will guide you through everything you need to know to maximize your learning experience.</p>
    <div class="highlight success">
      <p><strong>What is EduBot?</strong></p>
      <p>EduBot is an AI-powered learning tool that helps you practice for TOEFL and IELTS exams 24/7. With over 3,000 questions, AI tutoring, speaking practice, and personalized study plans, EduBot is designed to help you achieve your target band score faster.</p>
    </div>
    <h3>What You'll Get:</h3>
    <ul>
      <li>📝 <strong>3,000+ Practice Questions</strong> — Reading, Listening, Speaking, and Writing</li>
      <li>🤖 <strong>AI Tutor 24/7</strong> — Ask anything about English, get instant answers</li>
      <li>🎤 <strong>Speaking Practice</strong> — Send voice messages, get AI feedback</li>
      <li>📊 <strong>Progress Tracking</strong> — See your improvement over time</li>
      <li>🔄 <strong>Spaced Repetition</strong> — Smart review of mistakes</li>
      <li>📅 <strong>Personalized Study Plans</strong> — Based on your current level</li>
    </ul>
    <div class="toc">
      <h3>📋 Table of Contents</h3>
      <ul>
        <li><a href="#getting-started">1. Getting Started</a></li>
        <li><a href="#daily-commands">2. Daily Commands</a></li>
        <li><a href="#premium">3. Premium Features</a></li>
        <li><a href="#study-plan">4. Your Study Plan</a></li>
        <li><a href="#speaking">5. Speaking Practice</a></li>
        <li><a href="#progress">6. Tracking Progress</a></li>
        <li><a href="#referral">7. Referral Program</a></li>
        <li><a href="#faq">8. FAQ</a></li>
        <li><a href="#support">9. Support</a></li>
      </ul>
    </div>
    <div class="page-break"></div>
    <h2 id="getting-started">1. Getting Started 🚀</h2>
    <h3>1.1 Set Up Your Profile</h3>
    <p>Before you start, let's make sure your profile is set up correctly:</p>
    <ol>
      <li>Open <strong>@osee_IBT_IELTS_tutor_bot</strong> in Telegram</li>
      <li>Send <span class="command">/settings</span> to choose your target exam (TOEFL or IELTS)</li>
      <li>Select your current proficiency level (Beginner, Intermediate, or Advanced)</li>
      <li>You're ready to start!</li>
    </ol>
    <h3>1.2 Take the Diagnostic Test</h3>
    <p>Before diving into practice, take the diagnostic test to understand your current level:</p>
    <div class="command-block">Send /diagnostic</div>
    <p>This test will:</p>
    <ul>
      <li>Assess your current English level</li>
      <li>Identify your strengths and weaknesses</li>
      <li>Create a personalized study plan for you</li>
    </ul>
    <div class="tip-box">
      <h4>💡 Pro Tip</h4>
      <p>Take the diagnostic test when you're fresh and focused. It takes about 15-20 minutes. Don't rush — this sets your baseline!</p>
    </div>
    <h3>1.3 Understanding the Main Menu</h3>
    <p>When you open the bot, you'll see the main menu with these options:</p>
    <table>
      <tr><th>Menu</th><th>What it does</th></tr>
      <tr><td>📝 Latihan Tes</td><td>Start a practice test</td></tr>
      <tr><td>📖 Belajar</td><td>Access study materials</td></tr>
      <tr><td>🩺 Diagnostic</td><td>Take the placement test</td></tr>
      <tr><td>📊 Progress</td><td>View your statistics</td></tr>
      <tr><td>📅 Hari Ini</td><td>See today's study plan</td></tr>
      <tr><td>💳 Upgrade Premium</td><td>See premium options</td></tr>
      <tr><td>💬 Tanya Admin</td><td>Contact support via WhatsApp</td></tr>
    </table>
    <div class="page-break"></div>
    <h2 id="daily-commands">2. Daily Commands 📚</h2>
    <p>These are the commands you'll use most often. Make them part of your daily routine!</p>
    <h3>2.1 Essential Commands</h3>
    <table>
      <tr><th>Command</th><th>Description</th></tr>
      <tr><td><span class="command">/diagnostic</span></td><td>Take the placement test to establish your baseline</td></tr>
      <tr><td><span class="command">/study</span></td><td>Access study topics and materials</td></tr>
      <tr><td><span class="command">/today</span></td><td>See your personalized lesson for today</td></tr>
      <tr><td><span class="command">/review</span></td><td>Review questions you got wrong</td></tr>
      <tr><td><span class="command">/challenge @user</span></td><td>Challenge a friend to a 5-question duel</td></tr>
      <tr><td><span class="command">/settings</span></td><td>Change your target exam or level</td></tr>
      <tr><td><span class="command">/role</span></td><td>View your XP, level, and badges</td></tr>
      <tr><td><span class="command">/help</span></td><td>Get help with commands</td></tr>
    </table>
    <h3>2.2 Your Daily Routine</h3>
    <p>We recommend this daily routine for best results:</p>
    <div class="highlight">
      <p><strong>🌅 Morning (Before School/Work)</strong></p>
      <p>1. Send <span class="command">/today</span> to see today's lesson</p>
      <p>2. Complete the recommended practice</p>
      <p>3. Send <span class="command">/review</span> to review mistakes</p>
    </div>
    <div class="highlight">
      <p><strong>🌙 Evening (Before Sleep)</strong></p>
      <p>1. Do 5-10 more practice questions</p>
      <p>2. Use voice messages to practice speaking</p>
      <p>3. Check your progress with <span class="command">/role</span></p>
    </div>
    <div class="page-break"></div>
    <h2 id="premium">3. Premium Features ⭐</h2>
    <p>EduBot offers a free trial so you can test the platform. After your trial ends, upgrade to Premium for full access!</p>
    <h3>3.1 Free Trial</h3>
    <p>Every new user gets <strong>1 day free trial</strong> to explore EduBot!</p>
    <h3>3.2 Premium Benefits</h3>
    <div class="highlight success">
      <p><strong>With Premium, you get:</strong></p>
      <p>✅ <strong>Unlimited Questions</strong> — Practice without limits</p>
      <p>✅ <strong>AI Tutor 24/7</strong> — Ask anything, anytime</p>
      <p>✅ <strong>Speaking Practice</strong> — Send voice, get feedback</p>
      <p>✅ <strong>Full Study Plans</strong> — Complete learning path</p>
      <p>✅ <strong>Spaced Repetition</strong> — Smart review system</p>
      <p>✅ <strong>Progress Analytics</strong> — Detailed statistics</p>
    </div>
    <h3>3.3 How to Buy Premium</h3>
    <p>Send <span class="command">/buy</span> to see payment options:</p>
    <ul>
      <li><strong>Telegram Stars</strong> — Instant activation</li>
      <li><strong>GoPay / Transfer</strong> — Manual confirmation</li>
    </ul>
    <h3>3.4 Pricing</h3>
    <table>
      <tr><th>Duration</th><th>Price</th></tr>
      <tr><td>7 days</td><td>Rp 30,000</td></tr>
      <tr><td>30 days (1 month)</td><td>Rp 99,000</td></tr>
      <tr><td>90 days (3 months)</td><td>Rp 270,000</td></tr>
      <tr><td>180 days (6 months)</td><td>Rp 500,000</td></tr>
      <tr><td>365 days (1 year)</td><td>Rp 950,000</td></tr>
    </table>
    <div class="page-break"></div>
    <h2 id="study-plan">4. Your Study Plan 📅</h2>
    <p>After taking the diagnostic test, EduBot creates a personalized study plan just for you.</p>
    <h3>4.1 How It Works</h3>
    <ol>
      <li><strong>Diagnostic Test</strong> — We assess your current level</li>
      <li><strong>Gap Analysis</strong> — We identify what you need to learn</li>
      <li><strong>Study Plan Created</strong> — A day-by-day learning path</li>
      <li><strong>Daily Lessons</strong> — <span class="command">/today</span> shows what to study</li>
      <li><strong>Spaced Repetition</strong> — Questions repeat at optimal intervals</li>
    </ol>
    <h3>4.2 Daily Study Plan</h3>
    <p>Send <span class="command">/today</span> every day to see your recommended lesson.</p>
    <div class="tip-box">
      <h4>💡 Pro Tip</h4>
      <p>Consistency beats intensity! It's better to do 20 minutes every day than 2 hours once a week. Build the habit!</p>
    </div>
    <div class="page-break"></div>
    <h2 id="speaking">5. Speaking Practice 🎤</h2>
    <p>Speaking is often the hardest part of TOEFL/IELTS. EduBot's AI speaking practice helps you improve!</p>
    <h3>5.1 How to Practice Speaking</h3>
    <ol>
      <li>Send a <strong>voice message</strong> (hold the microphone button)</li>
      <li>Speak about the topic or question shown</li>
      <li>The AI will transcribe and provide feedback</li>
    </ol>
    <div class="page-break"></div>
    <h2 id="progress">6. Tracking Progress 📊</h2>
    <p>EduBot tracks everything you do. Monitor your progress to stay motivated!</p>
    <h3>6.1 Your Stats</h3>
    <p>Send <span class="command">/role</span> to see:</p>
    <ul>
      <li><strong>Level</strong> — Your current XP level</li>
      <li><strong>XP Points</strong> — Earned by answering questions</li>
      <li><strong>Badges</strong> — Achievements you've unlocked</li>
    </ul>
    <div class="page-break"></div>
    <h2 id="referral">7. Referral Program 🎁</h2>
    <p>Love EduBot? Share it with friends and earn free premium!</p>
    <h3>7.1 How It Works</h3>
    <ol>
      <li>Send <span class="command">/referral</span> to get your unique link</li>
      <li>Share the link with friends</li>
      <li>When they sign up and become paid users</li>
      <li>You get free premium days!</li>
    </ol>
    <div class="page-break"></div>
    <h2 id="faq">8. Frequently Asked Questions ❓</h2>
    <h3>Q: How is EduBot different from other practice apps?</h3>
    <p>A: EduBot uses AI to provide personalized learning. Unlike static apps, we adapt to your level, track your mistakes, and create a study plan just for you.</p>
    <h3>Q: How long does it take to see results?</h3>
    <p>A: Most students see improvement within 2-3 weeks of consistent practice.</p>
    <h3>Q: Can I use EduBot on my phone?</h3>
    <p>A: Yes! EduBot works perfectly on mobile. Just open Telegram — no app download needed.</p>
    <div class="page-break"></div>
    <h2 id="support">9. Support & Contact 📞</h2>
    <h3>Need Help?</h3>
    <ul>
      <li>📱 <strong>WhatsApp:</strong> wa.me/628112467784</li>
      <li>💬 <strong>Telegram:</strong> @oseeadmin</li>
      <li>🌐 <strong>Website:</strong> osee.co.id</li>
    </ul>
    <div class="footer">
      <p>© 2025 EduBot | osee.co.id</p>
      <p>AI-Powered TOEFL & IELTS Preparation for Indonesian Students</p>
    </div>
  </div>
</body>
</html>`;

const TEACHER_HANDBOOK_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>EduBot - Teacher Handbook</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.7; color: #1a1a2e; background: white; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px 30px; }
    .cover { text-align: center; padding: 80px 0; border-bottom: 3px solid #168acd; margin-bottom: 40px; }
    .cover .logo { font-size: 3rem; font-weight: 800; color: #168acd; margin-bottom: 20px; }
    .cover .logo span { color: #ffd700; }
    .cover h1 { font-size: 2.2rem; color: #1a1a2e; margin-bottom: 15px; }
    .cover .subtitle { font-size: 1.1rem; color: #666; margin-bottom: 30px; }
    .cover .url { font-size: 1.2rem; color: #168acd; font-weight: 600; }
    .cover .version { font-size: 0.9rem; color: #999; margin-top: 20px; }
    h2 { font-size: 1.6rem; color: #168acd; margin: 35px 0 20px; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0; }
    h3 { font-size: 1.2rem; color: #1a1a2e; margin: 25px 0 15px; }
    p { margin-bottom: 15px; color: #444; }
    ul, ol { margin: 15px 0 15px 25px; }
    li { margin-bottom: 10px; color: #444; }
    .highlight { background: #f0f7ff; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #168acd; }
    .highlight.success { background: #f0fff0; border-left-color: #28a745; }
    .highlight.warning { background: #fff9e6; border-left-color: #ffc107; }
    .highlight.info { background: #f0f7ff; border-left-color: #168acd; }
    .command { background: #1a1a2e; color: #ffd700; padding: 12px 20px; border-radius: 8px; font-family: 'Consolas', monospace; font-size: 1rem; margin: 10px 0; display: inline-block; }
    .command-block { background: #1a1a2e; color: #ffd700; padding: 15px 20px; border-radius: 8px; font-family: 'Consolas', monospace; font-size: 0.95rem; margin: 15px 0; overflow-x: auto; }
    .tip-box { background: linear-gradient(135deg, #168acd 0%, #0d5c8a 100%); color: white; padding: 25px; border-radius: 15px; margin: 25px 0; }
    .tip-box h4 { font-size: 1.1rem; margin-bottom: 10px; }
    .tip-box p { color: rgba(255,255,255,0.9); }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #1a1a2e; }
    tr:hover { background: #f8f9fa; }
    .page-break { page-break-after: always; }
    .footer { text-align: center; padding: 40px 0; margin-top: 40px; border-top: 2px solid #f0f0f0; color: #999; font-size: 0.9rem; }
    .toc { background: #f8f9fa; padding: 25px; border-radius: 15px; margin: 25px 0; }
    .toc h3 { margin-top: 0; }
    .toc ul { list-style: none; margin-left: 0; }
    .toc li { padding: 5px 0; }
    .toc li a { color: #168acd; text-decoration: none; }
    .toc li a:hover { text-decoration: underline; }
    .emoji { font-size: 1.3em; margin-right: 8px; }
    .badge { background: #ffd700; color: #1a1a2e; padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
    .teacher-badge { background: linear-gradient(135deg, #168acd, #0d5c8a); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
  </style>
</head>
<body>
  <div class="page">
    <div class="cover">
      <div class="logo">Edu<span>Bot</span></div>
      <h1>Teacher Handbook</h1>
      <p class="subtitle">Manage Your English Class with AI Power</p>
      <p class="url">osee.co.id</p>
      <p class="version">Version 1.0 | April 2025</p>
    </div>
    <h2>Welcome to EduBot for Teachers! 🎓</h2>
    <p>Hello, teacher! Congratulations on joining EduBot as a teacher partner. This handbook will guide you through everything you need to manage your students effectively using our AI-powered platform.</p>
    <div class="highlight success">
      <p><strong>What is EduBot for Teachers?</strong></p>
      <p>EduBot is a SaaS platform that helps English teachers manage their classes more efficiently. With AI-powered practice questions, automated daily quizzes, student progress tracking, and smart spaced repetition — you can focus on teaching while EduBot handles the repetitive work.</p>
    </div>
    <h3>What You'll Get as a Teacher:</h3>
    <ul>
      <li>👥 <strong>Class Management</strong> — Create classes, invite students with codes</li>
      <li>📊 <strong>Student Dashboard</strong> — Monitor each student's progress</li>
      <li>📝 <strong>Auto Quiz</strong> — Daily quiz sent automatically to your class</li>
      <li>🏆 <strong>Leaderboard</strong> — Keep students motivated with rankings</li>
      <li>📈 <strong>Analytics</strong> — See class performance at a glance</li>
      <li>🤝 <strong>Referral Rewards</strong> — Earn free months by inviting students</li>
    </ul>
    <div class="toc">
      <h3>📋 Table of Contents</h3>
      <ul>
        <li><a href="#getting-started">1. Getting Started</a></li>
        <li><a href="#class-management">2. Class Management</a></li>
        <li><a href="#student-monitoring">3. Monitoring Students</a></li>
        <li><a href="#admin-dashboard">4. Admin Dashboard</a></li>
        <li><a href="#pricing">5. Pricing & Billing</a></li>
        <li><a href="#daily-commands">6. Daily Commands</a></li>
        <li><a href="#tips">7. Best Practices</a></li>
        <li><a href="#faq">8. FAQ</a></li>
        <li><a href="#support">9. Support</a></li>
      </ul>
    </div>
    <div class="page-break"></div>
    <h2 id="getting-started">1. Getting Started 🚀</h2>
    <h3>1.1 Activate Your Teacher Account</h3>
    <p>Before you can manage classes, you need to activate your teacher role:</p>
    <ol>
      <li>Open <strong>@osee_IBT_IELTS_tutor_bot</strong> in Telegram</li>
      <li>Send <span class="command">/teacher [invite_code]</span> — use the invite code provided to you</li>
      <li>You'll receive a <span class="teacher-badge">TEACHER</span> badge and access to teacher commands</li>
    </ol>
    <div class="highlight warning">
      <p><strong>Note:</strong> You get a 7-day free trial as a teacher. After the trial, you need to activate premium to continue managing classes.</p>
    </div>
    <h3>1.2 Setting Up Your Profile</h3>
    <p>Configure your teacher settings:</p>
    <div class="command-block">Send /settings</div>
    <h3>1.3 Understanding Teacher Commands</h3>
    <table>
      <tr><th>Command</th><th>Description</th></tr>
      <tr><td><span class="command">/admin</span></td><td>Open the admin dashboard (web app)</td></tr>
      <tr><td><span class="command">/addclass</span></td><td>Create a new class</td></tr>
      <tr><td><span class="command">/broadcast MSG</span></td><td>Send message to all students</td></tr>
      <tr><td><span class="command">/stats</span></td><td>View system statistics</td></tr>
    </table>
    <div class="page-break"></div>
    <h2 id="class-management">2. Class Management 📚</h2>
    <h3>2.1 Creating a Class</h3>
    <p>To create a new class:</p>
    <div class="command-block">Send /addclass</div>
    <p>Follow the prompts to enter class name and you'll receive a unique invite code to share with students.</p>
    <h3>2.2 Inviting Students</h3>
    <p>Students can join your class using the invite code:</p>
    <div class="command-block">Send /join CODE</div>
    <h3>2.3 Daily Quiz System</h3>
    <p>Each class gets an automatic daily quiz at 8 AM WIB containing 5 questions.</p>
    <div class="page-break"></div>
    <h2 id="student-monitoring">3. Monitoring Students 👀</h2>
    <p>The <span class="command">/admin</span> dashboard gives you full visibility into your students' progress.</p>
    <h3>3.1 Student List View</h3>
    <p>Access the dashboard and click the Students tab to see:</p>
    <ul>
      <li>Student name and Telegram username</li>
      <li>Current level and XP</li>
      <li>Questions answered today</li>
      <li>Last active time</li>
      <li>Premium status</li>
    </ul>
    <h3>3.2 Class Leaderboard</h3>
    <p>Keep students motivated with weekly rankings updated every Monday at 8 AM WIB.</p>
    <div class="page-break"></div>
    <h2 id="admin-dashboard">4. Admin Dashboard 💻</h2>
    <h3>4.1 Dashboard Tabs</h3>
    <table>
      <tr><th>Tab</th><th>Content</th></tr>
      <tr><td>Students</td><td>List of all students with key metrics</td></tr>
      <tr><td>Progress</td><td>Class-wide analytics and charts</td></tr>
      <tr><td>CSV Export</td><td>Download student data as spreadsheet</td></tr>
    </table>
    <div class="page-break"></div>
    <h2 id="pricing">5. Pricing & Billing 💰</h2>
    <div class="highlight success">
      <p><strong>Rp 50,000 per student per month</strong></p>
      <p>Minimum 5 students per class</p>
    </div>
    <h3>5.2 What's Included</h3>
    <ul>
      <li>✅ Full class management</li>
      <li>✅ Up to 50 students per class</li>
      <li>✅ Daily auto quiz</li>
      <li>✅ Student progress tracking</li>
      <li>✅ Leaderboard system</li>
      <li>✅ CSV export</li>
    </ul>
    <div class="tip-box">
      <h4>💡 Revenue Example</h4>
      <p>If you have 20 students paying Rp 150k/month = Rp 3,000,000 revenue. EduBot fee = Rp 1,000,000. Your profit = Rp 2,000,000/month!</p>
    </div>
    <div class="page-break"></div>
    <h2 id="daily-commands">6. Daily Commands 📋</h2>
    <table>
      <tr><th>Command</th><th>Description</th></tr>
      <tr><td><span class="command">/admin</span></td><td>Open admin dashboard</td></tr>
      <tr><td><span class="command">/stats</span></td><td>View system statistics</td></tr>
      <tr><td><span class="command">/broadcast MSG</span></td><td>Send message to all students</td></tr>
    </table>
    <div class="page-break"></div>
    <h2 id="tips">7. Best Practices 🎯</h2>
    <h3>7.1 Growing Your Class</h3>
    <div class="highlight success">
      <p><strong>Start with your existing network:</strong></p>
      <p>✅ Current students who need TOEFL/IELTS prep</p>
      <p>✅ Alumni who are planning to study abroad</p>
      <p>✅ WhatsApp groups you're already in</p>
    </div>
    <h3>7.2 Student Retention Tips</h3>
    <ul>
      <li><strong>Personal touch:</strong> Send birthday wishes, celebrate milestones</li>
      <li><strong>Healthy competition:</strong> Weekly prizes for top performers</li>
      <li><strong>Clear goals:</strong> Help students set target band scores</li>
      <li><strong>Regular check-ins:</strong> Use /broadcast to stay connected</li>
    </ul>
    <div class="page-break"></div>
    <h2 id="faq">8. Frequently Asked Questions ❓</h2>
    <h3>Q: How many students can I have per class?</h3>
    <p>A: Standard plan allows up to 50 students per class.</p>
    <h3>Q: Can I use EduBot alongside my existing teaching methods?</h3>
    <p>A: Absolutely! EduBot is a supplement, not a replacement.</p>
    <h3>Q: How do students pay?</h3>
    <p>A: Students can pay via Telegram Stars or GoPay transfer.</p>
    <div class="page-break"></div>
    <h2 id="support">9. Support & Contact 📞</h2>
    <ul>
      <li>📱 <strong>WhatsApp:</strong> wa.me/628112467784</li>
      <li>💬 <strong>Telegram:</strong> @oseeadmin</li>
      <li>🌐 <strong>Website:</strong> osee.co.id</li>
    </ul>
    <div class="footer">
      <p>© 2025 EduBot | osee.co.id</p>
      <p>AI-Powered TOEFL & IELTS Preparation for Indonesian Students</p>
    </div>
  </div>
</body>
</html>`;

handbookRoutes.get('/student', async (c) => {
  const headers = new Headers();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Disposition', 'attachment; filename="EduBot-Student-Handbook.html"');
  return new Response(STUDENT_HANDBOOK_HTML, { headers });
});

handbookRoutes.get('/teacher', async (c) => {
  const headers = new Headers();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Disposition', 'attachment; filename="EduBot-Teacher-Handbook.html"');
  return new Response(TEACHER_HANDBOOK_HTML, { headers });
});

handbookRoutes.get('/student/raw', async (c) => {
  return c.html(STUDENT_HANDBOOK_HTML);
});

handbookRoutes.get('/teacher/raw', async (c) => {
  return c.html(TEACHER_HANDBOOK_HTML);
});

export { STUDENT_HANDBOOK_HTML, TEACHER_HANDBOOK_HTML };