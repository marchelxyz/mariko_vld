import type { UserProfile } from "@shared/types";
import { httpClient } from "../http";

export const profileRemoteApi = {
  async getUserProfile(userId: string): Promise<UserProfile> {
    return await httpClient.request<UserProfile>(`/api/profile/${encodeURIComponent(userId)}`);
  },

  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<boolean> {
    await httpClient.request(`/api/profile/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: profile,
    });
    return true;
  },
};
