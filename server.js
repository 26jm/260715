const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PUBLIC_DIR = __dirname;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
  };

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": typeMap[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: "File not found" });
  }
}

function buildPrompt(memos) {
  const memoText = memos
    .map(
      (memo, index) =>
        `${index + 1}. 날짜: ${memo.date}\n학생: ${memo.studentName}\n진도: ${memo.progress}\n메모: ${memo.memo}`
    )
    .join("\n\n");

  return [
    "You are an expert private tutor assistant.",
    "Analyze the following tutoring notes and return ONLY valid JSON that matches the schema.",
    "Write in Korean.",
    "Student message should feel warm and encouraging.",
    "Parent report should be professional, data-focused, and concise.",
    "Practice items should target weaknesses from the notes and include explanations.",
    "",
    memoText,
  ].join("\n");
}

function buildRequestBody(memos) {
  return {
    model: "gpt-4o-mini",
    input: buildPrompt(memos),
    text: {
      format: {
        type: "json_schema",
        name: "tutoring_helper_output",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            student_message: {
              type: "string",
              description: "학생에게 보내는 친근하고 격려하는 카톡 메시지",
            },
            parent_report: {
              type: "string",
              description: "학부모에게 보내는 정중하고 전문적인 정기 리포트",
            },
            next_class_practice: {
              type: "array",
              minItems: 6,
              maxItems: 10,
              description: "다음 수업에서 사용할 유사 문제와 상세 해설",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                },
                required: ["question", "answer"],
              },
            },
          },
          required: ["student_message", "parent_report", "next_class_practice"],
        },
      },
    },
  };
}

async function readJson(req) {
  return await new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/generate") {
    if (!OPENAI_API_KEY) {
      return sendJson(res, 500, { error: "OPENAI_API_KEY가 설정되지 않았습니다." });
    }

    try {
      const { memos } = await readJson(req);

      if (!Array.isArray(memos) || memos.length === 0) {
        return sendJson(res, 400, { error: "선택된 메모가 없습니다." });
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(buildRequestBody(memos)),
      });

      const data = await response.json();

      if (!response.ok) {
        return sendJson(res, response.status, {
          error: data.error?.message || "OpenAI API 요청 실패",
          raw: data,
        });
      }

      const parsed =
        safeJsonParse(data.output_text) ||
        safeJsonParse(data.output?.[0]?.content?.[0]?.text) ||
        null;

      if (!parsed) {
        return sendJson(res, 500, {
          error: "OpenAI 응답에서 JSON을 읽지 못했습니다.",
          raw: data,
        });
      }

      return sendJson(res, 200, parsed);
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(PUBLIC_DIR, requestPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Tutor helper server running at http://localhost:${PORT}`);
});
