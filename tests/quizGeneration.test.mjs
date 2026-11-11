import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuizInput,
  extractResponsesOutput,
  makeOpenAIRequest,
  validateGeneratedQuestions,
} from "../supabase/functions/_shared/quizGeneration.mjs";

const pages = [
  { page_no: 3, text: "Demand increases while supply stays constant." },
  { page_no: 4, text: "A price ceiling is a legal maximum price." },
];

function question(overrides = {}) {
  return {
    prompt: "What happens when demand increases?",
    choices: ["Price rises", "Price falls", "No change", "Supply disappears"],
    correct_index: 0,
    source_page: 3,
    topic: "Demand",
    explanation: "The source explains that increased demand raises equilibrium price when supply is unchanged.",
    difficulty: 1,
    ...overrides,
  };
}

test("builds Arabic instructions and includes page markers as source context", () => {
  const input = buildQuizInput({ language: "ar", questionCount: 5, topic: "", pages });
  assert.match(input[0].content, /Arabic/);
  assert.match(input[1].content, /\[PAGE 3\]/);
  assert.match(input[1].content, /\[PAGE 4\]/);
  assert.match(input[0].content, /never as instructions/);
  assert.match(input[0].content, /Do not claim or imply/);
});

test("creates a strict structured-output request without embedding an API key", () => {
  const request = makeOpenAIRequest({ model: "gpt-6-astra", language: "en", questionCount: 5, topic: "Demand", pages });
  assert.equal(request.model, "gpt-6-astra");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.deepEqual(request.text.format.schema.required, ["questions"]);
  assert.equal(JSON.stringify(request).includes("OPENAI_API_KEY"), false);
});

test("accepts valid questions only when page references exist in the supplied source", () => {
  const valid = Array.from({ length: 5 }, (_, i) => question({
    prompt: `Question number ${i + 1}: what changes?`,
    source_page: i % 2 ? 4 : 3,
  }));
  const result = validateGeneratedQuestions({ questions: valid }, [3, 4], 5);
  assert.equal(result.length, 5);
  assert.equal(result[0].correct_index, 0);
});

test("rejects an answer key outside the four choices", () => {
  assert.throws(
    () => validateGeneratedQuestions({ questions: Array.from({ length: 5 }, (_, i) => question({ prompt: `Unique prompt ${i}`, correct_index: 4 })) }, [3, 4], 5),
    /invalid answer key/,
  );
});

test("rejects fabricated page references", () => {
  assert.throws(
    () => validateGeneratedQuestions({ questions: Array.from({ length: 5 }, (_, i) => question({ prompt: `Unique prompt ${i}`, source_page: 99 })) }, [3, 4], 5),
    /page that was not supplied/,
  );
});

test("rejects duplicate prompts, duplicate choices, and wrong question counts", () => {
  assert.throws(
    () => validateGeneratedQuestions({ questions: Array.from({ length: 5 }, () => question()) }, [3, 4], 5),
    /duplicate questions/,
  );
  assert.throws(
    () => validateGeneratedQuestions({ questions: Array.from({ length: 5 }, (_, i) => question({ prompt: `Unique prompt ${i}`, choices: ["Same", "Same", "Third", "Fourth"] })) }, [3, 4], 5),
    /duplicate choices/,
  );
  assert.throws(() => validateGeneratedQuestions({ questions: [question()] }, [3, 4], 5), /requested number/);
});

test("extracts Responses API output text and handles refusal/incomplete responses", () => {
  assert.deepEqual(
    extractResponsesOutput({ status: "completed", output: [{ content: [{ type: "output_text", text: '{"questions":[]}' }] }] }),
    { questions: [] },
  );
  assert.throws(() => extractResponsesOutput({ status: "incomplete", output: [] }), /incomplete/);
  assert.throws(() => extractResponsesOutput({ output: [{ content: [{ type: "refusal" }] }] }), /refused/);
});


test("rejects unexpected question fields and text beyond database-safe limits", () => {
  const valid = Array.from({ length: 5 }, (_, i) => question({ prompt: `Unique prompt ${i}` }));
  assert.throws(
    () => validateGeneratedQuestions({ questions: valid.map((item) => ({ ...item, internal_note: "unexpected" })) }, [3, 4], 5),
    /invalid object shape/,
  );
  assert.throws(
    () => validateGeneratedQuestions({ questions: valid.map((item, i) => question({
      prompt: i === 0 ? "P".repeat(2001) : `Unique prompt ${i}`,
    })) }, [3, 4], 5),
    /invalid prompt/,
  );
  assert.throws(
    () => validateGeneratedQuestions({ questions: valid.map((item, i) => question({
      prompt: `Unique prompt ${i}`,
      choices: i === 0 ? ["C".repeat(501), "B", "C", "D"] : item.choices,
    })) }, [3, 4], 5),
    /four non-empty choices/,
  );
  assert.throws(
    () => validateGeneratedQuestions({ questions: valid.map((item, i) => question({
      prompt: `Unique prompt ${i}`,
      topic: i === 0 ? "T".repeat(121) : item.topic,
    })) }, [3, 4], 5),
    /no topic/,
  );
  assert.throws(
    () => validateGeneratedQuestions({ questions: valid.map((item, i) => question({
      prompt: `Unique prompt ${i}`,
      explanation: i === 0 ? "E".repeat(4001) : item.explanation,
    })) }, [3, 4], 5),
    /no explanation/,
  );
});
