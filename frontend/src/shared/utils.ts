import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export {
  getPlatformIdentitySearchLabel,
  getPlatformIdentitySearchValues,
  getPlatformIdentityText,
  getPreferredPlatformMutationId,
  isVisibleInPlatformList,
} from "./utils/platformIdentity";
export {
  sanitizeAdminFacingMessage,
  sanitizeUserFacingMessage,
} from "./utils/userFacingError";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
