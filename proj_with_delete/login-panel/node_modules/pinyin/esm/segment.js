let nodeRsJiebaLoaded = false;
let segmentit;
let hansIntlSegmenter;
export function segment(hans, segment) {
    try {
        if (segment === "@node-rs/jieba") {
            const { load, cut } = require("@node-rs/jieba");
            if (!nodeRsJiebaLoaded) {
                nodeRsJiebaLoaded = true;
                load();
            }
            return cut(hans, false);
        }
        if (segment === "segmentit") {
            const { Segment, useDefault } = require("segmentit");
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
        const nodejieba = require("nodejieba");
        return nodejieba.cutSmall(hans, 4);
    }
    catch (ex) {
        return [hans];
    }
}
//# sourceMappingURL=segment.js.map