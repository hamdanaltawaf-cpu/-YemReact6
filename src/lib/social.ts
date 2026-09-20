export const SOCIAL_PROVIDERS = ['google', 'apple', 'microsoft'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
export const SOCIAL_NAMES: Record<SocialProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  microsoft: 'Microsoft',
};
export function isSocialProvider(value: string): value is SocialProvider {
  return SOCIAL_PROVIDERS.some((provider) => provider === value);
}
export const SOCIAL_ERRORS: Record<string, string> = {
  unavailable: 'تعذّر إكمال الدخول. حاول مجددًا أو اختر خدمة أخرى.',
  cancelled: 'لم يكتمل الربط. يمكنك اختيار الخدمة والمحاولة مجددًا.',
  expired:
    'انتهت صلاحية محاولة الدخول أو تعذّر التحقق من المتصفح. افتح الموقع في تبويب مستقل وحاول مجددًا.',
  failed: 'تعذّر إكمال الدخول. حاول مجددًا أو اختر خدمة أخرى.',
  account_exists:
    'يوجد حساب سابق بهذا البريد. يلزم ربطه بأمان من إدارة الموقع قبل استخدام هذه الخدمة.',
  rate_limited: 'محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.',
};
