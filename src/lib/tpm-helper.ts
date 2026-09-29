/**
 * 燁輝 TPM 人員識別與 PM / TPM 區隔工具
 */

// 燁輝 TPM 同仁已知姓名清單（用於嚴格區隔億威內部 PM 與燁輝 TPM 窗口）
export const TPM_PERSONNEL_NAMES: readonly string[] = [
    '陳家姷',
    '陳家炳',
    '徐智宏',
    '賴冠廷',
    '胡春如',
    '許家豪',
    '蔣永政',
    '蘇煥鈞',
    '鄭文芳',
];

/**
 * 判斷指定人員姓名是否屬於 TPM 同仁
 */
export const isTpmPerson = (name?: string | null): boolean => {
    if (!name) return false;
    const n = name.trim();
    if (!n) return false;
    return TPM_PERSONNEL_NAMES.some((t) => n.includes(t)) || n.toUpperCase().includes('TPM');
};

/**
 * 嚴格區隔 負責 PM (億威) 與 TPM 窗口 (燁輝)
 */
export const separatePmAndTpm = (
    metaPm?: string | null,
    metaTpm?: string | null,
    docTpm?: string | null,
    docEgiga?: string | null
): { responsiblePm: string; tpmOfficeContact: string } => {
    const rawMetaPm = metaPm?.trim() || '';
    const rawMetaTpm = metaTpm?.trim() || '';
    const rawDocTpm = docTpm?.trim() || '';
    const rawDocEgiga = docEgiga?.trim() || '';

    let tpmOfficeContact = '';
    let responsiblePm = '';

    // TPM 判定：只要包含 TPM 人員關鍵字，一律歸類為 TPM 窗口
    if (isTpmPerson(rawMetaTpm)) {
        tpmOfficeContact = rawMetaTpm;
    } else if (isTpmPerson(rawDocTpm)) {
        tpmOfficeContact = rawDocTpm;
    } else if (isTpmPerson(rawMetaPm)) {
        tpmOfficeContact = rawMetaPm;
    } else if (rawDocTpm && rawDocTpm !== rawDocEgiga && !rawDocTpm.includes('經理')) {
        tpmOfficeContact = rawDocTpm;
    } else if (rawMetaTpm) {
        tpmOfficeContact = rawMetaTpm;
    }

    // 負責 PM 判定：TPM 人員絕不歸為負責 PM
    if (rawMetaPm && !isTpmPerson(rawMetaPm)) {
        responsiblePm = rawMetaPm;
    } else if (rawDocEgiga && !isTpmPerson(rawDocEgiga) && rawDocEgiga !== '王耀輝經理' && rawDocEgiga !== '尚未填寫') {
        responsiblePm = rawDocEgiga;
    } else if (rawDocTpm && !isTpmPerson(rawDocTpm)) {
        responsiblePm = rawDocTpm;
    }

    return { responsiblePm, tpmOfficeContact };
};
