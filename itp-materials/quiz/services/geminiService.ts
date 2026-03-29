
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Question, UserAnswers, GeminiFeedbackResponse } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable not found. Please set it up.");
  // In a real app, you might throw an error or handle this more gracefully
}

const ai = new GoogleGenAI({ apiKey: API_KEY! }); // Non-null assertion assuming API_KEY is set by environment

function formatQuestionsForPrompt(questions: Question[], userAnswers: UserAnswers): string {
  return questions.map((q, index) => {
    const userAnswer = userAnswers[q.id] || "Not Answered";
    let questionContext = q.questionText ? q.questionText : "Listening Question Choice Set (No audio, infer from options)";
    if (q.sectionId === 'listening-comprehension' && !q.questionText) {
        questionContext = `For this Listening Comprehension question (Question ${index + 1}), determine the most plausible correct answer from the options, assuming a typical TOEFL ITP short conversation.`;
    } else if (q.questionText) {
        questionContext = `Question ${index + 1}: ${q.questionText}`;
    }

    const optionsString = q.options.map(opt => `(${opt.id}) ${opt.text}`).join('\n');
    return `
${questionContext}
Options:
${optionsString}
User's Answer: ${userAnswer}
Question ID: ${q.id} 
`;
  }).join('\n---\n');
}

export async function getFeedbackFromGemini(
  questions: Question[],
  userAnswers: UserAnswers,
  sectionTitle: string,
  partTitle: string
): Promise<GeminiFeedbackResponse> {
  if (!API_KEY) {
    return Promise.reject(new Error("API Key for Gemini is not configured."));
  }

  const formattedQuestions = formatQuestionsForPrompt(questions, userAnswers);

  const prompt = `
You are a TOEFL ITP expert. The user has attempted questions from "${sectionTitle} - ${partTitle}".
For each question, provide:
1. The Question ID.
2. The user's answer.
3. The correct answer (A, B, C, or D).
4. A brief explanation for why that answer is correct.
5. If the user's answer was incorrect, briefly explain why their choice was wrong (this can be part of the main explanation).

Important: For Listening Comprehension questions where no audio script is provided, infer the most likely correct answer based on common TOEFL scenarios and the given options. Clearly state this assumption if necessary in your explanation.

Return your response as a JSON object with a single root key "feedback".
The "feedback" key should contain an array of objects. Each object must correspond to a question and have the following structure:
{
  "questionId": "string (e.g., LPA-1)",
  "userAnswer": "string (e.g., 'B')",
  "correctAnswer": "string (e.g., 'A')",
  "explanation": "string (explanation for the correct answer, and why user's might be wrong if applicable)"
}

Do NOT include any markdown formatting like \`\`\`json in your final JSON output. The output must be a valid JSON string ONLY.

Here are the questions and the user's answers:
${formattedQuestions}
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17', 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    let jsonStr = response.text.trim();
    // Gemini might sometimes wrap JSON in markdown, remove it.
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const parsedData = JSON.parse(jsonStr) as GeminiFeedbackResponse;
    if (!parsedData.feedback || !Array.isArray(parsedData.feedback)) {
        throw new Error("Invalid feedback structure received from Gemini.");
    }
    return parsedData;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Try to parse error if it's from Gemini
    if (error instanceof Error && error.message.includes("code")) { // Basic check for Gemini error format
        try {
            const errorObj = JSON.parse(error.message.substring(error.message.indexOf('{')));
            throw new Error(`Gemini API Error: ${errorObj.message || 'Unknown Gemini Error'}`);
        } catch (parseError) {
             throw new Error(`Failed to parse Gemini API error: ${error.message}`);
        }
    }
    throw new Error(`Failed to get feedback from Gemini. ${error instanceof Error ? error.message : String(error)}`);
  }
}
