import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { authedFetch } from '../api/authedFetch';

interface ContentItem {
  id: number;
  test_type: string;
  section: string;
  question_type: string;
  title: string | null;
  difficulty: number;
  status: string;
  source: string;
}

export default function AdminContent() {
  const { user } = useAuthStore();
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [formTestType, setFormTestType] = useState('TOEFL_IBT');
  const [formSection, setFormSection] = useState('reading');
  const [formQuestionType, setFormQuestionType] = useState('multiple_choice');
  const [formTitle, setFormTitle] = useState('');
  const [formDifficulty, setFormDifficulty] = useState(3);
  const [formQuestion, setFormQuestion] = useState('');
  const [formOptions, setFormOptions] = useState('');
  const [formCorrect, setFormCorrect] = useState('');
  const [formPassage, setFormPassage] = useState('');

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    try {
      const res = await authedFetch('/api/admin/content/');
      if (res.ok) {
        setContents(await res.json());
      }
    } catch {
      // Demo data
      setContents([
        { id: 1, test_type: 'TOEFL_IBT', section: 'reading', question_type: 'multiple_choice', title: 'Sample Reading Question', difficulty: 3, status: 'published', source: 'curated' },
        { id: 2, test_type: 'TOEFL_IBT', section: 'writing', question_type: 'write_email', title: 'Email Writing Prompt', difficulty: 2, status: 'draft', source: 'curated' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const content: Record<string, unknown> = {
      question: formQuestion,
      correct_answer: formCorrect,
    };

    if (formPassage) content.passage = formPassage;
    if (formOptions) content.options = formOptions.split('\n').filter(Boolean);

    try {
      const res = await authedFetch('/api/admin/content/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_type: formTestType,
          section: formSection,
          question_type: formQuestionType,
          title: formTitle || null,
          content,
          difficulty: formDifficulty,
        }),
      });

      if (res.ok) {
        setShowCreate(false);
        loadContent();
      }
    } catch {
      alert('Failed to create content');
    }
  }

  if (user?.role === 'student') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <p className="text-tg-hint">This area is for teachers and admins only.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button"></div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Content Manager</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-tg-button text-tg-button-text px-4 py-2 rounded-lg text-sm font-medium"
        >
          {showCreate ? 'Cancel' : '+ New'}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-tg-secondary rounded-xl p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-tg-hint">Test Type</label>
              <select
                value={formTestType}
                onChange={(e) => setFormTestType(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg bg-tg-bg border border-tg-hint/20 text-sm"
              >
                <option value="TOEFL_IBT">TOEFL iBT</option>
                <option value="IELTS">IELTS</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-tg-hint">Section</label>
              <select
                value={formSection}
                onChange={(e) => setFormSection(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg bg-tg-bg border border-tg-hint/20 text-sm"
              >
                <option value="reading">Reading</option>
                <option value="listening">Listening</option>
                <option value="speaking">Speaking</option>
                <option value="writing">Writing</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-tg-hint">Question Type</label>
            <select
              value={formQuestionType}
              onChange={(e) => setFormQuestionType(e.target.value)}
              className="w-full mt-1 p-2 rounded-lg bg-tg-bg border border-tg-hint/20 text-sm"
            >
              <option value="multiple_choice">Multiple Choice</option>
              <option value="complete_the_words">Complete the Words</option>
              <option value="write_email">Write an Email</option>
              <option value="write_academic_discussion">Academic Discussion</option>
              <option value="build_sentence">Build a Sentence</option>
              <option value="listen_and_repeat">Listen and Repeat</option>
              <option value="take_interview">Interview</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-tg-hint">Title</label>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full mt-1 p-2 rounded-lg bg-tg-bg border border-tg-hint/20 text-sm"
              placeholder="Optional title"
            />
          </div>

          <div>
            <label className="text-xs text-tg-hint">Passage (for reading questions)</label>
            <textarea
              value={formPassage}
              onChange={(e) => setFormPassage(e.target.value)}
              className="w-full mt-1 p-2 rounded-lg bg-tg-bg border border-tg-hint/20 text-sm h-24 resize-none"
              placeholder="Reading passage text..."
            />
          </div>

          <div>
            <label className="text-xs text-tg-hint">Question / Prompt</label>
            <textarea
              value={formQuestion}
              onChange={(e) => setFormQuestion(e.target.value)}
              className="w-full mt-1 p-2 rounded-lg bg-tg-bg border border-tg-hint/20 text-sm h-16 resize-none"
              placeholder="Enter the question..."
            />
          </div>

          <div>
            <label className="text-xs text-tg-hint">Options (one per line, for MCQ)</label>
            <textarea
              value={formOptions}
              onChange={(e) => setFormOptions(e.target.value)}
              className="w-full mt-1 p-2 rounded-lg bg-tg-bg border border-tg-hint/20 text-sm h-20 resize-none"
              placeholder="A. Option 1&#10;B. Option 2&#10;C. Option 3&#10;D. Option 4"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-tg-hint">Correct Answer</label>
              <input
                value={formCorrect}
                onChange={(e) => setFormCorrect(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg bg-tg-bg border border-tg-hint/20 text-sm"
                placeholder="e.g. B"
              />
            </div>
            <div>
              <label className="text-xs text-tg-hint">Difficulty (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={formDifficulty}
                onChange={(e) => setFormDifficulty(Number(e.target.value))}
                className="w-full mt-1 p-2 rounded-lg bg-tg-bg border border-tg-hint/20 text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            className="w-full bg-tg-button text-tg-button-text py-2 rounded-lg font-medium"
          >
            Create Content
          </button>
        </div>
      )}

      {/* Content List */}
      <div className="space-y-2">
        {contents.map((item) => (
          <div key={item.id} className="bg-tg-secondary rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{item.title || `${item.question_type} #${item.id}`}</p>
              <p className="text-xs text-tg-hint">
                {item.test_type.replace('_', ' ')} / {item.section} / Difficulty: {item.difficulty}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                item.status === 'published'
                  ? 'bg-green-100 text-green-700'
                  : item.status === 'draft'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}

        {contents.length === 0 && (
          <p className="text-center text-tg-hint text-sm mt-8">
            No content yet. Click "+ New" to create your first question.
          </p>
        )}
      </div>
    </div>
  );
}
