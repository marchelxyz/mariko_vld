import { botApi } from "../botApiService";

export const reviewsApi = {
  createReview: botApi.createReview,
  getRestaurantReviews: botApi.getRestaurantReviews,
  getReviewsStats: botApi.getReviewsStats,
}; 
