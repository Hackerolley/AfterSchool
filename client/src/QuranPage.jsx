import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Headphones,
  Heart,
  LoaderCircle,
  Repeat2,
  Search,
  Settings2,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import { quranGet, quranPost } from "./api.js";

const TOTAL_VERSES = 6236;
const DEFAULT_PROGRESS = {
  dailyGoal: 5,
  bookmarks: [],
  memorizedVerses: [],
  readVerses: [],
  todayReadCount: 0,
  todayTasks: [],
  streak: 0,
  memorizedCount: 0,
};
const LEARNING_TASKS = [
  { id: "listen", label: "Listen to a recitation" },
  { id: "review", label: "Review a memorized verse" },
  { id: "quiz", label: "Complete a quick review" },
];

function percent(value, total) {
  return total ? Math.min(100, Math.round((value / total) * 100)) : 0;
}

export default function QuranPage({ organizationId, studentName }) {
  const [chapters, setChapters] = useState([]);
  const [recitations, setRecitations] = useState([]);
  const [chapterId, setChapterId] = useState(1);
  const [recitationId, setRecitationId] = useState(7);
  const [page, setPage] = useState(1);
  const [verses, setVerses] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [verseIndex, setVerseIndex] = useState(0);
  const [progress, setProgress] = useState(DEFAULT_PROGRESS);
  const [activeSection, setActiveSection] = useState("reader");
  const [search, setSearch] = useState("");
  const [repeatCount, setRepeatCount] = useState(1);
  const [dailyGoalInput, setDailyGoalInput] = useState("5");
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingVerses, setLoadingVerses] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [progressError, setProgressError] = useState("");
  const [repeatNumber, setRepeatNumber] = useState(0);
  const pendingVerseKey = useRef("");
  const audioRef = useRef(null);
  const selectedVerse = verses[verseIndex];
  const selectedChapter = chapters.find((chapter) => chapter.id === chapterId);
  const selectedRecitation = recitations.find((recitation) => recitation.id === recitationId);
  const completedTasks = useMemo(() => new Set(progress.todayTasks), [progress.todayTasks]);
  const query = search.trim().toLowerCase();
  const visibleBookmarks = progress.bookmarks.filter((verseKey) => (
    !query || verseKey.toLowerCase().includes(query)
  ));

  useEffect(() => {
    let active = true;
    setLoadingCatalog(true);
    Promise.allSettled([
      quranGet("/chapters", organizationId),
      quranGet("/recitations", organizationId),
      quranGet("/progress", organizationId),
    ]).then((results) => {
      if (!active) return;
      const catalogErrors = [];
      if (results[0].status === "fulfilled") {
        setChapters(results[0].value.data);
      } else {
        catalogErrors.push(results[0].reason.message);
      }
      if (results[1].status === "fulfilled") {
        setRecitations(results[1].value.data);
        const defaultReciter = results[1].value.data.find((recitation) => /mishari.*afasy/i.test(recitation.reciter_name));
        if (defaultReciter) setRecitationId(defaultReciter.id);
      } else {
        catalogErrors.push(results[1].reason.message);
      }
      if (results[2].status === "fulfilled") {
        setProgress({ ...DEFAULT_PROGRESS, ...results[2].value.data });
        setDailyGoalInput(String(results[2].value.data.dailyGoal));
      } else {
        setProgressError(results[2].reason.message);
      }
      setError(catalogErrors.join(" "));
      setLoadingCatalog(false);
    });
    return () => { active = false; };
  }, [organizationId]);

  useEffect(() => {
    if (!chapters.length || !recitations.length) return undefined;
    let active = true;
    setLoadingVerses(true);
    setError("");
    quranGet(`/chapters/${chapterId}/verses?page=${page}&recitation=${recitationId}&translation=131`, organizationId)
      .then(({ data }) => {
        if (!active) return;
        setVerses(data.verses || []);
        setTotalPages(data.pagination?.total_pages || 1);
        const pendingIndex = pendingVerseKey.current
          ? data.verses.findIndex((verse) => verse.verse_key === pendingVerseKey.current)
          : -1;
        setVerseIndex(pendingIndex >= 0 ? pendingIndex : 0);
        if (pendingIndex >= 0) pendingVerseKey.current = "";
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoadingVerses(false);
      });
    return () => { active = false; };
  }, [chapterId, page, recitationId, chapters.length, recitations.length, organizationId]);

  async function updateProgress(update) {
    setSaving(true);
    setProgressError("");
    try {
      await quranPost(update, organizationId);
      const response = await quranGet("/progress", organizationId);
      setProgress({ ...DEFAULT_PROGRESS, ...response.data });
      setDailyGoalInput(String(response.data.dailyGoal));
    } catch (requestError) {
      setProgressError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeVerse(direction) {
    const nextIndex = verseIndex + direction;
    if (nextIndex >= 0 && nextIndex < verses.length) {
      setVerseIndex(nextIndex);
      setRepeatNumber(0);
      return;
    }
    if (direction > 0 && page < totalPages) setPage((value) => value + 1);
    else if (direction > 0 && chapterId < 114) {
      setChapterId((value) => value + 1);
      setPage(1);
    } else if (direction < 0 && page > 1) {
      setPage((value) => value - 1);
    } else if (direction < 0 && chapterId > 1) {
      const previousChapter = chapters.find((chapter) => chapter.id === chapterId - 1);
      if (previousChapter) {
        pendingVerseKey.current = `${previousChapter.id}:${previousChapter.verses_count}`;
        setChapterId(previousChapter.id);
        setPage(Math.ceil(previousChapter.verses_count / 50));
      }
    }
  }

  function finishRecitation() {
    if (repeatNumber < repeatCount) {
      setRepeatNumber((value) => value + 1);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => setProgressError("Your browser could not restart the recitation. Press play to continue."));
      }
    } else {
      setRepeatNumber(0);
    }
  }

  function openSection(section) {
    setActiveSection(section);
    document.getElementById(`quran-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const totalRead = progress.readVerses.length;
  const markedMemorized = Boolean(selectedVerse && progress.memorizedVerses.includes(selectedVerse.verse_key));
  const bookmarked = Boolean(selectedVerse && progress.bookmarks.includes(selectedVerse.verse_key));
  const audioUrl = selectedVerse?.audio?.url
    ? selectedVerse.audio.url.startsWith("http")
      ? selectedVerse.audio.url
      : `https:${selectedVerse.audio.url}`
    : "";

  return (
    <div className="quran-page">
      <div className="quran-welcome">
        <div className="quran-welcome-copy">
          <p className="eyebrow">YOUR DAILY RECITATION</p>
          <h1>Assalamu Alaikum, {studentName.split(" ")[0]}</h1>
          <p>May your journey with the Qur’an bring you closer to Allah.</p>
          <div className="quran-welcome-stats">
            <span><CalendarDays size={16} /><span><small>Today's goal</small><strong>Read {progress.dailyGoal} verses</strong></span></span>
            <span><Flame size={16} /><span><small>Study streak</small><strong>{progress.streak} {progress.streak === 1 ? "day" : "days"}</strong></span></span>
            <span><BookOpen size={16} /><span><small>Current surah</small><strong>{selectedChapter?.name_simple || "Al-Fatihah"}</strong></span></span>
          </div>
        </div>
        <div className="quran-art-book" aria-hidden="true"><BookOpen size={82} strokeWidth={1.1} /></div>
      </div>

      <div className="quran-shortcuts" aria-label="Quran learning sections">
        <button className={activeSection === "reader" ? "active" : ""} onClick={() => openSection("reader")}><BookOpen /><span><strong>Read Quran</strong><small>Read and reflect</small></span></button>
        <button className={activeSection === "audio" ? "active" : ""} onClick={() => openSection("audio")}><Headphones /><span><strong>Listen</strong><small>Listen to recitations</small></span></button>
        <button className={activeSection === "memorization" ? "active" : ""} onClick={() => openSection("memorization")}><Sparkles /><span><strong>Memorization</strong><small>Track your progress</small></span></button>
        <button className={activeSection === "bookmarks" ? "active" : ""} onClick={() => openSection("bookmarks")}><Bookmark /><span><strong>Bookmarks</strong><small>Your saved verses</small></span></button>
      </div>

      <div className="quran-layout">
        <div className="quran-main-column">
          <section className="quran-panel quran-reader" id="quran-reader">
            <div className="quran-panel-heading">
              <div><p className="eyebrow">YOUR READING SPACE</p><h2>Quran Reader</h2></div>
              <span className="quran-source">Powered by Quran.com</span>
            </div>
            <div className="quran-reader-tools">
              <label className="quran-select"><span>Surah</span><select value={chapterId} onChange={(event) => { setChapterId(Number(event.target.value)); setPage(1); }} disabled={loadingCatalog}><option value="" disabled>Select surah</option>{chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.name_simple} ({chapter.id})</option>)}</select><ChevronDown size={15} /></label>
              <label className="quran-select quran-ayah-select"><span>Ayah</span><select value={selectedVerse?.verse_key || ""} onChange={(event) => { const index = verses.findIndex((verse) => verse.verse_key === event.target.value); if (index >= 0) setVerseIndex(index); }} disabled={loadingVerses || !verses.length}>{verses.map((verse) => <option value={verse.verse_key} key={verse.id}>{verse.verse_number}</option>)}</select><ChevronDown size={15} /></label>
              <button className="quran-settings-button" onClick={() => openSection("audio")}><Settings2 size={15} /> Audio settings</button>
            </div>

            {error && <div className="quran-inline-error" role="alert">{error}</div>}
            {loadingVerses ? <div className="quran-reader-loading"><LoaderCircle className="quran-spinner" size={24} />Loading verses…</div> : selectedVerse ? (
              <>
                <div className="quran-verse" translate="no">
                  <div className="quran-verse-label">{selectedChapter?.name_simple} · {selectedVerse.verse_key}</div>
                  <p className="quran-arabic" lang="ar" dir="rtl">{selectedVerse.text_uthmani || selectedVerse.text_uthmani_simple}</p>
                  <p className="quran-translation">{selectedVerse.translations?.[0]?.text || "Translation is not available for this verse."}</p>
                </div>
                <div className="quran-audio-player" id="quran-audio">
                  <audio
                    ref={audioRef}
                    key={`${selectedVerse.verse_key}-${recitationId}`}
                    controls
                    preload="none"
                    src={audioUrl}
                    onEnded={finishRecitation}
                    onPlay={() => setRepeatNumber((value) => value || 1)}
                  >
                    Your browser does not support audio playback.
                  </audio>
                  <div className="quran-repeat-control"><Repeat2 size={16} /><span>Repeat</span><select aria-label="Repeat count" value={repeatCount} onChange={(event) => setRepeatCount(Number(event.target.value))}>{[1, 2, 3, 5, 10].map((count) => <option value={count} key={count}>{count}×</option>)}</select></div>
                </div>
                {repeatNumber > 0 && repeatCount > 1 && <p className="quran-repeat-status" aria-live="polite">Repeat {repeatNumber} of {repeatCount}</p>}
                <div className="quran-verse-actions">
                  <div>
                    <button className={`quran-icon-action ${bookmarked ? "selected" : ""}`} aria-label={bookmarked ? "Remove bookmark" : "Bookmark verse"} title={bookmarked ? "Remove bookmark" : "Bookmark verse"} disabled={saving} onClick={() => updateProgress({ action: bookmarked ? "unbookmark" : "bookmark", verseKey: selectedVerse.verse_key })}><Bookmark size={17} /></button>
                    <button className={`quran-icon-action ${markedMemorized ? "selected" : ""}`} aria-label={markedMemorized ? "Remove from memorized" : "Mark as memorized"} title={markedMemorized ? "Remove from memorized" : "Mark as memorized"} disabled={saving} onClick={() => updateProgress({ action: markedMemorized ? "unmemorize" : "memorize", verseKey: selectedVerse.verse_key })}><Heart size={17} /></button>
                  </div>
                  <button className="quran-mark-read" disabled={saving || progress.readVerses.includes(selectedVerse.verse_key)} onClick={() => updateProgress({ action: "read", verseKey: selectedVerse.verse_key })}>
                    {progress.readVerses.includes(selectedVerse.verse_key) ? <><Check size={15} />Read</> : <><BookOpen size={15} />Mark as read</>}
                  </button>
                </div>
                <div className="quran-verse-navigation">
                  <button onClick={() => changeVerse(-1)} disabled={chapterId === 1 && page === 1 && verseIndex === 0}><ChevronLeft size={15} />Previous Ayah</button>
                  <span>{selectedVerse.verse_key}</span>
                  <button onClick={() => changeVerse(1)} disabled={page === totalPages && verseIndex === verses.length - 1 && chapterId === 114}>Next Ayah<ChevronRight size={15} /></button>
                </div>
              </>
            ) : !error ? <div className="quran-reader-loading">No verses are available right now.</div> : null}
          </section>

          <section className="quran-panel quran-audio-panel" id="quran-audio-library">
            <div className="quran-panel-heading"><div><p className="eyebrow">MAKE IT YOURS</p><h2>Listen to a reciter</h2></div><Headphones size={19} /></div>
            <div className="quran-reciter-picker">
              <label htmlFor="quran-reciter">Choose a reciter</label>
              <select id="quran-reciter" value={recitationId} onChange={(event) => setRecitationId(Number(event.target.value))} disabled={!recitations.length}>
                {recitations.map((recitation) => <option value={recitation.id} key={recitation.id}>{recitation.reciter_name}{recitation.style ? ` · ${recitation.style}` : ""}</option>)}
              </select>
            </div>
            <p className="quran-reciter-note">{selectedRecitation?.translated_name?.name || selectedRecitation?.reciter_name || "Choose an available reciter"} · Listen to each ayah and repeat it as you learn.</p>
          </section>

          <section className="quran-panel quran-featured-panel" id="quran-memorization">
            <div className="quran-panel-heading"><div><p className="eyebrow">KEEP GROWING</p><h2>Memorization progress</h2></div><Sparkles size={19} /></div>
            <p className="quran-featured-copy">Save verses you have learned and return to them for revision.</p>
            {progress.memorizedVerses.length ? (
              <div className="quran-chip-list">{progress.memorizedVerses.slice(-8).reverse().map((verseKey) => <button key={verseKey} onClick={() => selectVerseKey(verseKey, chapters, chapterId, page, setChapterId, setPage, setVerseIndex, pendingVerseKey, setActiveSection)}>{verseKey}<ChevronRight size={13} /></button>)}</div>
            ) : <p className="quran-empty-note">Use the heart button beside a verse to add it to your memorized list.</p>}
          </section>

          <section className="quran-panel quran-featured-panel" id="quran-bookmarks">
            <div className="quran-panel-heading"><div><p className="eyebrow">SAVE FOR LATER</p><h2>Bookmarks</h2></div><Bookmark size={18} /></div>
            {progress.bookmarks.length > 3 && <label className="quran-search"><Search size={15} /><input aria-label="Search bookmarks" placeholder="Find a saved verse" value={search} onChange={(event) => setSearch(event.target.value)} /></label>}
            {visibleBookmarks.length ? (
              <div className="quran-chip-list">{visibleBookmarks.slice(-12).reverse().map((verseKey) => <button key={verseKey} onClick={() => selectVerseKey(verseKey, chapters, chapterId, page, setChapterId, setPage, setVerseIndex, pendingVerseKey, setActiveSection)}>{verseKey}<ChevronRight size={13} /></button>)}</div>
            ) : <p className="quran-empty-note">{search ? "No bookmarks match your search." : "Save an ayah with the bookmark button and it will appear here."}</p>}
          </section>
        </div>

        <aside className="quran-side-column">
          <section className="quran-panel quran-progress-panel">
            <div className="quran-panel-heading"><div><p className="eyebrow">KEEP GOING</p><h2>Overall progress</h2></div><Target size={18} /></div>
            <div className="quran-progress-ring" style={{ "--quran-progress": `${percent(totalRead, TOTAL_VERSES)}%` }}><div><strong>{percent(totalRead, TOTAL_VERSES)}%</strong><small>Quran read</small></div></div>
            <div className="quran-progress-copy"><strong>{totalRead.toLocaleString()} of {TOTAL_VERSES.toLocaleString()} verses</strong><span>Unique verses marked as read</span><div className="quran-progress-track"><i style={{ width: `${percent(totalRead, TOTAL_VERSES)}%` }} /></div></div>
          </section>

          <section className="quran-panel quran-progress-panel">
            <div className="quran-panel-heading"><div><p className="eyebrow">MEMORIZE AT YOUR PACE</p><h2>Memorization</h2></div><button className="quran-text-link" onClick={() => openSection("memorization")}>View list<ChevronRight size={13} /></button></div>
            <div className="quran-memorized-number"><strong>{progress.memorizedCount}</strong><span>verses saved to your memorized list</span></div>
            <div className="quran-progress-track"><i style={{ width: `${percent(progress.memorizedCount, TOTAL_VERSES)}%` }} /></div>
            <div className="quran-mini-stats"><span><Star size={15} /><strong>{new Set(progress.memorizedVerses.map((key) => key.split(":")[0])).size}</strong><small>Surahs</small></span><span><Flame size={15} /><strong>{progress.streak}</strong><small>Day streak</small></span><span><BookOpen size={15} /><strong>{progress.todayReadCount}</strong><small>Read today</small></span></div>
          </section>

          <section className="quran-panel quran-plan-panel">
            <div className="quran-panel-heading"><div><p className="eyebrow">SMALL STEPS EACH DAY</p><h2>Daily learning plan</h2></div><CalendarDays size={18} /></div>
            <div className="quran-goal-editor"><label htmlFor="quran-daily-goal">Today's reading goal</label><div><input id="quran-daily-goal" type="number" min="1" max="100" value={dailyGoalInput} onChange={(event) => setDailyGoalInput(event.target.value)} /><span>verses</span><button className="quran-save-goal" disabled={saving || Number(dailyGoalInput) === progress.dailyGoal || Number(dailyGoalInput) < 1 || Number(dailyGoalInput) > 100} onClick={() => updateProgress({ action: "goal", dailyGoal: Number(dailyGoalInput) })}>Save</button></div></div>
            <div className="quran-plan-task">
              <span className={`quran-task-check ${progress.todayReadCount >= progress.dailyGoal ? "done" : ""}`}>{progress.todayReadCount >= progress.dailyGoal && <Check size={13} />}</span>
              <span><strong>Read {progress.dailyGoal} verses</strong><small>{progress.todayReadCount} of {progress.dailyGoal} marked read</small></span>
            </div>
            {LEARNING_TASKS.map(({ id, label }) => {
              const done = completedTasks.has(id);
              return (
                <button className="quran-plan-task" key={id} onClick={() => updateProgress({ action: "task", task: id, completed: !done })} disabled={saving}>
                  <span className={`quran-task-check ${done ? "done" : ""}`}>{done && <Check size={13} />}</span><span><strong>{label}</strong><small>{done ? "Completed today" : "Tap when you finish"}</small></span>
                </button>
              );
            })}
          </section>

          <section className="quran-panel quran-activity-panel">
            <div className="quran-panel-heading"><div><p className="eyebrow">YOUR JOURNEY</p><h2>Recent activity</h2></div><Flame size={18} /></div>
            <div className="quran-activity-row"><span className="quran-activity-icon"><BookOpen size={15} /></span><span><strong>Verses read</strong><small>{progress.todayReadCount} verses today</small></span></div>
            <div className="quran-activity-row"><span className="quran-activity-icon"><Headphones size={15} /></span><span><strong>Listening practice</strong><small>{completedTasks.has("listen") ? "Completed today" : "Keep building your routine"}</small></span></div>
            <div className="quran-activity-row"><span className="quran-activity-icon"><Bookmark size={15} /></span><span><strong>Saved verses</strong><small>{progress.bookmarks.length} bookmarks</small></span></div>
          </section>
        </aside>
      </div>

      {progressError && <div className="quran-progress-error" role="alert">{progressError}</div>}
    </div>
  );
}

function selectVerseKey(verseKey, chapters, currentChapterId, currentPage, setChapterId, setPage, setVerseIndex, pendingVerseKey, setActiveSection) {
  const [chapterNumber, verseNumber] = verseKey.split(":").map(Number);
  const versePage = Math.ceil(verseNumber / 50);
  const indexInPage = (verseNumber - 1) % 50;
  if (!chapters.some((chapter) => chapter.id === chapterNumber)) return;
  if (currentChapterId === chapterNumber && currentPage === versePage) {
    setVerseIndex(indexInPage);
  } else {
    pendingVerseKey.current = indexInPage === 0 ? "" : verseKey;
    setChapterId(chapterNumber);
    setPage(versePage);
  }
  setActiveSection("reader");
  document.getElementById("quran-reader")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
