import { createOrganizationWithAdmin } from "./organization.service.js";

export async function createOrganization(req, res) {
  const organization = await createOrganizationWithAdmin(req.body);
  res.status(201).json({ success: true, data: organization });
}
