const common = require('../common');
const electron = require('electron');
const popoutHandler = require('./popoutHandler/popoutHandler');
const themeHandler = require('./themeHandler/themeHandler');
const discordHandler = require('./discordHandler');
const settingHandler = require('./settingHandler');
const electron_context_menu = require('electron-context-menu');
const appMenuSetup = require('./menu/appMenuSetup');
const events = require('events');
class App extends events.EventEmitter {
    constructor() {
        super();
        this.mainWindow = new common.ElectronWindow({
            height: 900,
            width: 1600
        });
        this.settingsHandler = new settingHandler.SettingHandler();
        this.windowArray = [];
        this.discordHandler = new discordHandler.DiscordHandler(
            this.mainWindow
        );
        this.themeHandler = new themeHandler.ThemeHandler(
            this.settingsHandler,
            this.mainWindow
        );
        this.popoutHandler = new popoutHandler.PopoutHandler();
        this.addWindow(this.mainWindow);
        if (!this.settingsHandler.has('enable-ace'))
            this.settingsHandler.set('enable-ace', false);
        electron.app.applicationMenu = appMenuSetup.appMenuSetup(
            this,
            this.themeHandler,
            this.settingsHandler,
            this.popoutHandler
        );
        this.mainWindow.webContents.on('new-window', (event, url) => {
            let oauth =
                url == 'https://repl.it/auth/google/get?close=1' ||
                url == 'https://repl.it/auth/github/get?close=1';
            event.preventDefault();
            if (oauth) {
                this.clearCookies(true);
                electron.ipcMain.once('authDone', () =>
                    this.mainWindow.loadURL('https://repl.it/~')
                );
            }
            const win = new common.ElectronWindow(
                {
                    height: 900,
                    width: 1600
                },
                oauth ? 'auth.js' : ''
            );
            win.loadURL(url, { userAgent: 'chrome' });
            event.newGuest = win;
            this.addWindow(win);
        });
    }
    toggleAce(menu) {
        let userAgent =
            'Mozilla/5.0 (iPad; CPU OS 11_3 like Mac OS X)AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Tablet/15E148 Safari/604.1';
        if (menu) {
            if (menu.checked == true) {
                this.settingsHandler.set('enable-ace', true);
            } else {
                this.settingsHandler.set('enable-ace', false);
                userAgent = electron.app.userAgentFallback;
            }
        }
        this.windowArray.forEach((window) => {
            window.webContents.userAgent = userAgent;
            window.reload();
        });
    }
    async clearCookies(oauthOnly) {
        if (
            !oauthOnly &&
            !common.promptYesNoSync(
                'Are you sure you want to clear all cookies?',
                'Confirm'
            )
        )
            return;
        const allCookies = await electron.session.defaultSession.cookies.get(
            {}
        );
        for (let x = 0; x < allCookies.length; x++) {
            const cookie = allCookies[x];
            if (
                (oauthOnly && !cookie.domain.includes('repl.it')) ||
                !oauthOnly
            ) {
                await electron.session.defaultSession.cookies.remove(
                    `https://${cookie.domain.charAt(0) === '.' ? 'www' : ''}${
                        cookie.domain
                    }${cookie.path}`,
                    cookie.name
                );
                electron.session.defaultSession.flushStorageData();
            }
        }
        if (!oauthOnly) {
            for (let x = 0; x < this.windowArray.length; x++) {
                this.windowArray[x].reload();
            }
        }
    }
    addWindow(window) {
        electron_context_menu({ window: window });
        this.windowArray.push(window);
        window.webContents.on('will-navigate', (e, url) => {
            common.handleExternalLink(e, window, url);
            if (this.settingsHandler.get('enable-ace')) this.toggleAce();
        });
        this.themeHandler.addTheme(window);
        window.webContents.on('did-finish-load', () =>
            this.themeHandler.addTheme(window)
        );
    }
}
exports.App = App;
