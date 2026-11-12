import { OvokAuthenticationError, OvokConnectionError, OvokError, OvokPermissionError } from "@ovok/core/next";

import { SignedOutError } from "./ovok";
import { RegisterError } from "./patients";

const UNAUTHORIZED = 401;

/** What to tell the nurse about a failure, in words they can act on. */
export function messageFor(error: unknown): string {
  if (error instanceof SignedOutError) return error.message;
  if (error instanceof RegisterError) {
    return error.status === UNAUTHORIZED ? "Your session has ended. Sign in again." : error.message;
  }
  if (error instanceof OvokAuthenticationError) return "Check the email and password, then try again.";
  if (error instanceof OvokPermissionError) return "Your account is not allowed to do this in this project.";
  if (error instanceof OvokConnectionError) return "The tablet is offline. Check the connection and try again.";
  if (error instanceof OvokError) return error.message;
  if (error instanceof TypeError) return "The tablet could not reach the server. Check the connection.";
  return "Something went wrong. Try again.";
}
