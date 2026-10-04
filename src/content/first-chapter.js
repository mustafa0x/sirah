// The first playable chapter contract. All learner wording, evidence mapping, and art
// direction in this file are working drafts pending scholarly/editorial approval.
import { details } from './details.js'
import { timeline } from './timeline.js'

/** @typedef {{id: string, title: string, scene: string, duration: number, source_ids: string[], paragraphs: Array<{id: string, text: string, source_ids: string[]}>, recap?: string}} ChapterStep */
/** @typedef {{id: string, title: string, release_id: string, release_status: string, review_status: string, language: string, objective: string, question: object, steps: ChapterStep[], sources: object[]}} Chapter */
/** @type {Chapter} */
export const chapter = {
    id: 'hijrah-thawr-loop',
    title: 'The Hijrah: a journey in stages',
    release_id: 'hackathon-demo-0.2',
    release_status: 'hackathon-demo',
    review_status: 'post-hackathon publication review',
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
            duration: 24,
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
            duration: 24,
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
            id: 'departure',
            title: 'The night of departure',
            scene: 'overview',
            duration: 34,
            source_ids: ['E18', 'E19', 'E20'],
            paragraphs: [
                {
                    id: 'N09a',
                    text: 'The leaders of Quraysh met in Dar al-Nadwah, the house where they settled their affairs, to decide what to do about the Prophet ﷺ now that they feared him.',
                    source_ids: ['E18'],
                },
                {
                    id: 'N09b',
                    text: 'That night they gathered at his door, waiting for him to sleep. He told ‘Ali to lie in his bed, wrapped in his green cloak, and assured him that no harm from them would reach him.',
                    source_ids: ['E19'],
                },
                {
                    id: 'N09c',
                    text: '‘Ali stayed behind for another reason too. People in Makkah left their valuables with the Prophet ﷺ for safekeeping, because they knew his honesty. ‘Ali was to return every one of them.',
                    source_ids: ['E20'],
                },
            ],
        },
        {
            id: 'thawr',
            reading_chapter_id: 'hch_thawr',
            title: 'Three nights at Thawr',
            scene: 'thawr',
            duration: 56,
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
            duration: 26,
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
            id: 'pursuit',
            reading_chapter_id: 'hch_suraqa',
            title: 'A rider on the road',
            scene: 'overview',
            duration: 36,
            source_ids: ['E13', 'E14', 'E15'],
            paragraphs: [
                {
                    id: 'N06a',
                    text: 'Quraysh had offered a reward for each of the two travellers. Suraqah ibn Malik recounts that a man came to his gathering and said he had just seen figures near the coast. Suraqah recognised who they must be, and set out after them.',
                    source_ids: ['E13'],
                },
                {
                    id: 'N06b',
                    text: 'By his own account, he came close enough to hear the Prophet ﷺ reciting. Then the forelegs of his horse sank into the ground up to the knees, and he was thrown from it.',
                    source_ids: ['E14'],
                },
                {
                    id: 'N06c',
                    text: 'He told them what Quraysh intended and offered them provisions. They took nothing from him and asked only that he keep their news hidden. At his request, ‘Amir ibn Fuhayrah wrote him a guarantee of safety on a piece of leather. Then they went on.',
                    source_ids: ['E15'],
                },
            ],
        },
        {
            id: 'tent',
            reading_chapter_id: 'hch_umm_mabad',
            title: 'The tent of Umm Ma‘bad',
            scene: 'overview',
            duration: 26,
            source_ids: ['E21'],
            paragraphs: [
                {
                    id: 'N10a',
                    text: 'Further on they stopped at the tent of Umm Ma‘bad of Khuza‘ah and asked for hospitality. She had no food to offer, she said, and no ewe but one that gave no milk.',
                    source_ids: ['E21'],
                },
                {
                    id: 'N10b',
                    text: 'The Prophet ﷺ called for the ewe, passed his hand over its udder and called on Allah. He milked it into a large vessel until it frothed, and said: drink, Umm Ma‘bad. Ibn Kathir notes that her story is well known and comes through routes that strengthen one another.',
                    source_ids: ['E21'],
                },
            ],
        },
        {
            id: 'quba',
            title: 'Quba: the first stop',
            scene: 'overview',
            duration: 24,
            source_ids: ['E11', 'E16'],
            paragraphs: [
                {
                    id: 'N05a',
                    text: 'In Madinah, Muslims went out to wait after hearing that the Prophet ﷺ had left Makkah. The arrival account describes their reception of him and his stay among Bani ‘Amr ibn ‘Awf.',
                    source_ids: ['E11'],
                },
                {
                    id: 'N07a',
                    text: 'He stayed among them for more than ten nights. There he founded the mosque that the account calls the one founded on piety, and he prayed in it.',
                    source_ids: ['E16'],
                },
            ],
        },
        {
            id: 'arrival',
            title: 'Arrival and a new beginning',
            scene: 'overview',
            duration: 24,
            source_ids: ['E17', 'E12'],
            paragraphs: [
                {
                    id: 'N08a',
                    text: 'Then he rode on, with people walking beside him, until his camel knelt at a place in Madinah where some of the Muslims already prayed. It was a yard for drying dates.',
                    source_ids: ['E17'],
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
            'This excerpt does not give an exact departure date.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E02',
            'Sahih al-Bukhari',
            '3905 · preparations',
            'فَجَهَّزْنَاهُمَا أَحَثَّ الْجَهَازِ، وَصَنَعْنَا لَهُمَا سُفْرَةً فِي جِرَابٍ، فَقَطَعَتْ أَسْمَاءُ بِنْتُ أَبِي بَكْرٍ قِطْعَةً مِنْ نِطَاقِهَا',
            'The selected passage describes provisions and Asma bint Abi Bakr using part of her waist-belt to tie the bag.',
            'The excerpt describes preparations, not a nightly delivery to the cave.',
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
            'The excerpt does not describe erasing footprints.',
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
            'The account does not describe the cave’s dimensions or layout.',
            'https://sunnah.com/bukhari:3653',
        ),
        source(
            'E09',
            'Quran',
            '9:40',
            'إِذْ هُمَا فِي الْغَارِ إِذْ يَقُولُ لِصَاحِبِهِ لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا',
            'The selected extract recalls the two in the cave and the reassurance to the companion.',
            'This excerpt is not the full verse and does not itself name Abu Bakr or Mount Thawr.',
            'https://quran.com/9/40',
        ),
        source(
            'E10',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'commentary on Quran 9:40 · Turath 930/764',
            'فإن الله ناصره ومؤيده ومظفره',
            'Ibn Kathir’s commentary on the Turath page explains the reassurance through Allah’s help, support, and strengthening.',
            'This is Ibn Kathir’s commentary, not the Quranic wording itself.',
            'https://api.turath.io/page?book_id=930&pg=764',
        ),
        source(
            'E11',
            'Sahih al-Bukhari',
            '3906 · arrival',
            'وَسَمِعَ الْمُسْلِمُونَ بِالْمَدِينَةِ مَخْرَجَ رَسُولِ اللَّهِ ... حَتَّى نَزَلَ بِهِمْ فِي بَنِي عَمْرِو بْنِ عَوْفٍ',
            'The selected arrival account describes people waiting and the stay among Bani ‘Amr ibn ‘Awf.',
            'It does not give an exact location for the stay among Bani ‘Amr ibn ‘Awf.',
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
        source(
            'E13',
            'Sahih al-Bukhari',
            '3906 · the reward',
            'يجعلون في رسول الله ﷺ وأبي بكر دية كل واحد منهما لمن قتله أو أسره',
            'Suraqah’s account records the reward offered for each of the two, and a report that figures had been seen near the coast.',
            'It does not establish where on the route this happened, and the scene does not place it.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E14',
            'Sahih al-Bukhari',
            '3906 · the pursuit',
            'ساخت يدا فرسي في الأرض حتى بلغتا الركبتين، فخررت عنها',
            'Suraqah describes the forelegs of his horse sinking into the ground to the knees, and being thrown.',
            'This is his own first-person account. The scene shows the road, not the event or any person.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E15',
            'Sahih al-Bukhari',
            '3906 · the guarantee',
            'ولم يسألاني إلا أن قالا: أخف عنا. فسألته أن يكتب لي كتاب أمن، فأمر عامر بن فهيرة فكتب',
            'They asked only that he keep their news hidden; ‘Amir ibn Fuhayrah wrote him a guarantee of safety.',
            'The wording of the written guarantee is not given in this passage.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E16',
            'Sahih al-Bukhari',
            '3906 · Quba',
            'فلبث رسول الله ﷺ في بني عمرو بن عوف بضع عشرة ليلة وأسس المسجد الذي أسس على التقوى',
            'The account gives a stay of more than ten nights among Bani ‘Amr ibn ‘Awf and the founding of a mosque there.',
            'The passage does not name the place; identifying it as Quba rests on other reports.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E17',
            'Sahih al-Bukhari',
            '3906 · entering Madinah',
            'ثم ركب راحلته وسار يمشي معه الناس حتى بركت عند مسجد رسول الله ﷺ بالمدينة',
            'He rode on with people walking beside him until his camel knelt at the site of the mosque in Madinah.',
            'It does not establish the route taken through the town or the appearance of the place.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E18',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'the council',
            'فاجتمعوا له في دار الندوة',
            'Ibn Ishaq reports that Quraysh met in Dar al-Nadwah to consult about the Prophet ﷺ once they feared him.',
            'The excerpt covers the meeting, not what was said in it.',
            'https://api.turath.io/page?book_id=930&pg=749',
        ),
        source(
            'E19',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'the bed',
            'نم على فراشي',
            'They gathered at his door at night; he told ‘Ali to sleep in his bed under his green cloak and assured him of safety.',
            'Ibn Kathir notes that al-Waqidi also relates this, combining several narrators’ accounts.',
            'https://api.turath.io/page?book_id=930&pg=751',
        ),
        source(
            'E20',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'the trusts',
            'الودائع التي كانت عنده للناس',
            '‘Ali was told to stay behind until he had returned the deposits people had left with the Prophet ﷺ.',
            'Ibn Ishaq introduces this with “as it has reached me”.',
            'https://api.turath.io/page?book_id=930&pg=756',
        ),
        source(
            'E21',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'the tent',
            'فنزل رسول الله ﷺ بخيمة أم معبد',
            'They stopped at Umm Ma‘bad’s tent; she had only a ewe without milk, which then gave milk in abundance.',
            'Ibn Kathir calls the story well known, through routes that support one another. It does not fix where the tent stood.',
            'https://api.turath.io/page?book_id=930&pg=779',
        ),
    ],
}

// What kind of account each passage is, and where in the scene it speaks of.
const passage_kinds = {
    E09: 'quran',
    E10: 'report',
    E18: 'report',
    E19: 'report',
    E20: 'report',
    E21: 'report',
}
const passage_places = {
    E01: 'makkah',
    E02: 'makkah',
    E03: 'cave',
    E04: 'cave',
    E05: 'cave',
    E06: 'makkah',
    E07: 'coast',
    E08: 'cave',
    E09: 'cave',
    E10: 'cave',
    E11: 'quba',
    E12: 'madinah',
    E13: 'road',
    E14: 'road',
    E15: 'road',
    E16: 'quba',
    E17: 'madinah',
    E18: 'makkah',
    E19: 'makkah',
    E20: 'makkah',
    E21: 'tent',
}
for (const source of chapter.sources) {
    source.kind = passage_kinds[source.id] ?? 'hadith'
    source.place = passage_places[source.id]
}

// Details and timeline entries carry their own passages, numbered after the chapter's.
const extras = [
    ...details.map((item) => ({
        item,
        citation: item,
        explanation: item.text,
        limits: item.limits,
    })),
    ...timeline
        .filter((item) => item.citation)
        .map((item) => ({
            item,
            citation: item.citation,
            explanation: item.note,
            limits: item.when,
        })),
]
for (const { item, citation, explanation, limits } of extras) {
    item.source_id = `E${chapter.sources.length + 1}`
    chapter.sources.push({
        id: item.source_id,
        number: chapter.sources.length + 1,
        reference: citation.work,
        work: citation.book,
        locator: `Turath · book ${citation.book_id} · page ${citation.page_id} · vol. ${citation.volume}, p. ${citation.page}`,
        excerpt: citation.excerpt,
        explanation,
        limits,
        url: `https://api.turath.io/page?book_id=${citation.book_id}&pg=${citation.page_id}`,
        author: citation.author,
        volume: citation.volume,
        page: citation.page,
        heading: null,
        book_id: citation.book_id,
        page_id: citation.page_id,
        kind: citation.kind,
        place: citation.place ?? (item.set || `detail_${item.id}`),
    })
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
        E13: {
            book_id: '930',
            page_id: '769',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '247',
            heading: 'حديث سراقة بن مالك',
            excerpt:
                'يجعلون في رسول الله ﷺ وأبي بكر دية كل واحد منهما لمن قتله أو أسره ... فقال: يا سراقة إني رأيت آنفا أسودة بالساحل أراها محمدا وأصحابه. قال سراقة: فعرفت أنهم هم',
        },
        E14: {
            book_id: '930',
            page_id: '769',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '247',
            heading: 'حديث سراقة بن مالك',
            excerpt:
                'حتى إذا سمعت قراءة رسول الله ﷺ وهو لا يلتفت وأبو بكر يكثر الالتفات، ساخت يدا فرسي في الأرض حتى بلغتا الركبتين، فخررت عنها',
        },
        E15: {
            book_id: '930',
            page_id: '770',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '248',
            heading: 'حديث سراقة بن مالك',
            excerpt:
                'وعرضت عليهم الزاد والمتاع، فلم يرزآني ولم يسألاني إلا أن قالا: أخف عنا. فسألته أن يكتب لي كتاب أمن، فأمر عامر بن فهيرة فكتب لي رقعة من أدم. ثم مضى رسول الله ﷺ',
        },
        E16: {
            book_id: '930',
            page_id: '772',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '250',
            heading: 'دخول المدينة وأول الاستقرار',
            excerpt:
                'فلبث رسول الله ﷺ في بني عمرو بن عوف بضع عشرة ليلة وأسس المسجد الذي أسس على التقوى، وصلى فيه رسول الله ﷺ',
        },
        E17: {
            book_id: '930',
            page_id: '772',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '250',
            heading: 'دخول المدينة وأول الاستقرار',
            excerpt:
                'ثم ركب راحلته وسار يمشي معه الناس حتى بركت عند مسجد رسول الله ﷺ بالمدينة، وهو يصلي فيه يومئذ رجال من المسلمين. وكان مربدا للتمر',
        },
        E18: {
            book_id: '930',
            page_id: '749',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '227',
            heading: 'اجتماع دار الندوة',
            excerpt:
                'فاجتمعوا له في دار الندوة، وهي دار قصي بن كلاب التي كانت قريش لا تقضي أمرا إلا فيها، يتشاورون فيما يصنعون في أمر رسول الله ﷺ حين خافوه',
        },
        E19: {
            book_id: '930',
            page_id: '751',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '229',
            heading: 'ليلة الخروج',
            excerpt:
                'فلما رأى رسول الله ﷺ مكانهم قال لعلي بن أبي طالب: نم على فراشي وتسج ببردي هذا الحضرمي الأخضر، فنم فيه فإنه لن يخلص إليك شئ تكرهه منهم',
        },
        E20: {
            book_id: '930',
            page_id: '756',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '234',
            heading: 'رد الودائع',
            excerpt:
                'أما علي فإن رسول الله ﷺ أمره أن يتخلف حتى يؤدي عن رسول الله ﷺ الودائع التي كانت عنده للناس، وكان رسول الله ﷺ، وليس بمكة أحد عنده شئ يخشى عليه إلا وضعه عنده، لما يعلم من صدقه وأمانته',
        },
        E21: {
            book_id: '930',
            page_id: '779',
            book: 'السيرة النبوية من البداية والنهاية - ت عبد الواحد',
            author: 'ابن كثير',
            volume: '2',
            page: '257',
            heading: 'قصة أم معبد الخزاعية',
            excerpt:
                'فنزل رسول الله ﷺ بخيمة أم معبد ... فقالت: والله ما عندنا طعام ولا لنا منحة ولا لنا شاة إلا حائل. فدعا رسول الله ﷺ ببعض غنمها فمسح ضرعها بيده ودعا الله وحلب في العس حتى أرغى وقال: اشربي يا أم معبد',
        },
    }
    return citations[id]
}

function source(id, work, locator, excerpt, explanation, limits, url) {
    const citation = get_turath_citation(id)
    return {
        id,
        number: Number(id.slice(1)),
        reference: /^[\d:]+$/.test(locator.split(' · ')[0])
            ? `${work} ${locator.split(' · ')[0]}`
            : work,
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
    // Narrated stages carry their own cue boundaries.
    if (step.paragraphs[0].end !== undefined)
        return step.paragraphs.find((item) => seconds < item.end) ?? step.paragraphs.at(-1)
    const fraction = Math.max(0, Math.min(1, seconds / step.duration))
    return step.paragraphs[
        Math.min(step.paragraphs.length - 1, Math.floor(fraction * step.paragraphs.length))
    ]
}
