import { ForgeListrTaskDefinition, InitTemplateOptions } from '@electron-forge/shared-types';
import { BaseTemplate } from '@electron-forge/template-base';
declare class ViteTemplate extends BaseTemplate {
    templateDir: string;
    initializeTemplate(directory: string, options: InitTemplateOptions): Promise<ForgeListrTaskDefinition[]>;
}
declare const _default: ViteTemplate;
export default _default;
//# sourceMappingURL=ViteTemplate.d.ts.map