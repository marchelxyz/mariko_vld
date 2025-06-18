// Утилита для сброса отзывов и создания новых тестовых данных

export const resetReviewsData = () => {
  try {
    // Очищаем только отзывы
    localStorage.removeItem('mariko_reviews');
    console.log('Отзывы очищены. Перезагрузите страницу для создания новых тестовых данных.');
    
    // Перезагружаем страницу для инициализации новых данных
    window.location.reload();
  } catch (error) {
    console.error('Ошибка при очистке отзывов:', error);
  }
};

// Добавляем функцию в глобальную область для вызова из консоли
(window as any).resetReviews = resetReviewsData; 