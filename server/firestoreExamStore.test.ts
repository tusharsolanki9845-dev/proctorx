import { beforeEach, describe, expect, it, vi } from "vitest";

const getFirebaseFirestore = vi.hoisted(() => vi.fn());

vi.mock("./firebaseAdmin", () => ({ getFirebaseFirestore }));

import { createExam } from "./firestoreExamStore";

type Ref = {
  path: string;
  collection: (name: string) => Ref;
  doc: (id?: string) => Ref;
  add: ReturnType<typeof vi.fn>;
};

function createRef(path: string): Ref {
  return {
    path,
    collection: name => createRef(`${path}/${name}`),
    doc: id => createRef(id ? `${path}/${id}` : `${path}/generated`),
    add: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Firestore exam store identifier allocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reserves exam and question IDs before the first atomic exam write", async () => {
    const operations: string[] = [];
    const transaction = {
      get: vi.fn(async (ref: Ref) => {
        operations.push(`get:${ref.path}`);
        return { data: () => ({ exams: 9, questions: 42 }) };
      }),
      set: vi.fn((ref: Ref) => operations.push(`set:${ref.path}`)),
      create: vi.fn((ref: Ref) => operations.push(`create:${ref.path}`)),
    };
    const firestore = {
      collection: (name: string) => createRef(name),
      runTransaction: async (callback: (value: typeof transaction) => Promise<number>) => callback(transaction),
    };
    getFirebaseFirestore.mockReturnValue(firestore);

    await expect(createExam(3, {
      title: "Atomic Firestore paper",
      description: null,
      durationSeconds: 900,
      startsAt: null,
      endsAt: null,
      status: "draft",
      maxAttempts: 1,
      shuffleQuestions: false,
      releaseResultsImmediately: true,
      proctoringConfig: {},
      questions: [
        { prompt: "Question one", optionA: "A", optionB: "B", optionC: "C", optionD: "D", correctOption: "A", points: 1 },
        { prompt: "Question two", optionA: "A", optionB: "B", optionC: "C", optionD: "D", correctOption: "B", points: 1 },
      ],
    })).resolves.toEqual({ id: 10 });

    expect(operations).toEqual([
      "get:meta/counters",
      "set:meta/counters",
      "create:exams/10",
      "create:exams/10/questions/43",
      "create:exams/10/questions/44",
    ]);
  });
});
