import PDFDocument from "pdfkit";

function percentage(value, total) {
  return total ? `${Math.round((value / total) * 100)}%` : "No sessions recorded";
}

function safePdfText(value) {
  return String(value || "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

export function createProgressReportPdf(report) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 52, info: { Title: "Student Progress Report" } });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    document.font("Helvetica-Bold").fontSize(21).fillColor("#123766")
      .text("Student Progress Report");
    document.moveDown(0.5);
    document.font("Helvetica").fontSize(11).fillColor("#26384d")
      .text(safePdfText(report.studentName));
    document.text(`${safePdfText(report.className)}${report.courseName ? ` | ${safePdfText(report.courseName)}` : ""}`);
    document.text(`Reporting period: ${safePdfText(report.monthLabel)}`);
    document.text(`Generated: ${safePdfText(report.generatedAt)}`);

    document.moveDown();
    document.font("Helvetica-Bold").fontSize(14).fillColor("#123766").text("Overall performance");
    document.font("Helvetica").fontSize(11).fillColor("#26384d")
      .text(`Monthly grade: ${report.progress.grade === null ? "Not provided" : `${report.progress.grade}%`}`)
      .text(`Assignment average: ${report.assignments.averageScore === null ? "Not graded" : `${report.assignments.averageScore}%`}`)
      .text(`Progress rating: ${report.progress.rating === null ? "Not provided" : `${report.progress.rating}/5`}`);

    document.moveDown();
    document.font("Helvetica-Bold").fontSize(14).fillColor("#123766").text("Attendance");
    document.font("Helvetica").fontSize(11).fillColor("#26384d")
      .text(`Present: ${report.attendance.present} | Late: ${report.attendance.late} | Absent: ${report.attendance.absent} | Excused: ${report.attendance.excused}`)
      .text(`Attendance rate: ${percentage(report.attendance.present + report.attendance.late, report.attendance.present + report.attendance.late + report.attendance.absent)}`);

    document.moveDown();
    document.font("Helvetica-Bold").fontSize(14).fillColor("#123766").text("Assignments and grades");
    document.font("Helvetica").fontSize(11).fillColor("#26384d")
      .text(`Assignments due or shared this month: ${report.assignments.total}`)
      .text(`Submitted: ${report.assignments.submitted} | Reviewed: ${report.assignments.reviewed}`)
      .text(report.assignments.averageScore === null
        ? "Average assignment score: No graded assignments"
        : `Average assignment score: ${report.assignments.averageScore}%`);
    document.text(report.progress.grade === null
      ? "Teacher's monthly grade: Not provided"
      : `Teacher's monthly grade: ${report.progress.grade}%`);

    document.moveDown();
    document.font("Helvetica-Bold").fontSize(14).fillColor("#123766").text("Learning progress");
    document.font("Helvetica").fontSize(11).fillColor("#26384d")
      .text(`Progress rating: ${report.progress.rating === null ? "Not provided" : `${report.progress.rating}/5`}`)
      .text(`Current topic: ${safePdfText(report.progress.currentTopic) || "Not provided"}`)
      .text(`Next topic: ${safePdfText(report.progress.nextTopic) || "Not provided"}`);

    document.moveDown();
    document.font("Helvetica-Bold").fontSize(14).fillColor("#123766").text("Teacher feedback");
    document.font("Helvetica").fontSize(11).fillColor("#26384d")
      .text(safePdfText(report.progress.feedback) || "No feedback recorded.", { width: 490, lineGap: 4 });

    document.moveDown(2);
    document.fontSize(9).fillColor("#66758a")
      .text("This report summarizes records available for the selected period.", { align: "center" });
    document.end();
  });
}
