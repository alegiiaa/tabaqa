/** U3 · tap-to-explain — the static copy map behind every InfoTip.
 *
 * One entry per dense term a judge might not know; plain language, EN + AR,
 * two sentences max. Rendered by components/ui/InfoTip.tsx. Keys are referenced
 * from JSX — keep them stable.
 */

export interface GlossaryEntry {
  /** [en, ar] term title */
  term: [string, string]
  /** [en, ar] plain-language explanation */
  body: [string, string]
}

export const GLOSSARY = {
  pd: {
    term: ['Probability of default (PD)', 'احتمال التعثّر (PD)'],
    body: [
      'The model’s estimate of the chance this applicant misses payments over the next 12 months. Lower is better.',
      'تقدير النموذج لاحتمال تخلّف المتقدم عن السداد خلال الاثني عشر شهرًا القادمة. الأقل أفضل.',
    ],
  },
  auc: {
    term: ['AUC', 'مقياس AUC'],
    body: [
      'Pick one real defaulter and one good borrower at random — AUC is how often the model ranks them correctly. 0.5 is a coin flip; 1.0 is perfect.',
      'اختر متعثّرًا حقيقيًا وسليمًا حقيقيًا عشوائيًا — يقيس AUC كم مرة يرتّبهما النموذج صحيحًا. ‏0.5 عشوائية تامة، و1.0 كمال.',
    ],
  },
  lift: {
    term: ['AUC lift', 'رفع AUC'],
    body: [
      'How much the cash-flow layer improves the ranking over the baseline view alone, with a bootstrap 95% confidence interval. If the interval excludes zero, the gain is statistically real.',
      'مقدار تحسين طبقة التدفق النقدي للترتيب فوق خط الأساس وحده، مع فاصل ثقة ٩٥٪ بالتحميل الذاتي. إن لم يشمل الفاصل الصفر فالمكسب حقيقي إحصائيًا.',
    ],
  },
  ks: {
    term: ['KS statistic', 'إحصاء KS'],
    body: [
      'The widest separation between how the model scores good vs bad borrowers. Higher means cleaner separation.',
      'أقصى فصل بين توزيع درجات العملاء السليمين والمتعثّرين. الأعلى يعني فصلًا أنظف.',
    ],
  },
  iv: {
    term: ['Information Value (IV)', 'قيمة المعلومات (IV)'],
    body: [
      'How much predictive signal one feature carries on its own. Rule of thumb: above 0.3 is strong; above 0.5 is exceptional.',
      'كمية الإشارة التنبؤية التي تحملها ميزة واحدة بمفردها. القاعدة العملية: فوق 0.3 قوية، وفوق 0.5 استثنائية.',
    ],
  },
  dbr: {
    term: ['Debt-burden ratio (DBR)', 'نسبة عبء الدين (DBR)'],
    body: [
      'Monthly obligations divided by monthly income. SAMA’s responsible-lending rules cap it — 33.33% for salaried customers, 25% for pensioners.',
      'الالتزامات الشهرية مقسومة على الدخل الشهري. تعليمات الإقراض المسؤول من ساما تضع لها سقفًا — ٣٣٫٣٣٪ للموظفين و٢٥٪ للمتقاعدين.',
    ],
  },
  psi: {
    term: ['Population Stability Index (PSI)', 'مؤشر استقرار التوزيع (PSI)'],
    body: [
      'A drift alarm: how far today’s applicants have shifted from the population the model was trained on. Above 0.25 means investigate before trusting the score.',
      'إنذار انزياح: كم ابتعد متقدمو اليوم عن المجتمع الذي دُرّب عليه النموذج. فوق 0.25 يعني: تحقّق قبل الوثوق بالدرجة.',
    ],
  },
  tstr: {
    term: ['Train-synthetic, test-real (TSTR)', 'تدريب اصطناعي واختبار حقيقي (TSTR)'],
    body: [
      'Train the model on the synthetic corpus, then test it on real held-out data. High retention proves the synthetic data carries the real signal — not a circular echo.',
      'ندرّب النموذج على البيانات الاصطناعية ثم نختبره على بيانات حقيقية محجوزة. الاحتفاظ العالي يثبت أن الاصطناعي يحمل الإشارة الحقيقية — لا صدى دائريًا.',
    ],
  },
  ci: {
    term: ['95% confidence interval', 'فاصل الثقة ٩٥٪'],
    body: [
      'The range the true value falls in with 95% probability, estimated from hundreds of bootstrap resamples. An interval that excludes zero means the effect is statistically real.',
      'النطاق الذي تقع فيه القيمة الحقيقية باحتمال ٩٥٪، مُقدَّرًا من مئات إعادات المعاينة. فاصل لا يشمل الصفر يعني أن الأثر حقيقي إحصائيًا.',
    ],
  },
  swap_set: {
    term: ['Swap-set analysis', 'تحليل التبادل'],
    body: [
      'Hold approval volume constant and compare who gets approved: the wallet layer swaps risky approvals out and good declined borrowers in. The realized default rate in the approved pool is the business proof.',
      'نثبّت حجم الموافقات ونقارن من يُقبل: طبقة المحفظة تُخرج الموافقات الخطرة وتُدخل مرفوضين جيّدين. معدل التعثّر الفعلي في المقبولين هو البرهان التجاري.',
    ],
  },
  verified_share: {
    term: ['Verified income share', 'نسبة الدخل الموثّق'],
    body: [
      'The portion of claimed income confirmed against payroll or account evidence — not self-declared. Higher verification tightens the score’s sufficiency band.',
      'الجزء من الدخل المُصرَّح به المؤكَّد عبر بيانات الرواتب أو أدلة الحساب — لا التصريح الذاتي. توثيق أعلى يضيّق نطاق كفاية الدرجة.',
    ],
  },
  thin_file: {
    term: ['Thin-file borrower', 'عميل محدود السجل'],
    body: [
      'An applicant with little or no credit history, where a bureau score is unreliable or does not exist. This is exactly the population Tabaqa is built to score.',
      'متقدم بسجل ائتماني ضئيل أو معدوم، حيث تكون درجة المكتب غير موثوقة أو غير موجودة. هذه تحديدًا الفئة التي بُنيت طبقة لتسجيلها.',
    ],
  },
  bad_rate: {
    term: ['Bad rate', 'معدل التعثّر'],
    body: [
      'The share of borrowers in the data who actually defaulted — the real outcomes every metric here is measured against.',
      'نسبة المقترضين الذين تعثّروا فعلًا في البيانات — النتائج الحقيقية التي تُقاس عليها كل الأرقام هنا.',
    ],
  },
  negative_control: {
    term: ['Negative control', 'الضابط السلبي'],
    body: [
      'An experiment designed to find nothing: if the method invents lift where none should exist, it fails the test. Ours correctly reads zero on single-source data — proof the machinery is honest.',
      'تجربة مصمَّمة لتجد لا شيء: لو اختلقت المنهجية رفعًا حيث لا ينبغي وجوده لسقطت في الاختبار. منهجيتنا تقرأ صفرًا صحيحًا على بيانات المصدر الواحد — دليل أمانة الأدوات.',
    ],
  },
  confidence: {
    term: ['Data-sufficiency band', 'نطاق كفاية البيانات'],
    body: [
      'Not a statistical confidence interval: the band widens when history is short or income is unverified. More months and more verification tighten it.',
      'ليس فاصل ثقة إحصائيًا: يتّسع النطاق عندما يكون السجل قصيرًا أو الدخل غير موثّق. شهور أكثر وتوثيق أعلى يضيّقانه.',
    ],
  },
} as const satisfies Record<string, GlossaryEntry>

export type GlossaryKey = keyof typeof GLOSSARY
