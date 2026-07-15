export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });
    return;
  }

  try {
    const { memos } = req.body || {};

    if (!Array.isArray(memos) || memos.length === 0) {
      res.status(400).json({ error: "선택된 메모가 없습니다." });
      return;
    }

    const prompt = memos
      .map(
        (memo, index) =>
          `${index + 1}. 날짜: ${memo.date}\n학생: ${memo.studentName}\n진도: ${memo.progress}\n메모: ${memo.memo}`
      )
      .join("\n\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          "You are an expert private tutor assistant.",
          "Analyze the following tutoring notes and return ONLY valid JSON that matches the schema.",
          "Write in Korean.",
          "Student message should be warm and encouraging.",
          "Parent report should be professional and data-focused.",
          "Practice items should target weaknesses and include explanations.",
          "",
          prompt,
        ].join("\n"),
        text: {
          format: {
            type: "json_schema",
            name: "tutoring_helper_output",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                student_message: { type: "string" },
                parent_report: { type: "string" },
                next_class_practice: {
                  type: "array",
                  minItems: 6,
                  maxItems: 10,
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
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({
        error: data.error?.message || "OpenAI API 요청 실패",
        raw: data,
      });
      return;
    }

    const parsed = safeJsonParse(data.output_text) || safeJsonParse(data.output?.[0]?.content?.[0]?.text);
    if (!parsed) {
      res.status(500).json({ error: "OpenAI 응답에서 JSON을 읽지 못했습니다.", raw: data });
      return;
    }

    res.status(200).json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
