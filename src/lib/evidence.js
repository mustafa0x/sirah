// How each kind of passage looks wherever evidence is drawn: in the scene and in the key.
export const evidence_kinds = ['quran', 'hadith', 'report', 'modern']

export function evidence_category(kind) {
    return kind === 'commentary' ? 'report' : kind
}

export const evidence_dot = {
    quran: 'bg-[#fff1c4] shadow-[0_0_10px_3px_rgba(255,241,196,0.75)]',
    hadith: 'bg-[#7fd1a0] shadow-[0_0_10px_3px_rgba(127,209,160,0.7)]',
    report: 'bg-[#e8a857] shadow-[0_0_10px_3px_rgba(232,168,87,0.7)]',
    modern: 'bg-[#8fb8ff] shadow-[0_0_10px_3px_rgba(143,184,255,0.7)]',
}
