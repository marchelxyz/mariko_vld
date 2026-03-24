import { describe, it, expect } from "vitest";
import { cn } from "./utils";
import {
  getPlatformIdentitySearchLabel,
  getPlatformIdentitySearchValues,
  getPlatformIdentityText,
  getPreferredPlatformMutationId,
  isVisibleInPlatformList,
} from "./utils/platformIdentity";

describe("cn function", () => {
  it("should merge classes correctly", () => {
    expect(cn("text-red-500", "bg-blue-500")).toBe("text-red-500 bg-blue-500");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    expect(cn("base-class", isActive && "active-class")).toBe(
      "base-class active-class",
    );
  });

  it("should handle false and null conditions", () => {
    const isActive = false;
    expect(cn("base-class", isActive && "active-class", null)).toBe(
      "base-class",
    );
  });

  it("should merge tailwind classes properly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("should work with object notation", () => {
    expect(cn("base", { conditional: true, "not-included": false })).toBe(
      "base conditional",
    );
  });
});

describe("platformIdentity helpers", () => {
  const mixedIdentity = {
    id: "internal-uuid",
    userId: "profile-uuid",
    telegramId: "1189569891",
    vkId: "8670261122",
  };

  it("should scope visibility by current platform", () => {
    expect(isVisibleInPlatformList(mixedIdentity, "telegram")).toBe(true);
    expect(isVisibleInPlatformList(mixedIdentity, "vk")).toBe(true);
    expect(isVisibleInPlatformList({ id: "internal", telegramId: null, vkId: null }, "telegram")).toBe(false);
    expect(isVisibleInPlatformList({ id: "internal", telegramId: null, vkId: null }, "vk")).toBe(false);
  });

  it("should return correct platform labels", () => {
    expect(getPlatformIdentitySearchLabel("telegram")).toBe("TG ID");
    expect(getPlatformIdentitySearchLabel("vk")).toBe("VK ID");
    expect(getPlatformIdentitySearchLabel("web")).toBe("ID");
  });

  it("should return platform-specific search values", () => {
    expect(getPlatformIdentitySearchValues(mixedIdentity, "telegram")).toEqual(["1189569891"]);
    expect(getPlatformIdentitySearchValues(mixedIdentity, "vk")).toEqual(["8670261122"]);
    expect(getPlatformIdentitySearchValues(mixedIdentity, "web")).toEqual([
      "1189569891",
      "8670261122",
      "profile-uuid",
    ]);
  });

  it("should render only current platform ID in mini app contexts", () => {
    expect(getPlatformIdentityText(mixedIdentity, "telegram")).toBe("TG ID: 1189569891");
    expect(getPlatformIdentityText(mixedIdentity, "vk")).toBe("VK ID: 8670261122");
  });

  it("should prefer platform ID for mutations", () => {
    expect(getPreferredPlatformMutationId(mixedIdentity, "telegram")).toBe("1189569891");
    expect(getPreferredPlatformMutationId(mixedIdentity, "vk")).toBe("8670261122");
    expect(getPreferredPlatformMutationId(mixedIdentity, "web")).toBe("profile-uuid");
  });
});
