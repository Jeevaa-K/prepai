"use strict";
require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 3001;

/* ─────────────────────────────────────────── Middleware ── */
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "20kb" }));
app.use(
  "/api/",
  rateLimit({
    windowMs : 15 * 60 * 1000,
    max      : 120,
    message  : { error: "Too many requests – please wait a moment." },
  })
);

/* ─────────────────────────────────────────── Groq helper ── */
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function groq(messages, maxTokens = 2048) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set in your .env file.");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method  : "POST",
    headers : {
      "Content-Type" : "application/json",
      Authorization  : `Bearer ${process.env.GROQ_API_KEY}`,
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

/* Strip markdown fences so JSON.parse never fails on ```json blocks */
function cleanJSON(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const obj = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return obj ? obj[1].trim() : text.trim();
}

/* ─────────────────────────────────────────── Role catalogue ── */
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

/* ─────────────────────────────────── Routes ── */

/* Health */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", model: GROQ_MODEL, timestamp: new Date().toISOString() });
});

/* Roles list */
app.get("/api/roles", (_req, res) => {
  res.json({ roles: Object.keys(ROLES) });
});

/* Generate interview questions */
app.post("/api/generate-questions", async (req, res) => {
  const { role, difficulty = "mid-level", count = 5 } = req.body;

  if (!role || !ROLES[role])
    return res.status(400).json({ error: "Invalid or missing `role`." });

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
    "timeGuide": "<suggested answer duration, e.g. '2-3 minutes'>"
  }
]`.trim();

  try {
    const raw  = await groq([{ role: "user", content: prompt }]);
    const data = JSON.parse(cleanJSON(raw));
    res.json({ role, difficulty, count: data.length, questions: data });
  } catch (e) {
    console.error("[generate-questions]", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* Analyse a candidate's answer */
app.post("/api/analyze-answer", async (req, res) => {
  const { role, question, questionType, answer } = req.body;

  if (!role || !question || !answer)
    return res.status(400).json({ error: "`role`, `question` and `answer` are required." });
  if (answer.trim().length < 15)
    return res.status(400).json({ error: "Answer is too short to evaluate." });

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
    "clarity"  : { "score": <0–100>, "label": "Clarity & Communication",  "feedback": "<specific, actionable feedback>" },
    "depth"    : { "score": <0–100>, "label": "Depth & Technical Detail", "feedback": "<specific, actionable feedback>" },
    "relevance": { "score": <0–100>, "label": "Relevance & Focus",        "feedback": "<specific, actionable feedback>" },
    "structure": { "score": <0–100>, "label": "Structure & Flow",         "feedback": "<specific, actionable feedback>" }
  },
  "strengths"   : ["<concrete strength 1>", "<concrete strength 2>"],
  "improvements": ["<actionable improvement 1>", "<actionable improvement 2>", "<actionable improvement 3>"],
  "modelAnswer" : "<A crisp 3-4 sentence model answer showcasing best-in-class response>",
  "keywords"    : ["<important term or concept the candidate should have used>"]
}`.trim();

  try {
    const raw  = await groq([{ role: "user", content: prompt }]);
    const data = JSON.parse(cleanJSON(raw));
    res.json(data);
  } catch (e) {
    console.error("[analyze-answer]", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* Generate a follow-up probe */
app.post("/api/followup", async (req, res) => {
  const { role, question, answer } = req.body;
  if (!role || !question || !answer)
    return res.status(400).json({ error: "`role`, `question` and `answer` are required." });

  const prompt = `
You are interviewing a ${role} candidate.
Original question: "${question}"
Their answer: "${answer}"
Generate ONE sharp, probing follow-up question that exposes a gap or pushes for deeper insight.
Return ONLY the question text.`.trim();

  try {
    const followUp = await groq([{ role: "user", content: prompt }], 200);
    res.json({ followUp });
  } catch (e) {
    console.error("[followup]", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────── Start server ── */
app.listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║    PrepAI  –  Interview Prep API     ║");
  console.log("╠══════════════════════════════════════╣");
  console.log(`║  Running  →  http://localhost:${PORT}   ║`);
  console.log(`║  Model    →  ${GROQ_MODEL}  ║`);
  console.log("╚══════════════════════════════════════╝\n");
});
