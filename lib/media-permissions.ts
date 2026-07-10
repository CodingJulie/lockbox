export type MediaKind = "audio" | "video";
export type PermissionStatus = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

export interface MediaEnvironment {
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasMediaRecorder: boolean;
  hostname: string;
  isLocalhost: boolean;
  platform: "ios" | "android" | "macos" | "windows" | "other";
  browser: "chrome" | "safari" | "firefox" | "edge" | "other";
}

export function detectMediaEnvironment(): MediaEnvironment {
  if (typeof window === "undefined") {
    return {
      isSecureContext: false,
      hasMediaDevices: false,
      hasMediaRecorder: false,
      hostname: "",
      isLocalhost: false,
      platform: "other",
      browser: "other",
    };
  }

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  let platform: MediaEnvironment["platform"] = "other";
  if (isIOS) platform = "ios";
  else if (isAndroid) platform = "android";
  else if (/Mac/.test(ua)) platform = "macos";
  else if (/Win/.test(ua)) platform = "windows";

  let browser: MediaEnvironment["browser"] = "other";
  if (/Edg\//.test(ua)) browser = "edge";
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "chrome";
  else if (/Firefox\//.test(ua)) browser = "firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "safari";

  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

  return {
    isSecureContext: window.isSecureContext,
    hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
    hasMediaRecorder: typeof MediaRecorder !== "undefined",
    hostname,
    isLocalhost,
    platform,
    browser,
  };
}

export function getEnvironmentBlockReason(env: MediaEnvironment): string | null {
  if (!env.isSecureContext) {
    if (env.isLocalhost) return null;
    return `Запись работает только через HTTPS или localhost. Сейчас: ${env.hostname || "неизвестный адрес"}. Откройте http://localhost:3000`;
  }
  if (!env.hasMediaDevices) return "Браузер не поддерживает доступ к микрофону и камере";
  if (!env.hasMediaRecorder) return "Браузер не поддерживает запись MediaRecorder";
  return null;
}

export async function queryMediaPermission(kind: MediaKind): Promise<PermissionStatus> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unknown";
  }

  const names: PermissionName[] =
    kind === "video"
      ? (["camera", "microphone"] as PermissionName[])
      : (["microphone"] as PermissionName[]);

  try {
    const results = await Promise.all(names.map((name) => navigator.permissions.query({ name })));
    if (results.some((r) => r.state === "denied")) return "denied";
    if (results.every((r) => r.state === "granted")) return "granted";
    if (results.some((r) => r.state === "prompt")) return "prompt";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function getMediaConstraints(kind: MediaKind): MediaStreamConstraints {
  if (kind === "video") {
    return {
      audio: true,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 854 },
        height: { ideal: 480 },
        frameRate: { ideal: 15, max: 24 },
      },
    };
  }
  return { audio: true };
}

export interface SettingsGuide {
  title: string;
  steps: string[];
  systemLink?: { label: string; url: string };
}

export function getSettingsGuide(kind: MediaKind, env: MediaEnvironment): SettingsGuide {
  const device = kind === "video" ? "камеру и микрофон" : "микрофон";

  if (env.platform === "macos") {
    const browserSteps: Record<MediaEnvironment["browser"], string[]> = {
      safari: [
        "Откройте Safari → Настройки → Веб-сайты",
        kind === "video"
          ? "Выберите «Камера» и «Микрофон» → разрешите для этого сайта"
          : "Выберите «Микрофон» → разрешите для этого сайта",
        "Обновите страницу и нажмите «Разрешить доступ» снова",
      ],
      chrome: [
        "Нажмите значок замка слева от адресной строки",
        "Включите «Камера» и «Микрофон» → «Разрешить»",
        "Обновите страницу",
      ],
      edge: [
        "Нажмите значок замка слева от адресной строки",
        "Разрешите доступ к камере и микрофону для сайта",
        "Обновите страницу",
      ],
      firefox: [
        "Нажмите значок замка слева от адресной строки",
        "Снимите блокировку микрофона и камеры",
        "Обновите страницу",
      ],
      other: ["Откройте настройки сайта в браузере", `Разрешите ${device}`, "Обновите страницу"],
    };

    return {
      title: `Как включить ${device}`,
      steps: [
        "Сначала проверьте системные настройки macOS:",
        "Системные настройки → Конфиденциальность и безопасность → Камера / Микрофон",
        "Убедитесь, что ваш браузер включён в списке",
        ...browserSteps[env.browser],
      ],
      systemLink: {
        label: "Открыть настройки конфиденциальности macOS",
        url:
          kind === "video"
            ? "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Camera"
            : "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone",
      },
    };
  }

  if (env.platform === "ios") {
    return {
      title: `Как включить ${device} на iPhone/iPad`,
      steps: [
        "Настройки → Safari → Камера / Микрофон → «Спросить» или «Разрешить»",
        "Настройки → Конфиденциальность → Камера / Микрофон → включите Safari",
        "Закройте вкладку, откройте сайт заново через localhost или HTTPS",
        "Нажмите «Разрешить доступ» — появится системный запрос iOS",
      ],
    };
  }

  if (env.platform === "android") {
    return {
      title: `Как включить ${device} на Android`,
      steps: [
        "Нажмите значок замка в адресной строке Chrome",
        "Разрешите «Камера» и «Микрофон»",
        "Если доступ заблокирован: Настройки → Приложения → Chrome → Разрешения",
        "Обновите страницу и нажмите «Разрешить доступ»",
      ],
    };
  }

  return {
    title: `Как включить ${device}`,
    steps: [
      "Нажмите значок замка или «i» слева от адресной строки",
      `Найдите «Камера» / «Микрофон» и выберите «Разрешить»`,
      "Обновите страницу",
      "Нажмите «Разрешить доступ» — браузер покажет системный запрос",
    ],
  };
}

export function mapMediaError(
  err: unknown,
  kind: MediaKind
): {
  message: string;
  needsSettings: boolean;
} {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return {
          message:
            kind === "video"
              ? "Доступ к камере и микрофону запрещён"
              : "Доступ к микрофону запрещён",
          needsSettings: true,
        };
      case "SecurityError":
        return {
          message: "Браузер заблокировал доступ. Используйте https://localhost:3000",
          needsSettings: true,
        };
      case "NotFoundError":
      case "DevicesNotFoundError":
        return {
          message:
            kind === "video"
              ? "Камера или микрофон не найдены на устройстве"
              : "Микрофон не найден на устройстве",
          needsSettings: false,
        };
      case "NotReadableError":
      case "TrackStartError":
        return {
          message: "Устройство занято другим приложением. Закройте Zoom, Telegram и др.",
          needsSettings: false,
        };
      default:
        return {
          message: err.message || "Не удалось получить доступ к устройствам",
          needsSettings: false,
        };
    }
  }
  if (err instanceof Error) {
    return { message: err.message, needsSettings: false };
  }
  return {
    message: kind === "video" ? "Не удалось начать видеозапись" : "Не удалось начать аудиозапись",
    needsSettings: false,
  };
}

export function openSystemSettings(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
