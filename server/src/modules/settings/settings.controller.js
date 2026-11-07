import { deleteImage, uploadImage } from "../assignments/cloudinary.service.js";
import { Organization } from "../organizations/organization.model.js";
import { HttpError } from "../../utils/http-error.js";
import { DEFAULT_MEMBER_ID_FORMATS } from "../users/user-id.js";

export function getProfileSettings(req, res) {
  res.json({
    success: true,
    data: {
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      avatarUrl: req.user.avatarUrl || "",
    },
  });
}

export async function updateProfileAvatar(req, res) {
  const uploaded = await uploadImage(req.file, `users/${req.user._id}`, req.app.locals.config);
  const previousPublicId = req.user.avatarPublicId;
  try {
    req.user.avatarUrl = uploaded.url;
    req.user.avatarPublicId = uploaded.publicId;
    await req.user.save();
  } catch (error) {
    await deleteImage(uploaded.publicId, req.app.locals.config);
    throw error;
  }
  if (previousPublicId && previousPublicId !== uploaded.publicId) {
    await deleteImage(previousPublicId, req.app.locals.config);
  }
  res.json({ success: true, data: { avatarUrl: req.user.avatarUrl } });
}

export async function removeProfileAvatar(req, res) {
  const previousPublicId = req.user.avatarPublicId;
  req.user.avatarUrl = "";
  req.user.avatarPublicId = "";
  await req.user.save();
  if (previousPublicId) await deleteImage(previousPublicId, req.app.locals.config);
  res.json({ success: true, data: { avatarUrl: "" } });
}

export function getSchoolSettings(req, res) {
  res.json({
    success: true,
    data: {
      name: req.organization.name,
      slug: req.organization.slug,
      logoUrl: req.organization.logoUrl || "",
      idFormats: {
        student: req.organization.idFormats?.student || DEFAULT_MEMBER_ID_FORMATS.student,
        teacher: req.organization.idFormats?.teacher || DEFAULT_MEMBER_ID_FORMATS.teacher,
      },
    },
  });
}

export async function updateSchoolMemberIdFormats(req, res) {
  const organization = await Organization.findById(req.organization._id);
  if (!organization) throw new HttpError(404, "School not found");
  organization.idFormats = req.body;
  await organization.save();
  res.json({ success: true, data: { idFormats: organization.idFormats } });
}

export async function updateSchoolLogo(req, res) {
  if (req.membership.role !== "admin") {
    throw new HttpError(403, "School administrator permission required");
  }
  const organization = await Organization.findById(req.organization._id);
  if (!organization) throw new HttpError(404, "School not found");
  const uploaded = await uploadImage(req.file, `schools/${organization._id}`, req.app.locals.config);
  const previousPublicId = organization.logoPublicId;
  try {
    organization.logoUrl = uploaded.url;
    organization.logoPublicId = uploaded.publicId;
    await organization.save();
  } catch (error) {
    await deleteImage(uploaded.publicId, req.app.locals.config);
    throw error;
  }
  if (previousPublicId && previousPublicId !== uploaded.publicId) {
    await deleteImage(previousPublicId, req.app.locals.config);
  }
  res.json({ success: true, data: { logoUrl: organization.logoUrl } });
}

export async function removeSchoolLogo(req, res) {
  if (req.membership.role !== "admin") {
    throw new HttpError(403, "School administrator permission required");
  }
  const organization = await Organization.findById(req.organization._id);
  if (!organization) throw new HttpError(404, "School not found");
  const previousPublicId = organization.logoPublicId;
  organization.logoUrl = "";
  organization.logoPublicId = "";
  await organization.save();
  if (previousPublicId) await deleteImage(previousPublicId, req.app.locals.config);
  res.json({ success: true, data: { logoUrl: "" } });
}
