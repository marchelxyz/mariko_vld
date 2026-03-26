import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Megaphone, Plus, Save, Trash2, Copy, Upload } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { useAdmin, useCities } from "@shared/hooks";
import { Permission, UserRole } from "@shared/types";
import { type PromotionCardData } from "@shared/data";
import {
  fetchPromotionImageLibrary,
  fetchPromotions,
  savePromotions,
  uploadPromotionImage,
  type PromotionImageAsset,
} from "@shared/api/promotionsApi";
import { Button, Input, Label, Textarea, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@shared/ui";
import { useToast } from "@/hooks";
import { ImageLibraryModal } from "../menu/ui";

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());

const ensureUuid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const pattern = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return pattern.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const resolvePromotionImageUrl = (url?: string | null) => {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  // Если URL уже полный, возвращаем как есть
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  // Для относительных путей возвращаем как есть (обрабатывается на сервере)
  return trimmed;
};

const buildLibraryImageUrl = (asset: PromotionImageAsset) => {
  if (asset?.url) {
    return asset.url; // уже публичный URL
  }
  // Если нет URL, возвращаем пустую строку
  return "";
};

const normalizeImageUrl = (raw?: string | null) => {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const encodedPath = url.pathname
      .split("/")
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join("/");
    return `${url.protocol}//${url.host}${encodedPath}${url.search}${url.hash}`;
  } catch {
    return raw.replace(/ /g, "%20");
  }
};

/**
 * Читает файл как data URL для предпросмотра.
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Не удалось прочитать файл как data URL"));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Ошибка чтения файла"));
    };
    reader.readAsDataURL(file);
  });
}

type PromotionUploadContext =
  | { mode: "card"; promoId: string }
  | { mode: "library" };

const shouldAddPromotionImageToLibrary = (raw?: string | null) => {
  if (!raw) return false;
  const trimmed = raw.trim();
  return Boolean(trimmed) && !trimmed.startsWith("data:");
};

const getPromotionLibraryPath = (
  promo: PromotionCardData,
  index: number,
  normalizedUrl: string,
) => {
  const fallbackName = promo.title?.trim() || `promotion-${index + 1}`;
  if (normalizedUrl.startsWith("/")) {
    return normalizedUrl.replace(/^\/+/, "");
  }
  try {
    const parsed = new URL(normalizedUrl);
    const fileName = parsed.pathname.split("/").pop();
    return fileName ? decodeURIComponent(fileName) : fallbackName;
  } catch {
    return fallbackName;
  }
};

const mergePromotionImagesIntoLibrary = (
  assets: PromotionImageAsset[],
  promotions: PromotionCardData[],
) => {
  const merged: PromotionImageAsset[] = [];
  const seen = new Set<string>();

  const registerAsset = (asset: PromotionImageAsset) => {
    const normalizedUrl = normalizeImageUrl(asset.url || buildLibraryImageUrl(asset));
    if (!normalizedUrl || normalizedUrl.startsWith("data:") || seen.has(normalizedUrl)) {
      return;
    }
    seen.add(normalizedUrl);
    merged.push({
      ...asset,
      url: normalizedUrl,
    });
  };

  assets.forEach(registerAsset);

  promotions.forEach((promo, index) => {
    if (!shouldAddPromotionImageToLibrary(promo.imageUrl)) {
      return;
    }
    const normalizedUrl = normalizeImageUrl(resolvePromotionImageUrl(promo.imageUrl));
    if (!normalizedUrl || seen.has(normalizedUrl)) {
      return;
    }
    seen.add(normalizedUrl);
    merged.push({
      path: getPromotionLibraryPath(promo, index, normalizedUrl),
      url: normalizedUrl,
      size: 0,
      updatedAt: null,
    });
  });

  return merged;
};

type PromotionsErrorContext = {
  currentCityId: string | null;
  copyFromCityId: string | null;
  accessibleCitiesCount: number;
  promotionsCount: number;
  allowedRestaurants: string[];
  isSuperAdmin: boolean;
  userRole: UserRole;
};

type PromotionsErrorBoundaryProps = {
  children: ReactNode;
  context?: () => PromotionsErrorContext | undefined;
};

type PromotionsErrorBoundaryState = {
  hasError: boolean;
  error?: Error | null;
};

const normalizeBaseUrl = (value?: string) => {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const resolveAdminLogsUrl = () => {
  const adminBase = normalizeBaseUrl(import.meta.env.VITE_ADMIN_API_URL);
  const serverBase = normalizeBaseUrl(import.meta.env.VITE_SERVER_API_URL);
  if (adminBase) {
    return `${adminBase}/admin/logs`;
  }
  if (serverBase) {
    return `${serverBase}/cart/admin/logs`;
  }
  return "/api/cart/admin/logs";
};

const ADMIN_LOGS_URL = resolveAdminLogsUrl();

async function reportPromotionsError(
  error: Error,
  info: ErrorInfo,
  context?: PromotionsErrorContext,
): Promise<void> {
  try {
    await fetch(ADMIN_LOGS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "error",
        category: "promotions",
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        context,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Игнорируем сбои логирования, чтобы не мешать пользователю
  }
}

class PromotionsErrorBoundary extends Component<
  PromotionsErrorBoundaryProps,
  PromotionsErrorBoundaryState
> {
  state: PromotionsErrorBoundaryState = { hasError: false, error: null };

  async componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ hasError: true, error });
    const context = this.props.context ? this.props.context() : undefined;
    await reportPromotionsError(error, info, context);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">
          <p className="font-semibold text-white">Не удалось загрузить «Управление акциями».</p>
          <p className="text-sm text-white/70 mt-1">Обновите страницу или попробуйте позже.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function PromotionsManagementContent({
  onContextChange,
}: {
  onContextChange?: (context: PromotionsErrorContext) => void;
}): JSX.Element {
  const { cities: allCities, isLoading: isCitiesLoading } = useCities();
  const { isSuperAdmin, allowedRestaurants, hasPermission, userRole } = useAdmin();
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<PromotionCardData[]>([]);
  const [currentCityId, setCurrentCityId] = useState<string | null>(null);
  const [copyFromCityId, setCopyFromCityId] = useState<string | null>(null);
  const [sourcePromotions, setSourcePromotions] = useState<PromotionCardData[]>([]);
  const [imageLibrary, setImageLibrary] = useState<PromotionImageAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLoadingPromos, setIsLoadingPromos] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLibraryUploading, setIsLibraryUploading] = useState(false);
  const [uploadingPromoId, setUploadingPromoId] = useState<string | null>(null);
  const [openLibraryForId, setOpenLibraryForId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadContextRef = useRef<PromotionUploadContext | null>(null);
  const noPromotionsAccess = !hasPermission(Permission.MANAGE_PROMOTIONS);

  const accessibleCities = useMemo(() => {
    if (isSuperAdmin() || userRole === UserRole.ADMIN) {
      return allCities;
    }
    if (!allowedRestaurants?.length) {
      return [];
    }
    const allowedSet = new Set(allowedRestaurants);
    return allCities.filter((city) => city.restaurants?.some((restaurant) => allowedSet.has(restaurant.id)));
  }, [allCities, allowedRestaurants, isSuperAdmin, userRole]);

  useEffect(() => {
    if (!isCitiesLoading && accessibleCities.length && !currentCityId) {
      setCurrentCityId(accessibleCities[0].id);
    }
    if (!isCitiesLoading && currentCityId && !accessibleCities.some((city) => city.id === currentCityId)) {
      setCurrentCityId(accessibleCities[0]?.id ?? null);
    }
  }, [accessibleCities, currentCityId, isCitiesLoading]);

  useEffect(() => {
    if (copyFromCityId && !accessibleCities.some((city) => city.id === copyFromCityId)) {
      setCopyFromCityId(null);
    }
  }, [accessibleCities, copyFromCityId]);

  useEffect(() => {
    onContextChange?.({
      currentCityId,
      copyFromCityId,
      accessibleCitiesCount: accessibleCities.length,
      promotionsCount: promotions.length,
      allowedRestaurants: allowedRestaurants ?? [],
      isSuperAdmin: isSuperAdmin(),
      userRole,
    });
  }, [
    accessibleCities.length,
    allowedRestaurants,
    copyFromCityId,
    currentCityId,
    isSuperAdmin,
    onContextChange,
    promotions.length,
    userRole,
  ]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (noPromotionsAccess) {
        setPromotions([]);
        return;
      }
      if (!currentCityId) {
        setPromotions([]);
        return;
      }
      setIsLoadingPromos(true);
      try {
        const list = await fetchPromotions(currentCityId);
        if (!cancelled) {
          const normalized = (list ?? []).map((p, index) => ({
            ...p,
            id: isUuid(p.id) ? p.id : ensureUuid(),
            displayOrder: p.displayOrder ?? index + 1,
          }));
          setPromotions(normalized);
        }
      } catch (error) {
        console.error("Ошибка загрузки акций:", error);
        if (!cancelled) {
          setPromotions([]);
          toast({
            title: "Не удалось загрузить акции",
            description: "Проверьте подключение или права.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPromos(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentCityId, noPromotionsAccess, toast]);

  useEffect(() => {
    if (!copyFromCityId) {
      setSourcePromotions([]);
      return;
    }
    const loadSource = async () => {
      if (noPromotionsAccess) {
        setSourcePromotions([]);
        return;
      }
      try {
        const source = await fetchPromotions(copyFromCityId);
        const normalized = (source ?? []).map((p, index) => ({
          ...p,
          id: isUuid(p.id) ? p.id : ensureUuid(),
          displayOrder: p.displayOrder ?? index + 1,
        }));
        setSourcePromotions(normalized);
      } catch (error) {
        console.error("Ошибка загрузки акций-источника:", error);
        setSourcePromotions([]);
      }
    };
    void loadSource();
  }, [copyFromCityId, noPromotionsAccess]);

  useEffect(() => {
    if (noPromotionsAccess) {
      setImageLibrary([]);
      return;
    }
    if (currentCityId) {
      void loadImageLibrary();
    } else {
      setImageLibrary([]);
    }
  }, [currentCityId, noPromotionsAccess]);

  const emptyState = useMemo(() => promotions.length === 0, [promotions.length]);
  const mergedLibrary = useMemo(
    () => mergePromotionImagesIntoLibrary(imageLibrary, promotions),
    [imageLibrary, promotions],
  );
  const isAnyUploadInProgress = Boolean(uploadingPromoId) || isLibraryUploading;

  const filteredLibrary = useMemo(() => {
    if (!librarySearch.trim()) return mergedLibrary;
    const query = librarySearch.trim().toLowerCase();
    return mergedLibrary.filter((img) => img.path.toLowerCase().includes(query));
  }, [mergedLibrary, librarySearch]);

  const preparedLibrary = useMemo(
    () =>
      filteredLibrary.map((img) => ({
        ...img,
        url: normalizeImageUrl(img.url || buildLibraryImageUrl(img)),
      })),
    [filteredLibrary],
  );

  if (noPromotionsAccess) {
    return null;
  }

  if (!isCitiesLoading && accessibleCities.length === 0) {
    return null;
  }

  const handleAdd = () => {
    const id = ensureUuid();
    setPromotions((prev) => [
      ...prev,
      {
        id,
        title: "Новая акция",
        description: "",
        imageUrl: "",
      },
    ]);
    toast({ title: "Добавлена новая карточка", description: "Заполните данные и сохраните." });
  };

  const handleRemove = (id: string) => {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Карточка удалена", description: "Не забудьте сохранить изменения." });
  };

  const handleRemoveWithConfirm = (promo: PromotionCardData) => {
    const confirmed = window.confirm(`Удалить акцию «${promo.title || "без названия"}»?`);
    if (!confirmed) return;
    handleRemove(promo.id);
  };

  const handleChange = (id: string, field: keyof PromotionCardData, value: string) => {
    setPromotions((prev) =>
      prev.map((promo) => (promo.id === id ? { ...promo, [field]: value } : promo)),
    );
  };

  const handleManualSave = async () => {
    if (!currentCityId) {
      toast({ title: "Выберите город", description: "Перед сохранением выберите город.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    const payload = promotions.map((promo, index) => ({
      ...promo,
      id: isUuid(promo.id) ? promo.id : ensureUuid(),
      imageUrl: resolvePromotionImageUrl(promo.imageUrl),
      isActive: promo.isActive !== false,
      displayOrder: index + 1,
    }));

    try {
      const result = await savePromotions(currentCityId, payload);
      if (result?.success === false) {
        toast({
          title: "Не удалось сохранить акции",
          description: result.errorMessage || "Проверьте подключение или права.",
          variant: "destructive",
        });
        return;
      }

      setPromotions(payload);
      toast({ title: "Сохранено", description: "Акции обновлены для главной страницы." });
    } catch (error: unknown) {
      console.error("Ошибка сохранения акций:", error);
      toast({
        title: "Не удалось сохранить",
        description: "Попробуйте ещё раз.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyFrom = () => {
    if (!copyFromCityId) {
      toast({ title: "Выберите город", description: "Укажите город-источник для копирования.", variant: "destructive" });
      return;
    }
    fetchPromotions(copyFromCityId)
      .then((copied) => {
        const normalized = (copied ?? []).map((p, index) => ({
          ...p,
          id: isUuid(p.id) ? p.id : ensureUuid(),
          displayOrder: p.displayOrder ?? index + 1,
        }));
        setPromotions(normalized);
        toast({ title: "Скопировано", description: "Акции скопированы из выбранного города." });
      })
      .catch((error) => {
        console.error("Ошибка копирования акций:", error);
        toast({
          title: "Не удалось скопировать",
          description: "Проверьте подключение или права.",
          variant: "destructive",
        });
      });
  };

  const handleCopySingle = (promo: PromotionCardData) => {
    if (!copyFromCityId) {
      toast({
        title: "Выберите город",
        description: "Укажите город-источник для копирования.",
        variant: "destructive",
      });
      return;
    }
    const source = sourcePromotions.find((p) => p.id === promo.id);
    if (!source) {
      toast({ title: "Не найдена акция", description: "Попробуйте выбрать другую акцию.", variant: "destructive" });
      return;
    }
    const exists = promotions.some(
      (p) =>
        p.title.trim().toLowerCase() === (source.title || "").trim().toLowerCase() &&
        (p.imageUrl || "").trim() === (source.imageUrl || "").trim() &&
        (p.description || "").trim() === (source.description || "").trim(),
    );
    if (exists) {
      toast({
        title: "Такая акция уже есть",
        description: "В текущем городе карточка с таким содержимым уже существует.",
        variant: "destructive",
      });
      return;
    }
    const id = ensureUuid();
    const cloned: PromotionCardData = { ...source, id };
    setPromotions((prev) => [...prev, cloned]);
    toast({ title: "Акция скопирована", description: "Отредактируйте детали при необходимости." });
  };

  const loadImageLibrary = async () => {
    if (!currentCityId) return;
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const images = await fetchPromotionImageLibrary(currentCityId, "city");
      setImageLibrary(images ?? []);
    } catch (error) {
      console.error("Ошибка загрузки библиотеки изображений:", error);
      setLibraryError("Не удалось загрузить библиотеку изображений.");
      toast({
        title: "Не удалось загрузить библиотеку",
        description: "Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleSelectLibraryImage = (promoId: string, url: string) => {
    setPromotions((prev) =>
      prev.map((promo) => (promo.id === promoId ? { ...promo, imageUrl: url } : promo)),
    );
    setOpenLibraryForId(null);
    setIsLibraryOpen(false);
  };

  const openFileDialog = (context: PromotionUploadContext) => {
    uploadContextRef.current = context;
    fileInputRef.current?.click();
  };

  const handleUploadFileClick = (promoId: string) => {
    openFileDialog({ mode: "card", promoId });
  };

  const handleLibraryUploadClick = () => {
    openFileDialog({ mode: "library" });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const context = uploadContextRef.current;
    if (!file || !context || !currentCityId) {
      return;
    }
    event.target.value = "";
    uploadContextRef.current = null;

    const previousUrl =
      context.mode === "card"
        ? promotions.find((promo) => promo.id === context.promoId)?.imageUrl ?? ""
        : "";

    try {
      const optimizedFile = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1440,
        quality: 0.9,
        maxSizeMB: 4,
      });

      if (context.mode === "card") {
        setUploadingPromoId(context.promoId);
        const previewUrl = await readFileAsDataUrl(optimizedFile);
        setPromotions((prev) =>
          prev.map((promo) =>
            promo.id === context.promoId ? { ...promo, imageUrl: previewUrl } : promo,
          ),
        );
      } else {
        setIsLibraryUploading(true);
      }

      const uploaded = await uploadPromotionImage(optimizedFile, currentCityId);
      if (!uploaded?.url) {
        throw new Error("Сервер не вернул URL загруженного изображения.");
      }

      if (context.mode === "card") {
        setPromotions((prev) =>
          prev.map((promo) =>
            promo.id === context.promoId ? { ...promo, imageUrl: uploaded.url } : promo,
          ),
        );
        toast({
          title: "Изображение загружено",
          description: "Фото добавлено в библиотеку и прикреплено к карточке.",
        });
      } else {
        toast({
          title: "Фото загружено в библиотеку",
          description: "Теперь его можно выбирать для карточек акций.",
        });
      }

      await loadImageLibrary();
    } catch (error) {
      console.error("Ошибка загрузки изображения акции:", error);
      if (context.mode === "card") {
        setPromotions((prev) =>
          prev.map((promo) =>
            promo.id === context.promoId ? { ...promo, imageUrl: previousUrl } : promo,
          ),
        );
      }
      toast({
        title: "Не удалось загрузить изображение",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        variant: "destructive",
      });
    } finally {
      setUploadingPromoId(null);
      setIsLibraryUploading(false);
    }
  };

  if (isLoadingPromos && !promotions.length) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-white flex items-center gap-3">
        <div className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        <span>Загружаем акции…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-white font-el-messiri text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-mariko-primary" />
              Управление акциями
            </h2>
            <p className="text-white/70 mt-1">
              Добавляйте карточки, меняйте описание и ссылки на изображения для карусели на главной.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAdd} disabled={isSaving}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить карточку
            </Button>
            <Button
              variant="default"
              onClick={handleManualSave}
              className="bg-mariko-primary"
              disabled={isSaving || isAnyUploadInProgress}
            >
              <Save className="h-4 w-4 mr-2" />
              {isAnyUploadInProgress ? "Загрузка изображения..." : isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/80">Город для редактирования</Label>
            <Select
              value={currentCityId ?? undefined}
              onValueChange={(val) => setCurrentCityId(val)}
            >
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder={isCitiesLoading ? "Загрузка..." : "Выберите город"} />
              </SelectTrigger>
              <SelectContent>
                {accessibleCities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
                {!accessibleCities.length && (
                  <div className="px-3 py-2 text-sm text-white/60">
                    Нет доступных городов
                  </div>
                )}
              </SelectContent>
            </Select>
            {isLoadingPromos && (
              <p className="text-xs text-white/60">Загружаем акции для выбранного города…</p>
            )}
            <Button
              variant="secondary"
              onClick={handleLibraryUploadClick}
              className="bg-white/10 text-white"
              disabled={!currentCityId || isAnyUploadInProgress}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isLibraryUploading ? "Загружаем в библиотеку..." : "Загрузить фото в библиотеку"}
            </Button>
            <p className="text-xs text-white/60">
              Загрузите изображения заранее, чтобы затем быстро подставлять их в карточки акций.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Скопировать акции из другого города</Label>
            <div className="flex gap-2">
              <Select
                value={copyFromCityId ?? undefined}
                onValueChange={(val) => setCopyFromCityId(val)}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Выберите город-источник" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleCities
                    .filter((city) => city.id !== currentCityId)
                    .map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  {!accessibleCities.length && (
                    <div className="px-3 py-2 text-sm text-white/60">
                      Нет доступных городов
                    </div>
                  )}
                </SelectContent>
              </Select>
              <Button onClick={handleCopyFrom} variant="secondary" className="bg-white/10 text-white">
                <Copy className="h-4 w-4 mr-1" />
                Скопировать все
              </Button>
            </div>
            <p className="text-xs text-white/60">
              Можно перенести готовые карточки из другого города и отредактировать под текущий.
            </p>

            {copyFromCityId && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-white/80">Или скопируйте одну акцию:</p>
                {sourcePromotions.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/60">
                    В выбранном городе нет акций.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sourcePromotions.map((promo) => (
                      <button
                        key={promo.id}
                        type="button"
                        onClick={() => handleCopySingle(promo)}
                        className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left transition hover:border-white/30 hover:bg-white/10"
                      >
                        <div className="relative h-28 w-full bg-black/20">
                          {promo.imageUrl ? (
                            <img
                              src={resolvePromotionImageUrl(promo.imageUrl)}
                              alt={promo.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/60">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/30 opacity-0 transition group-hover:opacity-100" />
                          <div className="absolute bottom-2 right-2 rounded-full bg-white/15 px-3 py-1 text-xs text-white">
                            Скопировать
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                          <p className="text-white font-semibold line-clamp-2">{promo.title || "Без названия"}</p>
                          {promo.description && (
                            <p className="text-white/70 text-xs line-clamp-2">{promo.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {emptyState ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8 text-white/80">
          <ImageIcon className="h-10 w-10" />
          <p className="text-center">Карточек нет. Добавьте первую акцию, чтобы показать её в карусели.</p>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить первую акцию
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {promotions.map((promo, idx) => (
            <div
              key={promo.id}
              className="relative rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5 shadow-lg shadow-black/10"
            >
              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-white/60 text-sm min-w-0">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white font-semibold flex-shrink-0">
                      {idx + 1}
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveWithConfirm(promo)}
                    className="bg-red-600 hover:bg-red-500 px-2 py-1 text-xs h-8"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Заголовок</Label>
                  <Input
                    value={promo.title}
                    onChange={(e) => handleChange(promo.id, 'title', e.target.value)}
                    placeholder="Например, «-30% именинникам»"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Описание (при открытии)</Label>
                  <Textarea
                    value={promo.description ?? ''}
                    onChange={(e) => handleChange(promo.id, 'description', e.target.value)}
                    rows={3}
                    placeholder="Коротко опишите условия акции"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Ссылка на изображение</Label>
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    {promo.imageUrl ? (
                      <img
                        src={resolvePromotionImageUrl(promo.imageUrl)}
                        alt={promo.title || `Акция ${idx + 1}`}
                        className="h-44 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-44 w-full items-center justify-center text-white/50">
                        <div className="flex flex-col items-center gap-2 text-center">
                          <ImageIcon className="h-8 w-8" />
                          <span className="text-sm">Изображение пока не выбрано</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Input
                    value={promo.imageUrl ?? ""}
                    onChange={(e) => handleChange(promo.id, 'imageUrl', e.target.value)}
                    placeholder="/images/promotions/..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleUploadFileClick(promo.id)}
                      className="bg-white/10 text-white"
                      disabled={isAnyUploadInProgress}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Загрузить с устройства
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setOpenLibraryForId(promo.id);
                        setIsLibraryOpen(true);
                        setLibrarySearch('');
                        if (!imageLibrary.length) {
                          void loadImageLibrary();
                        }
                      }}
                      className="bg-white/10 text-white"
                      disabled={isAnyUploadInProgress}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Выбрать из библиотеки
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ImageLibraryModal
        isOpen={isLibraryOpen}
        images={preparedLibrary}
        searchQuery={librarySearch}
        isLoading={libraryLoading}
        error={libraryError}
        selectedUrl={
          promotions.find((p) => p.id === openLibraryForId)?.imageUrl ?? undefined
        }
        onUpload={handleLibraryUploadClick}
        uploadButtonLabel={isLibraryUploading ? "Загружаем..." : "Загрузить в библиотеку"}
        isUploading={isLibraryUploading}
        emptyStateDescription="Пока библиотека пуста. Загрузите фото в библиотеку или прикрепите файл к конкретной карточке акции."
        onSelect={(url) => {
          if (openLibraryForId) {
            handleSelectLibraryImage(openLibraryForId, url);
          }
        }}
        onSearchChange={setLibrarySearch}
        onClose={() => {
          setIsLibraryOpen(false);
          setOpenLibraryForId(null);
        }}
      />
    </div>
  );
}

export function PromotionsManagement(): JSX.Element {
  const contextRef = useRef<PromotionsErrorContext>({
    currentCityId: null,
    copyFromCityId: null,
    accessibleCitiesCount: 0,
    promotionsCount: 0,
    allowedRestaurants: [],
    isSuperAdmin: false,
    userRole: UserRole.USER,
  });

  return (
    <PromotionsErrorBoundary context={() => contextRef.current}>
      <PromotionsManagementContent
        onContextChange={(ctx) => {
          contextRef.current = ctx;
        }}
      />
    </PromotionsErrorBoundary>
  );
}

export default PromotionsManagement;
