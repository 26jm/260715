module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { memos } = req.body || {};

    if (!Array.isArray(memos) || memos.length === 0) {
      res.status(400).json({ error: "선택된 메모가 없습니다." });
      return;
    }

    const firstStudent = memos[0]?.studentName || "학생";

    res.status(200).json({
      student_message: `${firstStudent} 오늘 수고했어요. 다음 시간에도 차근차근 이어가 봅시다.`,
      parent_report: `${firstStudent}의 최근 수업 메모를 바탕으로 기본 개념과 오답 패턴을 계속 점검하고 있습니다.`,
      next_class_practice: [
        {
          question: "기초 확인 문제 1",
          answer: "정답과 해설",
        },
        {
          question: "기초 확인 문제 2",
          answer: "정답과 해설",
        },
        {
          question: "기초 확인 문제 3",
          answer: "정답과 해설",
        },
        {
          question: "기초 확인 문제 4",
          answer: "정답과 해설",
        },
        {
          question: "기초 확인 문제 5",
          answer: "정답과 해설",
        },
        {
          question: "기초 확인 문제 6",
          answer: "정답과 해설",
        }
      ],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
