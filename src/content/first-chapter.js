// The first playable chapter contract. All learner wording, evidence mapping, and art
// direction in this file are working drafts pending scholarly/editorial approval.
/** @typedef {{id: string, title: string, scene: string, duration: number, source_ids: string[], paragraphs: Array<{id: string, text: string, source_ids: string[]}>, recap?: string}} ChapterStep */
/** @typedef {{id: string, title: string, release_status: string, review_status: string, language: string, objective: string, question: object, steps: ChapterStep[], sources: object[]}} Chapter */
/** @type {Chapter} */
export const chapter = {
    id: 'hijrah-thawr-loop',
    title: 'The Hijrah: a journey in stages',
    release_status: 'draft',
    review_status: 'scholarly and publication review pending',
    language: 'English working draft; no final narration or translation approved',
    objective:
        'Connect preparations, the stay at Thawr, the onward journey, and arrival while distinguishing an illustration from its evidence.',
    question: {
        id: 'q-onward-after-cave',
        prompt: 'How did the journey continue after the cave?',
        context_step: 'thawr',
        expected_sources: ['E06', 'E07'],
        action: { type: 'detour', step_id: 'onward', label: 'Show the onward journey' },
    },
    steps: [
        {
            id: 'setting',
            title: 'Before the journey',
            scene: 'overview',
            duration: 9,
            source_ids: ['E01', 'E11'],
            paragraphs: [
                {
                    id: 'N01a',
                    text: 'This chapter follows the Hijrah: the Prophet Muhammad’s ﷺ migration from Makkah to Madinah. We will follow a few connected stages, from preparations for departure to arrival in Madinah.',
                    source_ids: ['E01', 'E11'],
                },
                {
                    id: 'N01b',
                    text: 'Before the Prophet departed, some Muslims had already moved to Madinah. Abu Bakr was preparing to leave too, but waited to accompany him. This was part of a wider movement, not a departure in which everyone travelled together.',
                    source_ids: ['E01'],
                },
            ],
        },
        {
            id: 'preparations',
            title: 'Preparing to leave',
            scene: 'overview',
            duration: 11,
            source_ids: ['E02', 'E06'],
            paragraphs: [
                {
                    id: 'N02a',
                    text: 'When permission to depart had been given, preparations were made for the Prophet ﷺ and Abu Bakr. ‘Aishah’s account describes provisions packed in a bag. Asma, Abu Bakr’s daughter, used part of her waist-belt to tie its opening.',
                    source_ids: ['E02'],
                },
                {
                    id: 'N02b',
                    text: 'They also hired a skilled guide, entrusted him with two riding animals, and arranged to meet him at Thawr after three nights. The arrangements for the onward journey were already being made.',
                    source_ids: ['E06'],
                },
            ],
        },
        {
            id: 'thawr',
            title: 'Three nights at Thawr',
            scene: 'thawr',
            duration: 18,
            source_ids: ['E03', 'E04', 'E05', 'E08', 'E09', 'E10'],
            paragraphs: [
                {
                    id: 'N03a',
                    text: 'After the preparations, the Prophet ﷺ and Abu Bakr sheltered in a cave on Mount Thawr. ‘Aishah’s account in Sahih al-Bukhari records that they stayed there for three nights. This was a stage within the journey, not its destination.',
                    source_ids: ['E03'],
                },
                {
                    id: 'N03b',
                    text: 'During the stay, ‘Abdullah ibn Abi Bakr brought news of plans against them. He came after darkness and left before daybreak, returning to Makkah. His contribution was information.',
                    source_ids: ['E04'],
                },
                {
                    id: 'N03c',
                    text: '‘Amir ibn Fuhayrah provided another kind of help. He tended sheep and brought them near after nightfall, making milk available. The account describes this on each of the three nights.',
                    source_ids: ['E05'],
                },
                {
                    id: 'N03d',
                    text: 'Abu Bakr’s own account brings us closer to the danger of discovery. He was concerned that they might be seen if someone looked down. The Prophet reassured him.',
                    source_ids: ['E08'],
                },
                {
                    id: 'N03e',
                    text: 'The Quran also recalls the two in the cave and the reassurance given to the companion. Ibn Kathir’s commentary on the passage explains the reassurance through Allah’s help and support.',
                    source_ids: ['E09', 'E10'],
                },
            ],
        },
        {
            id: 'onward',
            title: 'The journey continues',
            scene: 'overview',
            duration: 9,
            source_ids: ['E06', 'E07'],
            paragraphs: [
                {
                    id: 'N04a',
                    text: 'The arranged meeting with the guide connects the stay at Thawr to the next stage. When the Prophet ﷺ and Abu Bakr continued, ‘Amir ibn Fuhayrah and the guide went with them. The account says that the guide led them by the coastal way.',
                    source_ids: ['E06', 'E07'],
                },
                {
                    id: 'N04b',
                    text: 'That description gives us part of the route’s character, but not every turn or stopping place. The connection shown here is schematic; it is not a measured itinerary.',
                    source_ids: ['E07'],
                },
            ],
        },
        {
            id: 'arrival',
            title: 'Arrival and a new beginning',
            scene: 'overview',
            duration: 10,
            source_ids: ['E11', 'E12'],
            paragraphs: [
                {
                    id: 'N05a',
                    text: 'In Madinah, Muslims went out to wait after hearing that the Prophet ﷺ had left Makkah. The arrival account describes their reception of him and his stay among Bani ‘Amr ibn ‘Awf.',
                    source_ids: ['E11'],
                },
                {
                    id: 'N05b',
                    text: 'The account goes on to describe a date-drying yard that became the site of the Prophet’s mosque in Madinah. It records the Prophet carrying bricks with those building it.',
                    source_ids: ['E12'],
                },
            ],
            recap: 'You followed preparations, a period of shelter, the onward journey, and arrival. You met different forms of help and read accounts of reassurance. This is a selected account, not a complete history of every episode or consequence of the Hijrah.',
        },
    ],
    sources: [
        source(
            'E01',
            'Sahih al-Bukhari',
            '3905 · migration chapter',
            'فَهَاجَرَ مَنْ هَاجَرَ قِبَلَ الْمَدِينَةِ، وَرَجَعَ عَامَّةُ مَنْ كَانَ هَاجَرَ بِأَرْضِ الْحَبَشَةِ إِلَى الْمَدِينَةِ',
            'Some Muslims moved to Madinah before this departure; the selected passage also describes Abu Bakr waiting to accompany the Prophet ﷺ.',
            'The wording and use are draft research material. A Turath page_id and publication-approved edition have not been locked.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E02',
            'Sahih al-Bukhari',
            '3905 · preparations',
            'فَجَهَّزْنَاهُمَا أَحَثَّ الْجَهَازِ، وَصَنَعْنَا لَهُمَا سُفْرَةً فِي جِرَابٍ، فَقَطَعَتْ أَسْمَاءُ بِنْتُ أَبِي بَكْرٍ قِطْعَةً مِنْ نِطَاقِهَا',
            'The selected passage describes provisions and Asma bint Abi Bakr using part of her waist-belt to tie the bag.',
            'This is a selected Arabic extract, not a final translation or publication clearance.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E03',
            'Sahih al-Bukhari',
            '3905 · cave stay',
            'ثُمَّ لَحِقَ رَسُولُ اللَّهِ صلى الله عليه وسلم وَأَبُو بَكْرٍ بِغَارٍ فِي جَبَلِ ثَوْرٍ فَكَمَنَا فِيهِ ثَلاَثَ لَيَالٍ',
            'The selected passage supports the cave on Mount Thawr and three nights.',
            'It does not establish coordinates, dimensions, or the exact arrangement of a visual model.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E04',
            'Sahih al-Bukhari',
            '3905 · news',
            'فَيَأْتِيَهُمَا بِخَبَرِ ذَلِكَ حِينَ يَخْتَلِطُ الظَّلاَمُ',
            'The selected passage describes ‘Abdullah ibn Abi Bakr bringing news of plans against the two companions after darkness.',
            'It does not establish modern clock times or a mapped trail.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E05',
            'Sahih al-Bukhari',
            '3905 · milk',
            'وَيَرْعَى عَلَيْهِمَا عَامِرُ بْنُ فُهَيْرَةَ مِنْحَةً مِنْ غَنَمٍ ... فِي كُلِّ لَيْلَةٍ مِنْ تِلْكَ اللَّيَالِي الثَّلاَثِ',
            'The selected passage connects ‘Amir ibn Fuhayrah with tending sheep and making milk available during the three nights.',
            'Do not enlarge this passage with an unreviewed footprint-erasing or animal detail.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E06',
            'Sahih al-Bukhari',
            '3905 · guide',
            'وَاسْتَأْجَرَ رَسُولُ اللَّهِ صلى الله عليه وسلم وَأَبُو بَكْرٍ رَجُلاً ... هَادِيًا خِرِّيتًا',
            'The selected passage describes hiring a skilled guide, entrusting him with two riding animals, and arranging the meeting at Thawr.',
            'The selected passage does not supply the guide’s personal name or a precise route.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E07',
            'Sahih al-Bukhari',
            '3905 · onward route',
            'وَانْطَلَقَ مَعَهُمَا عَامِرُ بْنُ فُهَيْرَةَ وَالدَّلِيلُ فَأَخَذَ بِهِمْ طَرِيقَ السَّوَاحِلِ',
            'The selected passage says that ‘Amir and the guide went with them and that the guide led them by the coastal way.',
            'It does not establish every turn, distance, stopping place, or exact GPS route.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E08',
            'Sahih al-Bukhari',
            '3653 · cave reassurance',
            'لَوْ أَنَّ أَحَدَهُمْ نَظَرَ تَحْتَ قَدَمَيْهِ لأَبْصَرَنَا ... اللَّهُ ثَالِثُهُمَا',
            'Abu Bakr’s account records concern about being seen and the Prophet’s reassurance.',
            'The display is an Arabic extract and draft attribution; it is not a visual depiction of the unseen.',
            'https://sunnah.com/bukhari:3653',
        ),
        source(
            'E09',
            'Quran',
            '9:40',
            'إِذْ هُمَا فِي الْغَارِ إِذْ يَقُولُ لِصَاحِبِهِ لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا',
            'The selected extract recalls the two in the cave and the reassurance to the companion.',
            'This excerpt is not the full verse and does not itself name Abu Bakr or Mount Thawr. No final translation is selected.',
            'https://quran.com/9/40',
        ),
        source(
            'E10',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'commentary on Quran 9:40 · Turath 930/764',
            'فإن الله ناصره ومؤيده ومظفره',
            'Ibn Kathir’s commentary on the Turath page explains the reassurance through Allah’s help, support, and strengthening.',
            'This is commentary in Ibn Kathir, not the Quranic wording itself; the use and wording remain pending scholarly review.',
            'https://api.turath.io/page?book_id=930&pg=764',
        ),
        source(
            'E11',
            'Sahih al-Bukhari',
            '3906 · arrival',
            'وَسَمِعَ الْمُسْلِمُونَ بِالْمَدِينَةِ مَخْرَجَ رَسُولِ اللَّهِ ... حَتَّى نَزَلَ بِهِمْ فِي بَنِي عَمْرِو بْنِ عَوْفٍ',
            'The selected arrival account describes people waiting and the stay among Bani ‘Amr ibn ‘Awf.',
            'Keep arrival duration and exact geography out of the draft chapter until separately reviewed.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E12',
            'Sahih al-Bukhari',
            '3906 · shared building work',
            'ثُمَّ بَنَاهُ مَسْجِدًا، وَطَفِقَ رَسُولُ اللَّهِ صلى الله عليه وسلم يَنْقُلُ مَعَهُمُ اللَّبِنَ',
            'The selected passage describes the mosque site and the Prophet ﷺ carrying bricks with the builders.',
            'It does not establish the exact appearance of buildings in the scene.',
            'https://sunnah.com/bukhari:3906',
        ),
    ],
}

function get_turath_citation(id) {
    const citations = {
        E01: {
            book_id: '9820',
            page_id: '140',
            book: 'الرحيق المختوم',
            author: 'صفي الرحمن المباركفوري',
            volume: '1',
            page: '142',
            heading: 'الهجرة إلى المدينة',
            excerpt:
                'فهاجر من هاجر قبل المدينة ... وتجهز أبو بكر قبل المدينة ... فحبس أبو بكر نفسه على رسول الله ﷺ ليصحبه',
        },
        E02: {
            book_id: '13606',
            page_id: '123',
            book: 'صحيح السيرة النبوية - إبراهيم العلي',
            author: 'إبراهيم العلي',
            volume: '1',
            page: '124',
            heading: 'المبحث الثالث: ما يذكر عن أسماء في الهجرة',
            excerpt:
                'فجهزناهما أحث الجهاز، وصنعنا لهما سفرة في جراب، فقطعت أسماء بنت أبي بكر قطعة من نطاقها، فربطت به على فم الجراب',
        },
        E03: {
            book_id: '13606',
            page_id: '122',
            book: 'صحيح السيرة النبوية - إبراهيم العلي',
            author: 'إبراهيم العلي',
            volume: '1',
            page: '123',
            heading: 'التخطيط للهجرة والرعاية الربانية',
            excerpt: 'ثم لحق رسول الله وأبو بكر بغار في جبل ثور ... فكمنا فيه ثلاث ليال',
        },
        E04: {
            book_id: '13606',
            page_id: '122',
            book: 'صحيح السيرة النبوية - إبراهيم العلي',
            author: 'إبراهيم العلي',
            volume: '1',
            page: '123',
            heading: 'التخطيط للهجرة والرعاية الربانية',
            excerpt:
                'يبيت عندهما عبد الله بن أبي بكر ... فيصبح مع قريش بمكة ... حتى يأتيهما بخبر ذلك حين يختلط الظلام',
        },
        E05: {
            book_id: '13606',
            page_id: '122',
            book: 'صحيح السيرة النبوية - إبراهيم العلي',
            author: 'إبراهيم العلي',
            volume: '1',
            page: '123',
            heading: 'التخطيط للهجرة والرعاية الربانية',
            excerpt:
                'ويرعى عليهما عامر بن فهيرة ... فيريحها عليهما حين تذهب ساعة من العشاء ... يفعل ذلك في كل ليلة من تلك الليالي الثلاث',
        },
        E06: {
            book_id: '13606',
            page_id: '122',
            book: 'صحيح السيرة النبوية - إبراهيم العلي',
            author: 'إبراهيم العلي',
            volume: '1',
            page: '123',
            heading: 'التخطيط للهجرة والرعاية الربانية',
            excerpt:
                'واستأجر رسول الله ﷺ وأبو بكر رجلًا من بني الديل ... هاديًا خريتًا ... فدفعا إليه راحلتيهما، وواعداه غار ثور بعد ثلاث ليال',
        },
        E07: {
            book_id: '13606',
            page_id: '122',
            book: 'صحيح السيرة النبوية - إبراهيم العلي',
            author: 'إبراهيم العلي',
            volume: '1',
            page: '123',
            heading: 'التخطيط للهجرة والرعاية الربانية',
            excerpt: 'وانطلق معهما عامر بن فهيرة والدليل، فأخذ بهما طريق السواحل',
        },
        E08: {
            book_id: '930',
            page_id: '764',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '242',
            heading: 'تفسير آية الغار من سورة التوبة',
            excerpt:
                'أن أبا بكر حدثه، قال: قلت للنبي ﷺ ونحن في الغار: لو أن أحدهم نظر إلى قدميه لأبصرنا تحت قدميه',
        },
        E09: {
            book_id: '930',
            page_id: '764',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '242',
            heading: 'نقل الآية 40 من سورة التوبة',
            excerpt:
                'إلا تنصروه فقد نصره الله، إذ أخرجه الذين كفروا ثاني اثنين إذ هما في الغار، إذ يقول لصاحبه لا تحزن إن الله معنا',
        },
        E10: {
            book_id: '930',
            page_id: '764',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '242',
            heading: 'شرح معنى النصرة في آية الغار',
            excerpt:
                'فإن الله ناصره ومؤيده ومظفره ... ولها قال ثاني اثنين إذ هما في الغار أي وقد لجأ إلى الغار فأقاما فيه ثلاثة أيام',
        },
        E11: {
            book_id: '930',
            page_id: '772',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '250',
            heading: 'دخول المدينة وأول الاستقرار',
            excerpt:
                'فسمع المسلمون بالمدينة بمخرج رسول الله ﷺ من مكة ... حتى نزل بهم في بني عمرو بن عوف ... فلبث رسول الله ﷺ في بني عمرو بن عوف بضع عشرة ليلة',
        },
        E12: {
            book_id: '930',
            page_id: '773',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '251',
            heading: 'بناء المسجد والعمل مع الأنصار',
            excerpt: 'ثم بناه مسجدًا. فطفق رسول الله ﷺ ينقل معهم اللبن في بنيانه',
        },
    }
    return citations[id]
}

function source(id, work, locator, excerpt, explanation, limits, url) {
    const citation = get_turath_citation(id)
    return {
        id,
        work: citation?.book ?? work,
        locator: citation
            ? `Turath · book ${citation.book_id} · page ${citation.page_id} · vol. ${citation.volume}, p. ${citation.page}`
            : locator,
        excerpt: citation?.excerpt ?? excerpt,
        explanation,
        limits,
        url: citation
            ? `https://api.turath.io/page?book_id=${citation.book_id}&pg=${citation.page_id}`
            : url,
        author:
            citation?.author ??
            (id === 'E10' ? 'Al-Sa‘di' : 'Attribution recorded in the cited work'),
        volume: citation?.volume ?? null,
        page: citation?.page ?? null,
        heading: citation?.heading ?? null,
        book_id: citation?.book_id ?? null,
        page_id: citation?.page_id ?? null,
        review_status: citation
            ? 'draft — Turath page retrieved; scholarly and publication review pending'
            : 'draft — scholarly and publication review pending',
        citation_status: citation
            ? 'Turath book_id/page_id retrieved from category 24; publication approval pending'
            : 'exact Turath book_id/page_id not locked for this draft',
    }
}

export function get_step(id) {
    const step = chapter.steps.find((item) => item.id === id)
    if (!step) throw new Error(`Unknown chapter step: ${id}`)
    return step
}

export function get_source(id) {
    return chapter.sources.find((item) => item.id === id)
}

export function sources_for(step) {
    return step.source_ids.map(get_source).filter(Boolean)
}

export function cue_for(step, seconds) {
    const fraction = Math.max(0, Math.min(1, seconds / step.duration))
    return step.paragraphs[
        Math.min(step.paragraphs.length - 1, Math.floor(fraction * step.paragraphs.length))
    ]
}
