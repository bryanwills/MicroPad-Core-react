import actionCreatorFactory, { ActionCreator, AsyncActionCreators } from 'typescript-fsa';
import { IRenameNotepadObjectAction } from './types/NotepadTypes';
import {
	AddCryptoPasskeyAction,
	AddToSyncAction,
	DeleteElementAction,
	ExpandFromNoteAction,
	InsertElementAction,
	MoveAcrossNotepadsAction,
	MoveNotepadObjectAction,
	NewNotepadObjectAction,
	NotepadToSyncNotepadAction,
	RestoreJsonNotepadAndLoadNoteAction,
	SearchIndices,
	SyncAction,
	UpdateBibliographyAction,
	UpdateElementAction,
	ZoomChange
} from './types/ActionTypes';
import { IInsertElementState } from './reducers/NoteReducer';
import { CombinedNotepadSyncList, SyncLoginRequest, SyncUser } from './types/SyncTypes';
import { FlatNotepad, Notepad, Translators } from 'upad-parse/dist';
import { NoteElement } from 'upad-parse/dist/Note';
import { SearchResults } from './reducers/SearchReducer';
import { ThemeName } from './types/Themes';
import { DueItem } from './services/DueDates';
import { DrawMode } from './reducers/EditorReducer';
import { AppInfoMessage } from './reducers/AppInfoReducer';
import { ModalId } from './types/ModalIds';
import { EncryptionStatus } from './reducers/AppReducer';

export type MicroPadAction = ActionTypes[keyof ActionTypes];
export type ActionNames = keyof ActionFactories;

export type MicroPadActions = {
	[ActionName in ActionNames]: ActionFactories[ActionName] extends ActionCreator<any>
		? ReturnType<ActionFactories[ActionName]>
		: ActionFactories[ActionName] extends AsyncActionCreators<any, any, any>
			? { started: ReturnType<ActionFactories[ActionName]['started']>, done: ReturnType<ActionFactories[ActionName]['done']>, failed: ReturnType<ActionFactories[ActionName]['failed']> }
			: never;
};

type ActionFactories = typeof actions;
type ActionTypes = {
	[ActionName in ActionNames]: ActionFactories[ActionName] extends ActionCreator<any>
		? ReturnType<ActionFactories[ActionName]>
		: ActionFactories[ActionName] extends AsyncActionCreators<any, any, any>
			? (ReturnType<ActionFactories[ActionName]['started']> | ReturnType<ActionFactories[ActionName]['done']> | ReturnType<ActionFactories[ActionName]['failed']>)
			: never;
};

const actionCreator = actionCreatorFactory();

export const actions = {
	parseNpx: actionCreator.async<string, FlatNotepad, unknown>('PARSE_NPX'),
	saveNotepad: actionCreator.async<Notepad, void, void>('SAVE_NOTEPAD'),
	getNotepadList: actionCreator.async<void, string[], void>('GET_NOTEPAD_LIST'),
	downloadNotepad: actionCreator.async<string, string, void>('DOWNLOAD_NOTEPAD'),
	openNotepadFromStorage: actionCreator.async<string, void, unknown>('OPEN_NOTEPAD_FROM_STORAGE'),
	renameNotepad: actionCreator.async<string, string, void>('RENAME_NOTEPAD'),
	checkNoteAssets: actionCreator.async<[string, NoteElement[]], FlatNotepad, void>('CHECK_NOTE_ASSETS'),
	loadNote: actionCreator.async<string, object, Error>('LOAD_NOTE'),
	expandAllExplorer: actionCreator.async<void, string[], void>('EXPAND_ALL_EXPLORER'),
	print: actionCreator.async<void, NoteElement, void>('PRINT'),
	syncLogin: actionCreator.async<SyncLoginRequest, SyncUser, void>('SYNC_LOGIN'),
	getSyncedNotepadList: actionCreator.async<SyncUser, CombinedNotepadSyncList, void>('SYNC_GET_NOTEPAD_LIST'),
	syncDownload: actionCreator.async<string, Notepad, void>('SYNC_DOWNLOAD'),
	syncUpload: actionCreator.async<SyncAction, void, any>('SYNC_UPLOAD'),
	deleteFromSync: actionCreator.async<string, void, void>('SYNC_DELETE'),
	addToSync: actionCreator.async<AddToSyncAction, string, void>('SYNC_CREATE'),
	quickNote: actionCreator.async<void, string, void>('QUICK_NOTE'),
	indexNotepads: actionCreator.async<void, SearchIndices, void>('INDEX_NOTEPADS'),
	exportAll: actionCreator.async<void, Blob, Error>('EXPORT_ALL_NOTEPADS'),
	exportToMarkdown: actionCreator.async<void, Blob, Error>('EXPORT_ALL_NOTEPADS_TO_MD'),
	clearOldData: actionCreator.async<{ silent: boolean }, void, Error>('CLEAR_OLD_DATA'),
	getHelp: actionCreator.async<void, void, Error>('GET_HELP'),
	getDueDates: actionCreator.async<string[], DueItem[], Error>('GET_DUE_DATES'),
	moveObjAcrossNotepads: actionCreator.async<MoveAcrossNotepadsAction, void, Error>('CROSS_NOTEPAD_MOVE'),
	search: actionCreator.async<string, SearchResults, Error>('SEARCH'),
	forgetSavedPasswords: actionCreator.async<void, void, unknown>('FORGET_SAVED_PASSWORDS'),

	restoreJsonNotepad: actionCreator<string>('PARSE_JSON_NOTEPAD'),
	restoreJsonNotepadAndLoadNote: actionCreator<RestoreJsonNotepadAndLoadNoteAction>('PARSE_JSON_NOTEPAD_AND_LOAD_NOTE'),
	newNotepad: actionCreator<FlatNotepad>('NEW_NOTEPAD'),
	flipFullScreenState: actionCreator<void>('FLIP_FULL_SCREEN'),
	exitFullScreen: actionCreator<void>('EXIT_FULL_SCREEN'),
	openBreadcrumb: actionCreator<string>('OPEN_BREADCRUMB'),
	deleteNotepad: actionCreator<string>('DELETE_NOTEPAD'),
	exportNotepad: actionCreator<void>('EXPORT_NOTEPAD'),
	expandSection: actionCreator<string>('OPEN_SECTION'),
	collapseSelection: actionCreator<string>('CLOSE_SECTION'),
	deleteNotepadObject: actionCreator<string>('DELETE_NOTEPAD_OBJECT'),
	renameNotepadObject: actionCreator<IRenameNotepadObjectAction>('RENAME_NOTEPAD_OBJECT'),
	expandFromNote: actionCreator<ExpandFromNoteAction>('EXPAND_FROM_NOTE'),
	collapseAllExplorer: actionCreator<void>('COLLAPSE_ALL_EXPLORER'),
	openEditor: actionCreator<string>('OPEN_EDITOR'),
	updateElement: actionCreator<UpdateElementAction>('UPDATE_ELEMENT'),
	updateDefaultFontSize: actionCreator<string>('UPDATE_DEFAULT_FONT_SIZE'),
	newSection: actionCreator<NewNotepadObjectAction>('NEW_SECTION'),
	newNote: actionCreator<NewNotepadObjectAction>('NEW_NOTE'),
	trackAsset: actionCreator<string>('TRACK_ASSET'),
	untrackAsset: actionCreator<string>('UNTRACK_ASSET'),
	reloadNote: actionCreator<void>('RELOAD_NOTE'),
	insertElement: actionCreator<InsertElementAction>('INSERT_ELEMENT'),
	toggleInsertMenu: actionCreator<Partial<IInsertElementState>>('TOGGLE_INSERT_MENU'),
	deleteElement: actionCreator<DeleteElementAction>('DELETE_ELEMENT'),
	queueParseNpx: actionCreator<string>('QUEUE_PARSE_NPX'),
	parseEnex: actionCreator<string>('PARSE_ENEX'),
	updateBibliography: actionCreator<UpdateBibliographyAction>('UPDATE_BIBLIOGRAPHY'),
	loadNotepadByIndex: actionCreator<number>('LOAD_NOTEPAD_BY_INDEX'),
	updateZoomLevel: actionCreator<ZoomChange>('UPDATE_ZOOM_LEVEL'),
	clearPrintView: actionCreator<void>('CLEAR_PRINT'),
	syncLogout: actionCreator<void>('SYNC_LOGOUT'),
	updateCurrentSyncId: actionCreator<CombinedNotepadSyncList>('UPDATE_SYNC_ID'),
	sync: actionCreator<SyncAction>('SYNC'),
	actWithSyncNotepad: actionCreator<NotepadToSyncNotepadAction>('ACT_WITH_SYNC_NOTEPAD'),
	requestSyncDownload: actionCreator<string>('REQUEST_SYNC_DOWNLOAD'),
	syncProError: actionCreator<void>('SYNC_PRO_ERROR'),
	setSyncProStatus: actionCreator<boolean>('SET_SYNC_PRO_STATUS'),
	setHelpPref: actionCreator<boolean>('SET_HELP_PREF'),
	checkVersion: actionCreator<void>('CHECK_VERSION_ELECTRON'),
	closeNote: actionCreator<void>('CLOSE_NOTE'),
	selectTheme: actionCreator<ThemeName>('SELECT_THEME'),
	moveNotepadObject: actionCreator<MoveNotepadObjectAction>('MOVE_NOTEPAD_OBJECT'),
	quickMarkdownInsert: actionCreator<void>('QUICK_MARKDOWN_INSERT'),
	quickNotepad: actionCreator<void>('QUICK_NOTEPAD'),
	flashExplorer: actionCreator<void>('FLASH_EXPLORER'),
	encryptNotepad: actionCreator<string>('ENCRYPT_NOTEPAD'),
	addCryptoPasskey: actionCreator<AddCryptoPasskeyAction>('ADD_CRYPTO_PASSKEY'),
	closeNotepad: actionCreator<void>('CLOSE_NOTEPAD'),
	importMarkdown: actionCreator<Translators.Markdown.MarkdownImport[]>('IMPORT_FROM_MARKDOWN'),
	setExplorerWidth: actionCreator<string>('SET_EXPLORER_WIDTH'),
	feelingLucky: actionCreator<void>('FEELING_LUCKY'),
	setSearchResultVisibility: actionCreator<boolean>('SET_SEARCH_RESULT_VISIBILITY'),
	toggleSpellCheck: actionCreator<boolean | void>('TOGGLE_SPELL_CHECK'),
	toggleWordWrap: actionCreator<boolean | void>('TOGGLE_WORD_WRAP'),
	openModal: actionCreator<ModalId>('OPEN_MODAL'),
	closeModal: actionCreator<void>('CLOSE_MODAL'),
	setDrawMode: actionCreator<DrawMode>('SET_DRAW_MODE'),
	setDrawingLineColour: actionCreator<string>('SET_DRAWING_LINE_COLOUR'),
	dismissInfoBanner: actionCreator<void>('DISMISS_INFO_BANNER'),
	setInfoMessage: actionCreator<AppInfoMessage>('SET_INFO_MESSAGE'),
	mouseMove: actionCreator<{ x: number, y: number }>('MOUSE_MOVE'),
	filePasted: actionCreator<File>('FILE_PASTED'),
	updateEncryptionStatus: actionCreator<EncryptionStatus>('UPDATE_CRYPTO_STATUS'),
	hashtagSearchOrJump: actionCreator<string>('HASHTAG_SEARCH_OR_JUMP'),
	setShowHistoricalDueDates: actionCreator<boolean>('SET_SHOW_HISTORICAL_DUE_DATES'),
};

export const READ_ONLY_ACTIONS: ReadonlySet<string> = new Set<string>([
	actions.quickNote.started.type,
	actions.quickNote.done.type,
	actions.quickNote.failed.type,

	actions.filePasted.type,
	actions.updateElement.type,
	actions.quickMarkdownInsert.type,
	actions.insertElement.type,
	actions.toggleInsertMenu.type,
	actions.openEditor.type,
	actions.renameNotepadObject.type,
	actions.newSection.type,
	actions.newNote.type,
	actions.moveNotepadObject.type,
	actions.deleteElement.type,
	actions.deleteNotepadObject.type
]);
