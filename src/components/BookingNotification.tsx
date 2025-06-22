import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface NotificationProps {
  type: 'success' | 'error' | 'loading';
  message: string;
  show: boolean;
  onClose: () => void;
  duration?: number; // Время показа в миллисекундах
}

/**
 * Компонент уведомления для результатов бронирования
 */
export function BookingNotification({ 
  type, 
  message, 
  show, 
  onClose, 
  duration = 5000 
}: NotificationProps) {
  useEffect(() => {
    if (show && type !== 'loading') {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, type, duration, onClose]);

  if (!show) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-400" />;
      case 'loading':
        return <Clock className="w-6 h-6 text-blue-400 animate-spin" />;
      default:
        return null;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600/20 border-green-500/30';
      case 'error':
        return 'bg-red-600/20 border-red-500/30';
      case 'loading':
        return 'bg-blue-600/20 border-blue-500/30';
      default:
        return 'bg-gray-600/20 border-gray-500/30';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div 
        className={`
          ${getBgColor()}
          backdrop-blur-sm border rounded-2xl p-4 shadow-lg
          transform transition-all duration-300 ease-in-out
          ${show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        `}
      >
        <div className="flex items-start gap-3">
          {getIcon()}
          <div className="flex-1">
            <p className="text-white font-el-messiri text-sm leading-relaxed">
              {message}
            </p>
          </div>
          {type !== 'loading' && (
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors ml-2"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Хук для управления уведомлениями
 */
export function useNotification() {
  const [notification, setNotification] = useState({
    show: false,
    type: 'success' as 'success' | 'error' | 'loading',
    message: ''
  });

  const showNotification = (type: 'success' | 'error' | 'loading', message: string) => {
    setNotification({
      show: true,
      type,
      message
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({
      ...prev,
      show: false
    }));
  };

  const showSuccess = (message: string) => showNotification('success', message);
  const showError = (message: string) => showNotification('error', message);
  const showLoading = (message: string) => showNotification('loading', message);

  return {
    notification,
    showSuccess,
    showError,
    showLoading,
    hideNotification
  };
} 