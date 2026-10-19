import { Router } from "express";
import { authenticate, authorize, requireOrganization } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createLibraryItem,
  deleteLibraryItem,
  getEbookFile,
  listLibraryItems,
  updateLibraryItem,
} from "./library.controller.js";
import { createLibraryItemSchema, updateLibraryItemSchema } from "./library.validator.js";
import { uploadEbook } from "./library.upload.js";

const router = Router();
router.use(authenticate);
router.use((req, res, next) => {
  if (req.method === "GET" && req.path.endsWith("/file") && typeof req.query.organizationId === "string") {
    req.headers["x-organization-id"] = req.query.organizationId;
  }
  next();
}, requireOrganization);
router.get("/", asyncHandler(listLibraryItems));
router.post(
  "/",
  authorize("admin"),
  uploadEbook,
  validate(createLibraryItemSchema),
  asyncHandler(createLibraryItem),
);
router.get("/:itemId/file", asyncHandler(getEbookFile));
router.patch(
  "/:itemId",
  authorize("admin"),
  uploadEbook,
  validate(updateLibraryItemSchema),
  asyncHandler(updateLibraryItem),
);
router.delete("/:itemId", authorize("admin"), asyncHandler(deleteLibraryItem));

export default router;
