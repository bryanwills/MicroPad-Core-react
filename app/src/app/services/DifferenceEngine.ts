import { from, fromEvent, lastValueFrom, Observable, of, retryWhen } from 'rxjs';
import { MICROPAD_URL } from '../types';
import { concatMap, filter, map, retry, take } from 'rxjs/operators';
import { AssetList, INotepadSharingData, ISyncedNotepad, SyncedNotepadList } from '../types/SyncTypes';
import { parse } from 'date-fns';
import { LAST_MODIFIED_FORMAT, Notepad } from 'upad-parse/dist';
import { ajax } from 'rxjs/ajax';
import { encrypt } from 'upad-parse/dist/crypto';
import { generateGuid } from '../util';
import { getAssetInfoImpl } from '../workers/sync-worker/sync-worker-impl';
import { actions } from '../actions';
import { store } from '../root';
import { WorkerMsgData } from '../workers';
import { SYNC_ASSET_OVERSIZED_MESSAGE } from '../strings.enNZ';

const AssetHashWorker = new Worker(build.defs.SYNC_WORKER_PATH, { type: 'module' });

export const AccountService = (() => {
	const call = <T>(endpoint: string, resource: string, payload?: Record<string, string>) => callApi<T>('account', endpoint, resource, payload);

	const login = (username: string, password: string): Observable<{ username: string, token: string }> => {
		return call<{ token: string }>('login', username, { password })
			.pipe(map(res => { return { username, token: res.token }; }));
	};

	const isPro = (username: string, token: string): Observable<boolean> => {
		return call<{ isPro: boolean }>('is_pro', username, { token })
			.pipe(map(res => res.isPro));
	};

	return { login, isPro };
})();

export const NotepadService = (() => {
	const call = <T>(endpoint: string, resource: string, payload?: Record<string, string>) => callApi<T>('notepad', endpoint, resource, payload);

	/** @deprecated */
	const listNotepads = (username: string, token: string): Observable<SyncedNotepadList> =>
		call<{ notepads: SyncedNotepadList }>('list_notepads', username, { token }).pipe(map(res => res.notepads));

	const listSharedNotepads = (username: string, token: string): Observable<Record<string, INotepadSharingData>> =>
		call<{ notepads: Record<string, INotepadSharingData> }>('sharing_list_notepads', username, { token }).pipe(map(res => res.notepads));

	const create = (username: string, token: string, notepadTitle: string): Observable<string> => {
		return call<{ notepad: string }>('create', username, { token, notepadTitle }).pipe(map(res => res.notepad));
	};

	return { listNotepads, listSharedNotepads, create };
})();

export const SyncService = (() => {
	const call = <T>(endpoint: string, resource: string, payload?: Record<string, string>) => callApi<T>('sync', endpoint, resource, payload);

	const getLastModified = (syncId: string): Observable<Date> =>
		call<{ title: string, lastModified: string }>('info', syncId).pipe(map(res => parse(res.lastModified, LAST_MODIFIED_FORMAT, new Date())));

	const downloadNotepad = (syncId: string): Observable<ISyncedNotepad> =>
		call<{ notepad: string }>('download', syncId).pipe(map(res => JSON.parse(res.notepad)));

	const getAssetDownloadLinks = (syncId: string, assets: string[]): Observable<AssetList> =>
		call<{ urlList: AssetList }>('download_assets', syncId, { assets: JSON.stringify(assets) }).pipe(map(res => res.urlList));

	const uploadNotepad = (username: string, token: string, syncId: string, notepad: ISyncedNotepad, passkey?: string): Observable<AssetList> =>
		from(!!notepad.crypto && !!passkey ? encrypt(notepad, passkey) : of(notepad)).pipe(
			concatMap(np =>
				call<{ assetsToUpload: AssetList }>('upload', syncId, {
					notepadV2: JSON.stringify(np, (k, v) => (k === 'parent') ? undefined : v) // Remove parent links here, unneeded content
						.replace(
							/[\u007f-\uffff]/g,
							char => '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4)
						), // Fix unicode encoding
					username,
					token
				})
			),
			map(res => res.assetsToUpload)
		);

	const deleteNotepad = (syncId: string, username: string, token: string): Observable<void> => call<void>('delete', syncId, {
		username,
		token
	});

	async function notepadToSyncedNotepad(notepad: Notepad): Promise<ISyncedNotepad> {
		const cid = generateGuid();
		const res$ = fromEvent<MessageEvent<WorkerMsgData<ReturnType<typeof getAssetInfoImpl>>>>(AssetHashWorker, 'message').pipe(
			filter(event => event.data?.cid === cid),
			map(event => {
				if (event.data.error) throw event.data.error;
				return event.data;
			}),
			take(1)
		);

		const getAssetInfo$ = lastValueFrom(res$);
		AssetHashWorker.postMessage({
			cid,
			type: 'getAssetInfo',
			flatNotepad: notepad.flatten()
		});

		const { assets, hasOversizedAssets, assetTypes } = await getAssetInfo$;
		if (hasOversizedAssets) {
			store.dispatch(actions.setInfoMessage({
				text: SYNC_ASSET_OVERSIZED_MESSAGE
			}));
		}

		return Object.assign({}, notepad, { assetHashList: assets, assetTypes });
	}

	return {
		getLastModified,
		downloadNotepad,
		getAssetDownloadLinks,
		uploadNotepad,
		deleteNotepad,
		notepadToSyncedNotepad
	}
})();

export function downloadAsset(url: string): Observable<Blob> {
	return ajax<Blob>({
		url,
		method: 'GET',
		crossDomain: true,
		responseType: 'blob'
	}).pipe(
		map(res => res.response),
		retry(2)
	);
}

export function uploadAsset(url: string, asset: Blob): Observable<void> {
	return ajax({
		url,
		method: 'PUT',
		body: asset,
		crossDomain: true,
		headers: {
			'Content-Type': asset.type
		}
	}).pipe(
		map(() => undefined),
		retry(2)
	);
}

function callApi<T>(parent: string, endpoint: string, resource: string, payload?: Record<string, string>, method?: string): Observable<T> {
	return ajax<T>({
		url: `${shouldUseDevApi() ? 'http://localhost:48025' : MICROPAD_URL}/diffeng/${parent}/${endpoint}/${resource}`,
		method: method || (!payload) ? 'GET' : 'POST',
		body: payload ? new URLSearchParams(payload).toString() : undefined,
		crossDomain: true,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
		},
		responseType: 'json',
		timeout: !!payload ? undefined : 10000 // 10 seconds
	}).pipe(
		map(res => res.response),
		retryWhen(errors => errors.pipe(
			map((error, i) => {
				if (i > 2 || error?.response?.error === 'Too many assets on a non-pro notepad') {
					throw error;
				}
				return error;
			})
		))
	);
}

function shouldUseDevApi(): boolean {
	return !!new URLSearchParams(location.search).get('local');
}
