import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// Массив названий месяцев на русском языке
const RU_MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

/**
 * Преобразует объект Date в строку формата ДД.ММ.ГГГГ
 */
export const formatDate = (date: Date): string =>
  date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export type DatePickerProps = {
  selected: Date; // текущая выбранная дата
  minDate: Date; // минимально допустимая дата
  maxDate: Date; // максимально допустимая дата
  onSelect: (date: Date) => void; // вызывается при выборе даты
  onClose: () => void; // закрытие календаря
};

/**
 * Компонент всплывающего календаря для выбора даты
 */
const DatePicker = ({ selected, minDate, maxDate, onSelect, onClose }: DatePickerProps) => {
  const [viewMonth, setViewMonth] = useState<Date>(
    new Date(selected.getFullYear(), selected.getMonth(), 1)
  );

  // Проверяем можно ли перейти к предыдущему/следующему месяцу
  const canPrev =
    new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1) >
    new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canNext =
    new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0) < maxDate;

  const handlePrev = () => {
    if (canPrev) {
      setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (canNext) {
      setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    }
  };

  // Генерируем календарную сетку для текущего месяца
  const generateCalendar = () => {
    const startOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const endOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
    const daysInMonth = endOfMonth.getDate();

    const firstWeekDay = (startOfMonth.getDay() + 6) % 7; // 0 = Monday

    const days: (Date | null)[] = Array(firstWeekDay).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
    }

    // Дополняем до полного количества ячеек (кратное 7)
    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  };

  const days = generateCalendar();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-3xl p-6 w-[340px] shadow-xl">
        {/* Заголовок с месяцем и навигацией */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrev}
            disabled={!canPrev}
            className="p-1 rounded-full hover:bg-mariko-primary/10 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-el-messiri text-lg font-bold text-mariko-dark">
            {RU_MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
          </span>
          <button
            onClick={handleNext}
            disabled={!canNext}
            className="p-1 rounded-full hover:bg-mariko-primary/10 disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Названия дней недели */}
        <div className="grid grid-cols-7 gap-1 text-center text-mariko-dark/70 text-sm mb-2">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
            <div key={day} className="font-semibold">
              {day}
            </div>
          ))}
        </div>

        {/* Сетка дней */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={idx} />;
            }

            const isDisabled = date < minDate || date > maxDate;
            const isSelected = date.toDateString() === selected.toDateString();

            const baseClasses =
              "w-10 h-10 flex items-center justify-center rounded-full text-sm";
            const dynamicClasses = isDisabled
              ? "text-gray-300"
              : `cursor-pointer hover:bg-mariko-primary/20 text-mariko-dark ${
                  isSelected ? "bg-mariko-primary text-white hover:bg-mariko-primary" : ""
                }`;

            return (
              <button
                key={idx}
                disabled={isDisabled}
                onClick={() => !isDisabled && onSelect(date)}
                className={`${baseClasses} ${dynamicClasses}`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="mt-4 w-full bg-mariko-field text-mariko-dark py-3 rounded-2xl hover:bg-mariko-field/80 flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" /> Закрыть
        </button>
      </div>
    </div>
  );
};

export default DatePicker; 