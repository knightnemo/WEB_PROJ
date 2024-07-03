// const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
// const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')

// const { argv } = process
// console.log(argv)
// const isDev = argv[1].endsWith('start.js')
// module.exports = [new ForkTsCheckerWebpackPlugin(), isDev && new ReactRefreshWebpackPlugin({ overlay: false })].filter(
//     Boolean
// )

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const webpack = require('webpack')
const chalk = require('chalk')
const packageInfo = require('./package.json')
const projectName = `${packageInfo.productName || packageInfo.name}`
const debug = require('debug')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CopyPlugin = require('copy-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { execSync } = require('child_process')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { basename } = require('path')
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')
const log = debug('package:plugins-define')


const envVarDefine = new webpack.DefinePlugin({
    // 构建信息
    __BUILD_INFO__: JSON.stringify(`build at ${new Date().toLocaleString()} on ${process.platform}`),
    // 本次构建 COMMIT
    __COMMIT_HASH__: JSON.stringify( '-'),
    // 项目名称
    __PROJECT_NAME__: JSON.stringify(projectName.toLowerCase()),
    // 当前环境/构建分支
    __CURRENT_BRANCH__: "master",
    // 测试用。。。
    __CI_ENV__: JSON.stringify( 'NOTHING.'),
    // 开发模式
    __IS_DEV__: true,
    // 当前版本（可能会出错）
    __NEXT_VERSION__: JSON.stringify( '0-0'),
    __IS_WEB__: false,
    // pdf 静态资源路径
    __PDF_PREFIX__: ""
})

const optimization = {
    minimizer: [
        new TerserPlugin({
            parallel: true,
            extractComments: false,
            terserOptions: {
                format: {
                    comments: false,
                },
                compress: {
                    pure_funcs:
                            ['console.info', 'console.log', 'console.debug', 'console.warn']
                },
                keep_classnames: true,
                keep_fnames: false,
                mangle: true,
            },
        }),
    ],
}

// const isProductionEnv = ['master', 'feat-demo'].includes(CURRENT_BRANCH)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// const probSource = `public/prob-${isProductionEnv ? 'prod' : 'dev'}.js`
module.exports = {
    rendererPlugins: [
        new ForkTsCheckerWebpackPlugin(),
        envVarDefine,
        new ReactRefreshWebpackPlugin({ overlay: false }),
    ].filter(Boolean),
    mainPlugins: [envVarDefine],
    optimization,
}
