/* Special Imports */
// @ts-expect-error TS2307
import helpNpx from './assets/Help.npx';
/* CSS Imports */
import '@fontsource/abeezee';
import 'material-icons-font/material-icons-font.css';
import 'materialize-css/dist/css/materialize.min.css';
import './root.css';
import './ScrollbarPatch.css';
/* Themes */
import './theme-styles/Solarized.css';
import './theme-styles/Midnight.css';
import './theme-styles/Void.css';
import './theme-styles/Wellington.css';
import './theme-styles/Peach.css';
import './theme-styles/Pastel.css';
import './theme-styles/Purple.css';
/* JS Imports */
import React from 'react';
import 'materialize-css/dist/js/materialize.js';
import { MICROPAD_URL } from './types';
import { applyMiddleware } from 'redux';
import { BaseReducer } from './reducers/BaseReducer';
import { epicMiddleware } from './epics';
import localforage from 'localforage';
import * as ReactDOM from 'react-dom';
import { actions } from './actions';
import { Provider } from 'react-redux';
import HeaderComponent from './components/header/HeaderContainer';
import NotepadExplorerComponent from './components/explorer/NotepadExplorerContainer';
import NoteViewerComponent from './containers/NoteViewerContainer';
import { enableKeyboardShortcuts } from './services/shortcuts';
import PrintViewOrAppContainerComponent from './containers/PrintViewContainer';
import NoteElementModalComponent from './components/note-element-modal/NoteElementModalComponent';
import { SyncLoginRequest, SyncUser } from './types/SyncTypes';
import InsertElementComponent from './containers/InsertElementContainer';
import { ThemeName } from './types/Themes';
import AppBodyComponent from './containers/AppBodyContainer';
import ToastEventHandler from './services/ToastEventHandler';
import { LastOpenedNotepad } from './epics/StorageEpics';
import { createSentryReduxEnhancer } from '../sentry';
import { createDynamicCss } from './DynamicAppCss';
import { hasRequiredFeatures } from '../unsupported-page/feature-detect';
import { showUnsupportedPage } from '../unsupported-page/show-page';
import { hasEncryptedNotebooks, hasSavedPasswords, restoreSavedPasswords } from './services/CryptoService';
import TopLevelModalsComponent from './components/TopLevelModalsComponent';
import { rootEpic$ } from './epics/rootEpic';
import InfoBannerComponent from './components/header/info-banner/InfoBannerContainer';
import { watchPastes } from './services/paste-watcher';
import { configureStore } from '@reduxjs/toolkit';
import { isDev } from './util';
import { DueDateSettingsState } from './reducers/DueDateSettingsReducer';
import { SettingsStorageKeys } from './storage/settings-storage-keys';

try {
	document.domain = MICROPAD_URL.split('//')[1];
} catch (err) {
	console.warn(`Couldn't set domain for resolving CORS. If this is prod change 'MICROPAD_URL'.`);
}

const baseReducer: BaseReducer = new BaseReducer();

export const store = configureStore({
	reducer: baseReducer.reducer,
	enhancers: [applyMiddleware(epicMiddleware), createSentryReduxEnhancer()],
	middleware: getDefaultMiddleware => getDefaultMiddleware({
		serializableCheck: false,
		thunk: false,
		immutableCheck: false
	}),
	devTools: {
		actionsDenylist: [actions.mouseMove.type],
		actionSanitizer: action => {
			switch (action.type) {
				case actions.parseNpx.started.type:
					return { ...action, payload: null };
				default:
					return action;
			}
		}
	}
});

export type MicroPadStore = typeof store;

export const TOAST_HANDLER = new ToastEventHandler();

export const NOTEPAD_STORAGE = localforage.createInstance({
	name: 'MicroPad',
	storeName: 'notepads'
});

export const ASSET_STORAGE = localforage.createInstance({
	name: 'MicroPad',
	storeName: 'assets'
});

export const SYNC_STORAGE = localforage.createInstance({
	name: 'MicroPad',
	storeName: 'sync'
});

export const SETTINGS_STORAGE = localforage.createInstance({
	name: 'MicroPad',
	storeName: 'settings'
});

export const CRYPTO_PASSKEYS_STORAGE = localforage.createInstance({
	name: 'MicroPad',
	storeName: 'cryptoPasskeys'
});

export type StorageMap = {
	notepadStorage: LocalForage,
	assetStorage: LocalForage,
	syncStorage: LocalForage,
	settingsStorage: LocalForage,
	cryptoPasskeysStorage: LocalForage,

	/** @deprecated Use settingsStorage instead */
	generalStorage: LocalForage
};

export function getStorage(): StorageMap {
	return {
		notepadStorage: NOTEPAD_STORAGE,
		assetStorage: ASSET_STORAGE,
		syncStorage: SYNC_STORAGE,
		settingsStorage: SETTINGS_STORAGE,
		cryptoPasskeysStorage: CRYPTO_PASSKEYS_STORAGE,
		generalStorage: localforage
	};
}

export async function init() {
	const shouldInit = await hasRequiredFeatures();
	if (!shouldInit) {
		showUnsupportedPage();
		return;
	}

	epicMiddleware.run(rootEpic$);

	await hydrateStoreFromLocalforage();
	createDynamicCss(store);

	if (!window.MicroPadGlobals.isPersistenceAllowed) {
		store.dispatch(actions.setInfoMessage({
			text: `Failed to get permission for long-term storage. You may need to save your notebooks manually.`,
			cta: 'https://github.com/MicroPad/MicroPad-Core/discussions/438'
		}));
	}

	if (window.isElectron) store.dispatch(actions.checkVersion());
	store.dispatch(actions.getNotepadList.started());
	store.dispatch(actions.indexNotepads.started());

	enableKeyboardShortcuts(store);
	document.addEventListener('mousemove', e => store.dispatch(actions.mouseMove({
		x: e.clientX,
		y: e.clientY
	})));

	// Render the main UI
	ReactDOM.render(
		<Provider store={store}>
			<PrintViewOrAppContainerComponent>
				<React.StrictMode><HeaderComponent /></React.StrictMode>
				<AppBodyComponent>
					<NoteViewerComponent />
					<React.StrictMode>
						<NotepadExplorerComponent />
						<NoteElementModalComponent id="whats-new-modal" npx={helpNpx} findNote={np => np.sections[0].notes[2]} />
						<InsertElementComponent />
						<TopLevelModalsComponent />
					</React.StrictMode>
				</ AppBodyComponent>
				<React.StrictMode><InfoBannerComponent /></React.StrictMode>
			</PrintViewOrAppContainerComponent>
		</Provider>,
		document.getElementById('app')!
	);

	await displayWhatsNew();
	notepadDownloadHandler();
	watchPastes(store);

	store.dispatch(actions.clearOldData.started({ silent: true }));

	// Show a warning when closing before notepad save or sync is complete
	store.subscribe(() => {
		const isSaving = store.getState().notepads.isLoading || store.getState().notepads.notepad?.isLoading;
		const isSyncing = store.getState().sync.isLoading;
		window.onbeforeunload = (isSyncing || isSaving) ? () => true : null;
	});

	const hideLoadingScreen = async () => {
		if (!window.isElectron && !isDev(false) && 'serviceWorker' in navigator) {
			// if we have a service worker already installed, wait for it to update before doing anything
			if (!!navigator.serviceWorker.controller?.state) {
				await navigator.serviceWorker.ready;
			}
		}
		window.loadingScreen.finish();
	};
	document.readyState === 'complete' ? await hideLoadingScreen() : window.addEventListener('load', hideLoadingScreen);
}

async function hydrateStoreFromLocalforage() {
	await Promise.all(Object.values(getStorage()).map(storage => storage.ready()));

	Promise.all([hasEncryptedNotebooks(NOTEPAD_STORAGE), hasSavedPasswords(CRYPTO_PASSKEYS_STORAGE)])
		.then(([hasEncryptedNotebooks, hasSavedPasswords]) => store.dispatch(actions.updateEncryptionStatus({
			hasEncryptedNotebooks,
			hasSavedPasswords
		})));
	const restoreSavedPasswords$ = restoreSavedPasswords(store, CRYPTO_PASSKEYS_STORAGE);

	const fontSize = await localforage.getItem<string>('font size');
	if (!!fontSize) store.dispatch(actions.updateDefaultFontSize(fontSize));

	const helpPref: boolean | null = await localforage.getItem<boolean>('show help');
	if (helpPref !== null) store.dispatch(actions.setHelpPref(helpPref));

	const shouldSpellCheck = await SETTINGS_STORAGE.getItem<boolean>('shouldSpellCheck');
	if (shouldSpellCheck !== null) store.dispatch(actions.toggleSpellCheck(shouldSpellCheck));

	const shouldWordWrap = await SETTINGS_STORAGE.getItem<boolean>('shouldWordWrap');
	if (shouldWordWrap !== null) store.dispatch(actions.toggleWordWrap(shouldWordWrap));

	const syncUser: SyncUser | null = await SYNC_STORAGE.getItem<SyncUser>('sync user');
	if (!!syncUser && !!syncUser.token && !!syncUser.username) store.dispatch(actions.syncLogin.done({ params: {} as SyncLoginRequest, result: syncUser }));

	const theme = await localforage.getItem<ThemeName>('theme');
	if (!!theme) store.dispatch(actions.selectTheme(theme));

	const dueDateOpts$ = SETTINGS_STORAGE.getItem<DueDateSettingsState>(SettingsStorageKeys.DUE_DATE_OPTS)
		.then(opts => store.dispatch(actions.setShowHistoricalDueDates(opts?.showHistoricalDueDates ?? false)));
	await dueDateOpts$;

	await Promise.all([dueDateOpts$, restoreSavedPasswords$]);

	// Reopen the last notebook + note
	const lastOpenedNotepad = await localforage.getItem<string | LastOpenedNotepad>('last opened notepad');
	if (typeof lastOpenedNotepad === 'string') {
		store.dispatch(actions.openNotepadFromStorage.started(lastOpenedNotepad));
	} else if (!!lastOpenedNotepad) {
		const { notepadTitle, noteRef } = lastOpenedNotepad;
		if (noteRef) {
			store.dispatch(actions.restoreJsonNotepadAndLoadNote({ notepadTitle, noteRef }));
		} else {
			store.dispatch(actions.openNotepadFromStorage.started(notepadTitle));
		}
	}
}

async function displayWhatsNew() {
	// some clean up of an old item, can be removed in the future
	localforage.removeItem(SettingsStorageKeys.OLD_MINOR_VERSION).catch(e => console.error(e));

	const minorVersion = store.getState().app.version.minor;
	const oldMinorVersion = await SETTINGS_STORAGE.getItem<number>(SettingsStorageKeys.OLD_MINOR_VERSION);
	if (minorVersion === oldMinorVersion) return;

	// Open "What's New"
	setTimeout(() => {
		store.dispatch(actions.openModal('whats-new-modal'));
	}, 0);

	SETTINGS_STORAGE.setItem<number>(SettingsStorageKeys.OLD_MINOR_VERSION, minorVersion).catch(e => console.error(e));
}

function notepadDownloadHandler() {
	 
	const downloadNotepadUrl = new URLSearchParams(location.search).get('download');
	if (!!downloadNotepadUrl) store.dispatch(actions.downloadNotepad.started(downloadNotepadUrl));
}
