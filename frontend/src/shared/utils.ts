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
export { resolveEffectiveCartOrderStatus } from "./utils/orderStatus";
export {
  buildModifierSelectionKey,
  createDefaultModifierSelectionMap,
  formatSelectedModifiersLabel,
  getMenuItemModifierGroups,
  getMissingRequiredModifierGroups,
  getModifierSelectionExtraPrice,
  hasSelectableModifierGroups,
  resolveSelectedModifiersFromMap,
} from "./utils/menuModifiers";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
