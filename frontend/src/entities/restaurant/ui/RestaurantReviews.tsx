import { Star, MessageCircle, User } from "lucide-react";
import { useEffect, useState } from "react";
import { reviewsApi } from "@shared/api";
import type { Review } from "@shared/types";

interface RestaurantReviewsProps {
  restaurantId: string;
  restaurantName: string;
}

export const RestaurantReviews = ({ restaurantId }: RestaurantReviewsProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    averageRating: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReviews = async () => {
      try {
        setLoading(true);
        const [reviewsData, statsData] = await Promise.all([
          reviewsApi.getRestaurantReviews(restaurantId),
          reviewsApi.getReviewsStats(restaurantId),
        ]);
        setReviews(reviewsData);
        setStats(statsData);
      } catch (error) {
        console.error("Ошибка загрузки отзывов:", error);
      } finally {
        setLoading(false);
      }
    };

    loadReviews();
  }, [restaurantId]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const renderStars = (rating: number, size: "sm" | "md" = "sm") => {
    const starSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
    return (
      <div className="flex">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`${starSize} ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-400"}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-mariko-secondary rounded-[45px] p-6 animate-pulse space-y-4">
        <div className="h-6 bg-white/20 rounded" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-white/10 rounded" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="bg-mariko-secondary rounded-[45px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="w-6 h-6 text-white" />
          <h3 className="text-white font-el-messiri text-xl font-bold">
            Отзывы о ресторане
          </h3>
        </div>
        <div className="text-center py-8">
          <MessageCircle className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <p className="text-white/60 font-el-messiri text-lg">
            Пока нет отзывов об этом ресторане
          </p>
          <p className="text-white/40 font-el-messiri text-sm mt-2">
            Станьте первым, кто оставит отзыв!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-mariko-secondary rounded-[45px] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-white" />
          <h3 className="text-white font-el-messiri text-xl font-bold">
            Отзывы гостей
          </h3>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 mb-1">
            {renderStars(Math.round(stats.averageRating), "md")}
            <span className="text-white font-el-messiri text-lg font-bold">
              {stats.averageRating.toFixed(1)}
            </span>
          </div>
          <p className="text-white/60 text-sm">
            {stats.total} {stats.total === 1 ? "отзыв" : stats.total < 5 ? "отзыва" : "отзывов"}
          </p>
        </div>
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {reviews.map((review) => {
          const sentimentStyles = {
            positive: "bg-white/10 border-l-4 border-green-400",
            negative: "bg-white/10 border-l-4 border-red-400",
            neutral: "bg-white/10 border-l-4 border-yellow-400",
          } as const;

          return (
            <div key={review.id} className={`${sentimentStyles[review.sentiment]} rounded-2xl p-4`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-el-messiri font-semibold">
                        {review.userName || "Гость"}
                      </p>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          review.sentiment === "positive"
                            ? "bg-green-500/20 text-green-300"
                            : review.sentiment === "negative"
                            ? "bg-red-500/20 text-red-300"
                            : "bg-yellow-500/20 text-yellow-300"
                        }`}
                      >
                        {review.sentiment === "positive" ? "😊" : review.sentiment === "negative" ? "😞" : "😐"}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm">{formatDate(review.createdAt)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {renderStars(review.rating)}
                  <span className="text-white/80 text-sm font-medium">{review.rating}/5</span>
                </div>
              </div>
              <p className="text-white/90 font-el-messiri text-sm leading-relaxed">{review.text}</p>
              {review.managerResponse && (
                <div className="mt-3 bg-white/5 rounded-xl p-3 border-l-3 border-yellow-400">
                  <p className="text-white/70 text-xs font-semibold mb-1">Ответ ресторана:</p>
                  <p className="text-white/80 font-el-messiri text-sm">{review.managerResponse}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {stats.total > 3 && (
        <div className="mt-6 pt-4 border-t border-white/20">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-green-400 font-bold text-lg">{stats.positive}</p>
              <p className="text-white/70 text-sm">Положительные</p>
            </div>
            <div>
              <p className="text-red-400 font-bold text-lg">{stats.negative}</p>
              <p className="text-white/70 text-sm">Негативные</p>
            </div>
            <div>
              <p className="text-yellow-400 font-bold text-lg">{stats.neutral}</p>
              <p className="text-white/70 text-sm">Нейтральные</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 
