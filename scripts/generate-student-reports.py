#!/usr/bin/env python3
"""
Student Legacy Report Generator

Generates comprehensive reports for all students based on historical data.

Usage:
    python scripts/generate-student-reports.py

Requirements:
    pip install requests tabulate

Output:
    - Console: Formatted report for all students
    - CSV: reports/student_report_YYYY-MM-DD.csv
"""

import json
import csv
import os
from datetime import datetime, timedelta
from typing import Optional
import requests

# Configuration
WORKER_URL = "https://edubot-api.edubot-leonardus.workers.dev"
ADMIN_SECRET = "bayuganteng"

HEADERS = {
    "x-admin-secret": ADMIN_SECRET,
    "Content-Type": "application/json"
}

def get_all_students() -> list:
    """Fetch all students via API."""
    response = requests.get(
        f"{WORKER_URL}/api/classes/all/students",
        headers=HEADERS
    )
    response.raise_for_status()
    return response.json()

def get_student_analytics(user_id: int) -> Optional[dict]:
    """Fetch detailed analytics for a student."""
    try:
        response = requests.get(
            f"{WORKER_URL}/api/analytics/student/{user_id}",
            headers=HEADERS,
            timeout=30
        )
        if response.ok:
            return response.json()
        return None
    except Exception as e:
        print(f"  [!] Error fetching analytics for user {user_id}: {e}")
        return None

def get_activity_status(last_study_date) -> str:
    """Determine activity status based on last study date."""
    if not last_study_date:
        return "🔴 Very Cold"
    
    try:
        last_date = datetime.fromisoformat(last_study_date.replace('Z', '+00:00'))
        days_since = (datetime.now(last_date.tzinfo) - last_date).days
        
        if days_since <= 3:
            return "🟢 Active"
        elif days_since <= 7:
            return "🟡 Cold"
        else:
            return "🔴 Very Cold"
    except:
        return "🔴 Unknown"

def generate_bar(percentage: float, width: int = 15) -> str:
    """Generate a text progress bar."""
    filled = int((percentage / 100) * width)
    empty = width - filled
    return "█" * filled + "░" * empty

def format_section_name(section: str) -> str:
    """Format section name for display."""
    names = {
        "reading": "Reading",
        "listening": "Listening", 
        "speaking": "Speaking",
        "writing": "Writing",
        "structure": "Structure",
    }
    return names.get(section, section.replace("_", " ").title())

def generate_console_report(students: list, analytics_data: dict) -> str:
    """Generate formatted console report."""
    lines = []
    
    # Header
    lines.append("=" * 80)
    lines.append("                    EDUBOT STUDENT LEGACY REPORT")
    lines.append("=" * 80)
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"Total Students: {len(students)}")
    lines.append("")
    
    # System overview
    total_questions = sum(a.get("total_questions", 0) or 0 for a in analytics_data.values())
    total_correct = sum(a.get("total_correct", 0) or 0 for a in analytics_data.values())
    active_count = sum(1 for s in students if get_activity_status(s.get("last_study_date")).startswith("🟢"))
    premium_count = sum(1 for s in students if s.get("is_premium"))
    
    lines.append("─" * 80)
    lines.append("SYSTEM OVERVIEW")
    lines.append("─" * 80)
    lines.append(f"Total Questions Answered: {total_questions:,}")
    lines.append(f"Total Correct Answers: {total_correct:,}")
    lines.append(f"Overall System Accuracy: {round((total_correct / total_questions * 100), 1) if total_questions > 0 else 0}%")
    lines.append(f"Active Students (3 days): {active_count}")
    cold = sum(1 for s in students if get_activity_status(s.get('last_study_date')).startswith('🟡'))
    very_cold = sum(1 for s in students if get_activity_status(s.get('last_study_date')).startswith('🔴'))
    lines.append(f"Cold Students (4-7 days): {cold}")
    lines.append(f"Very Cold Students (7+ days): {very_cold}")
    lines.append(f"Premium Students: {premium_count}")
    lines.append("")
    
    # Per-student reports
    for i, student in enumerate(students):
        user_id = student["id"]
        analytics = analytics_data.get(user_id, {})
        
        # Status
        status = get_activity_status(student.get("last_study_date"))
        premium = "⭐" if student.get("is_premium") else ""
        
        lines.append("=" * 80)
        lines.append(f"{status} {student.get('name', 'Unknown')} (ID: {user_id}) {premium}")
        lines.append("-" * 80)
        
        # Contact info
        if student.get("username"):
            lines.append(f"Username: @{student['username']}")
        lines.append(f"Target Test: {student.get('target_test') or 'Not set'}")
        lines.append(f"Proficiency Level: {student.get('proficiency_level') or 'Not set'}")
        lines.append(f"Member Since: {student.get('created_at', 'Unknown')[:10]}")
        lines.append("")
        
        # Performance
        total_q = analytics.get("total_questions", 0) or 0
        total_c = analytics.get("total_correct", 0) or 0
        accuracy = analytics.get("overall_accuracy", 0) or 0
        
        lines.append("PERFORMANCE")
        lines.append(f"  Total Questions:    {total_q:,}")
        lines.append(f"  Correct Answers:   {total_c:,}")
        lines.append(f"  Overall Accuracy:  {accuracy}%")
        lines.append(f"  Tests Completed:   {analytics.get('tests_completed', 0) or 0}")
        lines.append(f"  Sessions:          {analytics.get('total_sessions', 0) or 0}")
        lines.append("")
        
        # Section breakdown
        section_acc = analytics.get("section_accuracy", {})
        if section_acc:
            lines.append("SECTION ACCURACY")
            # Sort by accuracy
            sorted_sections = sorted(
                [(s, d) for s, d in section_acc.items() if d > 0],
                key=lambda x: x[1],
                reverse=True
            )
            for section, pct in sorted_sections:
                bar = generate_bar(pct)
                lines.append(f"  {format_section_name(section):20} {bar} {pct}%")
            lines.append("")
        
        # Study patterns
        lines.append("STUDY PATTERNS")
        lines.append(f"  Current Streak:    {analytics.get('current_streak', 0) or 0} days")
        lines.append(f"  Longest Streak:     {analytics.get('longest_streak', 0) or 0} days")
        
        study_tend = analytics.get("study_tendency", {})
        if study_tend:
            lines.append(f"  Preferred Time:     {study_tend.get('preferred_time', 'N/A')}")
            lines.append(f"  Most Active Day:   {study_tend.get('most_active_day', 'N/A')}")
            lines.append(f"  Weekly Frequency:   {study_tend.get('weekly_frequency', 0)}x/week")
            lines.append(f"  Avg Session:       {study_tend.get('avg_session_minutes', 0)} min")
        
        daily_logs = analytics.get("daily_logs", [])
        if daily_logs:
            dates = [d.get("date") for d in daily_logs if d.get("date")]
            if dates:
                lines.append(f"  First Activity:     {min(dates)}")
                lines.append(f"  Last Activity:      {max(dates)}")
        
        lines.append("")
        
        # Diagnostic
        diag = analytics.get("diagnostic")
        if diag:
            lines.append("DIAGNOSTIC RESULTS")
            if diag.get("estimated_band"):
                lines.append(f"  Est. Band Score:    {diag['estimated_band']}")
            if diag.get("grammar"):
                lines.append(f"  Grammar:            {diag['grammar']['score']}/{diag['grammar']['total']}")
            if diag.get("reading"):
                lines.append(f"  Reading:            {diag['reading']['score']}/{diag['reading']['total']}")
            if diag.get("listening"):
                lines.append(f"  Listening:         {diag['listening']['score']}/{diag['listening']['total']}")
            lines.append("")
        
        # Strengths & weaknesses
        if section_acc:
            sorted_sections = sorted(section_acc.items(), key=lambda x: x[1] or 0)
            weakest = sorted_sections[0] if sorted_sections else None
            strongest = sorted_sections[-1] if sorted_sections else None
            
            if weakest and weakest[1] > 0:
                lines.append(f"  ⚠️ Needs Work:      {format_section_name(weakest[0])} ({weakest[1]}%)")
            if strongest and strongest[1] > 0 and strongest[0] != weakest[0]:
                lines.append(f"  ⭐ Strongest:       {format_section_name(strongest[0])} ({strongest[1]}%)")
        
        lines.append("")
    
    return "\n".join(lines)

def generate_csv_report(students: list, analytics_data: dict, filename: str):
    """Generate CSV report."""
    fieldnames = [
        "id", "name", "username", "target_test", "proficiency_level",
        "is_premium", "created_at", "last_study_date", "status",
        "total_questions", "total_correct", "overall_accuracy",
        "tests_completed", "total_sessions", "current_streak", "longest_streak",
        "preferred_time", "most_active_day", "weekly_frequency",
        "reading_accuracy", "listening_accuracy", "speaking_accuracy", "writing_accuracy", "structure_accuracy",
        "estimated_band", "percentile_rank"
    ]
    
    rows = []
    for student in students:
        user_id = student["id"]
        analytics = analytics_data.get(user_id, {})
        study_tend = analytics.get("study_tendency", {})
        section_acc = analytics.get("section_accuracy", {})
        diag = analytics.get("diagnostic", {})
        
        rows.append({
            "id": user_id,
            "name": student.get("name", ""),
            "username": student.get("username") or "",
            "target_test": student.get("target_test") or "",
            "proficiency_level": student.get("proficiency_level") or "",
            "is_premium": "Yes" if student.get("is_premium") else "No",
            "created_at": student.get("created_at", "")[:10],
            "last_study_date": student.get("last_study_date") or "Never",
            "status": get_activity_status(student.get("last_study_date")),
            "total_questions": analytics.get("total_questions", 0) or 0,
            "total_correct": analytics.get("total_correct", 0) or 0,
            "overall_accuracy": analytics.get("overall_accuracy", 0) or 0,
            "tests_completed": analytics.get("tests_completed", 0) or 0,
            "total_sessions": analytics.get("total_sessions", 0) or 0,
            "current_streak": analytics.get("current_streak", 0) or 0,
            "longest_streak": analytics.get("longest_streak", 0) or 0,
            "preferred_time": study_tend.get("preferred_time", ""),
            "most_active_day": study_tend.get("most_active_day", ""),
            "weekly_frequency": study_tend.get("weekly_frequency", 0),
            "reading_accuracy": section_acc.get("reading", 0) or 0,
            "listening_accuracy": section_acc.get("listening", 0) or 0,
            "speaking_accuracy": section_acc.get("speaking", 0) or 0,
            "writing_accuracy": section_acc.get("writing", 0) or 0,
            "structure_accuracy": section_acc.get("structure", 0) or 0,
            "estimated_band": (diag.get("estimated_band") if diag else None) or "",
            "percentile_rank": analytics.get("percentile", "")
        })
    
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"CSV report saved to: {filename}")

def main():
    # Set UTF-8 encoding for output
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    
    print("Fetching all students...")
    students = get_all_students()
    print(f"Found {len(students)} students")
    
    # Fetch analytics for each student
    analytics_data = {}
    print("\nFetching analytics for each student...")
    for i, student in enumerate(students):
        user_id = student["id"]
        print(f"  [{i+1}/{len(students)}] Processing {student.get('name', 'Unknown')} (ID: {user_id})...")
        analytics = get_student_analytics(user_id)
        if analytics:
            analytics_data[user_id] = analytics
    
    # Generate reports
    print("\n" + "=" * 80)
    print("GENERATING CONSOLE REPORT")
    print("=" * 80 + "\n")
    
    console_report = generate_console_report(students, analytics_data)
    
    # Generate CSV
    os.makedirs("reports", exist_ok=True)
    csv_filename = f"reports/student_report_{datetime.now().strftime('%Y-%m-%d')}.csv"
    generate_csv_report(students, analytics_data, csv_filename)
    
    # Also save console report
    txt_filename = f"reports/student_report_{datetime.now().strftime('%Y-%m-%d')}.txt"
    with open(txt_filename, "w", encoding="utf-8") as f:
        f.write(console_report)
    print(f"\nText report saved to: {txt_filename}")
    print(f"CSV report saved to: {csv_filename}")
    
    # Print summary to console (without emojis)
    print("\n" + "=" * 80)
    print("STUDENT SUMMARY (sorted by name)")
    print("=" * 80)
    for student in sorted(students, key=lambda s: s.get('name', '')):
        user_id = student["id"]
        analytics = analytics_data.get(user_id, {})
        total_q = analytics.get("total_questions", 0) or 0
        accuracy = analytics.get("overall_accuracy", 0) or 0
        status = get_activity_status(student.get("last_study_date"))
        status_clean = status.replace("🟢", "[ACTIVE]").replace("🟡", "[COLD]").replace("🔴", "[VERY COLD]")
        print(f"  {student.get('name', 'Unknown'):25} | {total_q:6} Q | {accuracy:5}% | {status_clean}")

if __name__ == "__main__":
    main()
