import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(async () => { cleanup(); localStorage.clear(); await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase('fp-master');request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);}); });
