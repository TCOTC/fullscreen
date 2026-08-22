import {
    getAllEditor,
    getFrontend,
    type IProtyle,
} from "siyuan";

/**
 * 对齐思源原生 fullscreen() 的编辑器全屏。
 * 待官方提供 Protyle#isFullscreen / setFullscreen 后改走 API：https://github.com/siyuan-note/siyuan/issues/18909
 */

/** 与思源原生全屏动画时长一致，用于延后隐藏 gutter */
const GUTTER_HIDE_DELAY = 300;

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
