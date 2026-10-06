// The first playable chapter contract. All learner wording, evidence mapping, and art
// direction in this file are working drafts pending scholarly/editorial approval.
import { details } from './details.js'
import { timeline } from './timeline.js'
import * as generated from './text.generated.js'
// Optional exports are read with fallbacks: the compiler loads this module before writing them.
const { source_notes, stage_text } = generated
const cited_passages = generated.cited_passages ?? {}
const weak_sources = generated.weak_sources ?? []

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
            reading_chapter_id: 'hch_early_migration',
            additional_reading_chapter_ids: ['hch_aqaba'],
            scene: 'overview',
            duration: 24,
            source_ids: ['E01', 'E11'],
        },
        {
            id: 'preparations',
            reading_chapter_id: 'hch_preparations',
            scene: 'overview',
            duration: 24,
            source_ids: ['E02', 'E06'],
        },
        {
            id: 'departure',
            reading_chapter_id: 'hch_departure',
            scene: 'overview',
            duration: 34,
            source_ids: ['E18', 'E19', 'E20'],
        },
        {
            id: 'thawr',
            reading_chapter_id: 'hch_thawr',
            scene: 'thawr',
            duration: 56,
            source_ids: ['E03', 'E04', 'E05', 'E08', 'E09', 'E10'],
        },
        {
            id: 'onward',
            reading_chapter_id: 'hch_road',
            scene: 'overview',
            duration: 26,
            source_ids: ['E06', 'E07'],
        },
        {
            id: 'pursuit',
            reading_chapter_id: 'hch_suraqa',
            scene: 'overview',
            duration: 36,
            source_ids: ['E13', 'E14', 'E15'],
        },
        {
            id: 'tent',
            reading_chapter_id: 'hch_umm_mabad',
            scene: 'overview',
            duration: 26,
            source_ids: ['E21', 'E40'],
        },
        {
            id: 'quba',
            reading_chapter_id: 'hch_quba',
            scene: 'overview',
            duration: 24,
            source_ids: ['E11', 'E16'],
        },
        {
            id: 'arrival',
            reading_chapter_id: 'hch_madinah_arrival',
            additional_reading_chapter_ids: ['hch_mosque', 'hch_settlement'],
            scene: 'overview',
            duration: 24,
            source_ids: ['E17', 'E12'],
        },
    ],
    sources: [
        source(
            'E01',
            'Sahih al-Bukhari',
            '3905 · migration chapter',
            'فَهَاجَرَ مَنْ هَاجَرَ قِبَلَ الْمَدِينَةِ، وَرَجَعَ عَامَّةُ مَنْ كَانَ هَاجَرَ بِأَرْضِ الْحَبَشَةِ إِلَى الْمَدِينَةِ',
            'This excerpt does not give an exact departure date.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E02',
            'Sahih al-Bukhari',
            '3905 · preparations',
            'فَجَهَّزْنَاهُمَا أَحَثَّ الْجَهَازِ، وَصَنَعْنَا لَهُمَا سُفْرَةً فِي جِرَابٍ، فَقَطَعَتْ أَسْمَاءُ بِنْتُ أَبِي بَكْرٍ قِطْعَةً مِنْ نِطَاقِهَا',
            'The excerpt describes preparations, not a nightly delivery to the cave.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E03',
            'Sahih al-Bukhari',
            '3905 · cave stay',
            'ثُمَّ لَحِقَ رَسُولُ اللَّهِ صلى الله عليه وسلم وَأَبُو بَكْرٍ بِغَارٍ فِي جَبَلِ ثَوْرٍ فَكَمَنَا فِيهِ ثَلاَثَ لَيَالٍ',
            'It does not establish coordinates, dimensions, or the exact arrangement of a visual model.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E04',
            'Sahih al-Bukhari',
            '3905 · news',
            'فَيَأْتِيَهُمَا بِخَبَرِ ذَلِكَ حِينَ يَخْتَلِطُ الظَّلاَمُ',
            'It does not establish modern clock times or a mapped trail.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E05',
            'Sahih al-Bukhari',
            '3905 · milk',
            'وَيَرْعَى عَلَيْهِمَا عَامِرُ بْنُ فُهَيْرَةَ مِنْحَةً مِنْ غَنَمٍ ... فِي كُلِّ لَيْلَةٍ مِنْ تِلْكَ اللَّيَالِي الثَّلاَثِ',
            'The excerpt does not describe erasing footprints.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E06',
            'Sahih al-Bukhari',
            '3905 · guide',
            'وَاسْتَأْجَرَ رَسُولُ اللَّهِ صلى الله عليه وسلم وَأَبُو بَكْرٍ رَجُلاً ... هَادِيًا خِرِّيتًا',
            'The selected passage does not supply the guide’s personal name or a precise route.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E07',
            'Sahih al-Bukhari',
            '3905 · onward route',
            'وَانْطَلَقَ مَعَهُمَا عَامِرُ بْنُ فُهَيْرَةَ وَالدَّلِيلُ فَأَخَذَ بِهِمْ طَرِيقَ السَّوَاحِلِ',
            'It does not establish every turn, distance, stopping place, or exact GPS route.',
            'https://sunnah.com/bukhari:3905',
        ),
        source(
            'E08',
            'Sahih al-Bukhari',
            '3653 · cave reassurance',
            'لَوْ أَنَّ أَحَدَهُمْ نَظَرَ تَحْتَ قَدَمَيْهِ لأَبْصَرَنَا ... اللَّهُ ثَالِثُهُمَا',
            'The account does not describe the cave’s dimensions or layout.',
            'https://sunnah.com/bukhari:3653',
        ),
        source(
            'E09',
            'Quran',
            '9:40',
            'إِذْ هُمَا فِي الْغَارِ إِذْ يَقُولُ لِصَاحِبِهِ لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا',
            'This excerpt is not the full verse and does not itself name Abu Bakr or Mount Thawr.',
            'https://quran.com/9/40',
        ),
        source(
            'E10',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'commentary on Quran 9:40 · Turath 930/764',
            'فإن الله ناصره ومؤيده ومظفره',
            'This is Ibn Kathir’s commentary, not the Quranic wording itself.',
            'https://api.turath.io/page?book_id=930&pg=764',
        ),
        source(
            'E11',
            'Sahih al-Bukhari',
            '3906 · arrival',
            'وَسَمِعَ الْمُسْلِمُونَ بِالْمَدِينَةِ مَخْرَجَ رَسُولِ اللَّهِ ... حَتَّى نَزَلَ بِهِمْ فِي بَنِي عَمْرِو بْنِ عَوْفٍ',
            'It does not give an exact location for the stay among Bani ‘Amr ibn ‘Awf.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E12',
            'Sahih al-Bukhari',
            '3906 · shared building work',
            'ثُمَّ بَنَاهُ مَسْجِدًا، وَطَفِقَ رَسُولُ اللَّهِ صلى الله عليه وسلم يَنْقُلُ مَعَهُمُ اللَّبِنَ',
            'It does not establish the exact appearance of buildings in the scene.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E13',
            'Sahih al-Bukhari',
            '3906 · the reward',
            'يجعلون في رسول الله ﷺ وأبي بكر دية كل واحد منهما لمن قتله أو أسره',
            'It does not establish where on the route this happened, and the scene does not place it.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E14',
            'Sahih al-Bukhari',
            '3906 · the pursuit',
            'ساخت يدا فرسي في الأرض حتى بلغتا الركبتين، فخررت عنها',
            'This is his own first-person account. The scene shows the road, not the event or any person.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E15',
            'Sahih al-Bukhari',
            '3906 · the guarantee',
            'ولم يسألاني إلا أن قالا: أخف عنا. فسألته أن يكتب لي كتاب أمن، فأمر عامر بن فهيرة فكتب',
            'The wording of the written guarantee is not given in this passage.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E16',
            'Sahih al-Bukhari',
            '3906 · Quba',
            'فلبث رسول الله ﷺ في بني عمرو بن عوف بضع عشرة ليلة وأسس المسجد الذي أسس على التقوى',
            'The passage does not name the place; identifying it as Quba rests on other reports.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E17',
            'Sahih al-Bukhari',
            '3906 · entering Madinah',
            'ثم ركب راحلته وسار يمشي معه الناس حتى بركت عند مسجد رسول الله ﷺ بالمدينة',
            'It does not establish the route taken through the town or the appearance of the place.',
            'https://sunnah.com/bukhari:3906',
        ),
        source(
            'E18',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'the council',
            'فاجتمعوا له في دار الندوة',
            'The excerpt covers the meeting, not what was said in it.',
            'https://api.turath.io/page?book_id=930&pg=749',
        ),
        source(
            'E19',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'the bed',
            'نم على فراشي',
            'Ibn Kathir notes that al-Waqidi also relates this, combining several narrators’ accounts.',
            'https://api.turath.io/page?book_id=930&pg=751',
        ),
        source(
            'E20',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'the trusts',
            'الودائع التي كانت عنده للناس',
            'Ibn Ishaq introduces this with “as it has reached me”.',
            'https://api.turath.io/page?book_id=930&pg=756',
        ),
        source(
            'E21',
            'Ibn Kathir, al-Bidayah wa al-Nihayah',
            'the tent',
            'فنزل رسول الله ﷺ بخيمة أم معبد',
            '',
            'https://api.turath.io/page?book_id=930&pg=779',
        ),
    ],
}

// Stage wording comes from content/journey/*.md.
for (const step of chapter.steps) {
    const text = stage_text[step.id]
    if (!text) throw new Error(`No content/journey file for stage ${step.id}`)
    step.title = text.title
    step.paragraphs = text.paragraphs.map(({ young, ...paragraph }) => paragraph)
    if (text.recap) step.recap = text.recap.text
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
        limits: item.limits,
    })),
    ...timeline
        .filter((item) => item.citation)
        .map((item) => ({
            item,
            citation: item.citation,
            limits: item.when,
        })),
]
for (const { item, citation, limits } of extras) {
    item.source_id = `E${chapter.sources.length + 1}`
    chapter.sources.push({
        id: item.source_id,
        number: chapter.sources.length + 1,
        reference: citation.work,
        work: citation.book,
        locator: `Turath · book ${citation.book_id} · page ${citation.page_id} · vol. ${citation.volume}, p. ${citation.page}`,
        excerpt: citation.excerpt,
        explanation: null,
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

const critical_source = source(
    'E40',
    'Ibn Kathir, al-Bidayah wa al-Nihayah',
    'the tent',
    '',
    '',
    'https://app.turath.io/book/4445?page=2190',
)
critical_source.kind = 'commentary'
critical_source.place = 'tent'
chapter.sources.push(critical_source)

// Each passage's note comes from content/sources.md.
for (const source of chapter.sources) {
    if (!source_notes[source.id]) throw new Error(`No note in content/sources.md for ${source.id}`)
    source.explanation = source_notes[source.id].text
}

// Captions derived from the chapters cite the chapters' passages (registry ids such as
// "sp_thawr_support:p1"); each becomes a source here, numbered after the journey's own, placed
// where its stage is.
const stage_places = {
    setting: 'makkah',
    preparations: 'makkah',
    departure: 'makkah',
    thawr: 'cave',
    onward: 'coast',
    pursuit: 'road',
    tent: 'tent',
    quba: 'quba',
    arrival: 'madinah',
}
for (const step of chapter.steps)
    for (const id of step.paragraphs.flatMap((paragraph) => paragraph.source_ids)) {
        const passage = cited_passages[id]
        if (!passage || chapter.sources.some((source) => source.id === id)) continue
        chapter.sources.push({
            id,
            number: chapter.sources.length + 1,
            reference: passage.reference,
            work: passage.book_ar,
            locator: '',
            excerpt: passage.excerpt,
            explanation: '',
            limits: '',
            url: passage.url,
            author: '',
            volume: passage.volume,
            page: passage.page,
            heading: null,
            book_id: passage.book_id,
            page_id: null,
            kind: /قرآن/.test(passage.kind_ar ?? '')
                ? 'quran'
                : /حديث/.test(passage.kind_ar ?? '')
                  ? 'hadith'
                  : 'report',
            place: stage_places[step.id],
            strength: passage.strength ?? null,
        })
    }
for (const source of chapter.sources) if (weak_sources.includes(source.id)) source.strength = 'weak'
for (const step of chapter.steps)
    step.source_ids = [
        ...new Set([...step.source_ids, ...step.paragraphs.flatMap((p) => p.source_ids)]),
    ]

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
        E40: {
            book_id: '4445',
            page_id: '2190',
            book: 'البداية والنهاية - ت التركي',
            author: 'ابن كثير',
            speaker_ar: 'إسماعيل بن كثير',
            citation_ar: 'البداية والنهاية - ت التركي، 4/472',
            source_unit_id: 'H-4445-2190-CRIT-IBNKATHIRGENERAL:p1',
            source_start: 0,
            source_end: 677,
            source_text_sha256: 'bf239f181713c58bd433c3270b09270ad5a30c1edbf163d6d7d839f73fe7cd19',
            source_url: 'https://app.turath.io/book/4445?page=2190',
            volume: '4',
            page: '472',
            heading: 'تقوية ابن كثير طرق قصة أم معبد إجمالا',
            excerpt:
                'وَاجْتَازَ فِي مُرُورِهِ عَلَى أُمِّ مَعْبَدٍ بِنْتِ كَعْبٍ مِنْ بَنِي كَعْبِ بْنِ خُزَاعَةَ، قَالَهُ ابْنُ هِشَامٍ. وَقَالَ يُونُسُ، عَنِ ابْنِ إِسْحَاقَ: اسْمُهَا عَاتِكَةُ بِنْتُ خَالِدِ بْنِ مُنْقِذِ بْنِ رَبِيعَةَ بْنِ أَصْرَمَ. وَقَالَ الْأُمَوِيُّ: هِيَ عَاتِكَةُ بِنْتُ تَبِيعٍ حَلِيفِ بَنِي مُنْقِذِ بْنِ رَبِيعَةَ بْنِ أَصْرَمَ بْنِ ضَبِيسِ بْنِ حَرَامِ بْنِ حُبْشِيَّةَ بْنِ كَعْبِ بْنِ عَمْرٍو، وَلِهَذِهِ الْمَرْأَةِ مِنَ الْوَلَدِ، مَعْبَدٌ، وَنَضْرَةٌ، وَحُنَيْدَةُ، بَنُو أَبِي مَعْبَدٍ، وَاسْمُهُ أَكْثَمُ بْنُ عَبْدِ الْعُزَّى بْنِ مُنْقِذِ بْنِ رَبِيعَةَ بْنِ أَصْرَمَ بْنِ ضَبِيسٍ، وَقِصَّتُهَا مَشْهُورَةٌ مَرْوِيَّةٌ مِنْ طَرْقٍ يَشُدُّ بَعْضُهَا بَعْضًا.',
        },
    }
    return citations[id]
}

function source(id, work, locator, excerpt, limits, url) {
    const citation = get_turath_citation(id)
    return {
        id,
        number: Number(id.slice(1)),
        reference:
            citation?.citation_ar ??
            (/^[\d:]+$/.test(locator.split(' · ')[0])
                ? `${work} ${locator.split(' · ')[0]}`
                : work),
        work: citation?.book ?? work,
        locator: citation
            ? `Turath · book ${citation.book_id} · page ${citation.page_id} · vol. ${citation.volume}, p. ${citation.page}`
            : locator,
        excerpt: citation?.excerpt ?? excerpt,
        explanation: null,
        limits,
        url:
            citation?.source_url ??
            (citation
                ? `https://api.turath.io/page?book_id=${citation.book_id}&pg=${citation.page_id}`
                : url),
        ...(citation?.source_unit_id
            ? {
                  speaker_ar: citation.speaker_ar,
                  citation_ar: citation.citation_ar,
                  source_unit_id: citation.source_unit_id,
                  source_start: citation.source_start,
                  source_end: citation.source_end,
                  source_text_sha256: citation.source_text_sha256,
              }
            : {}),
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
