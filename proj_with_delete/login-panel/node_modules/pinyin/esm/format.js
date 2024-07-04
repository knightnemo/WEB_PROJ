import { ENUM_PINYIN_STYLE, PHONETIC_SYMBOL, INITIALS } from "./constant";
import { hasKey } from "./util";
function initials(py) {
    for (let i = 0, l = INITIALS.length; i < l; i++) {
        if (py.indexOf(INITIALS[i]) === 0) {
            return INITIALS[i];
        }
    }
    return "";
}
const RE_PHONETIC_SYMBOL = new RegExp("([" + Object.keys(PHONETIC_SYMBOL).join("") + "])", "g");
const RE_TONE2 = /([aeoiuvnm])([0-4])$/;
export function toFixed(pinyin, style) {
    let tone = "";
    let first_letter;
    let py;
    switch (style) {
        case ENUM_PINYIN_STYLE.INITIALS:
            return initials(pinyin);
        case ENUM_PINYIN_STYLE.FIRST_LETTER:
            first_letter = pinyin.charAt(0);
            if (hasKey(PHONETIC_SYMBOL, first_letter)) {
                first_letter = PHONETIC_SYMBOL[first_letter].charAt(0);
            }
            return first_letter;
        case ENUM_PINYIN_STYLE.NORMAL:
            return pinyin.replace(RE_PHONETIC_SYMBOL, function ($0, $1_phonetic) {
                return PHONETIC_SYMBOL[$1_phonetic].replace(RE_TONE2, "$1");
            });
        case ENUM_PINYIN_STYLE.PASSPORT:
            return pinyin.replace(RE_PHONETIC_SYMBOL, function ($0, $1_phonetic) {
                return PHONETIC_SYMBOL[$1_phonetic].replace(RE_TONE2, "$1").replace("v", "YU");
            }).toUpperCase();
        case ENUM_PINYIN_STYLE.TO3NE:
            return pinyin.replace(RE_PHONETIC_SYMBOL, function ($0, $1_phonetic) {
                return PHONETIC_SYMBOL[$1_phonetic];
            });
        case ENUM_PINYIN_STYLE.TONE2:
            py = pinyin.replace(RE_PHONETIC_SYMBOL, function ($0, $1) {
                tone = PHONETIC_SYMBOL[$1].replace(RE_TONE2, "$2");
                return PHONETIC_SYMBOL[$1].replace(RE_TONE2, "$1");
            });
            return py + tone;
        case ENUM_PINYIN_STYLE.TONE:
        default:
            return pinyin;
    }
}
//# sourceMappingURL=format.js.map