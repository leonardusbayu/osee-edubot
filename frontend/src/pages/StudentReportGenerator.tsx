/**
 * Student Legacy Report Generator
 *
 * Run with: npx wrangler d1 execute edubot-db --remote --file=./scripts/student-report.sql --output=./reports/student-report.csv
 *
 * Or use the Node.js version below for better formatting.
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth';

const WORKER_BASE = 'https://edubot-api.edubot-leonardus.workers.dev';
const ADMIN_SECRET = 'bayuganteng';

async function adminFetch(url: string): Promise<Response> {
  const fullUrl = url.startsWith('/api') ? `${WORKER_BASE}${url}` : url;
  return fetch(fullUrl, {
    headers: {
      'x-admin-secret': ADMIN_SECRET,
    },
  });
}

interface StudentReport {
  id: number;
  name: string;
  username: string | null;
  target_test: string | null;
  proficiency_level: string | null;
  is_premium: boolean;
  created_at: string;
  last_active: string | null;
  current_streak: number;
  longest_streak: number;
  total_questions: number;
  total_correct: number;
  overall_accuracy: number;
  tests_taken: number;
  sections: {
    [key: string]: {
      questions: number;
      correct: number;
      accuracy: number;
    };
  };
  active_days: number;
  first_activity: string | null;
  last_activity: string | null;
  estimated_band: number | null;
  status: 'active' | 'cold' | 'very_cold';
}

async function generateReports(): Promise<StudentReport[]> {
  // Get all students
  const studentsRes = await adminFetch('/api/classes/all/students');
  const students = await studentsRes.json();

  const reports: StudentReport[] = [];

  for (const student of students) {
    // Get detailed analytics for each student
    const analyticsRes = await adminFetch(`/api/analytics/student/${student.id}`);
    const analytics = analyticsRes.ok ? await analyticsRes.json() : null;

    // Get section breakdown
    const sectionRes = await adminFetch(`/api/analytics/student/${student.id}/sections`);
    const sectionData = sectionRes.ok ? await sectionRes.json() : null;

    const report: StudentReport = {
      id: student.id,
      name: student.name,
      username: student.username,
      target_test: student.target_test,
      proficiency_level: student.proficiency_level,
      is_premium: student.is_premium,
      created_at: student.created_at,
      last_active: student.last_study_date,
      current_streak: analytics?.current_streak || 0,
      longest_streak: analytics?.longest_streak || 0,
      total_questions: analytics?.total_questions || 0,
      total_correct: analytics?.total_correct || 0,
      overall_accuracy: analytics?.overall_accuracy || 0,
      tests_taken: analytics?.tests_completed || 0,
      sections: sectionData || {},
      active_days: analytics?.total_sessions || 0,
      first_activity: analytics?.daily_logs?.[0]?.date || null,
      last_activity: analytics?.daily_logs?.[analytics.daily_logs.length - 1]?.date || null,
      estimated_band: student.estimated_band || null,
      status: getActivityStatus(analytics?.last_study_date),
    };

    reports.push(report);
  }

  return reports;
}

function getActivityStatus(lastStudyDate: string | null): 'active' | 'cold' | 'very_cold' {
  if (!lastStudyDate) return 'very_cold';
  const daysSince = (Date.now() - new Date(lastStudyDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 3) return 'active';
  if (daysSince <= 7) return 'cold';
  return 'very_cold';
}

function formatReport(reports: StudentReport[]): string {
  let output = '';

  output += '═══════════════════════════════════════════════════════════════════════════════\n';
  output += '                      EDUBOT STUDENT LEGACY REPORT                            \n';
  output += '═══════════════════════════════════════════════════════════════════════════════\n';
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Total Students: ${reports.length}\n`;
  output += '\n';

  // Summary stats
  const totalQuestions = reports.reduce((sum, r) => sum + r.total_questions, 0);
  const totalCorrect = reports.reduce((sum, r) => sum + r.total_correct, 0);
  const activeStudents = reports.filter(r => r.status === 'active').length;
  const premiumStudents = reports.filter(r => r.is_premium).length;

  output += '── SYSTEM OVERVIEW ──────────────────────────────────────────────────────────\n';
  output += `Total Questions Answered: ${totalQuestions.toLocaleString()}\n`;
  output += `Overall Accuracy: ${totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0}%\n`;
  output += `Active Students (3 days): ${activeStudents}\n`;
  output += `Premium Students: ${premiumStudents}\n`;
  output += '\n';

  // Per-student reports
  for (const report of reports) {
    const statusEmoji = report.status === 'active' ? '🟢' : report.status === 'cold' ? '🟡' : '🔴';
    const premiumBadge = report.is_premium ? ' ⭐' : '';

    output += '═══════════════════════════════════════════════════════════════════════════════\n';
    output += `${statusEmoji} ${report.name} (ID: ${report.id})${premiumBadge}\n`;
    output += '───────────────────────────────────────────────────────────────────────────────\n';

    if (report.username) {
      output += `Username: @${report.username}\n`;
    }
    output += `Target Test: ${report.target_test || 'Not set'}\n`;
    output += `Level: ${report.proficiency_level || 'Not set'}\n`;
    output += `Member since: ${new Date(report.created_at).toLocaleDateString()}\n`;
    output += '\n';

    output += '── PERFORMANCE ───────────────────────────────────────────────────────────────\n';
    output += `Total Questions: ${report.total_questions.toLocaleString()}\n`;
    output += `Correct Answers: ${report.total_correct.toLocaleString()}\n`;
    output += `Overall Accuracy: ${report.overall_accuracy}%\n`;
    output += `Tests Completed: ${report.tests_taken}\n`;
    output += `Est. Band Score: ${report.estimated_band || 'N/A'}\n`;
    output += '\n';

    output += '── SECTION BREAKDOWN ─────────────────────────────────────────────────────────\n';
    const sectionNames: Record<string, string> = {
      reading: 'Reading',
      listening: 'Listening',
      speaking: 'Speaking',
      writing: 'Writing',
      structure: 'Structure & Written Expression',
    };

    const sections = Object.entries(report.sections);
    if (sections.length > 0) {
      sections.sort((a, b) => (b[1].accuracy || 0) - (a[1].accuracy || 0));
      for (const [section, data] of sections) {
        const name = sectionNames[section] || section;
        const bar = generateBar(data.accuracy || 0);
        output += `${name}: ${bar} ${data.accuracy || 0}% (${data.questions} questions)\n`;
      }
    } else {
      output += 'No section data available\n';
    }
    output += '\n';

    output += '── STUDY PATTERNS ───────────────────────────────────────────────────────────\n';
    output += `Current Streak: ${report.current_streak} days\n`;
    output += `Longest Streak: ${report.longest_streak} days\n`;
    output += `Active Days: ${report.active_days}\n`;
    output += `First Activity: ${report.first_activity || 'N/A'}\n`;
    output += `Last Activity: ${report.last_activity || 'Never'}\n`;
    output += '\n';

    // Weakest & Strongest
    if (sections.length > 0) {
      const sorted = [...sections].sort((a, b) => (b[1].accuracy || 0) - (a[1].accuracy || 0));
      const strongest = sorted[0];
      const weakest = sorted[sorted.length - 1];

      if (strongest && strongest[1].questions > 0) {
        output += `STRONGEST: ${sectionNames[strongest[0]] || strongest[0]} (${strongest[1].accuracy}%)\n`;
      }
      if (weakest && weakest[1].questions > 0 && weakest[0] !== strongest?.[0]) {
        output += `NEEDS WORK: ${sectionNames[weakest[0]] || weakest[0]} (${weakest[1].accuracy}%)\n`;
      }
    }
    output += '\n';
  }

  return output;
}

function generateBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

// Run if called directly
if (typeof window !== 'undefined') {
  generateReports().then(reports => {
    const report = formatReport(reports);
    console.log(report);

    // Copy to clipboard or download
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  });
}

export { generateReports, formatReport };
export type { StudentReport };
