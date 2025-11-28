export interface Review {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  rating: number;
  text: string;
  sentiment: "positive" | "negative" | "neutral";
  status: "pending" | "processed" | "resolved";
  isPublic: boolean;
  managerResponse?: string;
  createdAt: string;
  processedAt?: string;
}
