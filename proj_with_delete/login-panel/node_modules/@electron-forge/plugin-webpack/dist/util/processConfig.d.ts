import { Configuration } from 'webpack';
import { ConfigurationFactory } from '../WebpackConfig';
export declare type ConfigProcessor = (config: ConfigurationFactory) => Promise<Configuration>;
declare const processConfig: (processor: ConfigProcessor, config: Configuration | ConfigurationFactory) => Promise<Configuration>;
export default processConfig;
//# sourceMappingURL=processConfig.d.ts.map