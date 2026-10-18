import { HttpError } from "../utils/http-error.js";

export function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new HttpError(400, "Request validation failed", result.error.flatten()));
      return;
    }
    if (source === "query") req.validatedQuery = result.data;
    else req[source] = result.data;
    next();
  };
}
