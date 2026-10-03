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
function entry(id, span, lane, title, when, certainty, note, stage, citation = null) {
    const [from, to, longest = to] = span
    return { id, from, to, longest, lane, title, when, certainty, note, stage, citation }
}

export const timeline_start = { day: 12, month: 9 }
export const timeline_days = 25

export const timeline = [
    entry(
        'leave',
        [0, 0.6],
        0,
        'Leaving Makkah',
        'Night of 27 Safar · 12–13 September 622',
        'reckoned',
        'The night of departure is in the accounts. Its place in the calendar is a modern reckoning.',
        'departure',
        {
            ...RAHIQ,
            kind: 'modern',
            place: 'makkah',
            page_id: '146',
            volume: '1',
            page: '148',
            excerpt:
                'غادر رسول الله ﷺ بيته في ليلة ٢٧ من شهر صفر سنة ١٤ من النبوة الموافق ١٢/ ١٣ سبتمبر سنة ٦٢٢ م',
        },
    ),
    entry(
        'cave',
        [0.4, 3.3],
        1,
        'Three nights at Thawr',
        'The nights before Friday, Saturday and Sunday',
        'stated',
        'Three nights is in al-Bukhari. Naming them after the days of the week follows a modern reckoning.',
        'thawr',
        {
            ...RAHIQ,
            kind: 'modern',
            place: 'cave',
            page_id: '147',
            volume: '1',
            page: '149',
            excerpt: 'وكمنا في الغار ثلاث ليال، ليلة الجمعة وليلة السبت وليلة الأحد',
        },
    ),
    entry(
        'guide',
        [3.3, 3.9],
        0,
        'The guide arrives',
        'Night of Monday, 1 Rabi‘ al-Awwal · 16 September 622',
        'reckoned',
        'The guide came with the two mounts after the third night, as arranged. The calendar date is a modern reckoning.',
        'onward',
        {
            ...RAHIQ,
            kind: 'modern',
            place: 'thawr',
            page_id: '149',
            volume: '1',
            page: '151',
            excerpt:
                'فلما كانت ليلة الإثنين- غرة ربيع الأول سنة ١ ه/ ١٦ سبتمبر سنة ٦٢٢ م- جاءهما عبد الله بن أريقط بالراحلتين',
        },
    ),
    entry(
        'road',
        [3.9, 11],
        1,
        'On the coastal road',
        'About a week',
        'undated',
        'The accounts give the order of what happened on the road, but no days. The pursuit and the tent of Umm Ma‘bad fall somewhere in this week.',
        'pursuit',
    ),
    entry(
        'quba',
        [11, 11.6],
        0,
        'Arrival at Quba',
        'Monday · 8 Rabi‘ al-Awwal · 23 September 622',
        'stated',
        'The account in al-Bukhari says it was a Monday in Rabi‘ al-Awwal. The day of the month is a modern reckoning.',
        'quba',
        {
            ...IBN_KATHIR,
            kind: 'hadith',
            place: 'quba',
            page_id: '772',
            volume: '2',
            page: '250',
            excerpt: 'حتى نزل بهم في بني عمرو بن عوف، وذلك يوم الاثنين من شهر ربيع الأول',
        },
    ),
    entry(
        'stay',
        [11.6, 15, 24],
        1,
        'The stay at Quba',
        'Four days, or more than ten nights',
        'differs',
        'Ibn Ishaq gives Monday to Thursday. The report in al-Bukhari says more than ten nights, and Banu ‘Amr ibn ‘Awf said eighteen. Ibn Kathir sets the reports side by side without settling it.',
        'quba',
        {
            ...IBN_KATHIR,
            kind: 'report',
            place: 'quba',
            page_id: '793',
            volume: '2',
            page: '271',
            excerpt:
                'فأقام رسول الله ﷺ بقباء في بني عمرو بن عوف يوم الاثنين ويوم الثلاثاء ويوم الأربعاء ويوم الخميس ... قلت: وقد تقدم فيما رواه البخاري من طريق الزهري، عن عروة، أنه أقام فيهم بضع عشرة ليلة',
        },
    ),
    entry(
        'friday',
        [15, 15.6],
        0,
        'The first Friday, and Madinah',
        'Friday · 12 Rabi‘ al-Awwal · 27 September 622',
        'reckoned',
        'That it was a Friday is in the early reports. The calendar date is a modern reckoning, and it follows the four-day stay.',
        'arrival',
        {
            ...RAHIQ,
            kind: 'modern',
            place: 'madinah',
            page_id: '163',
            volume: '1',
            page: '166',
            excerpt:
                'نزول رسول الله ﷺ بالمدينة في بني النجار كان يوم الجمعة (١٢ ربيع الأول سنة ١ ه الموافق ٢٧ سبتمبر سنة ٦٢٢ م)',
        },
    ),
]
