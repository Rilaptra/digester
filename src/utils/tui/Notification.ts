// Tipe khusus agar autocomplete sound muncul di Windows
export type ToastSound =
  | "Default"
  | "IM"
  | "Mail"
  | "Reminder"
  | "SMS"
  | "Alarm"
  | "Alarm2"
  | "Alarm3"
  | "Alarm4"
  | "Alarm5"
  | "Alarm6"
  | "Alarm7"
  | "Alarm8"
  | "Alarm9"
  | "Alarm10"
  | "Call"
  | "Call2"
  | "Call3"
  | "Call4"
  | "Call5"
  | "Call6"
  | "Call7"
  | "Call8"
  | "Call9"
  | "Call10"
  | null; // null = silent

export type ToastScenario = "reminder" | "alarm" | "incomingCall" | "urgent";
export type ToastImagePlacement = "appLogoOverride" | "hero" | "inline";
export type ToastButtonStyle = "Success" | "Critical";

export interface ToastImage {
  src: string;
  alt?: string;
  placement?: ToastImagePlacement;
  hintCrop?: "circle";
}

export interface ToastAction {
  label: string;
  url: string;
  activationType?: "foreground" | "background" | "protocol";
  placement?: "contextMenu";
  imageUri?: string;
  buttonStyle?: ToastButtonStyle;
  toolTip?: string;
}

export interface ToastProgress {
  title?: string;
  status: string;
  value: number | "indeterminate";
  valueStringOverride?: string;
}

export interface ToastConfig {
  title?: string;
  message: string;
  tag?: string;
  subtitle?: string;
  appName?: string;
  duration?: "short" | "long";
  sound?: ToastSound;
  scenario?: ToastScenario;
  images?: ToastImage[];
  actions?: ToastAction[];
  progress?: ToastProgress;
  header?: {
    id: string;
    title: string;
    arguments: string;
    activationType?: "foreground" | "protocol";
  };
  launch?: string;
}

/**
 * 🛠️ Builder Pattern untuk Notifikasi (DX Friendly & Advanced)
 */
export class ToastBuilder {
  private config: ToastConfig;

  constructor(message?: string) {
    this.config = { message: message || "" };
  }

  static create(message?: string): ToastBuilder {
    return new ToastBuilder(message);
  }

  setTitle(title: string): this {
    this.config.title = title;
    return this;
  }

  setMessage(message: string): this {
    this.config.message = message;
    return this;
  }

  setSubtitle(subtitle: string): this {
    this.config.subtitle = subtitle;
    return this;
  }

  setAppName(appName: string): this {
    this.config.appName = appName;
    return this;
  }

  setDuration(duration: "short" | "long"): this {
    this.config.duration = duration;
    return this;
  }

  setSound(sound: ToastSound): this {
    this.config.sound = sound;
    return this;
  }

  setScenario(scenario: ToastScenario): this {
    this.config.scenario = scenario;
    return this;
  }

  addImage(
    src: string,
    placement: ToastImagePlacement = "appLogoOverride",
    hintCrop?: "circle",
  ): this {
    if (!this.config.images) this.config.images = [];
    this.config.images.push({ src, placement, hintCrop });
    return this;
  }

  setProgress(
    status: string,
    value: number | "indeterminate",
    title?: string,
    valueStringOverride?: string,
  ): this {
    this.config.progress = { status, value, title, valueStringOverride };
    return this;
  }

  setHeader(id: string, title: string, argumentsStr: string): this {
    this.config.header = { id, title, arguments: argumentsStr };
    return this;
  }

  addButton(
    label: string,
    url: string,
    opts?: { buttonStyle?: ToastButtonStyle },
  ): this {
    if (!this.config.actions) this.config.actions = [];
    this.config.actions.push({
      label,
      url,
      activationType: "protocol",
      buttonStyle: opts?.buttonStyle,
    });
    return this;
  }

  addContextMenu(label: string, url: string): this {
    if (!this.config.actions) this.config.actions = [];
    this.config.actions.push({
      label,
      url,
      activationType: "protocol",
      placement: "contextMenu",
    });
    return this;
  }

  /**
   * 🆕 Set Tag untuk notifikasi.
   * Jika notifikasi dengan Tag yang sama dipanggil lagi, ia akan di-UPDATE, bukan ditambah baru.
   */
  setTag(tag: string): this {
    this.config.tag = tag;
    return this;
  }

  /**
   * 🆕 Helper khusus untuk update progress bar dengan cepat.
   */
  updateProgress(value: number | "indeterminate", status?: string): this {
    if (!this.config.progress) {
      throw new Error(
        "Progress belum di-set. Gunakan .setProgress() terlebih dahulu.",
      );
    }
    this.config.progress.value = value;
    if (status) this.config.progress.status = status;
    return this;
  }

  async show(): Promise<void> {
    if (!this.config.message) throw new Error("Pesan wajib diisi!");
    await Notification.show(this.config);
  }
}

/**
 * Fungsi utilitas untuk escaping XML yang aman dari injeksi karakter
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export class Notification {
  /**
   * 🔔 Menampilkan Notifikasi OS Native (Advanced & Cross-Platform)
   */
  static async show(config: ToastConfig | string): Promise<void> {
    const cfg = typeof config === "string" ? { message: config } : config;
    const title = cfg.title || "Digester";
    const message = cfg.message;
    const appName = cfg.appName || "Digester CLI";

    const platform = process.platform;

    try {
      if (platform === "win32") {
        await Notification.showWindows(cfg, title, message, appName);
      } else if (platform === "darwin") {
        Notification.showMacOS(cfg, title, message);
      } else {
        Notification.showLinux(cfg, title, message);
      }
    } catch (err) {
      console.error("🔴 Notification Error Details:\n", err);
    }
  }

  private static buildWindowsXml(
    cfg: ToastConfig,
    title: string,
    message: string,
  ): string {
    const formatWinPath = (src: string) => {
      if (src && /^[A-Za-z]:\\/.test(src)) {
        return `file:///${src.replace(/\\/g, "/")}`;
      }
      return src;
    };

    let xml = `<?xml version="1.0"?><toast`;

    const toastAttrs: string[] = [];
    // 🆕 Force duration long jika ada progress bar, alarm, atau incomingCall
    const duration =
      cfg.scenario === "alarm" ||
      cfg.scenario === "incomingCall" ||
      cfg.progress
        ? "long"
        : cfg.duration || "short";

    toastAttrs.push(`duration="${duration}"`);
    if (cfg.scenario) toastAttrs.push(`scenario="${cfg.scenario}"`);
    if (cfg.launch) {
      toastAttrs.push(`activationType="protocol"`);
      toastAttrs.push(`launch="${escapeXml(cfg.launch)}"`);
    }

    const useButtonStyle = cfg.actions?.some((a) => a.buttonStyle) || false;
    if (useButtonStyle) toastAttrs.push(`useButtonStyle="true"`);

    xml += ` ${toastAttrs.join(" ")}>`;
    xml += `<visual><binding template="ToastGeneric">`;

    // Hero Image
    const heroImg = cfg.images?.find((i) => i.placement === "hero");
    if (heroImg) {
      xml += `<image placement="hero" src="${escapeXml(formatWinPath(heroImg.src))}" ${heroImg.alt ? `alt="${escapeXml(heroImg.alt)}"` : ""}/>`;
    }

    // Texts
    xml += `<text>${escapeXml(title)}</text>`;
    xml += `<text>${escapeXml(message)}</text>`;

    // Progress Bar
    if (cfg.progress) {
      xml += `<progress status="${escapeXml(cfg.progress.status)}" value="${cfg.progress.value === "indeterminate" ? "indeterminate" : cfg.progress.value}"`;
      if (cfg.progress.title)
        xml += ` title="${escapeXml(cfg.progress.title)}"`;
      if (cfg.progress.valueStringOverride)
        xml += ` valueStringOverride="${escapeXml(cfg.progress.valueStringOverride)}"`;
      xml += `/>`;
    }

    // Inline Images
    const inlineImgs =
      cfg.images?.filter((i) => !i.placement || i.placement === "inline") || [];
    for (const img of inlineImgs) {
      xml += `<image src="${escapeXml(formatWinPath(img.src))}" ${img.alt ? `alt="${escapeXml(img.alt)}"` : ""}/>`;
    }

    // Subtitle / Attribution
    if (cfg.subtitle) {
      xml += `<text placement="attribution">${escapeXml(cfg.subtitle)}</text>`;
    }

    // AppLogoOverride Image (Icon Toast)
    const appLogo = cfg.images?.find((i) => i.placement === "appLogoOverride");
    if (appLogo) {
      const imgAttrs = [
        `placement="appLogoOverride"`,
        `src="${escapeXml(formatWinPath(appLogo.src))}"`,
      ];
      if (appLogo.alt) imgAttrs.push(`alt="${escapeXml(appLogo.alt)}"`);
      if (appLogo.hintCrop === "circle") imgAttrs.push(`hint-crop="circle"`);
      xml += `<image ${imgAttrs.join(" ")}/>`;
    }

    xml += `</binding></visual>`;

    // Audio
    if (cfg.sound === null) {
      xml += `<audio silent="true"/>`;
    } else {
      const defaultSound =
        cfg.scenario === "alarm"
          ? "Alarm"
          : cfg.scenario === "incomingCall"
            ? "Call"
            : "Default";
      const soundName = cfg.sound || defaultSound;
      const loop =
        cfg.scenario === "alarm" || cfg.scenario === "incomingCall"
          ? 'loop="true"'
          : "";
      xml += `<audio src="ms-winsoundevent:Notification.${soundName}" ${loop}/>`;
    }

    // Header
    if (cfg.header) {
      xml += `<header id="${escapeXml(cfg.header.id)}" title="${escapeXml(cfg.header.title)}" arguments="${escapeXml(cfg.header.arguments)}" activationType="${cfg.header.activationType || "protocol"}"/>`;
    }

    // Actions (Max 5 buttons/actions)
    if (cfg.actions && cfg.actions.length > 0) {
      xml += `<actions>`;
      const actions = cfg.actions.slice(0, 5); // Windows only supports 5 actions
      for (const action of actions) {
        const actAttrs = [
          `content="${escapeXml(action.label)}"`,
          `arguments="${escapeXml(action.url)}"`,
          `activationType="${action.activationType || "protocol"}"`,
        ];
        if (action.placement) actAttrs.push(`placement="${action.placement}"`);
        if (action.imageUri)
          actAttrs.push(
            `imageUri="${escapeXml(formatWinPath(action.imageUri))}"`,
          );
        if (action.toolTip)
          actAttrs.push(`hint-toolTip="${escapeXml(action.toolTip)}"`);
        if (action.buttonStyle)
          actAttrs.push(`hint-buttonStyle="${action.buttonStyle}"`);
        xml += `<action ${actAttrs.join(" ")}/>`;
      }
      xml += `</actions>`;
    }

    xml += `</toast>`;
    return xml;
  }

  private static async showWindows(
    cfg: ToastConfig,
    title: string,
    message: string,
    appName: string,
  ) {
    const aumid = appName.replace(/[^a-zA-Z0-9_.-]/g, "");
    const finalXml = Notification.buildWindowsXml(cfg, title, message);

    const xmlPs = finalXml.replace(/'/g, "''");
    const appNamePs = appName.replace(/'/g, "''");

    // 🆕 Tambahkan Tag & Group jika ada (Untuk fitur Update)
    const tagPs = cfg.tag ? cfg.tag.replace(/'/g, "''") : "";

    const psScript = `
 $ProgressPreference = 'SilentlyContinue'
 $regPath = "HKCU:\\Software\\Classes\\AppUserModelId\\${aumid}"
if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
Set-ItemProperty -Path $regPath -Name "DisplayName" -Value '${appNamePs}' -Force
Set-ItemProperty -Path $regPath -Name "ShowInSettings" -Value 0 -Force

try {
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime] | Out-Null

  $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
  $xml.LoadXml('${xmlPs}')

  $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)

  # 🆕 Set Tag & Group agar notifikasi bisa di-update
  if ('${tagPs}' -ne '') {
    $toast.Tag = '${tagPs}'
    $toast.Group = 'Digester'
  }

  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${aumid}').Show($toast)
} catch {
  Write-Error $_.Exception.Message
}
`.trim();

    const encodedCmd = Buffer.from(psScript, "utf16le").toString("base64");
    const proc = Bun.spawn(
      [
        "powershell",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        encodedCmd,
      ],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );

    await proc.exited;
  }

  private static showMacOS(cfg: ToastConfig, title: string, message: string) {
    const safeTitle = title.replace(/"/g, '\\"');
    const safeMsg = message.replace(/"/g, '\\"');
    const safeSubtitle = (cfg.subtitle || "").replace(/"/g, '\\"');

    let script = `display notification "${safeMsg}" with title "${safeTitle}"`;
    if (safeSubtitle) script += ` subtitle "${safeSubtitle}"`;

    const soundMap: Record<string, string> = {
      Default: "Glass",
      Mail: "Ping",
      Alarm: "Basso",
      Call: "Ring",
    };

    if (cfg.sound) {
      script += ` sound name "${soundMap[cfg.sound] || "Glass"}"`;
    } else if (cfg.scenario === "alarm") {
      script += ` sound name "Basso"`;
    }

    Bun.spawn(["osascript", "-e", script], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  }

  private static showLinux(cfg: ToastConfig, title: string, message: string) {
    const urgency =
      cfg.scenario === "alarm" ||
      cfg.scenario === "urgent" ||
      cfg.duration === "long"
        ? "--urgency=critical"
        : "--urgency=normal";

    const appLogo = cfg.images?.find((i) => i.placement === "appLogoOverride");
    const iconArg = appLogo?.src
      ? `--icon ${appLogo.src}`
      : "--icon dialog-information";

    const safeTitle = title.replace(/"/g, '\\"');
    let safeMsg = message.replace(/"/g, '\\"');
    if (cfg.subtitle) safeMsg += `\n${cfg.subtitle.replace(/"/g, '\\"')}`;

    Bun.spawn(
      [
        "sh",
        "-c",
        `notify-send ${urgency} ${iconArg} "${safeTitle}" "${safeMsg}"`,
      ],
      { stdio: ["ignore", "ignore", "ignore"] },
    );
  }
}
