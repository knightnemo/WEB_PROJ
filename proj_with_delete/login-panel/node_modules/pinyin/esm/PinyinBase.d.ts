import { ENUM_PINYIN_MODE, ENUM_PINYIN_STYLE } from "./constant";
import type { IPinyinAllOptions, IPinyinOptions, IPinyinSegment, IPinyin } from "./declare";
export default class PinyinBase {
    STYLE_TONE: ENUM_PINYIN_STYLE;
    STYLE_TONE2: ENUM_PINYIN_STYLE;
    STYLE_TO3NE: ENUM_PINYIN_STYLE;
    STYLE_NORMAL: ENUM_PINYIN_STYLE;
    STYLE_INITIALS: ENUM_PINYIN_STYLE;
    STYLE_FIRST_LETTER: ENUM_PINYIN_STYLE;
    STYLE_PASSPORT: ENUM_PINYIN_STYLE;
    MODE_NORMAL: ENUM_PINYIN_MODE;
    MODE_SURNAME: ENUM_PINYIN_MODE;
    pinyin(hans: string, options?: IPinyinOptions): string[][];
    normal_pinyin(hans: string, options: IPinyinAllOptions): string[][];
    single_pinyin(han: string, options: IPinyinAllOptions): string[];
    segment(hans: string, segmentType?: IPinyinSegment): string[];
    segment_pinyin(hans: string, options: IPinyinAllOptions): string[][];
    phrases_pinyin(phrases: string, options: IPinyinAllOptions): string[][];
    groupPhrases(phrases: string[][]): string[];
    surname_pinyin(hans: string, options: IPinyinAllOptions): string[][];
    compound_surname(hans: string, options: IPinyinAllOptions): string[][];
    single_surname(hans: string, options: IPinyinAllOptions): string[][];
    compare(hanA: string, hanB: string): number;
    compact(pys: string[][]): string[][];
}
export declare function getPinyinInstance(py: PinyinBase): IPinyin;
