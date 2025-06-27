import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { initEmailService, sendJobApplicationEmail, type JobApplicationEmailData } from "@/services/emailService";
import { useCityContext } from "@/contexts/CityContext";
import { cities } from "@/shared/data/cities";
import { usePhoneInput, getCleanPhoneNumber } from "@/shared/hooks/usePhoneInput";

import { Header } from "@widgets/header";
import { BottomNavigation } from "@widgets/bottomNavigation";
import { PageHeader } from "@widgets/pageHeader";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@shared/ui";
import { toast } from "sonner";

/**
 * Схема валидации формы заявки на вакансию
 */
const jobApplicationSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  desiredCity: z.string().min(1, "Выберите желаемый город работы"),
  restaurant: z.string().min(1, "Выберите ресторан"),
  age: z.number().min(16, "Минимальный возраст 16 лет").max(80, "Максимальный возраст 80 лет"),
  position: z.string().min(1, "Выберите должность"),
  experience: z.string().optional(),
  phone: z.string().min(10, "Введите корректный номер телефона"),
  email: z.string().email("Введите корректный email"),
});

type JobApplicationFormData = z.infer<typeof jobApplicationSchema>;

interface SubmissionStatus {
  isSubmitting: boolean;
  isSuccess: boolean;
  error: string | null;
}

/**
 * Компонент страницы подачи заявки на вакансию
 */
function JobApplication() {
  const navigate = useNavigate();
  const { selectedCity } = useCityContext();
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    isSubmitting: false,
    isSuccess: false,
    error: null,
  });
  const [selectedCityForJob, setSelectedCityForJob] = useState(selectedCity.name);
  const [availableRestaurants, setAvailableRestaurants] = useState(selectedCity.restaurants);

  // Хук для форматирования телефона
  const phoneInput = usePhoneInput();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<JobApplicationFormData>({
    resolver: zodResolver(jobApplicationSchema),
  });

  useEffect(() => {
    // Инициализируем email сервис при загрузке компонента
    initEmailService();
    
    // Устанавливаем изначальный город из контекста
    setValue("desiredCity", selectedCity.name);
    setSelectedCityForJob(selectedCity.name);
    setAvailableRestaurants(selectedCity.restaurants);
  }, [selectedCity, setValue]);

  // Обновляем поле phone в react-hook-form при каждом изменении телефона,
  // чтобы zod-валидация считала его заполненным
  useEffect(() => {
    setValue("phone", phoneInput.value);
  }, [phoneInput.value, setValue]);

  /**
   * Обработчик смены города
   */
  function handleCityChange(cityName: string) {
    const city = cities.find(c => c.name === cityName);
    if (city) {
      setSelectedCityForJob(cityName);
      setAvailableRestaurants(city.restaurants);
      // Сбрасываем выбранный ресторан
      setValue("restaurant", "");
    }
  }

  /**
   * Отправка формы на email
   */
  async function submitJobApplication(data: JobApplicationFormData): Promise<void> {
    setSubmissionStatus({ isSubmitting: true, isSuccess: false, error: null });

    try {
      const jobApplicationData: JobApplicationEmailData = {
        name: data.name,
        desiredCity: data.desiredCity,
        restaurant: data.restaurant,
        age: data.age,
        position: data.position,
        experience: data.experience,
        phone: getCleanPhoneNumber(phoneInput.value),
        email: data.email,
      };

      // Отправляем заявку через общий email сервис
      const result = await sendJobApplicationEmail(jobApplicationData);

      if (result.success) {
        setSubmissionStatus({ isSubmitting: false, isSuccess: false, error: null });
        reset();
        
        // Сразу переходим на главную страницу с параметром успеха
        navigate("/?jobApplicationSent=true");
      } else {
        setSubmissionStatus({
          isSubmitting: false,
          isSuccess: false,
          error: result.error || "Ошибка отправки заявки. Попробуйте позже.",
        });
        toast.error("Ошибка отправки заявки");
      }
    } catch (error) {
      console.error("Ошибка отправки заявки:", error);
      setSubmissionStatus({
        isSubmitting: false,
        isSuccess: false,
        error: "Ошибка отправки заявки. Попробуйте позже.",
      });
      toast.error("Ошибка отправки заявки");
    }
  }

  const onSubmit = handleSubmit(submitJobApplication);

  return (
    <div className="min-h-screen overflow-hidden flex flex-col bg-mariko-primary">
      {/* ВЕРХНЯЯ СЕКЦИЯ: Header с красным фоном и скруглением снизу */}
      <div className="bg-mariko-primary pb-6 md:pb-8">
        <Header />
      </div>

      {/* СРЕДНЯЯ СЕКЦИЯ: Main Content с белым фоном, расширенная до низа */}
      <div className="flex-1 bg-white relative overflow-hidden rounded-t-[24px] md:rounded-t-[32px] pt-6 md:pt-8
        before:content-[''] before:absolute before:top-0 before:left-0 before:right-0
        before:h-[28px] md:before:h-[32px]
        before:bg-gradient-to-b before:from-black/30 before:to-transparent
        before:rounded-t-[24px] md:before:rounded-t-[32px]">
        <div className="px-4 md:px-6 max-w-4xl mx-auto w-full">
          {/* Back Button and Title */}
          <div className="mt-6 md:mt-8 flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate("/")}
              className="p-2 text-mariko-primary hover:bg-mariko-primary/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-mariko-primary font-el-messiri text-3xl md:text-4xl font-bold">
              Работа у нас
            </h1>
          </div>

          {/* Job Application Form */}
          <div className="pb-40 md:pb-48">
            <form onSubmit={onSubmit} className="mt-6 space-y-6">
              {/* Имя */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  Имя *
                </Label>
                <Input
                  id="name"
                  type="text"
                  {...register("name")}
                  className="bg-mariko-field border-none text-mariko-dark placeholder:text-mariko-dark/60 rounded-lg h-12"
                  placeholder="Введите ваше имя"
                />
                {errors.name && (
                  <p className="text-red-400 text-sm font-el-messiri">{errors.name.message}</p>
                )}
              </div>

              {/* Желаемый город работы */}
              <div className="space-y-2">
                <Label htmlFor="desiredCity" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  Желаемый город работы *
                </Label>
                <Select 
                  value={selectedCityForJob}
                  onValueChange={(value) => {
                    setValue("desiredCity", value);
                    handleCityChange(value);
                  }}
                >
                  <SelectTrigger className="bg-mariko-field border-none text-mariko-dark h-12 rounded-lg">
                    <SelectValue placeholder="Выберите город" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.name}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.desiredCity && (
                  <p className="text-red-400 text-sm font-el-messiri">{errors.desiredCity.message}</p>
                )}
              </div>

              {/* Адрес ресторана */}
              <div className="space-y-2">
                <Label htmlFor="restaurant" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  Адрес ресторана *
                </Label>
                <Select onValueChange={(value) => setValue("restaurant", value)}>
                  <SelectTrigger className="bg-mariko-field border-none text-mariko-dark h-12 rounded-lg">
                    <SelectValue placeholder="Выберите ресторан" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRestaurants.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.address}>
                        {restaurant.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.restaurant && (
                  <p className="text-red-400 text-sm font-el-messiri">{errors.restaurant.message}</p>
                )}
              </div>

              {/* Возраст */}
              <div className="space-y-2">
                <Label htmlFor="age" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  Возраст *
                </Label>
                <Input
                  id="age"
                  type="number"
                  {...register("age", { valueAsNumber: true })}
                  className="bg-mariko-field border-none text-mariko-dark placeholder:text-mariko-dark/60 rounded-lg h-12"
                  placeholder="Введите ваш возраст"
                  min="16"
                  max="80"
                />
                {errors.age && (
                  <p className="text-red-400 text-sm font-el-messiri">{errors.age.message}</p>
                )}
              </div>

              {/* Должность */}
              <div className="space-y-2">
                <Label htmlFor="position" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  Должность *
                </Label>
                <Select onValueChange={(value) => setValue("position", value)}>
                  <SelectTrigger className="bg-mariko-field border-none text-mariko-dark h-12 rounded-lg">
                    <SelectValue placeholder="Выберите должность" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waiter">Официант</SelectItem>
                    <SelectItem value="cook">Повар</SelectItem>
                    <SelectItem value="barista">Бариста</SelectItem>
                    <SelectItem value="administrator">Администратор</SelectItem>
                    <SelectItem value="manager">Менеджер</SelectItem>
                    <SelectItem value="cleaner">Уборщик</SelectItem>
                    <SelectItem value="other">Другая должность</SelectItem>
                  </SelectContent>
                </Select>
                {errors.position && (
                  <p className="text-red-400 text-sm font-el-messiri">{errors.position.message}</p>
                )}
              </div>

              {/* Расскажи о себе */}
              <div className="space-y-2">
                <Label htmlFor="experience" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  Расскажи о себе
                </Label>
                <Textarea
                  id="experience"
                  {...register("experience")}
                  className="bg-mariko-field border-none text-mariko-dark placeholder:text-mariko-dark/60 rounded-lg min-h-[100px] resize-none"
                  placeholder="Расскажи немного о себе: твои интересы, увлечения, что тебя мотивирует. Опыт работы приветствуется, но не обязателен — мы всему научим! ✨"
                />
                {errors.experience && (
                  <p className="text-red-400 text-sm font-el-messiri">{errors.experience.message}</p>
                )}
              </div>

              {/* Телефон */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  Телефон *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneInput.value}
                  onChange={phoneInput.onChange}
                  className="bg-mariko-field border-none text-mariko-dark placeholder:text-mariko-dark/60 rounded-lg h-12"
                  placeholder="+7 (999) 123-45-67"
                />
                {errors.phone && (
                  <p className="text-red-400 text-sm font-el-messiri">{errors.phone.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-mariko-dark font-el-messiri text-lg font-semibold">
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  className="bg-mariko-field border-none text-mariko-dark placeholder:text-mariko-dark/60 rounded-lg h-12"
                  placeholder="example@email.com"
                />
                {errors.email && (
                  <p className="text-red-400 text-sm font-el-messiri">{errors.email.message}</p>
                )}
              </div>

              {/* Кнопка отправки */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={submissionStatus.isSubmitting}
                  className="w-full bg-mariko-field text-mariko-dark font-el-messiri text-lg font-bold h-14 rounded-lg hover:scale-105 transition-transform duration-200 disabled:opacity-50"
                >
                  {submissionStatus.isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Отправляем заявку...
                    </div>
                  ) : (
                    "Отправить заявку"
                  )}
                </Button>
              </div>

              {/* Ошибка отправки */}
              {submissionStatus.error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 font-el-messiri">{submissionStatus.error}</p>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* НАВИГАЦИЯ: позиционирована поверх белого фона */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNavigation currentPage="home" />
        </div>
      </div>
    </div>
  );
}

export default JobApplication; 