import { deleteDocument, privateDocumentUrl, uploadDocument } from "../assignments/cloudinary.service.js";
import { LibraryItem } from "./library.model.js";
import { HttpError } from "../../utils/http-error.js";

function safeLibraryItem(item) {
  const value = item.toObject ? item.toObject() : item;
  return {
    ...value,
    attachment: value.attachment
      ? { originalFilename: value.attachment.originalFilename, bytes: value.attachment.bytes }
      : undefined,
  };
}

export async function listLibraryItems(req, res) {
  const items = await LibraryItem.find({
    organization: req.organization._id,
    status: "published",
  }).sort({ createdAt: -1, _id: -1 }).lean();
  res.json({ success: true, data: items.map(safeLibraryItem) });
}

export async function createLibraryItem(req, res) {
  if (req.body.contentType === "ebook" && !req.file) {
    throw new HttpError(400, "Choose an ebook PDF to upload");
  }
  if (req.body.contentType === "youtube" && req.file) {
    throw new HttpError(400, "File uploads are only accepted for ebook items");
  }

  let attachment;
  try {
    if (req.file) attachment = await uploadDocument(req.file, req.organization._id, req.app.locals.config);
    const item = await LibraryItem.create({
      organization: req.organization._id,
      ...req.body,
      ...(attachment ? { attachment } : {}),
    });
    res.status(201).json({ success: true, data: safeLibraryItem(item) });
  } catch (error) {
    if (attachment) await deleteDocument(attachment, req.app.locals.config);
    throw error;
  }
}

export async function updateLibraryItem(req, res) {
  const existing = await LibraryItem.findOne({
    _id: req.params.itemId,
    organization: req.organization._id,
    status: "published",
  });
  if (!existing) throw new HttpError(404, "Library item not found");
  if (req.body.contentType === "ebook" && !req.file && !existing.attachment) {
    throw new HttpError(400, "Choose an ebook PDF to upload");
  }
  if (req.body.contentType === "youtube" && req.file) {
    throw new HttpError(400, "File uploads are only accepted for ebook items");
  }

  const previousAttachment = existing.attachment?.toObject();
  let nextAttachment = previousAttachment;
  try {
    if (req.file) nextAttachment = await uploadDocument(req.file, req.organization._id, req.app.locals.config);
    existing.set({
      ...req.body,
      ...(req.body.contentType === "ebook" ? { attachment: nextAttachment } : { attachment: undefined }),
    });
    await existing.save();
  } catch (error) {
    if (req.file && nextAttachment !== previousAttachment) {
      await deleteDocument(nextAttachment, req.app.locals.config);
    }
    throw error;
  }

  if (previousAttachment && (!nextAttachment || previousAttachment.publicId !== nextAttachment.publicId)) {
    await deleteDocument(previousAttachment, req.app.locals.config);
  }
  res.json({ success: true, data: safeLibraryItem(existing) });
}

export async function deleteLibraryItem(req, res) {
  const item = await LibraryItem.findOneAndDelete({
    _id: req.params.itemId,
    organization: req.organization._id,
    status: "published",
  });
  if (!item) throw new HttpError(404, "Library item not found");
  if (item.attachment) await deleteDocument(item.attachment, req.app.locals.config);
  res.json({ success: true, data: { id: item._id } });
}

export async function getEbookFile(req, res) {
  const item = await LibraryItem.findOne({
    _id: req.params.itemId,
    organization: req.organization._id,
    status: "published",
    contentType: "ebook",
  }).select("attachment");
  if (!item?.attachment) throw new HttpError(404, "Ebook not found");
  res.redirect(privateDocumentUrl(item.attachment, req.app.locals.config));
}
