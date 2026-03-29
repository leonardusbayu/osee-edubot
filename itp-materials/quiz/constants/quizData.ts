
import { SectionData } from '../types';

export const QUIZ_DATA: SectionData[] = [
  {
    id: 'listening-comprehension',
    title: 'Section 1: Listening Comprehension',
    instructions: [
      "This section tests your ability to comprehend spoken English. It is divided into three parts, each with its own directions. During actual exams, you are not permitted to turn the page during the reading of the directions or to take notes at any time.",
      "Section này kiểm tra khả năng hiểu văn nói tiếng Anh của bạn. Nó được chia thành ba phần, mỗi phần có hướng dẫn riêng. Trong bài thi thật, khi hướng dẫn đang được đọc trên băng, bạn không được phép lật trang hoặc ghi chú vào bất cứ lúc nào."
    ],
    parts: [
      {
        id: 'part-a',
        title: 'PART A',
        instructions: [
          "Directions: Each item in this part consists of a brief conversation involving two speakers. Following each conversation, a third voice will ask a question. You will hear the conversations and questions only once, and they will not be written out.",
          "When you have heard each conversation and question, read the four answer choices and select the one - (A), (B), (C), or (D) - that best answers the question based on what is directly stated or on what can be inferred.",
          "For this practice, assume you have heard the conversation and proceed to select the best answer."
        ],
        questions: [
          {
            id: 'LPA-1', sectionId: 'listening-comprehension', partId: 'part-a', questionNumber: 1,
            options: [
              { id: 'A', text: "He picked these strawberries himself." },
              { id: 'B', text: "He chose the freshest strawberries." },
              { id: 'C', text: "The strawberries were displayed outside Bailey's market." },
              { id: 'D', text: "The market had just sold the last strawberries." },
            ],
          },
          {
            id: 'LPA-2', sectionId: 'listening-comprehension', partId: 'part-a', questionNumber: 2,
            options: [
              { id: 'A', text: "He's the worst lecturer they've ever heard." },
              { id: 'B', text: "He gave one of his standard lectures." },
              { id: 'C', text: "His article was the worst they've ever read." },
              { id: 'D', text: "His lectures are generally better." },
            ],
          },
          {
            id: 'LPA-3', sectionId: 'listening-comprehension', partId: 'part-a', questionNumber: 3,
            options: [
              { id: 'A', text: "Ate breakfast quickly." },
              { id: 'B', text: "Came late to an appointment." },
              { id: 'C', text: "Skipped breakfast." },
              { id: 'D', text: "Waited in line." },
            ],
          },
          {
            id: 'LPA-4', sectionId: 'listening-comprehension', partId: 'part-a', questionNumber: 4,
            options: [
              { id: 'A', text: "What kind it is." },
              { id: 'B', text: "Where he bought it." },
              { id: 'C', text: "How much it cost." },
              { id: 'D', text: "What color it is." },
            ],
          },
          {
            id: 'LPA-5', sectionId: 'listening-comprehension', partId: 'part-a', questionNumber: 5,
            options: [
              { id: 'A', text: "She'd like to watch it, but she hasn't." },
              { id: 'B', text: "She didn't find it enjoyable." },
              { id: 'C', text: "She tried to understand it, but she couldn't." },
              { id: 'D', text: "She doesn't know when it comes on." },
            ],
          },
        ],
      }
    ],
  },
  {
    id: 'structure-written-expression',
    title: 'Section 2: Structure and Written Expression',
    instructions: [
      "TIME - 25 MINUTES",
      "This section tests your ability to recognize grammar and usage suitable for standard written English. It is divided into two parts, each with its own directions."
    ],
    parts: [
      {
        id: 'structure',
        title: 'STRUCTURE',
        instructions: [
          "Directions: Items in this part are incomplete sentences. Following each of these sentences, there are four words or phrases. You should select the one word or phrase - (A), (B), (C), or (D) - that best completes the sentence."
        ],
        questions: [
          {
            id: 'S-1', sectionId: 'structure-written-expression', partId: 'structure', questionNumber: 1,
            questionText: "Indian summer is a period of mild weather ______ the autumn.",
            options: [
              { id: 'A', text: "occurs" },
              { id: 'B', text: "occurring" },
              { id: 'C', text: "it occurs" },
              { id: 'D', text: "is occurring" },
            ],
          },
          {
            id: 'S-2', sectionId: 'structure-written-expression', partId: 'structure', questionNumber: 2,
            questionText: "Bacteria may be round, ______ or spiral.",
            options: [
              { id: 'A', text: "rod shapes" },
              { id: 'B', text: "in the shape of rods" },
              { id: 'C', text: "like a rod's shape" },
              { id: 'D', text: "rod-shaped" },
            ],
          },
          {
            id: 'S-3', sectionId: 'structure-written-expression', partId: 'structure', questionNumber: 3,
            questionText: "______ of his childhood home in Hannibal, Missouri, provided Mark Twain with the inspiration for two of his most popular novels.",
            options: [
              { id: 'A', text: "Remembering" },
              { id: 'B', text: "Memories" },
              { id: 'C', text: "It was the memories" },
              { id: 'D', text: "He remembered" },
            ],
          },
          {
            id: 'S-4', sectionId: 'structure-written-expression', partId: 'structure', questionNumber: 4,
            questionText: "Most of the spices and many of the herbs ______ today originate from plants native to tropical regions.",
            options: [
              { id: 'A', text: "using" },
              { id: 'B', text: "use of" },
              { id: 'C', text: "in use" },
              { id: 'D', text: "are used" },
            ],
          },
           {
            id: 'S-5', sectionId: 'structure-written-expression', partId: 'structure', questionNumber: 5,
            questionText: "______ many improvements made to highways during the nineteenth century, but Americans continued to depend on water routes for transportation.",
            options: [
              { id: 'A', text: "Despite the" },
              { id: 'B', text: "There were" },
              { id: 'C', text: "However" },
              { id: 'D', text: "Though there were" },
            ],
          },
        ],
      }
    ],
  }
];
