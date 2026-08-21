import {
    getAllEditor,
    getFrontend,
    type IProtyle,
} from "siyuan";

export interface FullscreenConfig {
    editorFullscreen: boolean;
    windowFullscreen: boolean;
}

interface ElectronBrowserWindow {
    isFullScreen: () => boolean;
    setFullScreen: (flag: boolean) => void;
}

/** 与思源原生全屏动画时长一致，用于延后隐藏 gutter */
const GUTTER_HIDE_DELAY = 300;

const getNodeRequire = () => {
    const requireFn = window.require;
    if (typeof requireFn !== "function") {
        return undefined;
    }
    return requireFn;
};

/** 通过 @electron/remote 取得当前 BrowserWindow */
export const getElectronWindow = (): ElectronBrowserWindow | undefined => {
    const requireFn = getNodeRequire();
    if (!requireFn) {
        return undefined;
    }
    try {
        const remote = requireFn("@electron/remote") as {getCurrentWindow?: () => ElectronBrowserWindow;};
        const currentWindow = remote?.getCurrentWindow?.();
        if (
            currentWindow &&
            typeof currentWindow.isFullScreen === "function" &&
            typeof currentWindow.setFullScreen === "function"
        ) {
            return currentWindow;
        }
    } catch {
        // 浏览器前端或不具备 remote 时忽略
    }
    return undefined;
};

export const isWindowFullscreen = (): boolean => {
    const electronWindow = getElectronWindow();
    if (electronWindow) {
        return electronWindow.isFullScreen();
    }
    if (document.fullscreenElement) {
        return true;
    }
    return document.body.classList.contains("body--fullscreen");
};

export const setWindowFullscreen = (enter: boolean) => {
    const electronWindow = getElectronWindow();
    if (electronWindow) {
        if (electronWindow.isFullScreen() !== enter) {
            electronWindow.setFullScreen(enter);
        }
        return;
    }
    if (enter) {
        if (!document.fullscreenElement) {
            void document.documentElement.requestFullscreen?.();
        }
        return;
    }
    if (document.fullscreenElement) {
        void document.exitFullscreen?.();
    }
};

export const isEditorFullscreen = (protyle: IProtyle): boolean => {
    return protyle.element.classList.contains("fullscreen");
};

const updateTabDragRegion = (enter: boolean) => {
    const frontend = getFrontend();
    if (frontend !== "desktop-window" && !window.siyuan.config.appearance.hideToolbar) {
        return;
    }
    document.querySelectorAll(".layout-tab-bar").forEach((bar) => {
        const headerElement = bar.parentElement;
        if (!headerElement || headerElement.getBoundingClientRect().top > 0) {
            return;
        }
        const dragElement = headerElement.querySelector(".item--readonly .fn__flex-1") as HTMLElement | null;
        if (dragElement) {
            // 进入编辑器全屏时取消页签拖拽区，退出后恢复
            dragElement.style.setProperty("-webkit-app-region", enter ? "" : "drag");
        }
    });
};

const updateWindowControls = (enter: boolean) => {
    if (window.siyuan.config.system.os === "darwin" || getFrontend() === "desktop-window") {
        return;
    }
    const windowControlsElement = document.getElementById("windowControls");
    if (!windowControlsElement) {
        return;
    }
    if (enter) {
        window.siyuan.zIndex++;
        windowControlsElement.style.zIndex = window.siyuan.zIndex.toString();
    } else {
        windowControlsElement.style.zIndex = "";
    }
};

/**
 * 对齐思源原生 fullscreen()：切换 .fullscreen、同步 editorIsFullscreen，
 * 并取消其它编辑器的全屏，避免与 Alt+Y / 更多菜单抢状态。
 */
export const setEditorFullscreen = (protyle: IProtyle, enter: boolean) => {
    const element = protyle.element;
    const currentlyFullscreen = element.classList.contains("fullscreen");
    if (currentlyFullscreen === enter) {
        window.siyuan.editorIsFullscreen = enter;
        return;
    }

    window.setTimeout(() => {
        document.querySelectorAll(".protyle-gutters").forEach((item) => {
            const gutter = item as HTMLElement;
            gutter.classList.add("fn__none");
            gutter.innerHTML = "";
        });
    }, GUTTER_HIDE_DELAY);

    if (enter) {
        element.classList.add("fullscreen");
        document.getElementById("drag")?.classList.add("fn__hidden");
    } else {
        element.classList.remove("fullscreen");
        document.getElementById("drag")?.classList.remove("fn__hidden");
    }

    updateTabDragRegion(enter);
    updateWindowControls(enter);
    window.siyuan.editorIsFullscreen = enter;

    getAllEditor().forEach((editor) => {
        const editorElement = editor.protyle.element;
        if (editorElement === element) {
            editor.resize();
            return;
        }
        if (editorElement.classList.contains("fullscreen")) {
            editorElement.classList.remove("fullscreen");
            editor.resize();
        }
    });
};

/** 已启用的项是否都处于全屏。未启用的项不参与判断。 */
export const isConfiguredFullscreen = (editorIsFS: boolean, config: FullscreenConfig): boolean => {
    return (!config.editorFullscreen || editorIsFS) && (!config.windowFullscreen || isWindowFullscreen());
};

export const isCombinedFullscreen = (protyle: IProtyle, config: FullscreenConfig): boolean => {
    return isConfiguredFullscreen(isEditorFullscreen(protyle), config);
};

/**
 * 按当前真实状态进入或退出。不缓存开关：用户可能已用原生快捷键、系统全屏等改过状态。
 * 已启用项只要有一个未全屏则全部进入全屏，都已全屏则全部退出。
 */
export const toggleConfiguredFullscreen = (protyle: IProtyle, config: FullscreenConfig) => {
    if (!config.editorFullscreen && !config.windowFullscreen) {
        return;
    }
    const enter = !isCombinedFullscreen(protyle, config);
    if (config.editorFullscreen) {
        setEditorFullscreen(protyle, enter);
    }
    if (config.windowFullscreen) {
        setWindowFullscreen(enter);
    }
};
