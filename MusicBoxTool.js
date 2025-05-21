/**
 * Loader for new NBS file format.
 * @see https://github.com/OpenNBS/opennbs.org/blob/main/pages/nbs.md
 */
class NbsLoader {
    #pointer = 0;
    #data;
    nbsSong;

    handleSingleNote(tick, layer, instrumentId, noteKey, velocity, panning, pitch) {
        this.nbsSong.noteBlocks.push({tick, layer, instrumentId, noteKey, velocity, panning, pitch});
    };

    handleSingleLayer(name, lock, volume, stereo) {
        this.nbsSong.layers.push({name, lock, volume, stereo});
    }

    handleSingleCustomInstrument(name, file, key, press) {
        this.nbsSong.customInstruments.push({name, file, key, press});
    }

    onerrorMessage() {
        return "Error loading NBS file!\n加载NBS文件时发生错误！";
    }

    oldVersionMessage() {
        return "This NBS file is too old to load!\n此NBS文件过旧，无法加载！";
    }

    async load(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                try {
                    this.nbsSong = new NbsSong();
                    this.nbsSong.fileName = file.name.slice(0, -4);
                    this.#pointer = 0;
                    // noinspection JSCheckFunctionSignatures
                    this.#data = new DataView(reader.result);
                    this.#parse();
                    this.#data = null;
                    resolve(this.nbsSong);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error(this.onerrorMessage()));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    #parse() {
        this.#parseHeader();
        this.#parseNoteBlocks();
        this.#parseLayers();
        this.#parseCustomInstruments();
    }

    #readByte() {
        const value = this.#data.getUint8(this.#pointer);
        this.#pointer += 1;
        return value;
    }

    #readShort() {
        const value = this.#data.getUint16(this.#pointer, true);
        this.#pointer += 2;
        return value;
    }

    #readInt() {
        const value = this.#data.getUint32(this.#pointer, true);
        this.#pointer += 4;
        return value;
    }

    #readString() {
        const length = this.#readInt();
        const charCodes = new Uint8Array(this.#data.buffer, this.#pointer, length);
        this.#pointer += length;
        return String.fromCharCode(...charCodes);
    }

    #parseHeader() {
        if (this.#readShort() !== 0) {
            throw new Error(this.oldVersionMessage());
        }

        this.nbsSong.version = this.#readByte();
        this.nbsSong.vanillaInstrumentCount = this.#readByte();
        this.nbsSong.length = this.#readShort();
        this.nbsSong.layerCount = this.#readShort();
        this.nbsSong.title = this.#readString();
        this.nbsSong.author = this.#readString();
        this.nbsSong.originalAuthor = this.#readString();
        this.nbsSong.description = this.#readString();
        this.nbsSong.tempo = this.#readShort();
        this.nbsSong.autoSave = this.#readByte();
        this.nbsSong.autoSaveDuration = this.#readByte();
        this.nbsSong.timeSignature = this.#readByte();
        this.nbsSong.minutesSpent = this.#readInt();
        this.nbsSong.leftClicks = this.#readInt();
        this.nbsSong.rightClicks = this.#readInt();
        this.nbsSong.blocksAdded = this.#readInt();
        this.nbsSong.blocksRemoved = this.#readInt();
        this.nbsSong.midiOrSchematicName = this.#readString();
        this.nbsSong.loop = this.#readByte() === 1;
        this.nbsSong.maxLoopCount = this.#readByte();
        this.nbsSong.loopStartTick = this.#readShort();
    }

    #parseNoteBlocks() {
        let tick = -1;
        let layer;

        while (true) {
            const jumpTicks = this.#readShort();
            if (jumpTicks === 0) break;
            tick += jumpTicks;
            layer = -1;
            while (true) {
                const jumpLayers = this.#readShort();
                if (jumpLayers === 0) break;
                layer += jumpLayers;
                this.#parseSingleNote(tick, layer);
            }

        }
    }

    #parseSingleNote(tick, layer) {
        const instrumentId = this.#readByte();
        const noteKey = this.#readByte();
        const velocity = this.#readByte();
        const panning = this.#readByte();
        const pitch = this.#readShort();
        this.handleSingleNote(tick, layer, instrumentId, noteKey, velocity, panning, pitch);
    }

    #parseLayers() {
        for (let i = 0; i < this.nbsSong.layerCount; i++) {
            this.#parseSingleLayer(i);
        }
    }

    #parseSingleLayer() {
        const name = this.#readString();
        const lock = this.#readByte() === 1;
        const volume = this.#readByte();
        const stereo = this.#readByte();
        this.handleSingleLayer(name, lock, volume, stereo);
    }

    #parseCustomInstruments() {
        const count = this.#readByte();
        for (let i = 0; i < count; i++) {
            this.#parseSingleCustomInstrument(i);
        }
    }

    #parseSingleCustomInstrument() {
        const name = this.#readString();
        const file = this.#readString();
        const key = this.#readByte();
        const press = this.#readByte();
        this.handleSingleCustomInstrument(name, file, key, press);
    }
}

class NbsSong {
    static vanillaInstrumentNames = ["Harp", "Bass", "Bass Drum", "Snare", "Hat", "Guitar", "Flute", "Bell", "Chime", "Xylophone", "Iron Xylophone", "Cow Bell", "Didgeridoo", "Bit", "Banjo", "Pling"];
    fileName;
    version;
    vanillaInstrumentCount;
    length;
    layerCount;
    title;
    author;
    originalAuthor;
    description;
    tempo;
    autoSave;
    autoSaveDuration;
    timeSignature;
    minutesSpent;
    leftClicks;
    rightClicks;
    blocksAdded;
    blocksRemoved;
    midiOrSchematicName;
    loop;
    maxLoopCount;
    loopStartTick;
    noteBlocks = [];
    layers = [];
    customInstruments = [];

    getInstrumentName(instrumentId) {
        if (instrumentId < this.vanillaInstrumentCount) {
            return NbsSong.vanillaInstrumentNames[instrumentId];
        }
        return this.customInstruments[instrumentId - this.vanillaInstrumentCount].name;
    }
}

class MusicBoxToolNbsLoader extends NbsLoader {
    handleSingleNote(tick, layer, instrumentId, noteKey, velocity, panning, pitch) {
        if (velocity !== 0) {
            this.nbsSong.noteBlocks.push({tick, layer, instrumentId, noteKey});
        }
    }

    handleSingleLayer(name, lock, volume, stereo) {
        this.nbsSong.layers.push({volume});
    }

    handleSingleCustomInstrument(name, file, key, press) {
        this.nbsSong.customInstruments.push({name, key});
    }
}

class MusicBoxTool {
    static COMMAND_1_21 = "command_1.21";
    static COMMAND_1_20 = "command_1.20";
    static PAGES = "pages";

    #loader = new MusicBoxToolNbsLoader();
    #loaded = false;
    #nbsSong;
    #notes;
    resultBar = document.getElementById("result-bar");

    async loadFile(file) {
        this.#loaded = false;
        this.#nbsSong = await this.#loader.load(file);
        this.#loadSong(this.#nbsSong);
        this.#loaded = true;
        this.resultBar.innerHTML = "";
        this.#showSongInfo();
    }

    #loadSong() {
        const map = new Map();
        const {noteBlocks, layers, vanillaInstrumentCount, customInstruments} = this.#nbsSong;
        for (const {tick, layer, noteKey, instrumentId} of noteBlocks) {
            if (layers[layer].velocity === 0) {
                continue;
            }
            if (!map.has(instrumentId)) {
                map.set(instrumentId, new Map());
            }
            let modifiedNoteKey = noteKey;
            if (instrumentId >= vanillaInstrumentCount) {
                modifiedNoteKey += (customInstruments[instrumentId - vanillaInstrumentCount].key) - 45;
            }
            const group = map.get(instrumentId);
            const offsetIndex = Math.max(Math.min(Math.floor((modifiedNoteKey - 8) / 25), 2), 0);
            const {octave, key} = [{octave: -2, key: 9}, {octave: 0, key: 33}, {octave: 2, key: 57},][offsetIndex];
            if (!group.has(octave)) {
                group.set(octave, []);
            }
            group.get(octave).push({tick, noteKey: (modifiedNoteKey - key) % 25});
        }
        this.#notes = map;
    }

    export(type) {
        if (!this.#loaded) {
            alert("Please load a nbs file first!\n请先加载一个nbs文件！");
            return;
        }
        this.resultBar.innerHTML = "";
        switch (type) {
            case MusicBoxTool.COMMAND_1_21:
                this.#exportByCommand({
                    getLore: (songName, originalAuthorName, authorName) => `minecraft:lore=['"${songName}"','"${originalAuthorName}"','"${authorName}"']`,
                    getCommand: (instName, octave, index, lore, code) => `/give @p cc_mb:note_grid[minecraft:item_name='"${instName}(${octave})-${index}"',${lore},cc_mb:notes=${code}]`
                });
                break;
            case MusicBoxTool.COMMAND_1_20:
                this.#exportByCommand({
                    getLore: (songName, originalAuthorName, authorName) => `Lore:['"${songName}"','"${originalAuthorName}"','"${authorName}"']`,
                    getCommand: (instName, octave, index, lore, code) => `/give @p cc_mb:note_grid{display:{Name:'"${instName}(${octave})-${index}"',${lore}},notes:${code}}`
                });
                break;
            case MusicBoxTool.PAGES:
                this.#exportByPages();
                break;
        }
        this.resultBar.scrollTop = 0;
    }

    #showSongInfo() {
        const songName = "💿 : " + this.#formatTextInCommand(this.#nbsSong.title || this.#nbsSong.fileName);
        const originalAuthorName = "🎵 : " + (this.#formatTextInCommand(this.#nbsSong.originalAuthor) || "? ? ?");
        const authorName = "💻 : " + (this.#formatTextInCommand(this.#nbsSong.author) || "? ? ?");
        this.#appendTitle("nbs info", true);
        this.#appendResult("Song Name", songName);
        this.#appendResult("Original Author", originalAuthorName);
        this.#appendResult("Author", authorName);
        return {songName, originalAuthorName, authorName};
    }

    #exportByCommand(consumers) {
        const {songName, originalAuthorName, authorName} = this.#showSongInfo();
        const lore = consumers.getLore(songName, originalAuthorName, authorName);
        for (const [instId, octaveMap] of this.#notes) {
            const instName = this.#formatTextInCommand(this.#nbsSong.getInstrumentName(instId));
            this.#appendTitle(instName, true);
            for (const [octave, notes] of octaveMap) {
                NoteGridCodeHelper.getCodes(notes).forEach((code, index) => {
                    const title = `Octave: ${octave} | Note Grid index: ${index + 1}`;
                    this.#appendResult(title, consumers.getCommand(instName, octave, index, lore, code));
                });
            }
        }
    }

    #formatTextInCommand(text) {
        return text.replace("\"", "\\\"").replace("\\", "\\\\").replace("'", "\\'");
    }

    #exportByPages() {
        this.#showSongInfo();
        for (const [instId, octaveMap] of this.#notes) {
            const instName = this.#formatTextInCommand(this.#nbsSong.getInstrumentName(instId));
            this.#appendTitle(instName, true);
            for (const [octave, notes] of octaveMap) {
                BookAndQuillHelper.getBooks(notes).forEach((pages, index) => {
                    const title = `Octave: ${octave} | Book index: ${index + 1}`;
                    this.#appendTitle(title);
                    for (const {text, page} of pages) {
                        const title = `Page: ${page + 1}`;
                        this.#appendResult(title, text);
                    }
                });
            }
        }
    }

    #appendTitle(textContent, jumpable = false) {
        const element = document.createElement('div');
        element.className = "result-title";
        if (jumpable) element.classList.add("jumpable");
        element.textContent = textContent;
        this.resultBar.appendChild(element);
    }

    #appendResult(title, result) {
        const titleElement = document.createElement('span');
        titleElement.className = "result-text-title";
        titleElement.textContent = title;

        const textElement = document.createElement('span');
        textElement.className = "result-text";
        textElement.textContent = result;

        const boxElement = document.createElement('div');
        boxElement.className = "result";
        boxElement.onclick = () => {
            navigator.clipboard.writeText(textElement.textContent).then(() => {
                boxElement.classList.add("clicked");
            });
        };

        boxElement.appendChild(titleElement);
        boxElement.appendChild(document.createElement('br'));
        boxElement.appendChild(textElement);

        this.resultBar.appendChild(boxElement);
    }
}

class BookAndQuillHelper {
    static keyMap = ["1", "q", "2", "w", "3", "e", "r", "5", "t", "6", "y", "u", "8", "i", "9", "o", "0", "p", "z", "s", "x", "d", "c", "v", "g"]
    #books = [];
    #pages = [];
    #page = {
        text: "",
        empty: true,
        page: 0 // [0, 63]
    };
    #currentTick = 0;

    static getBooks(notes) {
        return new BookAndQuillHelper().#getBooks(notes);
    }

    #getBooks(notes) {
        for (const {tick, noteKey} of notes) {
            while (this.#currentTick < tick) {
                this.#currentTick++;
                if (this.#currentTick % 64 === 0) {
                    this.#nextPage();
                } else {
                    this.#page.text += ".";
                }
            }
            this.#addKey(noteKey);
        }
        this.#pages.push(this.#page);
        this.#books.push(this.#pages);
        return this.#books;
    }

    #addKey(noteKey) {
        this.#page.text += BookAndQuillHelper.keyMap[noteKey];
        this.#page.empty = false;
    }

    #nextPage() {
        let nextPage = this.#page.page + 1;
        if (!this.#page.empty) {
            this.#pages.push(this.#page);
        }
        if (nextPage >= 64) {
            this.#nextBook();
            nextPage = 0;
        }
        this.#page = {
            text: "",
            empty: true,
            page: nextPage
        };
    }

    #nextBook() {
        this.#books.push(this.#pages);
        this.#pages = [];
    }
}

class NoteGridCodeHelper {
    #codes = [];
    #code = [];
    #lastTick = -1;
    #endTickOfPage = 63;
    #page = 0;
    #endPageOfNoteGrid = 63;

    static getCodes(notes) {
        return new NoteGridCodeHelper().#getCodes(notes);
    }

    #getCodes(notes) {
        for (const {tick, noteKey} of notes) {
            if (tick !== this.#lastTick) {
                this.#jumpTick(tick);
            }
            this.#code.push(noteKey + 1); // +1 to avoid 0
        }
        this.#code.push(0);
        this.#codes.push(this.#code);

        const result = [];
        for (const code of this.#codes) {
            result.push(`[B;${code.map(x => `${x}B`).join(',')}]`);
        }
        return result;
    }

    #jumpTick(tick) {
        if (tick > this.#endTickOfPage) {
            const pageGap = (tick - this.#endTickOfPage) / 64;
            for (let i = 0; i < pageGap; i++) {
                this.#nextPage();
            }
            this.#code.push(this.#lastTick - tick);
        } else {
            this.#code.push(this.#lastTick - tick);
            this.#lastTick = tick;
        }
    }

    #nextPage() {
        this.#code.push(0);
        this.#lastTick = this.#endTickOfPage;
        this.#endTickOfPage += 64;
        if (++this.#page > this.#endPageOfNoteGrid) {
            this.#nextNoteGrid();
        }
    }

    #nextNoteGrid() {
        this.#endPageOfNoteGrid += 64;
        this.#codes.push(this.#code);
        this.#code = [];
    }
}

class I18n {
    static switcher = document.getElementById("langSwitcher");
    static translations = {
        "en-US": {
            "title": "🎶 nbs File Export Tool",
            "nbsFile": "📄 nbs File",
            "exportMethod": "📤 Export",
            "command": "Command",
            "pageByPage": "Page-by-page",
            "jumpTo": "🛫 Jump to",
            "manual": "<button onclick=window.open(\"https://github.com/C20C01/MusicBox/blob/main/README.md\")>Manual</button>",
            "welcome":
                "<p><b>🤗 Welcome to nbs file export tool</b></p>" +
                "<p>A supporting tool for the mod「<a href=\"https://github.com/C20C01/MusicBox\">Music Box</a>」, used to transform nbs file to reference data for the mod.</p><br>" +
                "<p><b>🔔 Tip</b></p>" +
                "<ul><li>No support for old version nbs format, please use the new version「<a href=\"https://github.com/OpenNBS/NoteBlockStudio\">Note Block Studio</a>」to update.</li>" +
                "<li>Command: Generate commands to give you(@p) the specific Note Grids.</li>" +
                "<li>Page-by-page: Generate contents that needs to be input into the Book and Quill.</li>" +
                "<li>Click the generated text to copy it.</li></ul>",
        },
        "zh-CN": {
            "title": "🎶 nbs文件导出工具",
            "nbsFile": "📄 nbs文件",
            "exportMethod": "📤 导出",
            "command": "命令",
            "pageByPage": "逐页导出",
            "jumpTo": "🛫 跳转",
            "manual": "<button onclick=window.open(\"https://github.com/C20C01/MusicBox/blob/main/README/README_zh.md\")>说明</button>",
            "welcome":
                "<p><b>🤗 欢迎使用nbs文件导出工具</b></p>" +
                "<p>模组「<a href=\"https://github.com/C20C01/MusicBox\">纸带八音盒</a>」的配套工具，用于将nbs文件转换为模组使用的参考数据。</p><br>" +
                "<p><b>🔔 提示</b></p>" +
                "<lul><li>不支持旧版nbs格式，导出前请使用新版「<a href=\"https://github.com/OpenNBS/NoteBlockStudio\">Note Block Studio</a>」更新格式。</li>" +
                "<li>命令：生成给予你（@p）对应纸带的命令。</li>" +
                "<li>逐页导出：生成所有需要输入至书与笔中的内容。</li>" +
                "<li>点击生成的文本块即可复制其内容。</li></ul>",
        }
    }

    lang = "en-US";

    constructor() {
        for (const lang in I18n.translations) {
            I18n.switcher.add(new Option(lang, lang));
        }
        this.setLang(navigator.language);
    }

    getText(key) {
        return I18n.translations[this.lang][key] || key;
    }

    setLang(lang) {
        this.lang = I18n.translations[lang] ? lang : "en-US";
        I18n.switcher.value = this.lang;
        this.#updateLang();
    }

    #updateLang() {
        document.querySelectorAll('[data-i18n-key]').forEach(element => {
            const key = element.getAttribute('data-i18n-key');
            element.innerHTML = this.getText(key);
        });
    }
}

const tool = new MusicBoxTool();
const i18n = new I18n();
const titleElements = new Map();
const jumpToSelect = document.getElementById("jumpToSelect");

async function loadNBS(files) {
    if (files.length !== 1) {
        return;
    }
    await tool.loadFile(files[0]);
    for (const button of document.getElementsByClassName("exportButton")) {
        button.disabled = false;
        button.classList.remove("clicked");
    }
    jumpToSelect.disabled = false;
    updateJumpable();
}

function exportFile(element, type) {
    for (let button of document.getElementsByClassName("exportButton")) {
        button.classList.remove("clicked");
    }
    element.classList.add("clicked");
    tool.export(type);
    updateJumpable();
}

function updateJumpable() {
    titleElements.clear();
    jumpToSelect.innerHTML = "";
    for (const title of tool.resultBar.getElementsByClassName("jumpable")) {
        titleElements.set(title.textContent, title);
        jumpToSelect.add(new Option(title.textContent, title.textContent));
    }
}

function jumpTo(title) {
    const target = titleElements.get(title);
    if (target) {
        target.scrollIntoView();
    }
}
