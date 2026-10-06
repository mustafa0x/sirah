import { moments } from './text.generated.js'

// Things to find along the way: short, cited details placed in the scene. Positions are
// illustrative. Each becomes a marker, a card, and a source in the chapter's source list.
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

// `kind` is the type of the underlying account: quran, hadith, report (classical sirah
// and history) or modern (a modern author's own reading).
const KINDS = {
    visit: 'hadith',
    wealth: 'report',
    south: 'modern',
    belts: 'report',
    web: 'report',
    stations: 'report',
    garments: 'hadith',
    friday: 'report',
    camel: 'report',
    ayyub: 'report',
    brothers: 'report',
    song: 'report',
}

// The journey stage each detail belongs to, so the written version of a stage can
// include what the scene only shows as markers.
const STAGES = {
    visit: 'preparations',
    wealth: 'departure',
    south: 'departure',
    belts: 'thawr',
    web: 'thawr',
    stations: 'onward',
    garments: 'quba',
    friday: 'arrival',
    camel: 'arrival',
    ayyub: 'arrival',
    brothers: 'arrival',
    song: 'arrival',
}

// Each moment's wording comes from content/map.md.
function detail(id, limits, place, citation) {
    const { title, text } = moments[id]
    return { id, title, text, limits, ...place, ...citation, kind: KINDS[id], stage: STAGES[id] }
}

export const details = [
    detail(
        'visit',
        'This is ‘Aishah’s account as quoted in a modern sirah. The position of the house is illustrative.',
        { world: 'makkah', lat: 21.4195, lon: 39.824 },
        {
            ...RAHIQ,
            page_id: '144',
            volume: '1',
            page: '146',
            excerpt:
                'بينما نحن جلوس في بيت أبي بكر في نحر الظهيرة قال قائل لأبي بكر هذا رسول الله ﷺ متقنعا، في ساعة لم يكن يأتينا فيها ... قال: «فإني قد أذن لي في الخروج» فقال أبو بكر: الصحبة بأبي أنت يا رسول الله؟ قال رسول الله ﷺ: «نعم»',
        },
    ),
    detail(
        'wealth',
        'Reported by Ibn Ishaq from Asma through her grandson. The position of the house is illustrative.',
        { world: 'makkah', lat: 21.4165, lon: 39.829 },
        {
            ...IBN_KATHIR,
            page_id: '758',
            volume: '2',
            page: '236',
            excerpt:
                'احتمل أبو بكر ماله كله معه، خمسة آلاف درهم أو ستة آلاف درهم، فانطلق بها معه ... وأخذت أحجارا فوضعتها في كوة في البيت الذي كان أبي يضع ماله فيها، ثم وضعت عليها ثوبا',
        },
    ),
    detail(
        'south',
        'This is a modern author’s reading of the route, not wording from an early report.',
        { world: 'makkah', lat: 21.401, lon: 39.838 },
        {
            ...RAHIQ,
            page_id: '146',
            volume: '1',
            page: '148',
            excerpt:
                'فقد سلك الطريق الذي يضاده تماما، وهو الطريق الواقع جنوب مكة، والمتجه نحو اليمن. سلك هذا الطريق نحو خمسة أميال، حتى بلغ إلى جبل يعرف بجبل ثور',
        },
    ),
    detail(
        'belts',
        'Ibn Ishaq’s report. ‘Aishah’s account in al-Bukhari places the belt at the packing of the provisions instead.',
        { world: 'makkah', lat: 21.3845, lon: 39.846 },
        {
            ...IBN_KATHIR,
            page_id: '776',
            volume: '2',
            page: '254',
            excerpt:
                'وأتتهما أسماء بنت أبي بكر بسفرتهما، ونسيت أن تجعل لها عصاما ... فتحل نطاقها فتجعله عصاما ثم علقتها به. فكان يقال لها: ذات النطاقين لذلك',
        },
    ),
    detail(
        'web',
        'A single report. The nesting doves of popular retellings are not part of it.',
        { world: 'makkah', set: 'cave', lift: 0.0034, within: 0.07, beyond: 0.012 },
        {
            ...IBN_KATHIR,
            page_id: '761',
            volume: '2',
            page: '239',
            excerpt:
                'فصعدوا الجبل فمروا بالغار، فرأوا على بابه نسج العنكبوت، فقالوا: لو دخل ها هنا أحد لم يكن نسج العنكبوت على بابه، فمكث فيه ثلاث ليال. وهذا إسناد حسن، وهو من أجود ما روي في قصة نسج العنكبوت على فم الغار',
        },
    ),
    detail(
        'stations',
        'A list of names, without distances or days.',
        { world: 'region', lat: 21.9, lon: 39.33 },
        {
            ...IBN_KATHIR,
            page_id: '777',
            volume: '2',
            page: '255',
            excerpt:
                'سلك بهما أسفل مكة ثم مضى بهما على الساحل حتى عارض الطريق أسفل من عسفان، ثم سلك بهما على أسفل أمج، ثم استجاز بهما حتى عارض الطريق بعد أن أجاز قديدا',
        },
    ),
    detail(
        'garments',
        'From al-Bukhari, as quoted by Ibn Kathir. The account does not say where on the road they met.',
        { world: 'region', lat: 23.85, lon: 39.24 },
        {
            ...IBN_KATHIR,
            page_id: '771',
            volume: '2',
            page: '249',
            excerpt:
                'أن رسول الله ﷺ لقي الزبير في ركب من المسلمين كانوا تجارا قافلين من الشام، فكسا الزبير رسول الله ﷺ وأبا بكر ثياب بياض',
        },
    ),
    detail(
        'friday',
        'Quoted from a modern sirah, which cites Ibn Hisham. The position is illustrative.',
        { world: 'madinah', lat: 24.4525, lon: 39.6185 },
        {
            ...RAHIQ,
            page_id: '154',
            volume: '1',
            page: '156',
            excerpt:
                'فأدركته الجمعة في بني سالم بن عوف فجمع بهم في المسجد الذي في بطن الوادي وكانوا مائة رجل',
        },
    ),
    detail(
        'camel',
        'Ibn Ishaq’s report. Her path through the town is not known.',
        { world: 'madinah', lat: 24.4605, lon: 39.6135 },
        {
            ...IBN_KATHIR,
            page_id: '794',
            volume: '2',
            page: '272',
            excerpt:
                'قال: " خلوا سبيلها فإنها مأمورة " فخلوا سبيلها. فانطلقت ... حتى إذا أتت دار بني مالك بن النجار بركت',
        },
    ),
    detail(
        'ayyub',
        'The house is placed beside the mosque site for illustration.',
        { world: 'madinah', lat: 24.4682, lon: 39.6135 },
        {
            ...IBN_KATHIR,
            page_id: '796',
            volume: '2',
            page: '274',
            excerpt:
                'ونزل رسول الله ﷺ في دار أبي أيوب حتى بنى مسجده ومساكنه فعمل فيه رسول الله ﷺ والمسلمون من المهاجرين والأنصار',
        },
    ),
    detail(
        'brothers',
        'This is Ibn Kathir’s chapter heading. The individual pairings are listed in the pages that follow it.',
        { world: 'madinah', lat: 24.4705, lon: 39.607 },
        {
            ...IBN_KATHIR,
            page_id: '846',
            volume: '2',
            page: '324',
            excerpt: 'فصل في مؤاخاة النبي ﷺ بين المهاجرين والانصار ليرتفق المهاجرى بالانصارى',
        },
    ),
    detail(
        'song',
        'The chain stops short of an eyewitness, and some place the song at a later return to Madinah, not at this arrival.',
        { world: 'madinah', lat: 24.476, lon: 39.613 },
        {
            ...IBN_KATHIR,
            page_id: '791',
            volume: '2',
            page: '269',
            excerpt:
                'سمعت ابن عائشة يقول: لما قدم رسول الله ﷺ المدينة جعل النساء والصبيان يقلن: طلع البدر علينا * من ثنيات الوداع',
        },
    ),
]
