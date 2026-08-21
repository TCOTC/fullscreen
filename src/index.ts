import {
    Plugin,
    Setting,
    showMessage,
    type IProtyle,
} from "siyuan";
import {
    isConfiguredFullscreen,
    isEditorFullscreen,
    toggleConfiguredFullscreen,
    type FullscreenConfig,
} from "./fullscreen";
import type zhCN from "./i18n/zh-CN.json";

const STORAGE_NAME = "config.json";
const BUTTON_ID = "fullscreen";

const DEFAULT_CONFIG: FullscreenConfig = {
    editorFullscreen: true,
    windowFullscreen: true,
};

const normalizeConfig = (data: unknown): FullscreenConfig => {
    const source = typeof data === "object" && data !== null ? data as Partial<FullscreenConfig> : {};
    return {
        editorFullscreen: typeof source.editorFullscreen === "boolean" ?
            source.editorFullscreen :
            DEFAULT_CONFIG.editorFullscreen,
        windowFullscreen: typeof source.windowFullscreen === "boolean" ?
            source.windowFullscreen :
            DEFAULT_CONFIG.windowFullscreen,
    };
};

const getErrorMsg = (e: unknown) => {
    if (typeof e === "object" && e !== null && "msg" in e) {
        return String((e as {msg: unknown;}).msg);
    }
    return e instanceof Error ? e.message : String(e);
};

const createSwitch = (checked: boolean) => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "b3-switch fn__flex-center";
    input.checked = checked;
    return input;
};

export default class FullscreenPlugin extends Plugin {
    declare i18n: typeof zhCN;

    private config: FullscreenConfig = {...DEFAULT_CONFIG};

    async onload() {
        try {
            this.config = normalizeConfig(await this.loadData(STORAGE_NAME));
            this.data[STORAGE_NAME] = this.config;
        } catch (e) {
            const errorMessage = `${this.displayName}: failed to load data [${STORAGE_NAME}]: ${getErrorMsg(e)}`;
            showMessage(errorMessage);
            console.error(errorMessage);
            this.config = {...DEFAULT_CONFIG};
        }

        this.initSetting();
        this.syncBreadcrumbButton();
        this.eventBus.on("switch-protyle", this.onSwitchProtyle);

        console.log(this.displayName, "plugin loaded");
    }

    onLayoutReady() {
        this.syncBreadcrumbButton();
        console.log(this.displayName, "plugin layout ready");
    }

    onunload() {
        this.eventBus.off("switch-protyle", this.onSwitchProtyle);
        this.removeFullscreenButton();
        console.log(this.displayName, "plugin unloaded");
    }

    uninstall() {
        this.removeData(STORAGE_NAME).catch(e => {
            const errorMessage = `${this.displayName}: failed to uninstall remove data [${STORAGE_NAME}]: ${
                getErrorMsg(e)
            }`;
            showMessage(errorMessage);
            console.error(errorMessage);
        });

        console.log(this.displayName, "plugin uninstalled");
    }

    private initSetting() {
        let editorSwitch: HTMLInputElement;
        let windowSwitch: HTMLInputElement;

        this.setting = new Setting({
            height: "auto",
            width: "520px",
            confirmCallback: () => {
                this.config = {
                    editorFullscreen: editorSwitch.checked,
                    windowFullscreen: windowSwitch.checked,
                };
                this.data[STORAGE_NAME] = this.config;
                this.syncBreadcrumbButton();
                this.saveData(STORAGE_NAME, this.config).catch(e => {
                    const errorMessage = `${this.displayName}: failed to save data [${STORAGE_NAME}]: ${
                        getErrorMsg(e)
                    }`;
                    showMessage(errorMessage);
                    console.error(errorMessage);
                });
            },
        });

        this.setting.addItem({
            title: this.i18n.editorFullscreen,
            description: this.i18n.editorFullscreenDesc,
            createActionElement: () => {
                editorSwitch = createSwitch(this.config.editorFullscreen);
                return editorSwitch;
            },
        });

        this.setting.addItem({
            title: this.i18n.windowFullscreen,
            description: this.i18n.windowFullscreenDesc,
            createActionElement: () => {
                windowSwitch = createSwitch(this.config.windowFullscreen);
                return windowSwitch;
            },
        });
    }

    private hasEnabledAction() {
        return this.config.editorFullscreen || this.config.windowFullscreen;
    }

    private getButtonIcon(protyle?: IProtyle) {
        if (!this.hasEnabledAction()) {
            return "iconFullscreen";
        }
        const editorIsFS = protyle ?
            isEditorFullscreen(protyle) :
            !!document.querySelector(".protyle.fullscreen");
        return isConfiguredFullscreen(editorIsFS, this.config) ? "iconFullscreenExit" : "iconFullscreen";
    }

    private onSwitchProtyle = (event: CustomEvent) => {
        this.syncBreadcrumbButton(event.detail.protyle);
    };

    private syncBreadcrumbButton = (protyle?: IProtyle) => {
        if (!this.hasEnabledAction()) {
            this.removeFullscreenButton();
            return;
        }

        this.addBreadcrumbButton({
            id: BUTTON_ID,
            icon: this.getButtonIcon(protyle),
            title: this.i18n.buttonTitle,
            callback: (_event, currentProtyle) => {
                toggleConfiguredFullscreen(currentProtyle, this.config);
                this.syncBreadcrumbButton(currentProtyle);
            },
        });
    };

    private removeFullscreenButton() {
        this.removeBreadcrumbButton(BUTTON_ID);
    }
}
