// The same journey seen three ways. The scene, sources and order never change; a mode
// changes the wording, what is explained, and what is shown at first.

// Young learners follow six stages, in short sentences.
export const young_stages = ['setting', 'departure', 'thawr', 'pursuit', 'tent', 'arrival']

export const young_paragraphs = {
    N01a: 'This is the story of the Hijrah: when the Prophet Muhammad ﷺ travelled from Makkah to Madinah, a new home.',
    N01b: 'Many Muslims had already gone ahead. His best friend, Abu Bakr, waited so that they could travel together.',
    N02a: 'Abu Bakr prepared two camels. Asma helped pack food for the journey.',
    N02b: 'They chose a guide who knew the roads well. He would bring their camels after three nights.',
    N09a: 'An early account tells how the leaders of Quraysh met in Makkah to plan against the Prophet ﷺ.',
    N09b: 'The account says they waited outside his door that night, while ‘Ali slept in his bed, wrapped in his green cloak.',
    N09c: '‘Ali stayed behind to return the precious things that people had left with the Prophet ﷺ.',
    N03a: 'The Prophet ﷺ and Abu Bakr hid in a cave on Mount Thawr for three nights.',
    N03b: 'Each night, Abu Bakr’s son ‘Abdullah came in the dark to tell them the news from Makkah.',
    N03c: 'A shepherd called ‘Amir brought his sheep close every evening, so that they had milk to drink.',
    N03d: 'Abu Bakr was worried: if someone looked down, they would be seen! The Prophet ﷺ calmed him.',
    N03e: 'The Quran remembers what the Prophet ﷺ said to his friend in the cave: do not be sad, Allah is with us.',
    N04a: 'After three nights, their guide brought the camels. They left the cave and travelled towards Madinah.',
    N04b: 'They took a route near the coast. The journey was long, with many stops along the way.',
    N06a: 'Quraysh offered a big reward to catch them. A rider called Suraqah raced after them on his horse.',
    N06b: 'As he came close, his horse’s legs sank into the ground, and he fell off!',
    N06c: 'Suraqah gave up the chase. They asked him only to keep their secret, and went on their way.',
    N10a: 'Another account describes a stop at Umm Ma‘bad’s tent. She had a thin sheep that was not giving milk.',
    N10b: 'It says the Prophet ﷺ prayed and milked the sheep, and there was milk for everyone.',
    N07a: 'They first stopped at Quba, near Madinah, where a mosque was founded.',
    N05a: 'In Madinah, Muslims went out to wait for the Prophet ﷺ. The arrival account tells how they welcomed him.',
    N08a: 'At last they reached Madinah! The Prophet’s camel walked through the town and knelt in an open yard.',
    N05b: 'That yard became the place of his mosque, and he carried bricks to help build it.',
}

export const young_details = {
    visit: 'One hot noon, the Prophet ﷺ came to Abu Bakr’s house with big news: it was time to go. Abu Bakr asked to come too, and he said yes.',
    wealth: 'Abu Bakr took all his money for the journey. His daughter Asma put stones in its place to comfort her grandfather, who could not see.',
    south: 'Madinah is to the north. They went south first, towards Mount Thawr.',
    belts: 'Asma used her belt to tie up their food bag. People called her “the one with two belts”.',
    web: 'One report says the searchers saw a spider’s web across the cave and walked away.',
    stations:
        'Their guide knew the desert well. He led them along the coast, past many places whose names we still know.',
    garments: 'On the way, a friend called al-Zubayr gave them new white clothes.',
    friday: 'On his way into Madinah, the Prophet ﷺ led Friday prayer with about a hundred people.',
    camel: 'Everyone wanted the Prophet ﷺ to stay with them. He said: let the camel go, she has been told where to stop.',
    ayyub: 'He stayed in the house of Abu Ayyub until his mosque and his home were built.',
    brothers:
        'He made the people who arrived and the people of Madinah brothers, to help each other.',
    song: 'Many people remember a happy song sung to welcome him, but we are not sure it was sung that day.',
}

// For someone new to the story: why each stage matters.
export const why_it_matters = {
    setting: 'The Hijrah is so central that the Islamic calendar counts its years from it.',
    preparations:
        'Trust and careful planning sit side by side: the Prophet ﷺ relied on Allah and still prepared every step.',
    departure:
        'Even with people plotting against him, he made sure their property was returned. His honesty did not depend on how he was treated.',
    thawr: 'In the most frightening moment, the lesson is calm trust: Allah is with us.',
    onward: 'Choosing an unexpected route was wisdom, not doubt. Muslims are taught to trust Allah and still take sensible steps.',
    pursuit:
        'A man who set out to capture them left asking for their protection. The story is full of reversals like this.',
    tent: 'Hospitality from strangers, and blessing in very little, run through the whole of the Prophet’s life.',
    quba: 'A mosque was founded at Quba, making worship a part of life in the new home.',
    arrival:
        'Madinah became a home for the growing Muslim community, bringing newcomers and their hosts together.',
}

function term(id, word, meaning, match) {
    return { id, word, meaning, match }
}

// Terms explained for someone new to the story. `match` finds them in either language.
export const glossary = [
    term(
        'pbuh',
        'ﷺ',
        'Short for “peace and blessings of Allah be upon him”, said by Muslims after the Prophet’s name.',
        ['ﷺ'],
    ),
    term(
        'hijrah',
        'Hijrah',
        'The migration of the Prophet ﷺ and his companions from Makkah to Madinah, in 622.',
        ['Hijrah', 'الهجرة'],
    ),
    term(
        'quraysh',
        'Quraysh',
        'The leading tribe of Makkah. The Prophet ﷺ himself belonged to it.',
        ['Quraysh', 'قريش'],
    ),
    term('makkah', 'Makkah', 'The city where the Prophet ﷺ was born, home of the Ka‘bah.', [
        'Makkah',
        'مكة',
    ]),
    term(
        'madinah',
        'Madinah',
        'Then called Yathrib: the city that welcomed the Prophet ﷺ. Its name means “the city”.',
        ['Madinah', 'المدينة'],
    ),
    term(
        'abubakr',
        'Abu Bakr',
        'The Prophet’s closest friend and companion, who later led the Muslims after him.',
        ['Abu Bakr', 'أبو بكر', 'أبي بكر'],
    ),
    term('allah', 'Allah', 'The Arabic word for God.', ['Allah', 'الله']),
    term('quran', 'Quran', 'The holy book of Islam, which Muslims believe is the word of Allah.', [
        'Quran',
        'القرآن',
    ]),
    term(
        'bukhari',
        'Sahih al-Bukhari',
        'The collection of hadith that Muslims consider the most reliable.',
        ['al-Bukhari', 'البخاري'],
    ),
    term(
        'ibnkathir',
        'Ibn Kathir',
        'A scholar of the fourteenth century whose history of the Prophet’s life is widely used.',
        ['Ibn Kathir', 'ابن كثير'],
    ),
    term(
        'ibnishaq',
        'Ibn Ishaq',
        'An eighth-century historian whose accounts of the Prophet’s life are preserved by later writers.',
        ['Ibn Ishaq', 'ابن إسحاق'],
    ),
    term('thawr', 'Thawr', 'A mountain south of Makkah, with a small cave near its top.', [
        'Thawr',
        'ثور',
    ]),
    term('quba', 'Quba', 'A village on the edge of Madinah, where the Prophet ﷺ stopped first.', [
        'Quba',
        'قباء',
    ]),
]

// For someone new to the story: what each kind of source is.
export const kind_notes = {
    quran: 'A passage of the Quran, the holy book of Islam.',
    hadith: 'A hadith: a report of the Prophet’s words or deeds, passed on through named narrators. The collections of al-Bukhari and Muslim are considered the most reliable.',
    report: 'A report from the early histories of the Prophet’s life. They gather many accounts, some stronger than others.',
    modern: 'A modern author’s explanation or calculation, built on the early sources.',
}
