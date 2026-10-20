import { HttpError } from "../../utils/http-error.js";
import { QuranProgress } from "./quran.model.js";
import { fetchQuranContent } from "./quran.service.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getProgress(req) {
  return QuranProgress.findOneAndUpdate(
    { organization: req.organization._id, user: req.user._id },
    { $setOnInsert: {} },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function listChapters(req, res) {
  const query = new URLSearchParams({ language: "en" });
  const data = await fetchQuranContent(req.app.locals.config, "/chapters", query);
  if (!Array.isArray(data.chapters)) throw new HttpError(502, "Quran.com returned an invalid chapter catalog.");
  res.json({ success: true, data: data.chapters });
}

export async function listRecitations(req, res) {
  const data = await fetchQuranContent(
    req.app.locals.config,
    "/resources/recitations",
  );
  if (!Array.isArray(data.recitations)) throw new HttpError(502, "Quran.com returned an invalid recitation catalog.");
  res.json({ success: true, data: data.recitations });
}

export async function listVerses(req, res) {
  const chapterId = Number(req.params.chapterId);
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 114) {
    throw new HttpError(400, "Choose a valid Quran chapter");
  }

  const { page, recitation, translation } = req.validatedQuery;
  const query = new URLSearchParams({
    language: "en",
    words: "false",
    translations: String(translation),
    audio: String(recitation),
    per_page: "50",
    page: String(page),
  });
  const data = await fetchQuranContent(
    req.app.locals.config,
    `/verses/by_chapter/${chapterId}`,
    query,
  );
  if (!Array.isArray(data.verses)) throw new HttpError(502, "Quran.com returned invalid verse data.");
  res.json({ success: true, data });
}

export async function getStudentProgress(req, res) {
  const progress = await getProgress(req);
  const today = todayKey();
  const todayReading = progress.readingLog.find((entry) => entry.date === today);
  const todayTasks = progress.completedTasks
    .filter((entry) => entry.date === today)
    .map((entry) => entry.task);
  const activeDates = new Set(progress.readingLog
    .filter((entry) => entry.verseKeys.length > 0)
    .map((entry) => entry.date));
  let streak = 0;
  const day = new Date(`${today}T00:00:00.000Z`);
  if (!activeDates.has(today)) day.setUTCDate(day.getUTCDate() - 1);
  while (activeDates.has(day.toISOString().slice(0, 10))) {
    streak += 1;
    day.setUTCDate(day.getUTCDate() - 1);
  }
  res.json({
    success: true,
    data: {
      dailyGoal: progress.dailyGoal,
      bookmarks: progress.bookmarks,
      memorizedVerses: progress.memorizedVerses,
      readVerses: progress.readVerses,
      todayReadCount: todayReading?.verseKeys.length || 0,
      todayTasks,
      streak,
      memorizedCount: progress.memorizedVerses.length,
    },
  });
}

export async function updateStudentProgress(req, res) {
  const progress = await getProgress(req);
  const today = todayKey();
  const { action } = req.body;

  if (action === "goal") {
    progress.dailyGoal = req.body.dailyGoal;
  } else if (action === "read") {
    if (!progress.readVerses.includes(req.body.verseKey)) progress.readVerses.push(req.body.verseKey);
    let entry = progress.readingLog.find((item) => item.date === today);
    if (!entry) {
      entry = { date: today, verseKeys: [] };
      progress.readingLog.push(entry);
    }
    if (!entry.verseKeys.includes(req.body.verseKey)) entry.verseKeys.push(req.body.verseKey);
    const oldestDate = new Date(`${today}T00:00:00.000Z`);
    oldestDate.setUTCDate(oldestDate.getUTCDate() - 89);
    const cutoff = oldestDate.toISOString().slice(0, 10);
    progress.readingLog = progress.readingLog.filter((item) => item.date >= cutoff);
  } else if (action === "bookmark") {
    if (!progress.bookmarks.includes(req.body.verseKey)) progress.bookmarks.push(req.body.verseKey);
  } else if (action === "unbookmark") {
    progress.bookmarks = progress.bookmarks.filter((verseKey) => verseKey !== req.body.verseKey);
  } else if (action === "memorize") {
    if (!progress.memorizedVerses.includes(req.body.verseKey)) progress.memorizedVerses.push(req.body.verseKey);
  } else if (action === "unmemorize") {
    progress.memorizedVerses = progress.memorizedVerses.filter((verseKey) => verseKey !== req.body.verseKey);
  } else if (action === "task") {
    const existingIndex = progress.completedTasks.findIndex((entry) => (
      entry.date === today && entry.task === req.body.task
    ));
    if (req.body.completed && existingIndex === -1) {
      progress.completedTasks.push({ date: today, task: req.body.task });
    } else if (!req.body.completed && existingIndex !== -1) {
      progress.completedTasks.splice(existingIndex, 1);
    }
  }

  await progress.save();
  res.json({ success: true, data: { updated: true } });
}
