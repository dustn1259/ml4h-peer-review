const FOLDER_ID  = "1SQFfsTt0K_kb0TUjZlKXixqA2BzhNVxP";
const ADMIN_PW   = "edlab123@";

function doGet(e) {
  const action = e.parameter.action;
  if (action === "submit") return handleSubmit(e.parameter);
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

// ── 리뷰 저장 + Summary 자동 업데이트 ──────────────────────────
function handleSubmit(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Reviews 시트
  let rev = ss.getSheetByName("Reviews");
  if (!rev) {
    rev = ss.insertSheet("Reviews");
    const h = rev.getRange(1,1,1,8);
    h.setValues([["제출시각","학번","소속팀","리뷰대상팀","Soundness","Excitement","Overall","Comment"]]);
    h.setFontWeight("bold");
    h.setBackground("#f3f3f3");
    rev.setFrozenRows(1);
    rev.setColumnWidth(1, 160);
    rev.setColumnWidth(8, 300);
  }

  rev.appendRow([
    new Date(),
    p.studentId   || "",
    p.myTeam      || "",
    p.targetTeam  || "",
    Number(p.soundness)   || 0,
    Number(p.excitement)  || 0,
    Number(p.overall)     || 0,
    p.comment     || ""
  ]);

  // Summary 시트 재빌드
  rebuildSummary(ss);

  return ContentService.createTextOutput("")
  .setMimeType(ContentService.MimeType.TEXT);
}

// ── Summary 시트 재빌드 ─────────────────────────────────────────
function rebuildSummary(ss) {
  const rev = ss.getSheetByName("Reviews");
  if (!rev) return;

  const rows = rev.getDataRange().getValues().slice(1).filter(r => r[0]);

  // 팀별 집계
  const byTeam = {};
  rows.forEach(r => {
    const team = String(r[3]);
    if (!byTeam[team]) byTeam[team] = [];
    byTeam[team].push({
      soundness:   Number(r[4]) || 0,
      excitement:  Number(r[5]) || 0,
      overall:     Number(r[6]) || 0,
      comment:     String(r[7]) || "",
      reviewer:    String(r[1]) || ""
    });
  });

  // Summary 시트 초기화
  let sum = ss.getSheetByName("Summary");
  if (!sum) sum = ss.insertSheet("Summary");
  else sum.clearContents();

  // 헤더
  const header = [["Team","리뷰 수","Soundness 평균","Excitement 평균","Overall 평균","종합 평균"]];
  sum.getRange(1,1,1,6).setValues(header).setFontWeight("bold").setBackground("#e8f0fe");
  sum.setFrozenRows(1);

  // 팀 1~22 순서대로
  const summaryRows = [];
  for (let i = 1; i <= 22; i++) {
    const team  = `Team ${i}`;
    const revs  = byTeam[team] || [];
    const n     = revs.length;
    const avg   = k => n ? (revs.reduce((s,r) => s + r[k], 0) / n).toFixed(2) : "-";
    const s     = parseFloat(avg("soundness"))  || 0;
    const ex    = parseFloat(avg("excitement")) || 0;
    const ov    = parseFloat(avg("overall"))    || 0;
    const total = n ? ((s + ex + ov) / 3).toFixed(2) : "-";
    summaryRows.push([team, n, n ? avg("soundness") : "-", n ? avg("excitement") : "-", n ? avg("overall") : "-", total]);
  }
  sum.getRange(2, 1, summaryRows.length, 6).setValues(summaryRows);

  // 개별 리뷰 (익명) — Summary 시트 오른쪽에 팀별로
  let col = 8;
  for (let i = 1; i <= 22; i++) {
    const team = `Team ${i}`;
    const revs = byTeam[team] || [];
    if (!revs.length) continue;

    sum.getRange(1, col).setValue(`${team} 리뷰`).setFontWeight("bold").setBackground("#fce8e6");
    sum.getRange(2, col).setValue("Soundness");
    sum.getRange(2, col+1).setValue("Excitement");
    sum.getRange(2, col+2).setValue("Overall");
    sum.getRange(2, col+3).setValue("Comment");
    sum.getRange(2, col, 1, 4).setFontWeight("bold").setBackground("#f3f3f3");

    revs.forEach((r, idx) => {
      sum.getRange(3 + idx, col    ).setValue(r.soundness);
      sum.getRange(3 + idx, col + 1).setValue(r.excitement);
      sum.getRange(3 + idx, col + 2).setValue(r.overall);
      sum.getRange(3 + idx, col + 3).setValue(r.comment);
    });

    col += 5;
  }

  // 컬럼 너비 자동 조정
  sum.autoResizeColumns(1, 6);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 한 번만 실행: PDF 파일 ID 추출 ───────────────────────────────
function getFileIds() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const result = {};
  for (let i = 1; i <= 22; i++) {
    const files = folder.getFilesByName(`team${i}.pdf`);
    result[`Team ${i}`] = files.hasNext() ? files.next().getId() : "NOT_FOUND";
  }
  Logger.log(JSON.stringify(result, null, 2));
}

// ── Summary 수동 재빌드 (필요시 실행) ────────────────────────────
function manualRebuild() {
  rebuildSummary(SpreadsheetApp.getActiveSpreadsheet());
}
