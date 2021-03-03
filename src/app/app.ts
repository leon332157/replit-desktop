import { app, Cookie, ipcMain, MenuItem, screen, session } from 'electron';
import contextMenu from 'electron-context-menu';
import { EventEmitter } from 'events';

import { ElectronWindow, handleExternalLink, promptYesNoSync } from '../common';
import { DiscordHandler } from './discordHandler';
import { appMenuSetup } from './menu/appMenuSetup';
import { PopoutHandler } from './popoutHandler/popoutHandler';
import { SettingHandler } from './settingHandler';
import { ThemeHandler } from './themeHandler/themeHandler';

interface WindowSize {
    width: number;
    height: number;
}

class App extends EventEmitter {
    public readonly mainWindow: ElectronWindow;

    public readonly themeHandler: ThemeHandler;

    public readonly popoutHandler: PopoutHandler;

    public readonly discordHandler: DiscordHandler;

    protected windowArray: Map<number, ElectronWindow>;

    private readonly settingsHandler: SettingHandler;

    constructor() {
        super();
        this.mainWindow = new ElectronWindow(
            { height: 900, width: 1600 },
            'aceFix.js'
        );
        this.settingsHandler = new SettingHandler();
        this.windowArray = new Map();
        this.discordHandler = new DiscordHandler(this.mainWindow);

        this.themeHandler = new ThemeHandler(
            this.settingsHandler,
            this.mainWindow
        );
        this.popoutHandler = new PopoutHandler();
        this.addWindow(this.mainWindow);
        if (!this.settingsHandler.has('enable-ace'))
            this.settingsHandler.set('enable-ace', false);
        app.applicationMenu = appMenuSetup(
            this,
            this.themeHandler,
            this.settingsHandler,
            this.popoutHandler
        );

        if (this.settingsHandler.has('window-size')) {
            // Type is as an object ts does not like this got to find a better way arround this
            //@ts-ignore
            let windowSize: WindowSize = this.settingsHandler.get(
                'window-size'
            );

            if (typeof windowSize != 'object') {
                // Reset to Default
                windowSize = {
                    width: 1600,
                    height: 900
                };
            }

            let size = screen.getPrimaryDisplay().size;

            if (windowSize == null) {
                console.log('No window size detected.');
            } else if (
                windowSize.width &&
                windowSize.height &&
                size.width > windowSize.width &&
                size.height > windowSize.height
            ) {
                this.mainWindow.setSize(windowSize.width, windowSize.height);
            }
        }

        // Detect on resize and add to settings
        this.mainWindow.on('resize', () => {
            let size = this.mainWindow.getSize();
            this.settingsHandler.set('window-size', {
                width: size[0],
                height: size[1]
            });
        });

        // Handle The Login
        this.mainWindow.webContents.on('new-window', (event, url) => {
            let oauth =
                url == 'https://repl.it/auth/google/get?close=1' ||
                url == 'https://repl.it/auth/github/get?close=1';

            event.preventDefault();
            if (oauth) {
                this.clearCookies(true);
                ipcMain.once('authDone', () =>
                    this.mainWindow.loadURL('https://repl.it/~')
                );
            }
            const win = new ElectronWindow(
                {
                    height: 900,
                    width: 1600
                },
                oauth ? 'auth.js' : ''
            );
            win.loadURL(url, { userAgent: 'chrome' });
            event.newGuest = win;
            this.addWindow(win, false);
        });
    }

    toggleAce(menu?: MenuItem) {
        let userAgent: string =
            'Mozilla/5.0 (iPad; CPU OS 11_3 like Mac OS X)AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Tablet/15E148 Safari/604.1';
        if (menu) {
            if (menu.checked == true) {
                this.settingsHandler.set('enable-ace', true);
            } else {
                this.settingsHandler.set('enable-ace', false);
                userAgent = app.userAgentFallback;
            }
        } else if (!this.settingsHandler.get('enable-ace')) {
            userAgent = app.userAgentFallback;
        }
        [...this.windowArray.values()].forEach((window) => {
            // log in fix
            if (
                window.webContents &&
                /repl.it\/@(.*)\//i.test(window.webContents.getURL())
            ) {
                window.webContents.userAgent = userAgent;
                window.reload();
            }
        });
    }

    async clearCookies(oauthOnly: boolean, Prompt: boolean = true) {
        if (
            !oauthOnly &&
            Prompt &&
            !promptYesNoSync(
                'Are you sure you want to clear all cookies?',
                'Confirm'
            )
        )
            return;

        const allCookies: Array<Cookie> = await session.defaultSession.cookies.get(
            {}
        );
        for (let x = 0; x < allCookies.length; x++) {
            const cookie: Cookie = allCookies[x];
            if (
                (oauthOnly && !cookie.domain.includes('repl.it')) ||
                !oauthOnly
            ) {
                await session.defaultSession.cookies.remove(
                    `https://${cookie.domain.charAt(0) === '.' ? 'www' : ''}${
                        cookie.domain
                    }${cookie.path}`,
                    cookie.name
                );
                session.defaultSession.flushStorageData();
            }
        }
        if (!oauthOnly) {
            [...this.windowArray.values()].forEach((win) => {
                win.reload();
            });
        }
    }

    resetPreferences() {
        if (
            promptYesNoSync(
                `Are you sure?`,
                'Reset Settings',
                `This will reset your theme preferences.
This action is NOT reversible!`
            )
        ) {
            this.settingsHandler.clearAll();
            this.reloadAllWindows();
        }
    }

    reloadAllWindows() {
        [...this.windowArray.values()].forEach((win) => {
            win.reload();
        });
    }

    addWindow(window: ElectronWindow, handleExt: boolean = true) {
        contextMenu({
            window,
            prepend: () => [
                {
                    role: 'reload'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'undo'
                },
                {
                    role: 'redo'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'cut'
                },
                {
                    role: 'copy'
                },
                {
                    role: 'paste'
                },
                {
                    role: 'selectAll'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'zoomIn'
                },
                {
                    role: 'zoomOut'
                }
            ]
        });

        this.windowArray.set(window.id, window);

        window.webContents.on('will-navigate', (e, url) => {
            // Deal with the logout
            if (url == 'https://repl.it/logout')
                this.clearCookies(false, false);
            if (handleExt) handleExternalLink(e, window, url);
            if (this.settingsHandler.get('enable-ace')) this.toggleAce();
        });

        this.themeHandler.addTheme(window);

        window.webContents.on('did-finish-load', () =>
            this.themeHandler.addTheme(window)
        );

        window.on('close', () => {
            if (this.windowArray.has(window.id))
                this.windowArray.delete(window.id);
        });
    }
}

export { App };
