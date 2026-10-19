import mongoose from "mongoose";
import { HttpError } from "../../utils/http-error.js";
import { paginationResult } from "../../utils/pagination.js";
import { Membership } from "../memberships/membership.model.js";
import { User } from "../users/user.model.js";
import { Organization } from "./organization.model.js";
import { createOrganizationWithAdmin } from "./organization.service.js";

export async function createOrganization(req, res) {
  const organization = await createOrganizationWithAdmin(req.body);
  res.status(201).json({ success: true, data: organization });
}

function searchPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listOrganizations(req, res) {
  const { page, limit, search, status } = req.validatedQuery;
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const safeSearch = searchPattern(search);
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { slug: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const [organizations, total, active, suspended, inactive] = await Promise.all([
    Organization.find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Organization.countDocuments(filter),
    Organization.countDocuments({ status: "active" }),
    Organization.countDocuments({ status: "suspended" }),
    Organization.countDocuments({ status: "inactive" }),
  ]);

  const membershipCounts = organizations.length
    ? await Membership.aggregate([
        { $match: { organization: { $in: organizations.map(({ _id }) => _id) } } },
        {
          $group: {
            _id: "$organization",
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            activeAdmins: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ["$role", "admin"] }, { $eq: ["$status", "active"] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
    : [];
  const countsByOrganization = new Map(
    membershipCounts.map((counts) => [counts._id.toString(), counts]),
  );

  res.json({
    success: true,
    data: {
      organizations: organizations.map((organization) => ({
        ...organization,
        membershipCounts: countsByOrganization.get(organization._id.toString()) ?? {
          total: 0,
          active: 0,
          activeAdmins: 0,
        },
      })),
      stats: { total: active + suspended + inactive, active, suspended, inactive },
    },
    pagination: paginationResult(page, limit, total),
  });
}

export async function getOrganization(req, res) {
  const organization = await Organization.findById(req.params.organizationId).lean();
  if (!organization) throw new HttpError(404, "School not found");

  const membershipStats = await Membership.aggregate([
    { $match: { organization: organization._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
        suspended: { $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] } },
        activeAdmins: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$role", "admin"] }, { $eq: ["$status", "active"] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $project: { _id: 0, total: 1, active: 1, suspended: 1, inactive: 1, activeAdmins: 1 } },
  ]);

  res.json({
    success: true,
    data: {
      organization,
      membershipCounts: membershipStats[0] ?? {
        total: 0,
        active: 0,
        suspended: 0,
        inactive: 0,
        activeAdmins: 0,
      },
    },
  });
}

export async function listOrganizationMemberships(req, res) {
  const { page, limit, search, role, status } = req.validatedQuery;
  if (!(await Organization.exists({ _id: req.params.organizationId }))) {
    throw new HttpError(404, "School not found");
  }
  const filter = { organization: req.params.organizationId };
  if (role) filter.role = role;
  if (status) filter.status = status;

  if (search) {
    const safeSearch = searchPattern(search);
    const matchingUsers = await User.find({
      $or: [
        { firstName: { $regex: safeSearch, $options: "i" } },
        { lastName: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
      ],
    }).select("_id");
    filter.user = { $in: matchingUsers.map(({ _id }) => _id) };
  }

  const [memberships, total] = await Promise.all([
    Membership.find(filter)
      .populate("user", "firstName lastName email status")
      .sort({ role: 1, createdAt: -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Membership.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: memberships,
    pagination: paginationResult(page, limit, total),
  });
}

export async function updateOrganization(req, res) {
  const organization = await Organization.findById(req.params.organizationId);
  if (!organization) throw new HttpError(404, "School not found");

  Object.assign(organization, req.body);
  await organization.save();
  res.json({ success: true, data: organization });
}

export async function updateOrganizationMembershipStatus(req, res) {
  const databaseSession = await mongoose.startSession();
  let updatedMembership;
  try {
    await databaseSession.withTransaction(async () => {
      const membership = await Membership.findOne({
        _id: req.params.membershipId,
        organization: req.params.organizationId,
      }).session(databaseSession);
      if (!membership) throw new HttpError(404, "School membership not found");

      if (
        membership.role === "admin" &&
        membership.status === "active" &&
        req.body.status !== "active"
      ) {
        await Organization.updateOne(
          { _id: req.params.organizationId },
          { $inc: { __v: 1 } },
          { session: databaseSession },
        );
        const activeAdmins = await Membership.countDocuments({
          organization: req.params.organizationId,
          role: "admin",
          status: "active",
          _id: { $ne: membership._id },
        }).session(databaseSession);
        if (activeAdmins === 0) {
          throw new HttpError(409, "A school must keep at least one active administrator");
        }
      }

      membership.status = req.body.status;
      await membership.save({ session: databaseSession });
      updatedMembership = membership;
    });
  } finally {
    await databaseSession.endSession();
  }

  await updatedMembership.populate("user", "firstName lastName email status");
  res.json({ success: true, data: updatedMembership });
}
