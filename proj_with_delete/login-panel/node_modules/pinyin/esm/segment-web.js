import { Segment, useDefault } from "segmentit";
let segmentit;
let hansIntlSegmenter;
export function segment(hans, segment) {
    if (segment === "segmentit") {
        if (!segmentit) {
            segmentit = useDefault(new Segment());
        }
        return segmentit.doSegment(hans, {
            simple: true,
        });
    }
    if (segment === "Intl.Segmenter") {
        if (typeof Intl?.Segmenter === "function") {
            if (!hansIntlSegmenter) {
                hansIntlSegmenter = new Intl.Segmenter("zh-Hans-CN", {
                    granularity: "word",
                });
            }
            return [...hansIntlSegmenter.segment(hans)].map((s) => s.segment);
        }
    }
    return [hans];
}
//# sourceMappingURL=segment-web.js.map