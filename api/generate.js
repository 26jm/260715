module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." });
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

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions:generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          input: [
            "너는 과외 선생님을 돕는 AI 비서야.",
            "아래 메모들을 분석해서 반드시 유효한 JSON만 반환해.",
            "한국어로 작성해.",
            "student_message는 친근하고 격려하는 톤의 카톡 메시지.",
            "parent_report는 정중하고 전문적인 데이터 중심 리포트.",
            "next_class_practice는 6~10개의 유사 문제와 상세 해설.",
            "",
            prompt,
          ].join("\n"),
          response_format: {
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
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({
        error: data.error?.message || "Gemini API 요청 실패",
        raw: data,
      });
      return;
    }

    const parsed = safeJsonParse(
      data.output_text ||
        data.output?.[0]?.content?.[0]?.text ||
        data.candidates?.[0]?.content?.parts?.[0]?.text
    );

    if (!parsed) {
      res.status(500).json({ error: "Gemini 응답에서 JSON을 읽지 못했습니다.", raw: data });
      return;
    }

    res.status(200).json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
