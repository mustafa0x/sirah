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

function detail(id, title, text, limits, place, citation) {
    return { id, title, text, limits, ...place, ...citation, kind: KINDS[id], stage: STAGES[id] }
}

export const details = [
    detail(
        'visit',
        'The noon visit',
        'At the height of noon, an hour at which he never used to come, the Prophet ﷺ arrived at Abu Bakr’s house with his face covered. He said he had been given permission to leave. Abu Bakr asked to go with him, and he said yes.',
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
        'Stones in the niche',
        'Abu Bakr took all his money with him, five or six thousand dirhams. Asma recounts that her blind grandfather feared the family had been left with nothing. She put stones where the money used to be kept, covered them with a cloth, and guided his hand to them so that he would be at ease.',
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
        'Why south?',
        'Madinah lies to the north, and that is where a search would begin. They left in the opposite direction, on the road towards Yemen, for about five miles to Mount Thawr.',
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
        'She of the two belts',
        'When the three nights had passed, Asma brought their provisions but had forgotten a strap to hang the bag. She undid her waist-belt and used it. For that she was called Dhat al-Nitaqayn, she of the two belts.',
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
        'The spider’s web',
        'One report says the pursuers climbed the mountain, passed the cave, and saw a spider’s web across its opening. No one could have gone in, they reasoned, and they moved on. Ibn Kathir calls its chain good, the best of what is reported on this. The scene does not draw the web.',
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
        'The stations of the road',
        'Ibn Ishaq names the way the guide took: below Makkah, along the coast, across the road below ‘Usfan, below Amaj, past Qudayd, then al-Kharrar, Thaniyyat al-Marah, Liqf and on. Many of these names are hard to place today, so the line drawn here stays approximate.',
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
        'White garments',
        'On the way they met al-Zubayr with a group of Muslim merchants returning from Syria. He gave the Prophet ﷺ and Abu Bakr white garments to wear.',
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
        'The first Friday',
        'After leaving Quba, the time for Friday prayer came while he was among Banu Salim ibn ‘Awf. He led it there, in the mosque in the bed of the valley, with about a hundred men.',
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
        'Let her go',
        'Clan after clan took hold of his camel’s rope and invited him to stay with them. Each time he answered: let her go, for she is under command. She walked on until she knelt in the quarter of Banu Malik ibn al-Najjar.',
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
        'The house of Abu Ayyub',
        'He stayed in the house of Abu Ayyub until his mosque and his rooms were built, and he worked on the building himself alongside the Muhajirun and the Ansar.',
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
        'Brothers',
        'He paired those who had migrated with those who received them, as brothers, so that each newcomer had someone to lean on.',
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
        'The full moon has risen',
        'A well-known report says the women and children sang “The full moon has risen upon us, from the passes of al-Wada‘” when he arrived. Al-Bayhaqi relates it from Ibn ‘Aishah, a later narrator, not from someone who was there.',
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
