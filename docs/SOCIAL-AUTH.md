# الدخول الاجتماعي فقط

حلّ هذا التدفق محل الدخول والتسجيل بالبريد وكلمة المرور. تعرض `/login` ثلاثة خيارات فقط: Google وApple وMicrosoft، مع متابعة التصفح كزائر. لا نماذج تقليدية ولا مسار احتياطي لكلمات المرور. يبقى التذييل غائبًا عن صفحة الحساب والمكتبة.

## حالة التنفيذ

واجهة متجاوبة + مسارات Authorization Code + تحقق OIDC + حسابات وجلسات SQLite. **لا توجد مفاتيح مزودين في الحزمة؛ الدخول الخارجي غير مفعّل حتى ضبطها.** يظهر تنبيه واضح للخدمات غير المعدّة، والضغط عليها يشرح الحالة بدل إنشاء حساب وهمي. وجود الإعدادات يفعّل رابط الانتقال، لكنه لا يثبت صحة المفاتيح أو اعتماد التطبيق لدى المزود.

اختبارات محلية تستخدم رموز هوية موقعة بمفتاح اختباري، وقاعدة SQLite مؤقتة وتبادل رموز محاكى. لا تُعد هذه تجربة دخول حقيقية إلى حسابات المزودين. يجب اختبار المزودين الثلاثة في المتصفح بعد تهيئتهم، بما فيها الإلغاء وApple Private Relay وحسابات Microsoft الشخصية والمؤسسية.

## إعداد الخادم

ضع القيم في `.env.local` محليًا أو مخزن أسرار الاستضافة، ولا تضع أسرارًا في متغيرات `NEXT_PUBLIC_*` أو المستودع. راجع `.env.example`.

- `OAUTH_SITE_URL`: أصل الموقع العام، مثل `https://your-domain.example`، بلا مسار أو استعلام. يجب أن يكون هو الموقع المفتوح في المتصفح.
- `OAUTH_GOOGLE_CLIENT_ID` و`OAUTH_GOOGLE_CLIENT_SECRET`.
- `OAUTH_APPLE_CLIENT_ID` و`OAUTH_APPLE_CLIENT_SECRET`.
- `OAUTH_MICROSOFT_CLIENT_ID` و`OAUTH_MICROSOFT_CLIENT_SECRET`.
- `OAUTH_MICROSOFT_TENANT_ID`: افتراضيًا `common`، أو `organizations` أو `consumers` أو UUID مستأجر محدد.

أعد تشغيل الخادم بعد تعديل القيم. HTTP على localhost متاح لـGoogle وMicrosoft في التطوير فقط؛ Apple يحتاج نطاق HTTPS حقيقيًا. خلف البروكسي، اضبط `Host`/`X-Forwarded-Host` من مصدر موثوق ولا تمرر قيم العميل غير الموثوقة.

## روابط العودة

سجّل هذه الروابط حرفيًا في تطبيقات المزودين، واستبدل النطاق:

| المزود | Redirect URL |
|---|---|
| Google | `https://your-domain.example/api/auth/oauth/google/callback` |
| Apple | `https://your-domain.example/api/auth/oauth/apple/callback` |
| Microsoft | `https://your-domain.example/api/auth/oauth/microsoft/callback` |

### Google

أنشئ OAuth Client من نوع Web application. اضبط شاشة الموافقة والنطاقات والمستخدمين التجريبيين عند الحاجة. الصلاحيات المطلوبة: `openid profile email`، ولا يتم طلب الوصول إلى Google APIs أو الاحتفاظ بـrefresh tokens.

### Apple

فعّل Sign in with Apple واربط Services ID بتطبيقك، ثم سجّل النطاق ورابط العودة. Client ID هو Services ID. Client Secret هو JWT توقّعه بـES256 بمفتاح Apple `.p8`؛ يتضمن `kid` (Key ID)، و`iss` (Team ID)، و`sub` (Services ID)، و`aud=https://appleid.apple.com`، و`iat` و`exp`. مدة السر لا تتجاوز ستة أشهر؛ توليده وتجديده مسؤولية الخادم/المشغّل، ولا تُرفع المفاتيح إلى المستودع. لا يوجد تدوير تلقائي للسر في هذه النسخة.

Apple يعيد الرد بطريقة `form_post`؛ لذلك يستخدم **ملف ارتباط مؤقت لمحاولة Apple فقط** `SameSite=None; Secure; HttpOnly`. جلسة الموقع تبقى `SameSite=Lax`. الاسم المرسل خارج رمز الهوية لا يستخدم كإثبات هوية؛ إن لم يرد اسم داخل الرمز الموقع يعرض اسمًا افتراضيًا. بريد Private Relay مقبول إذا تحقق منه المزود.

### Microsoft

أنشئ App Registration، واختر أنواع الحسابات المدعومة، وأضف منصة Web ورابط العودة وClient Secret. استخدم **قيمة** السر، لا Secret ID. لدعم حسابات المؤسسات والحسابات الشخصية اختر النوع المناسب و`common`. الصلاحيات: `openid profile email`. يُتحقق من issuer الخاص بالمستأجر وقيوده. البريد غير المؤكد لا يعتمد لربط الحسابات.

## التدفق والأمان

1. `/api/auth/oauth/{provider}` يبدأ محاولة مدتها عشر دقائق مع `state` و`nonce` وربط HttpOnly بالمتصفح.
2. Google وMicrosoft يستخدمان PKCE S256. Apple يستخدم سر التطبيق ورد POST.
3. العودة تستهلك المحاولة مرة واحدة، تتحقق من ارتباط المتصفح ثم تتبادل الكود على الخادم فقط.
4. مكتبة `jose` تتحقق من توقيع RS256 باستخدام مفاتيح المزود الثابتة، وissuer وaudience وexpiry وnonce وauthorized party.
5. الهوية هي `(provider, issuer, subject)`، وليس البريد. أول دخول ينشئ عضوًا فقط؛ لا ترقية آلية لأول مستخدم.
6. إنشاء جلسة محلية لمدة سبعة أيام. لا تُخزّن رموز الوصول/التجديد الخارجية ولا تُرسل إلى المتصفح. العودة إلى `/saved` أو `/admin` حسب الدور، وليس وجهة يحددها المستخدم.

`POST /api/auth` القديم يرجع 410؛ GET لمعرفة الجلسة وDELETE للخروج باقيان. معلومات ملفات المحاولات تنتهي وتنظف عند بدء محاولات جديدة. تحديد معدل البدء محلي لكل عملية/IP وليس خدمة موزعة.

افتح الموقع في تبويب مستقل للدخول، لا إطار المعاينة. أزرار الخدمات المفعلة تنتقل إلى أعلى النافذة. رفض cookies أو سياسات المزود قد يمنع التدفق داخل الإطارات؛ لا تخفّض حماية الجلسات لتجاوز ذلك.

## حساب المالك والحسابات السابقة

لا تُحذف الحسابات القديمة أو محفوظاتها، لكن كلمات مرورها لا تعمل بعد هذا التحديث. الجلسات الحالية تبقى حتى خروجها/انتهائها. لا يُربط حساب سابق بمجرد تطابق البريد لتفادي الاستيلاء عليه. عند التصادم تعرض رسالة تطلب الربط من إدارة الموقع.

**مالك جديد:** سجّل اجتماعيًا أولًا، ثم استخرج `id` لحسابك من `GET /api/auth` أثناء جلستك الخاصة. على الخادم شغّل:

```bash
ADMIN_USER_ID='<id>' corepack pnpm admin:create
```

هذا الأمر يمنح الدور لحساب مرتبط بالفعل فقط ويُلغي جلساته السابقة؛ ادخل عبر نفس الخدمة مجددًا. لا توجد كلمة مرور مالك افتراضية أو مسار تسجيل يدوي.

**ترحيل حساب قديم أو ربط مزود إضافي:** خذ نسخة احتياطية أولًا. تحقّق بشكل مستقل من ملكية الحساب المحلي ومن `issuer` و`subject` لدى تطبيق المزود نفسه؛ لا تثق ببريد أو subject يرسله المستخدم دون تحقق. ثم استخدم أداة المشغّل:

```bash
LINK_USER_ID='<existing-local-id>' \
LINK_PROVIDER='google' \
LINK_ISSUER='https://accounts.google.com' \
LINK_SUBJECT='<independently-verified-provider-subject>' \
LINK_CONFIRMED=yes node scripts/link-social-account.mjs
```

الأداة تحفظ الدور والمحفوظات، ترفض نقل هوية مرتبطة بمستخدم آخر، وتبطل الجلسات الحالية وتكتب سجل تدقيق. لا توجد واجهة ربط ذاتي لمزود إضافي في هذا التحديث. إذا لم يزود المزود بريدًا مؤكدًا يخزّن معرف بريد داخلي غير قابل للإرسال ينتهي بـ`@social.invalid`؛ لا يستخدم للمراسلات.

## حدود الاختبارات

`pnpm test` يختبر التهيئة، التوقيع، قيود issuer/audience/nonce، PKCE، رد Apple، انتهاء المحاولات وإعادتها، الإلغاء وتصادم الحسابات مع تبادل رموز محاكى. `verification/social-auth.cjs` يختبر الواجهة المحلية وحالات عدم التهيئة/الإلغاء، أحجام الشاشة، غياب النموذج والتذييل، ورفض API القديم. لا يثبت نجاح دخول خارجي فعلي دون إعداد المزودين. تقارير V4 القديمة سبقت الاستبدال، وسيناريوهاتها التي تستخدم كلمة المرور تاريخية وليست اختبارات لهذا التدفق.

## Trusted proxy host mapping

If the public preview proxy rewrites Host to its internal backend domain, set server-only `OAUTH_PROXY_HOST` to that exact trusted backend host (no wildcard). The public callback stays under `OAUTH_SITE_URL`. Mutation guards require the exact origin/host mapping and reject browser `Sec-Fetch-Site: cross-site` requests even when a proxy rewrites Origin. Provider callbacks use their separate state/browser-binding validation. Recheck the mapping when the preview backend changes. Credentials belong in private `.env.local` or deployment secrets, never the distributable archive.
