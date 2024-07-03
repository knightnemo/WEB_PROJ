const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')
const plugins = require('./webpack.plugins')

module.exports = {
    /**
     * This is the main entry point for your application, it's the first file
     * that runs in the main process.
     */
    entry: './src/index.ts',
    // Put your normal webpack config below here
    plugins: plugins.mainPlugins,

    optimization: {
        minimizer: [
            new TerserPlugin({
                parallel: true,
                terserOptions: {
                    keep_classnames: true,
                    keep_fnames: true,
                    mangle: false,
                },
            }),
        ],
    },

    module: {
        rules: require('./webpack.rules'),
    },
    target: 'electron-main',
    resolve: {
        alias: {
            Globals: path.resolve(__dirname, 'src/Globals/'),
            Images: path.resolve(__dirname, 'src/Images/'),
            Pages: path.resolve(__dirname, 'src/Pages/'),
            Plugins: path.resolve(__dirname, 'src/Plugins/'),
            Styles: path.resolve(__dirname, 'src/Styles/'),
            Utils: path.resolve(__dirname, 'src/Utils/'),
        },
        fallback: {
            path: require.resolve('path-browserify'),
        },
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    },
}
