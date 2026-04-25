type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

type AlertFn = (title: string, message?: string, buttons?: AlertButton[]) => void;

type SupportCopyFn = (value: string) => Promise<unknown>;

export type SupportContactText = {
  fallbackTitle: string;
  fallbackMessage: string;
  copyEmail: string;
  copiedTitle: string;
  copiedMessage: string;
  cancel: string;
};

export type SupportContactOptions = {
  email: string;
  subject: string;
  body: string;
  text: SupportContactText;
};

export type SupportContactDeps = {
  canOpenURL: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<void>;
  alert: AlertFn;
  copyText: SupportCopyFn;
};

export function buildSupportEmailUrl({ email, subject, body }: Pick<SupportContactOptions, 'email' | 'subject' | 'body'>): string {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
}

function interpolate(template: string, email: string): string {
  return template.replace('{{email}}', email);
}

export async function openSupportContact(
  deps: SupportContactDeps,
  options: SupportContactOptions,
): Promise<'opened' | 'fallback'> {
  const mailtoUrl = buildSupportEmailUrl(options);
  const isSupported = await deps.canOpenURL(mailtoUrl);

  if (isSupported) {
    await deps.openURL(mailtoUrl);
    return 'opened';
  }

  deps.alert(
    options.text.fallbackTitle,
    interpolate(options.text.fallbackMessage, options.email),
    [
      {
        text: options.text.copyEmail,
        onPress: async () => {
          await deps.copyText(options.email);
          deps.alert(options.text.copiedTitle, options.text.copiedMessage);
        },
      },
      {
        text: options.text.cancel,
        style: 'cancel',
      },
    ],
  );

  return 'fallback';
}