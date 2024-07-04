import { Compiler } from 'webpack';
export default class AssetRelocatorPatch {
    private readonly isProd;
    private readonly nodeIntegration;
    constructor(isProd: boolean, nodeIntegration: boolean);
    private injectedProductionDirnameCode;
    apply(compiler: Compiler): void;
}
//# sourceMappingURL=AssetRelocatorPatch.d.ts.map