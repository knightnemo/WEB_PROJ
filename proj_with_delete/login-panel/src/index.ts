import { app, BrowserWindow, ipcMain, Rectangle, session, WebPreferences } from 'electron'
import * as path from 'path'
import process from 'process'

declare const MAIN_WINDOW_WEBPACK_ENTRY: string

if (require('electron-squirrel-startup')) {
    // eslint-disable-line global-require
    app.quit()
}

const iconPrefixMap: Record<string, string> = {
    darwin: '.icns',
    win32: '.ico',
    linux: '.png',
}

function getIconPath() {
    let suffix: string = iconPrefixMap[process.platform]
    suffix = suffix ? suffix : '.png'
    return path.join(app.getAppPath(), 'icon' + suffix)
}

const createWindow = (): void => {
    // Create the browser window.
    const mainWindow= new BrowserWindow({
        height: 600,
        width: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: getIconPath(),
        frame: true,
        show: false,
        resizable: true,
        useContentSize: true,
        center: true,
    })
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).then(() => { })
    session.defaultSession.clearCache()
    mainWindow.on('close', () => {
        session.defaultSession.clearStorageData().then(r => console.log(r))
    })

    if (!app.isPackaged) mainWindow.webContents.openDevTools()

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize()
        mainWindow.show()
    })
}

app.on('ready', () => { createWindow() })
