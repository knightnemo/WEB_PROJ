const { default: getForgeConfig } = require('@electron-forge/core/dist/util/forge-config')
const { getHookListrTasks } = require('@electron-forge/core/dist/util/hook')
const { getHostArch } = require('@electron/get')
const { Listr } = require('listr2')
const { default: resolveDir } = require('@electron-forge/core/dist/util/resolve-dir')
const { readMutatedPackageJson } = require('@electron-forge/core/dist/util/read-package-json')
const { default: getCurrentOutDir } = require('@electron-forge/core/dist/util/out-dir')
const chalk = require('chalk')

const log = console
const listrPackage = ({
    dir: providedDir = process.cwd(),
    // interactive = false,
    arch = getHostArch(),
    platform = process.platform,
    outDir,
}) => {
    return new Listr([
        {
            title: 'Preparing to package application',
            task: async ctx => {
                const resolvedDir = await resolveDir(providedDir)
                if (!resolvedDir) {
                    throw new Error('Failed to locate compilable Electron application')
                }
                ctx.dir = resolvedDir

                ctx.forgeConfig = await getForgeConfig(resolvedDir)
                ctx.packageJSON = await readMutatedPackageJson(resolvedDir, ctx.forgeConfig)

                if (!ctx.packageJSON.main) {
                    throw new Error('packageJSON.main must be set to a valid entry point for your Electron app')
                }

                ctx.calculatedOutDir = outDir || getCurrentOutDir(resolvedDir, ctx.forgeConfig)
            },
        },
        {
            title: 'Running packaging hooks',
            task: async ({ forgeConfig }, task) => {
                return task.newListr([
                    {
                        title: `Running ${chalk.yellow('generateAssets')} hook`,
                        task: async (_, task) => {
                            return task.newListr(await getHookListrTasks(forgeConfig, 'generateAssets', platform, arch))
                        },
                    },
                    {
                        title: `Running ${chalk.yellow('prePackage')} hook`,
                        task: async (_, task) => {
                            return task.newListr(await getHookListrTasks(forgeConfig, 'prePackage', platform, arch))
                        },
                    },
                ])
            },
        },
    ])
}

async function main() {
    /* const forgeConfig = await getForgeConfig(__dirname)
    console.log("forgeConfig:", forgeConfig)
    await runHook(forgeConfig, "prePackage", process.platform, getHostArch()) */

    // packges.api.core.src.api.packages. 截取打包部分，不需要构建本地应用部分
    try {
        const runner = listrPackage({})
        await runner.run()
    } catch (e) {
        log.error(e)
        // writeFileSync("temp_error", e.message)
        process.exit(-1)
    }
}

main()
