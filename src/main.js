// eslint-disable-next-line @typescript-eslint/naming-convention
const launcher_ = require('./launcher/launcher');
const electron = require('electron');
const path = require('path');
const common = require('./common');
const app = require('./app/app');
electron.app.setPath(
    'appData',
    path.join(electron.app.getPath('home'), '.repl.it', 'appData')
);
electron.app.setPath(
    'userData',
    path.join(electron.app.getPath('home'), '.repl.it', 'userData')
);
electron.app.disableHardwareAcceleration();
process.on('unhandledRejection', (rejection) => {
    console.error(`[Unhandled Promise Rejction] ${rejection.stack}`);
});

function initLauncher() {
    launcher = new launcher_.Launcher();
    launcher.init();
    launcher.window.webContents.once('did-finish-load', () => {
        launcher.window.show();
        initUpdater().then(() => {});
    });
}
async function initApp() {
    mainApp = new app.App();
    mainApp.mainWindow.loadURL('https://repl.it/~').catch(console.debug);
    await mainApp.clearCookies(true);
    mainApp.mainWindow.webContents.once('did-finish-load', () => {
        launcher.window.close();
    });
    mainApp.mainWindow.on('close', () => electron.app.quit());
}
async function initUpdater() {
    updater = new launcher_.Updater(launcher);
    if (process.execPath.includes('electron')) {
        updater.cleanUp(true);
    }
    launcher.updateStatus({ text: 'Checking Update' });
    const res = await updater.checkUpdate();
    if (res['changeLog'] == 'error') {
        launcher.updateStatus({
            text: 'Check update failed, skipping.'
        });
        updater.cleanUp(true);
    }
    updater.once('download-error', (e) => {
        console.error(e);
        updater.cleanUp();
    });
    updater.once('all-done', () => {
        launcher.updateStatus({ text: 'Launching app' });
        initApp();
    });
    if (res['hasUpdate']) {
        launcher.updateStatus({ text: 'Update detected' });
        if (
            common.promptYesNoSync(
                `A new update ${res['version']} is available. Do you want to update?`,
                'Update Available',
                res['changeLog']
            )
        ) {
            launcher.updateStatus({ text: 'Downloading Update' });
            updater.once('download-finished', updater.afterDownload);
            switch (common.PLATFORM) {
                case 'win32':
                    await updater.downloadUpdate(
                        updater.downloadUrls.windowsUrl
                    );
                    break;
                case 'darwin':
                    await updater.downloadUpdate(updater.downloadUrls.macOSUrl);
                    break;
                case 'linux':
                    await updater.downloadUpdate(updater.downloadUrls.linuxUrl);
                    break;
            }
        }
    } else {
        updater.cleanUp(true);
    }
}
electron.app.on('window-all-closed', () => {
    electron.app.quit();
});
electron.app.once('ready', () => {
    initLauncher();
});
