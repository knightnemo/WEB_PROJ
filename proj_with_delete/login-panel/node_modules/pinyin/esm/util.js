import { ENUM_PINYIN_STYLE, ENUM_PINYIN_MODE, DEFAULT_OPTIONS } from "./constant";
export function hasKey(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}
const pinyinStyleMap = new Map([
    ["tone", ENUM_PINYIN_STYLE.TONE],
    ["TONE", ENUM_PINYIN_STYLE.TONE],
    ["1", ENUM_PINYIN_STYLE.TONE],
    ["tone2", ENUM_PINYIN_STYLE.TONE2],
    ["TONE2", ENUM_PINYIN_STYLE.TONE2],
    ["2", ENUM_PINYIN_STYLE.TONE2],
    ["to3ne", ENUM_PINYIN_STYLE.TO3NE],
    ["TO3NE", ENUM_PINYIN_STYLE.TO3NE],
    ["5", ENUM_PINYIN_STYLE.TO3NE],
    ["first_letter", ENUM_PINYIN_STYLE.FIRST_LETTER],
    ["FIRST_LETTER", ENUM_PINYIN_STYLE.FIRST_LETTER],
    ["4", ENUM_PINYIN_STYLE.FIRST_LETTER],
    ["initials", ENUM_PINYIN_STYLE.INITIALS],
    ["INITIALS", ENUM_PINYIN_STYLE.INITIALS],
    ["3", ENUM_PINYIN_STYLE.INITIALS],
    ["normal", ENUM_PINYIN_STYLE.NORMAL],
    ["NORMAL", ENUM_PINYIN_STYLE.NORMAL],
    ["0", ENUM_PINYIN_STYLE.NORMAL],
    ["passport", ENUM_PINYIN_STYLE.PASSPORT],
    ["PASSPORT", ENUM_PINYIN_STYLE.PASSPORT],
    ["6", ENUM_PINYIN_STYLE.PASSPORT],
]);
export function convertPinyinStyle(style) {
    const s = String(style);
    if (pinyinStyleMap.has(s)) {
        return pinyinStyleMap.get(s);
    }
    return ENUM_PINYIN_STYLE.TONE;
}
const pinyinModeMap = new Map([
    ["normal", ENUM_PINYIN_MODE.NORMAL],
    ["NORMAL", ENUM_PINYIN_MODE.NORMAL],
    ["surname", ENUM_PINYIN_MODE.SURNAME],
    ["SURNAME", ENUM_PINYIN_MODE.SURNAME],
]);
export function convertPinyinMode(mode) {
    const s = String(mode);
    if (pinyinModeMap.has(s)) {
        return pinyinModeMap.get(s);
    }
    return ENUM_PINYIN_MODE.NORMAL;
}
export function convertUserOptions(options) {
    let segment = undefined;
    if (options?.segment) {
        if (options?.segment === true) {
            segment = "Intl.Segmenter";
        }
        else {
            segment = options.segment;
        }
    }
    const opt = {
        ...DEFAULT_OPTIONS,
        style: convertPinyinStyle(options?.style),
        mode: convertPinyinMode(options?.mode),
        segment,
        heteronym: options?.heteronym || false,
        group: options?.group || false,
    };
    return opt;
}
export function combo2array(a1, a2) {
    const result = [];
    if (!a1.length) {
        return a2;
    }
    if (!a2.length) {
        return a1;
    }
    for (let i = 0, l = a1.length; i < l; i++) {
        for (let j = 0, m = a2.length; j < m; j++) {
            result.push(a1[i] + a2[j]);
        }
    }
    return result;
}
export function combo(arr) {
    if (arr.length === 0) {
        return [];
    }
    if (arr.length === 1) {
        return arr[0];
    }
    let result = combo2array(arr[0], arr[1]);
    for (let i = 2, l = arr.length; i < l; i++) {
        result = combo2array(result, arr[i]);
    }
    return result;
}
export function compact2array(a1, a2) {
    if (!Array.isArray(a1) || !Array.isArray(a2)) {
        throw new Error("compact2array expect two array as parameters");
    }
    if (!a1.length) {
        a1 = [""];
    }
    if (!a2.length) {
        a2 = [""];
    }
    const result = [];
    for (let i = 0, l = a1.length; i < l; i++) {
        for (let j = 0, m = a2.length; j < m; j++) {
            if (Array.isArray(a1[i])) {
                result.push([...a1[i], a2[j]]);
            }
            else {
                result.push([a1[i], a2[j]]);
            }
        }
    }
    return result;
}
export function compact(arr) {
    if (arr.length === 0) {
        return [];
    }
    if (arr.length === 1) {
        return [arr[0]];
    }
    let result = compact2array(arr[0], arr[1]);
    for (let i = 2, l = arr.length; i < l; ++i) {
        result = compact2array(result, arr[i]);
    }
    return result;
}
//# sourceMappingURL=util.js.map