const electron = require('electron');
const fs = require('fs');
const path = require('path');
const write_file_atomic = require('write-file-atomic');
class SettingHandler {
    constructor() {
        this.settingsFilePath = `${path.dirname(
            electron.app.getPath('userData')
        )}${path.sep}settings.json`;
        this.ensureFileSync();
        this.settings = {};
        try {
            this.settings = JSON.parse(
                fs.readFileSync(this.settingsFilePath, 'utf-8')
            );
        } catch {
            this.resetAll();
            this.settings = JSON.parse(
                fs.readFileSync(this.settingsFilePath, 'utf-8')
            );
        }
    }
    ensureFileSync() {
        try {
            fs.statSync(this.settingsFilePath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.debug('creating file');
                this.saveSettings();
            } else throw err;
        }
    }
    saveSettings() {
        write_file_atomic.sync(
            this.settingsFilePath,
            JSON.stringify(this.settings, null, 4)
        );
    }
    has(key) {
        return this.settings.hasOwnProperty(key);
    }
    get(key) {
        return this.has(key) ? this.settings[key] : null;
    }
    set(key, value) {
        this.settings[key] = value;
        this.saveSettings();
    }
    unset(key) {
        delete this.settings[key];
        this.saveSettings();
    }
    resetAll() {
        this.saveSettings();
    }
}
exports.SettingHandler = SettingHandler;
