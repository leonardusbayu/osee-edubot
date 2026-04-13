/**
 * Teacher/Admin Autonomous Agent
 *
 * Takes a natural language goal, breaks it into steps, executes them using
 * available tools (D1 queries, Telegram API, AI generation), and reports results.
 */
import type { Env, User } from '../types';

interface AgentResult {
  success: boolean;
  summary: string;
  actions: string[];
  data?: any;
}

// Tools the agent can use
const TOOL_DESCRIPTIONS = `Available tools:
1. query_students — search/filter students by name, accuracy, activity, class
2. query_stats — get system statistics (costs, question counts, accuracy)
3. send_message — send Telegram message to specific student(s)
4. broadcast — send message to all students or filtered group
5. generate_questions — AI-generate IELTS/TOEFL questions from a topic
6. publish_content — publish draft questions
7. delete_content — archive old/bad questions
8. get_churn_risk — find inactive students
9. get_class_performance — analyze a class
10. calibrate_difficulty — auto-tag question difficulty from data
11. create_study_plan — generate study plan for a student
12. get_costs — show API cost breakdown`;

export async function runAgent(env: Env, user: User, goal: string): Promise<string> {
  if (!env.OPENAI_API_KEY) return 'AI not configured.';

  // Step 1: Plan — let AI decide what tools to use
  const planPrompt = `You are an autonomous agent for EduBot (TOEFL/IELTS learning platform).
You have access to a database of students, questions, test results, and can send Telegram messages.

${TOOL_DESCRIPTIONS}

The teacher/admin asked: "${goal}"

Respond with a JSON plan:
{
  "steps": [
    {"tool": "tool_name", "params": {"key": "value"}, "description": "what this step does"}
  ],
  "summary": "brief description of what you will do"
}

Rules:
- Use the minimum number of steps needed
- Be specific with parameters
- If the goal is a question, use query tools
- If the goal involves sending messages, use send/broadcast tools
- If the goal involves content, use generate/publish tools
- Maximum 5 steps`;

  try {
    const planResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini', max_tokens: 500, temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a task planner. Always respond with valid JSON only.' },
          { role: 'user', content: planPrompt },
        ],
      }),
    });

    const planData: any = await planResponse.json();
    const plan = JSON.parse(planData.choices?.[0]?.message?.content || '{}');

    if (!plan.steps?.length) return 'Tidak bisa memahami perintah. Coba lebih spesifik.';

    // Step 2: Execute each step
    const results: string[] = [];
    results.push(`Plan: ${plan.summary || goal}`);

    for (const step of plan.steps.slice(0, 5)) {
      const result = await executeStep(env, user, step);
      results.push(`${step.description}: ${result}`);
    }

    // Log cost
    try {
      await env.DB.prepare('INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd, user_id) VALUES (?, ?, ?, ?, ?)')
        .bind('openai', 'agent', 500, 0.0001, user.id).run();
    } catch {}

    return results.join('\n\n');
  } catch (e: any) {
    return `Agent error: ${e.message}`;
  }
}

async function executeStep(env: Env, user: User, step: any): Promise<string> {
  const { tool, params } = step;

  try {
    switch (tool) {
      case 'query_students': {
        let query = 'SELECT u.id, u.name, u.proficiency_level FROM users u WHERE u.role = ?';
        const binds: any[] = ['student'];

        if (params?.name) {
          query += ' AND u.name LIKE ?';
          binds.push(`%${params.name}%`);
        }

        query += ' ORDER BY u.name LIMIT 20';
        const result = await env.DB.prepare(query).bind(...binds).all();
        const students = result.results as any[];

        if (params?.with_stats) {
          const detailed = [];
          for (const s of students.slice(0, 10)) {
            const stats = await env.DB.prepare(
              `SELECT COUNT(*) as total, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct
               FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id WHERE ta.user_id=?`
            ).bind(s.id).first() as any;
            const acc = stats?.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
            detailed.push(`${s.name}: ${acc}% (${stats?.total || 0} soal)`);
          }
          return detailed.join('\n') || 'Tidak ada siswa.';
        }

        return students.map((s: any) => s.name).join(', ') || 'Tidak ada siswa.';
      }

      case 'query_stats': {
        const users = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first() as any;
        const questions = await env.DB.prepare('SELECT COUNT(*) as c FROM test_contents WHERE status=?').bind('published').first() as any;
        const answers = await env.DB.prepare("SELECT COUNT(*) as c FROM attempt_answers WHERE NOT (is_correct IS NULL AND section NOT IN ('speaking','writing'))").first() as any;
        const costs = await env.DB.prepare('SELECT SUM(cost_usd) as c FROM api_usage').first() as any;
        return `Users: ${users?.c || 0} | Questions: ${questions?.c || 0} | Answers: ${answers?.c || 0} | Cost: $${(costs?.c || 0).toFixed(4)}`;
      }

      case 'send_message': {
        const target = await env.DB.prepare('SELECT telegram_id FROM users WHERE id = ? OR name LIKE ?')
          .bind(params?.user_id || 0, `%${params?.name || ''}%`).first() as any;
        if (!target) return 'User tidak ditemukan.';
        const tgId = parseInt(String(target.telegram_id).replace('.0', ''));
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgId, text: params?.message || 'Hi from teacher!' }),
        });
        return 'Pesan terkirim.';
      }

      case 'broadcast': {
        let query = "SELECT telegram_id FROM users WHERE role = 'student'";
        if (params?.filter === 'inactive') {
          const ago = new Date(Date.now() - 3 * 86400000).toISOString();
          query = `SELECT u.telegram_id FROM users u LEFT JOIN (SELECT user_id, MAX(submitted_at) as last FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id GROUP BY user_id) s ON u.id=s.user_id WHERE u.role='student' AND (s.last < '${ago}' OR s.last IS NULL)`;
        }
        const targets = await env.DB.prepare(query).all();
        let sent = 0;
        for (const t of targets.results as any[]) {
          const tgId = parseInt(String(t.telegram_id).replace('.0', ''));
          try {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: tgId, text: params?.message || 'Pengumuman dari guru.' }),
            });
            sent++;
          } catch {}
        }
        return `Terkirim ke ${sent}/${targets.results.length} siswa.`;
      }

      case 'generate_questions': {
        const topic = params?.topic || 'general English';
        const count = Math.min(params?.count || 5, 10);
        const testType = params?.test_type || 'TOEFL_IBT';

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: 'gpt-4o', max_tokens: 1500,
            messages: [
              { role: 'system', content: 'Generate IELTS/TOEFL practice questions. JSON array only.' },
              { role: 'user', content: `Generate ${count} ${testType} reading MCQ about "${topic}". Each: {question_text, options: [{key,text}], answers: [letter], explanation}` },
            ],
          }),
        });
        const data: any = await response.json();
        const questions = JSON.parse(data.choices?.[0]?.message?.content || '[]');

        if (questions.length > 0) {
          const content = {
            type: 'grouped_reading', group_name: `AI: ${topic}`,
            passage: `Generated questions about ${topic}`, direction: 'Answer the questions.',
            questions: questions.map((q: any, i: number) => ({ index: i, ...q })),
            question_count: questions.length,
          };
          await env.DB.prepare(
            "INSERT INTO test_contents (test_type, section, question_type, title, content, difficulty, source, status) VALUES (?, 'reading', 'multiple_choice', ?, ?, 3, 'ai_generated', 'draft')"
          ).bind(testType, `AI: ${topic}`, JSON.stringify(content)).run();
        }

        return `${questions.length} soal dibuat (status: draft, perlu di-publish).`;
      }

      case 'publish_content': {
        const result = await env.DB.prepare(
          "UPDATE test_contents SET status = 'published' WHERE status = 'draft' AND source = 'ai_generated'"
        ).run();
        return `${result.meta.changes} soal dipublish.`;
      }

      case 'delete_content': {
        const result = await env.DB.prepare(
          "UPDATE test_contents SET status = 'archived' WHERE status = 'published' AND difficulty <= 1"
        ).run();
        return `${result.meta.changes} soal diarsipkan (terlalu mudah).`;
      }

      case 'get_churn_risk': {
        const ago = new Date(Date.now() - 3 * 86400000).toISOString();
        const result = await env.DB.prepare(
          `SELECT u.name FROM users u LEFT JOIN (SELECT user_id, MAX(submitted_at) as last FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id GROUP BY user_id) s ON u.id=s.user_id WHERE u.role='student' AND (s.last < ? OR s.last IS NULL)`
        ).bind(ago).all();
        return result.results.length > 0
          ? `${result.results.length} siswa inactive: ${(result.results as any[]).map(s => s.name).join(', ')}`
          : 'Semua siswa aktif!';
      }

      case 'get_class_performance': {
        const perf = await env.DB.prepare(
          `SELECT aa.section, COUNT(*) as total, SUM(CASE WHEN aa.is_correct=1 THEN 1 ELSE 0 END) as correct
           FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id=ta.id GROUP BY aa.section`
        ).all();
        return (perf.results as any[]).map(s =>
          `${s.section}: ${s.total > 0 ? Math.round((s.correct/s.total)*100) : 0}% (${s.total} soal)`
        ).join('\n') || 'Belum ada data.';
      }

      case 'calibrate_difficulty': {
        const qs = await env.DB.prepare(
          `SELECT tc.id, COUNT(aa.id) as att, SUM(CASE WHEN aa.is_correct=1 THEN 1 ELSE 0 END) as cor
           FROM test_contents tc LEFT JOIN attempt_answers aa ON aa.content_id=tc.id
           WHERE tc.status='published' GROUP BY tc.id HAVING att >= 5`
        ).all();
        let updated = 0;
        for (const q of qs.results as any[]) {
          const acc = q.att > 0 ? (q.cor / q.att) * 100 : 50;
          const diff = acc >= 90 ? 1 : acc >= 70 ? 2 : acc >= 50 ? 3 : acc >= 30 ? 4 : 5;
          await env.DB.prepare('UPDATE test_contents SET difficulty=? WHERE id=?').bind(diff, q.id).run();
          updated++;
        }
        return `${updated} soal dikalibrasi.`;
      }

      case 'get_costs': {
        const month = await env.DB.prepare(
          "SELECT service, SUM(cost_usd) as cost, COUNT(*) as calls FROM api_usage WHERE created_at >= date('now','-30 days') GROUP BY service"
        ).all();
        return (month.results as any[]).map(s => `${s.service}: $${s.cost.toFixed(4)} (${s.calls} calls)`).join('\n') || 'Belum ada data.';
      }

      default:
        return `Tool "${tool}" tidak dikenali.`;
    }
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}
