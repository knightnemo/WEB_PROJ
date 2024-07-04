import { ForgeListrTaskDefinition, InitTemplateOptions } from '@electron-forge/shared-types';
import { BaseTemplate } from '@electron-forge/template-base';
declare class ViteTypeScriptTemplate extends BaseTemplate {
    templateDir: string;
    initializeTemplate(directory: string, options: InitTemplateOptions): Promise<ForgeListrTaskDefinition[]>;
}
declare const _default: ViteTypeScriptTemplate;
export default _default;
//# sourceMappingURL=ViteTypeScriptTemplate.d.ts.map