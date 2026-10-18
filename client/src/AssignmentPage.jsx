import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Plus,
  Send,
  X,
  Youtube,
} from "lucide-react";
import { apiGet, apiPostForm, assignmentFileUrl } from "./api.js";

const contentLabels = {
  text: "Text assignment",
  document: "Document",
  link: "External link",
  youtube: "YouTube video",
};

function youtubeId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const id = host === "youtu.be"
      ? parsed.pathname.split("/").filter(Boolean)[0]
      : parsed.pathname === "/watch"
        ? parsed.searchParams.get("v")
        : parsed.pathname.split("/")[2];
    return /^[\w-]{11}$/.test(id || "") ? id : "";
  } catch {
    return "";
  }
}

function readableSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dueLabel(date) {
  if (!date) return "No due date";
  const due = new Date(date);
  if (Number.isNaN(due.getTime())) return "No due date";
  return `Due ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(due)}`;
}

export default function AssignmentPage({ role, assignments, classes, loading, organizationId, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [submissionType, setSubmissionType] = useState("text");
  const [createType, setCreateType] = useState("text");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selected && !showCreate) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !pending) {
        setSelected(null);
        setShowCreate(false);
        setError("");
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pending, selected, showCreate]);

  async function openAssignment(assignment) {
    setSelected(assignment);
    setError("");
    setSubmissions([]);
    if (role !== "teacher") return;
    setLoadingSubmissions(true);
    try {
      const response = await apiGet(`/assignments/${assignment._id}/submissions`, organizationId);
      setSubmissions(response.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingSubmissions(false);
    }
  }

  async function createAssignment(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const dueAt = form.get("dueAt");
    if (dueAt) form.set("dueAt", new Date(dueAt).toISOString());
    else form.delete("dueAt");
    try {
      await apiPostForm("/assignments", form, organizationId);
      setShowCreate(false);
      await onRefresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  async function submitWork(event) {
    event.preventDefault();
    if (!selected) return;
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiPostForm(`/assignments/${selected._id}/submissions`, form, organizationId);
      setSelected(await apiGet(`/assignments/${selected._id}`, organizationId).then((response) => response.data));
      await onRefresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  function closeDialog() {
    if (pending) return;
    setSelected(null);
    setShowCreate(false);
    setError("");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{role === "teacher" ? "CLASSROOM WORK" : "YOUR LEARNING SPACE"}</p>
          <h2>Assignments</h2>
          <p className="muted">{role === "teacher" ? "Create work for your classes and review student submissions." : "Open an assignment, review the resources, and submit your work."}</p>
        </div>
        {role === "teacher" && (
          <button className="button button-primary" onClick={() => { setError(""); setShowCreate(true); }}>
            <Plus size={17} />New assignment
          </button>
        )}
      </div>

      {error && !selected && !showCreate && <div className="error-banner" role="alert">{error}</div>}
      {loading ? <div className="assignment-skeleton" aria-label="Loading assignments" /> : assignments.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon"><ClipboardList size={21} /></span>
          <h3>{role === "teacher" ? "No assignments yet" : "You’re all caught up"}</h3>
          <p>{role === "teacher" ? "Create an assignment and choose one of your classes." : "Assignments for your enrolled classes will appear here."}</p>
          {role === "teacher" && classes.length > 0 && <button className="button button-primary button-small" onClick={() => setShowCreate(true)}><Plus size={15} />Create assignment</button>}
        </div>
      ) : (
        <div className="assignment-list">
          {assignments.map((assignment) => (
            <article className="assignment-card" key={assignment._id}>
              <span className={`assignment-icon assignment-${assignment.contentType}`}>
                {assignment.contentType === "document" ? <FileText size={19} /> : assignment.contentType === "link" ? <LinkIcon size={19} /> : assignment.contentType === "youtube" ? <Youtube size={19} /> : <BookOpen size={19} />}
              </span>
              <div className="assignment-card-copy">
                <div className="assignment-card-heading"><h3>{assignment.title}</h3><span className={`assignment-state ${assignment.submission ? "submitted" : ""}`}>{assignment.submission ? "Submitted" : contentLabels[assignment.contentType]}</span></div>
                <p>{assignment.class?.name || "Class"}{assignment.class?.course?.name ? ` · ${assignment.class.course.name}` : ""}</p>
                <small>{dueLabel(assignment.dueAt)}{assignment.submission?.submittedAt ? ` · Sent ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(assignment.submission.submittedAt))}` : ""}</small>
              </div>
              <button className="icon-button assignment-open" aria-label={`Open ${assignment.title}`} onClick={() => openAssignment(assignment)}><ArrowUpRight size={18} /></button>
            </article>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className="modal assignment-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-create-title">
            <div className="modal-heading"><div><p className="eyebrow">CLASSROOM WORK</p><h2 id="assignment-create-title">New assignment</h2><p>Choose a class and add the material students should work on.</p></div><button className="icon-button modal-close" aria-label="Close dialog" onClick={closeDialog}><X size={19} /></button></div>
            <form className="modal-form" onSubmit={createAssignment}>
              <label className="form-field"><span>Class</span><select name="classId" required defaultValue=""><option value="" disabled>Select a class</option>{classes.map((item) => <option key={item._id} value={item._id}>{item.name}{item.course?.name ? ` · ${item.course.name}` : ""}</option>)}</select></label>
              <label className="form-field"><span>Assignment title</span><input name="title" required maxLength="160" autoFocus placeholder="e.g. Fractions practice" /></label>
              <label className="form-field"><span>Instructions <small>Optional</small></span><textarea name="instructions" rows="3" maxLength="4000" placeholder="Tell students what to do." /></label>
              <label className="form-field"><span>Assignment material</span><select name="contentType" value={createType} onChange={(event) => setCreateType(event.target.value)}><option value="text">Text assignment</option><option value="document">Upload a document</option><option value="link">Web link</option><option value="youtube">YouTube video</option></select></label>
              {createType === "text" && <label className="form-field"><span>Assignment text</span><textarea name="contentText" required rows="5" maxLength="12000" placeholder="Write the assignment here." /></label>}
              {createType === "document" && <label className="form-field"><span>Document</span><input name="file" type="file" required accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" /><small>PDF, Word, or plain text; maximum 10 MB.</small></label>}
              {createType === "link" && <label className="form-field"><span>Web link</span><input name="linkUrl" required type="url" maxLength="2048" placeholder="https://example.com/resource" /></label>}
              {createType === "youtube" && <label className="form-field"><span>YouTube video URL</span><input name="youtubeUrl" required type="url" maxLength="2048" placeholder="https://youtu.be/…" /></label>}
              <label className="form-field"><span>Due date <small>Optional</small></span><input name="dueAt" type="datetime-local" /></label>
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="modal-actions"><button className="button button-quiet" type="button" onClick={closeDialog}>Cancel</button><button className="button button-primary" type="submit" disabled={pending || classes.length === 0}>{pending ? "Publishing…" : "Publish assignment"}<ArrowUpRight size={16} /></button></div>
            </form>
          </section>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className="modal assignment-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-detail-title">
            <div className="modal-heading"><div><p className="eyebrow">{selected.class?.name || "ASSIGNMENT"}</p><h2 id="assignment-detail-title">{selected.title}</h2><p>{dueLabel(selected.dueAt)}</p></div><button className="icon-button modal-close" aria-label="Close dialog" onClick={closeDialog}><X size={19} /></button></div>
            {selected.instructions && <p className="assignment-instructions">{selected.instructions}</p>}
            <div className="assignment-material">
              <p className="eyebrow">{contentLabels[selected.contentType]}</p>
              {selected.contentType === "text" && <div className="assignment-text">{selected.contentText}</div>}
              {selected.contentType === "document" && <a className="assignment-file-link" href={assignmentFileUrl(selected._id, organizationId)} target="_blank" rel="noreferrer"><FileText size={18} /><span>{selected.attachment?.originalFilename}<small>{selected.attachment?.bytes ? readableSize(selected.attachment.bytes) : "Secure download"}</small></span><ArrowDownToLine size={17} /></a>}
              {selected.contentType === "link" && <a className="assignment-resource-link" href={selected.linkUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} />Open assignment link</a>}
              {selected.contentType === "youtube" && youtubeId(selected.youtubeUrl) && <div className="assignment-video"><iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId(selected.youtubeUrl)}`} title={selected.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>}
            </div>
            {error && <div className="form-error assignment-error" role="alert">{error}</div>}

            {role === "student" ? (
              <form className="modal-form assignment-submit-form" onSubmit={submitWork}>
                <div className="assignment-submission-heading"><h3>Your submission</h3>{selected.submission?.isLate && <span className="assignment-state late">Submitted late</span>}</div>
                {selected.submission?.attachment && <a className="assignment-file-link previous-file" href={assignmentFileUrl(selected._id, organizationId, selected.submission._id)} target="_blank" rel="noreferrer"><FileText size={17} /><span>{selected.submission.attachment.originalFilename}<small>Current uploaded file</small></span><ArrowDownToLine size={16} /></a>}
                <label className="form-field"><span>How would you like to submit?</span><select name="submissionType" value={submissionType} onChange={(event) => setSubmissionType(event.target.value)}><option value="text">Write a response</option><option value="file">Upload a document</option><option value="link">Share a link</option></select></label>
                {submissionType === "text" && <label className="form-field"><span>Your response</span><textarea name="contentText" required rows="5" maxLength="12000" defaultValue={selected.submission?.submissionType === "text" ? selected.submission.contentText : ""} placeholder="Write your work here." /></label>}
                {submissionType === "file" && <label className="form-field"><span>Document</span><input name="file" type="file" required accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" /><small>PDF, Word, or plain text; maximum 10 MB.</small></label>}
                {submissionType === "link" && <label className="form-field"><span>Submission link</span><input name="linkUrl" type="url" required maxLength="2048" defaultValue={selected.submission?.submissionType === "link" ? selected.submission.linkUrl : ""} placeholder="https://…" /></label>}
                <div className="modal-actions"><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Submitting…" : selected.submission ? "Update submission" : "Submit work"}<Send size={15} /></button></div>
              </form>
            ) : (
              <section className="assignment-submissions">
                <div className="assignment-submission-heading"><h3>Student submissions</h3><span>{loadingSubmissions ? "Loading…" : submissions.length}</span></div>
                {loadingSubmissions ? <p className="muted">Loading submissions…</p> : submissions.length === 0 ? <p className="muted">No students have submitted work yet.</p> : submissions.map((item) => (
                  <article className="submission-row" key={item._id}>
                    <div><strong>{item.student?.user?.firstName} {item.student?.user?.lastName}</strong><small>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.submittedAt))}{item.isLate ? " · Late" : ""}</small></div>
                    {item.submissionType === "text" && <p>{item.contentText}</p>}
                    {item.submissionType === "link" && <a href={item.linkUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open student link</a>}
                    {item.attachment && <a href={assignmentFileUrl(selected._id, organizationId, item._id)} target="_blank" rel="noreferrer"><FileText size={14} />{item.attachment.originalFilename}</a>}
                  </article>
                ))}
              </section>
            )}
          </section>
        </div>
      )}
    </>
  );
}
