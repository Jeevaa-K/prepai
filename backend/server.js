"use strict";
require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");
const path      = require("path");
const { Langfuse } = require("langfuse");

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── Langfuse ────────────────────────────────────────────── */
const langfuse = new Langfuse({
  publicKey : process.env.LANGFUSE_PUBLIC_KEY,
  secretKey : process.env.LANGFUSE_SECRET_KEY,
  baseUrl   : process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
});

/* ── Middleware ──────────────────────────────────────────── */
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, max: 120 }));

/* ── Groq helper ─────────────────────────────────────────── */
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function groq(messages, maxTokens = 2048) {
  if (!process.env.GROQ_API_KEY)
    throw new Error("GROQ_API_KEY is not set in your .env file.");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method  : "POST",
    headers : {
      "Content-Type": "application/json",
      Authorization : `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: GROQ_MODEL, max_tokens: maxTokens, messages }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Groq HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

function cleanJSON(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const obj = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return obj ? obj[1].trim() : text.trim();
}

/* ── Roles ───────────────────────────────────────────────── */
const ROLES = {
  "Software Engineer"         : "software engineering, coding, system design, algorithms, data structures, OOP, concurrency",
  "Product Manager"           : "product strategy, roadmaps, OKRs, stakeholder management, prioritisation frameworks, user research",
  "Data Scientist"            : "machine learning, statistics, A/B testing, Python/R, experiment design, data storytelling",
  "UX Designer"               : "user research, design thinking, Figma, usability testing, information architecture, visual design",
  "Marketing Manager"         : "go-to-market strategy, brand positioning, paid/organic channels, campaign analytics, CRO",
  "DevOps Engineer"           : "CI/CD, Docker, Kubernetes, Terraform, cloud infrastructure, monitoring, incident response",
  "Business Analyst"          : "requirements gathering, process modelling, SQL, stakeholder communication, change management",
  "Data Engineer"             : "ETL pipelines, Spark, Airflow, data warehousing, Kafka, dbt, cloud data platforms",
  "Frontend Developer"        : "React, TypeScript, performance optimisation, accessibility, CSS architecture, browser APIs",
  "Backend Developer"         : "REST/GraphQL API design, databases, microservices, security, scalability, caching",
  "Machine Learning Engineer" : "model training & deployment, MLOps, feature stores, monitoring, distributed training",
  "Project Manager"           : "agile/scrum, risk management, resource planning, RACI, delivery execution, stakeholder alignment",
};

/* ── Health ──────────────────────────────────────────────── */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", model: GROQ_MODEL, timestamp: new Date().toISOString() });
});

/* ── Roles list ──────────────────────────────────────────── */
app.get("/api/roles", (_req, res) => {
  res.json({ roles: Object.keys(ROLES) });
});

/* ── Generate questions ──────────────────────────────────── */
app.post("/api/generate-questions", async (req, res) => {
  const { role, difficulty = "mid-level", count = 5 } = req.body;
  if (!role || !ROLES[role])
    return res.status(400).json({ error: "Invalid or missing role." });

  const n = Math.min(Math.max(parseInt(count) || 5, 3), 10);

  const prompt = `
You are a senior interviewer at a top-tier company running a ${difficulty} interview for a ${role}.
Generate exactly ${n} high-quality, realistic interview questions on: ${ROLES[role]}.
Include this distribution:
- 2 behavioral questions (expecting STAR method answers)
- 2 technical / domain-specific questions
- 1 situational / problem-solving question
Return ONLY a JSON array – no markdown, no commentary:
[
  {
    "id": 1,
    "question": "<full interview question>",
    "type": "behavioral | technical | situational",
    "category": "<2-3 word topic label>",
    "hint": "<one sentence describing what an excellent answer must cover>",
    "timeGuide": "<suggested answer duration, e.g. 2-3 minutes>"
  }
]`.trim();

  const trace = langfuse.trace({
    name    : "generate-questions",
    input   : { role, difficulty, count: n },
    metadata: { model: GROQ_MODEL },
  });

  try {
    const span = trace.span({ name: "groq-generate-questions", input: { prompt } });
    const raw  = await groq([{ role: "user", content: prompt }]);
    span.end({ output: raw });

    const data = JSON.parse(cleanJSON(raw));
    trace.update({ output: data, metadata: { questionCount: data.length } });
    await langfuse.flushAsync();

    res.json({ role, difficulty, count: data.length, questions: data });
  } catch (e) {
    trace.update({ metadata: { error: e.message } });
    await langfuse.flushAsync();
    console.error("[generate-questions]", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* ── Analyse answer ──────────────────────────────────────── */
app.post("/api/analyze-answer", async (req, res) => {
  const { role, question, questionType, answer } = req.body;
  if (!role || !question || !answer)
    return res.status(400).json({ error: "`role`, `question` and `answer` are required." });
  if (answer.trim().length < 15)
    return res.status(400).json({ error: "Please write at least a few sentences first." });

  const prompt = `
You are a senior hiring manager at a top-tier company evaluating a ${role} candidate's interview answer.
QUESTION (${questionType || "general"}):
"${question}"
CANDIDATE'S ANSWER:
"${answer}"
Provide a rigorous, honest, constructive evaluation. Return ONLY valid JSON – no markdown:
{
  "overallScore": <integer 0–100>,
  "verdict"     : "Exceptional" | "Strong" | "Good" | "Needs Work" | "Poor",
  "summary"     : "<2 concise sentences summarising overall performance>",
  "scores": {
    "clarity"  : { "score": <0–100>, "label": "Clarity & Communication",  "feedback": "<specific feedback>" },
    "depth"    : { "score": <0–100>, "label": "Depth & Technical Detail", "feedback": "<specific feedback>" },
    "relevance": { "score": <0–100>, "label": "Relevance & Focus",        "feedback": "<specific feedback>" },
    "structure": { "score": <0–100>, "label": "Structure & Flow",         "feedback": "<specific feedback>" }
  },
  "strengths"   : ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "modelAnswer" : "<3-4 sentence model answer>",
  "keywords"    : ["<keyword 1>", "<keyword 2>", "<keyword 3>"]
}`.trim();

  const trace = langfuse.trace({
    name    : "analyze-answer",
    input   : { role, question, questionType, answerLength: answer.length },
    metadata: { model: GROQ_MODEL },
  });

  try {
    const span = trace.span({ name: "groq-analyze-answer", input: { prompt } });
    const raw  = await groq([{ role: "user", content: prompt }]);
    span.end({ output: raw });

    const data = JSON.parse(cleanJSON(raw));
    trace.update({
      output  : data,
      metadata: { overallScore: data.overallScore, verdict: data.verdict },
    });
    await langfuse.flushAsync();

    res.json(data);
  } catch (e) {
    trace.update({ metadata: { error: e.message } });
    await langfuse.flushAsync();
    console.error("[analyze-answer]", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* ── Follow-up ───────────────────────────────────────────── */
app.post("/api/followup", async (req, res) => {
  const { role, question, answer } = req.body;
  if (!role || !question || !answer)
    return res.status(400).json({ error: "`role`, `question` and `answer` are required." });

  const prompt = `
You are interviewing a ${role} candidate.
Original question: "${question}"
Their answer: "${answer}"
Generate ONE sharp follow-up question. Return ONLY the question text.`.trim();

  const trace = langfuse.trace({
    name : "followup-question",
    input: { role, question },
  });

  try {
    const span     = trace.span({ name: "groq-followup", input: { prompt } });
    const followUp = await groq([{ role: "user", content: prompt }], 200);
    span.end({ output: followUp });
    trace.update({ output: followUp });
    await langfuse.flushAsync();

    res.json({ followUp });
  } catch (e) {
    trace.update({ metadata: { error: e.message } });
    await langfuse.flushAsync();
    console.error("[followup]", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* ── Start ───────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║    PrepAI  –  Interview Prep API     ║");
  console.log("╠══════════════════════════════════════╣");
  console.log(`║  Running  →  http://localhost:${PORT}   ║`);
  console.log(`║  Model    →  ${GROQ_MODEL}  ║`);
  console.log("║  Langfuse →  connected               ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`  Open → http://localhost:${PORT}\n`);
});