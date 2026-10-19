import { useState } from "react";
import { ArrowDownToLine, ArrowUpRight, BookOpen, ExternalLink, FileText, Plus, Trash2, Video, X, Youtube } from "lucide-react";
import { apiDelete, apiPatchForm, apiPostForm, libraryEbookUrl } from "./api.js";

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

export default function LibraryPage({ role, items, loading, organizationId, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [contentType, setContentType] = useState("ebook");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function openEditor(item = null) {
    setEditing(item || {});
    setContentType(item?.contentType || "ebook");
    setError("");
  }

  function closeDialogs() {
    if (pending) return;
    setEditing(null);
    setViewing(null);
    setError("");
  }

  async function saveItem(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      form.set("contentType", contentType);
      if (contentType === "youtube") form.delete("file");
      else form.delete("youtubeUrl");
      const result = editing._id
        ? await apiPatchForm(`/library/${editing._id}`, form, organizationId)
        : await apiPostForm("/library", form, organizationId);
      setEditing(null);
      await onRefresh();
      if (!result.success) throw new Error("The library item could not be saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  async function removeItem(item) {
    if (!window.confirm(`Delete “${item.title}” from the library?`)) return;
    setPending(true);
    setError("");
    try {
      await apiDelete(`/library/${item._id}`, organizationId);
      setViewing(null);
      await onRefresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">READ, WATCH, DISCOVER</p><h2>Library</h2><p className="muted">Ebooks and videos selected for your school community.</p></div>
        {role === "admin" && <button className="button button-primary" onClick={() => openEditor()}><Plus size={17} />Add to library</button>}
      </div>
      {error && !editing && <div className="error-banner" role="alert">{error}</div>}
      {loading ? <div className="assignment-skeleton" aria-label="Loading library" /> : items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon"><BookOpen size={22} /></span>
          <h3>The library is ready to grow</h3>
          <p>{role === "admin" ? "Add an ebook or a YouTube video to share learning resources with students." : "Ebooks and videos shared by your school will appear here."}</p>
          {role === "admin" && <button className="button button-primary button-small" onClick={() => openEditor()}><Plus size={15} />Add first resource</button>}
        </div>
      ) : (
        <div className="library-grid">
          {items.map((item) => (
            <article className="library-card" key={item._id}>
              <div className={`library-card-art ${item.contentType === "youtube" ? "library-video-art" : ""}`}>
                {item.contentType === "youtube" ? <Youtube size={26} /> : <BookOpen size={26} />}
                <span>{item.contentType === "youtube" ? "VIDEO" : "EBOOK"}</span>
              </div>
              <div className="library-card-body">
                <span className="library-item-type">{item.contentType === "youtube" ? "YouTube video" : "Ebook · PDF"}</span>
                <h3>{item.title}</h3>
                <p>{item.description || "A resource selected for your school library."}</p>
                <div className="library-card-actions">
                  <button className="button button-primary button-small" onClick={() => setViewing(item)}>{item.contentType === "youtube" ? <><Video size={15} />Watch video</> : <><BookOpen size={15} />Open ebook</>}</button>
                  {role === "admin" && <button className="icon-button library-manage-button" title="Edit item" aria-label={`Edit ${item.title}`} onClick={() => openEditor(item)}><ArrowUpRight size={17} /></button>}
                  {role === "admin" && <button className="icon-button library-manage-button library-delete-button" title="Delete item" aria-label={`Delete ${item.title}`} onClick={() => removeItem(item)}><Trash2 size={16} /></button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialogs(); }}>
          <section className="modal library-modal" role="dialog" aria-modal="true" aria-labelledby="library-editor-title">
            <div className="modal-heading">
              <div><p className="eyebrow">SCHOOL LIBRARY</p><h2 id="library-editor-title">{editing._id ? "Edit resource" : "Add a resource"}</h2><p>Share an ebook PDF or an embedded YouTube video.</p></div>
              <button className="icon-button modal-close" aria-label="Close dialog" disabled={pending} onClick={closeDialogs}><X size={19} /></button>
            </div>
            <form className="modal-form" onSubmit={saveItem}>
              <label className="form-field"><span>Resource type</span><select value={contentType} onChange={(event) => setContentType(event.target.value)}><option value="ebook">Ebook (PDF)</option><option value="youtube">YouTube video</option></select></label>
              <label className="form-field"><span>Title</span><input autoFocus required name="title" maxLength="160" defaultValue={editing.title || ""} placeholder="Resource title" /></label>
              <label className="form-field"><span>Description</span><textarea name="description" rows="3" maxLength="2000" defaultValue={editing.description || ""} placeholder="What will students learn?" /></label>
              {contentType === "ebook" ? (
                <label className="form-field"><span>PDF ebook {editing.attachment && "(optional to keep the current file)"}</span><input required={!editing.attachment || contentType !== editing.contentType} type="file" name="file" accept=".pdf,application/pdf" />{editing.attachment && <small>Current file: {editing.attachment.originalFilename}</small>}<small>PDF files up to 25 MB. The ebook is delivered through a secure download.</small></label>
              ) : (
                <label className="form-field"><span>YouTube video URL</span><input required type="url" name="youtubeUrl" maxLength="2048" defaultValue={editing.contentType === "youtube" ? editing.youtubeUrl : ""} placeholder="https://youtu.be/…" /></label>
              )}
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="modal-actions"><button className="button button-quiet" type="button" disabled={pending} onClick={closeDialogs}>Cancel</button><button className="button button-primary" type="submit" disabled={pending}>{pending ? <><span className="spinner" />Saving…</> : <>{editing._id ? "Save changes" : "Add to library"}<ArrowUpRight size={16} /></>}</button></div>
            </form>
          </section>
        </div>
      )}

      {viewing && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialogs(); }}>
          <section className="modal library-viewer-modal" role="dialog" aria-modal="true" aria-labelledby="library-viewer-title">
            <div className="modal-heading">
              <div><p className="eyebrow">{viewing.contentType === "youtube" ? "YOUTUBE VIDEO" : "EBOOK"}</p><h2 id="library-viewer-title">{viewing.title}</h2><p>{viewing.description}</p></div>
              <button className="icon-button modal-close" aria-label="Close viewer" onClick={closeDialogs}><X size={19} /></button>
            </div>
            {viewing.contentType === "youtube" && youtubeId(viewing.youtubeUrl) ? (
              <div className="assignment-video library-video"><iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId(viewing.youtubeUrl)}`} title={viewing.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
            ) : viewing.contentType === "youtube" ? (
              <a className="assignment-resource-link" href={viewing.youtubeUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open video on YouTube</a>
            ) : (
              <a className="assignment-file-link library-file-link" href={libraryEbookUrl(viewing._id, organizationId)} target="_blank" rel="noreferrer"><FileText size={19} /><span>{viewing.attachment?.originalFilename || "Open ebook"}<small>Secure PDF download</small></span><ArrowDownToLine size={17} /></a>
            )}
            {role === "admin" && <div className="modal-actions library-viewer-actions"><button className="button button-quiet" onClick={() => { setViewing(null); openEditor(viewing); }}>Edit</button><button className="button button-quiet library-delete-action" disabled={pending} onClick={() => removeItem(viewing)}>Delete</button><button className="button button-primary" onClick={closeDialogs}>Done</button></div>}
          </section>
        </div>
      )}
    </>
  );
}
