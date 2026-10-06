import { timeline_text } from './text.generated.js'

// The journey day by day. Day 0 is 12 September 622, the evening the Prophet ﷺ left
// Makkah. Each entry says how its date is known, and cites the passage that says so.
const IBN_KATHIR = {
    work: 'Ibn Kathir, al-Bidayah wa al-Nihayah',
    book_id: '930',
    book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
    author: 'ابن كثير',
}
const RAHIQ = {
    work: 'Al-Rahiq al-Makhtum',
    book_id: '9820',
    book: 'الرحيق المختوم',
    author: 'صفي الرحمن المباركفوري',
}

// `certainty`: stated (the account gives it), reckoned (a later author converts it to a
// calendar date), differs (the accounts disagree), undated (the accounts give no day).
// Each entry's wording comes from content/timeline.md.
function entry(id, span, lane, certainty, stage, citation = null) {
    const [from, to, longest = to] = span
    const text = timeline_text[id]
    const title = text.title
    const when = text.when.text
    const note = text.note?.text ?? ''
    return { id, from, to, longest, lane, title, when, certainty, note, stage, citation }
}

export const timeline_start = { day: 12, month: 9 }
export const timeline_days = 25

export const timeline = [
    entry('leave', [0, 0.6], 0, 'reckoned', 'departure', {
        ...RAHIQ,
        kind: 'modern',
        place: 'makkah',
        page_id: '146',
        volume: '1',
        page: '148',
        excerpt:
            'غادر رسول الله ﷺ بيته في ليلة ٢٧ من شهر صفر سنة ١٤ من النبوة الموافق ١٢/ ١٣ سبتمبر سنة ٦٢٢ م',
    }),
    entry('cave', [0.4, 3.3], 1, 'stated', 'thawr', {
        ...RAHIQ,
        kind: 'modern',
        place: 'cave',
        page_id: '147',
        volume: '1',
        page: '149',
        excerpt: 'وكمنا في الغار ثلاث ليال، ليلة الجمعة وليلة السبت وليلة الأحد',
    }),
    entry('guide', [3.3, 3.9], 0, 'reckoned', 'onward', {
        ...RAHIQ,
        kind: 'modern',
        place: 'thawr',
        page_id: '149',
        volume: '1',
        page: '151',
        excerpt:
            'فلما كانت ليلة الإثنين- غرة ربيع الأول سنة ١ ه/ ١٦ سبتمبر سنة ٦٢٢ م- جاءهما عبد الله بن أريقط بالراحلتين',
    }),
    entry('road', [3.9, 11], 1, 'undated', 'pursuit'),
    entry('quba', [11, 11.6], 0, 'stated', 'quba', {
        ...IBN_KATHIR,
        kind: 'hadith',
        place: 'quba',
        page_id: '772',
        volume: '2',
        page: '250',
        excerpt: 'حتى نزل بهم في بني عمرو بن عوف، وذلك يوم الاثنين من شهر ربيع الأول',
    }),
    entry('stay', [11.6, 15, 24], 1, 'differs', 'quba', {
        ...IBN_KATHIR,
        kind: 'report',
        place: 'quba',
        page_id: '793',
        volume: '2',
        page: '271',
        excerpt:
            'فأقام رسول الله ﷺ بقباء في بني عمرو بن عوف يوم الاثنين ويوم الثلاثاء ويوم الأربعاء ويوم الخميس ... قلت: وقد تقدم فيما رواه البخاري من طريق الزهري، عن عروة، أنه أقام فيهم بضع عشرة ليلة',
    }),
    entry('friday', [15, 15.6], 0, 'reckoned', 'arrival', {
        ...RAHIQ,
        kind: 'modern',
        place: 'madinah',
        page_id: '163',
        volume: '1',
        page: '166',
        excerpt:
            'نزول رسول الله ﷺ بالمدينة في بني النجار كان يوم الجمعة (١٢ ربيع الأول سنة ١ ه الموافق ٢٧ سبتمبر سنة ٦٢٢ م)',
    }),
]
