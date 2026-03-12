// TARGET BEYOND Service Worker
// キャッシュ名（バージョンアップ時は変更する）
const CACHE_NAME = 'target-beyond-v1';

// キャッシュ対象ファイル
const CACHE_FILES = [
  './TARGET_BEYOND_FIXED.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
];

// ── インストール：キャッシュに保存 ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Googleフォントはネットワーク失敗してもOK（CORSの制限あり）
      const coreFiles = ['./TARGET_BEYOND_FIXED.html', './manifest.json'];
      return cache.addAll(coreFiles).then(() => {
        // アイコンは存在する場合のみキャッシュ
        const optionalFiles = ['./icon-192.png', './icon-512.png'];
        return Promise.allSettled(
          optionalFiles.map(f =>
            cache.add(f).catch(() => console.log(`[SW] Skip: ${f}`))
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// ── アクティベート：古いキャッシュを削除 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── フェッチ：Cache First → Network Fallback ──
self.addEventListener('fetch', event => {
  // POSTリクエストやChrome拡張はスキップ
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // 正常レスポンスのみキャッシュ
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      }).catch(() => {
        // オフライン時：メインHTMLを返す（SPA的ふるまい）
        if (event.request.destination === 'document') {
          return caches.match('./TARGET_BEYOND_FIXED.html');
        }
      });
    })
  );
});

// ── バックグラウンド同期（将来の拡張用） ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
