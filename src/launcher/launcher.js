const electron = require('electron');
const common = require('../common');
const fs = require('fs');
const path = require('path');
const node_fetch = require('node-fetch');
const events = require('events');
const semver = require('semver');
class Updater extends events.EventEmitter {
    constructor(launcher) {
        super();
        this.downloadUrls = {
            windowsUrl: '',
            macOSUrl: '',
            linuxUrl: ''
        };
        this.pathSep = path.sep;
        this.appPath = `${electron.app.getAppPath()}${this.pathSep}`;
        this.upperAppPath = `${path.dirname(this.appPath)}${this.pathSep}`;
        this.userDesktop = electron.app.getPath('desktop');
        this.logFilePath = `${this.userDesktop}updater-log.txt`;
        this.logArray = [''];
        this.downloadPath = `${electron.app.getPath('appData')}updaterDownload${
            this.pathSep
        }`;
        this.appVersion = {
            major: parseInt(electron.app.getVersion().split('.')[0]),
            minor: parseInt(electron.app.getVersion().split('.')[1]),
            patch: parseInt(electron.app.getVersion().split('.')[2]),
            versionString: electron.app.getVersion()
        };
        this.launcher = launcher;
    }
    decodeReleaseResponse(resp) {
        return Object.assign({}, resp);
    }
    formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${
            sizes[i]
        }`;
    }
    async checkUpdate() {
        try {
            const res = this.decodeReleaseResponse(
                await (
                    await node_fetch(
                        'https://api.github.com/repos/repl-it-discord/repl-it-electron/releases/latest'
                    )
                ).json()
            );
            if (
                res.tag_name.includes('alpha') ||
                res.tag_name.includes('beta')
            ) {
                return { hasUpdate: false };
            }
            const tagNames = res.tag_name.split('.');
            const changeLog = res.body;
            const version = {
                major: parseInt(tagNames[0]),
                minor: parseInt(tagNames[1]),
                patch: parseInt(tagNames[2]),
                versionString: res.tag_name
            };
            for (let x = 0; x < res.assets.length; x++) {
                const asset = res.assets[x];
                if (asset.name.includes('exe') || asset.name.includes('win')) {
                    this.downloadUrls.windowsUrl = asset.browser_download_url;
                } else if (asset.name.includes('dmg')) {
                    this.downloadUrls.macOSUrl = asset.browser_download_url;
                } else if (asset.name.includes('tar.gz')) {
                    this.downloadUrls.linuxUrl = asset.browser_download_url;
                }
            }
            if (
                semver.gt(version.versionString, this.appVersion.versionString)
            ) {
                return {
                    hasUpdate: true,
                    changeLog: changeLog,
                    version: res.tag_name
                };
            } else {
                return { hasUpdate: false };
            }
        } catch (e) {
            console.error(e);
            return { hasUpdate: false, changeLog: 'error' };
        }
    }
    async downloadUpdate(url) {
        try {
            const req = await node_fetch(url);
            const contentLength = parseInt(req.headers.get('content-length'));
            const filename = url.split('/').pop();
            this.downloadFilePath = `${this.downloadPath}${filename}`;
            let downloaded = 0;
            if (!fs.existsSync(this.downloadPath)) {
                fs.mkdirSync(this.downloadPath, { recursive: true });
            }
            req.body
                .on('data', (chunk) => {
                    downloaded += chunk.length;
                    const percentage = Math.floor(
                        (downloaded / contentLength) * 100
                    );
                    this.launcher.updateStatus({
                        text: `${this.formatBytes(
                            downloaded
                        )}/${this.formatBytes(contentLength)}`,
                        percentage: `${percentage.toString()}%`
                    });
                })
                .pipe(fs.createWriteStream(this.downloadFilePath));
            req.body.on('end', () => {
                this.launcher.updateStatus({ text: 'Download Finished' });
                this.emit('download-finished');
            });
        } catch (e) {
            this.emit('download-error', e);
        }
    }
    afterDownload() {
        electron.shell.showItemInFolder(this.downloadFilePath);
        electron.app.exit(0);
    }
    cleanUp(skip) {
        if (!skip) {
            try {
                fs.unlinkSync(this.downloadFilePath);
            } catch (e) {}
        }
        this.emit('all-done');
    }
}
exports.Updater = Updater;
class Launcher {
    constructor() {
        this.window = new common.ElectronWindow(
            {
                show: false,
                resizable: false,
                height: 300,
                width: 250,
                frame: false
            },
            ``,
            true
        );
    }
    init() {
        this.window.loadFile('launcher/launcher.html').then();
    }
    updateStatus(status) {
        this.window.webContents.send('status-update', status);
    }
}
exports.Launcher = Launcher;
