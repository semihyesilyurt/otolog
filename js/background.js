const PROXY_HOST = "77.92.154.204";
const PROXY_PORT = 8888;

const proxyDomains = [
  "partslink24.com",
  "usercentrics.eu",
  "go-mpulse.net",
  "doubleclick.net",
  "googletagmanager.com",
];

// PAC script oluşturma
function generatePacScript() {
  const domains = JSON.stringify(proxyDomains).replace(/[^\x00-\x7F]/g, "");
  return `
    function FindProxyForURL(url, host) {
      var proxyDomains = ${domains};
      
      function checkDomain(domain) {
        return shExpMatch(host, "*." + domain) || shExpMatch(host, domain);
      }

      for (var i = 0; i < proxyDomains.length; i++) {
        if (checkDomain(proxyDomains[i])) {
          return "PROXY ${PROXY_HOST}:${PROXY_PORT}";
        }
      }

      return "DIRECT";
    }
  `.replace(/[^\x00-\x7F]/g, "");
}

// SSL Sertifika kontrolü
async function checkCertificate() {
    try {
        const response = await fetch('https://otolog.com/api/check-cert', {
            method: 'HEAD'
        });
        return response.ok;
    } catch (error) {
        if (error.message.includes('SSL')) {
            return false;
        }
        return true;
    }
}

// Sertifika uyarısı göster
function showCertificateWarning() {
    chrome.notifications.create('cert-warning', {
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'SSL Sertifika Hatası',
        message: 'Güvenli bağlantı için sertifika kurulumu gerekiyor. Kurulum rehberini görüntülemek için tıklayın.',
        requireInteraction: true
    });
}

// Notification tıklama olayını dinle
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'cert-warning') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('pages/cert_guide.html')
        });
    }
});

// Eklenti aktif/pasif durumu kontrolü
let isEnabled = false;
let isSubscriptionExpired = false;
let isAuthenticated = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getProxyStatus") {
        sendResponse({ isEnabled });
    } else if (message.action === "setAuthStatus") {
        isAuthenticated = message.isAuthenticated;
        if (!isAuthenticated) {
            // Oturum yoksa sistemi devre dışı bırak
            isEnabled = false;
            chrome.proxy.settings.set({
                value: { mode: "direct" },
                scope: "regular"
            });
        }
        sendResponse({ success: true });
    } else if (message.action === "toggleProxy") {
        // Oturum yoksa sistemi etkinleştirmeyi reddet
        if (!isAuthenticated) {
            sendResponse({ 
                isEnabled: false,
                error: "Sistem kullanımı için giriş yapmanız gerekiyor"
            });
            return true;
        }

        // Eğer forceDisable true ise, abonelik sona ermiş demektir
        if (message.forceDisable) {
            isSubscriptionExpired = true;
            isEnabled = false;
        } else if (isSubscriptionExpired) {
            sendResponse({ 
                isEnabled: false,
                error: "Aboneliğiniz sona erdiği için sistem etkinleştirilemiyor"
            });
            return true;
        } else {
            isEnabled = message.enable !== undefined ? message.enable : !isEnabled;
        }
        
        if (isEnabled && !isSubscriptionExpired && isAuthenticated) {
            chrome.proxy.settings.set({
                value: {
                    mode: "pac_script",
                    pacScript: {
                        data: generatePacScript()
                    }
                },
                scope: "regular"
            });
        } else {
            chrome.proxy.settings.set({
                value: { mode: "direct" },
                scope: "regular"
            });
        }
        
        sendResponse({ isEnabled });
    }
    return true;
});

// GitHub API endpoint'i
const GITHUB_REPO = 'semihyesilyurt/otolog';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// Sürüm kontrolü
async function checkForUpdates() {
    try {
        // Mevcut sürümü al
        const manifest = chrome.runtime.getManifest();
        const currentVersion = manifest.version;

        // GitHub'dan en son sürümü kontrol et
        const response = await fetch(GITHUB_API);
        const data = await response.json();

        // API yanıtını kontrol et
        if (!data || !data.tag_name) {
            console.log('Henüz yayınlanmış bir sürüm yok');
            return;
        }

        // Sürüm numarasını temizle (v1.1.0 -> 1.1.0)
        const latestVersion = data.tag_name.toLowerCase().replace(/^v/, '');

        // Sürümleri karşılaştır
        if (compareVersions(latestVersion, currentVersion) > 0) {
            // Yeni sürüm bulundu, güncelleme bildirimini göster
            chrome.notifications.create('update-available', {
                type: 'basic',
                iconUrl: 'images/icon128.png',
                title: 'OTOLOG Güncelleme',
                message: `Yeni sürüm (${latestVersion}) mevcut. Güncellemek için tıklayın.`,
                requireInteraction: true
            });

            // Yeni sürümü indir
            const zipUrl = data.zipball_url;
            const updateResponse = await fetch(zipUrl);
            const updateBlob = await updateResponse.blob();

            // Güncelleme dosyasını kaydet
            const updateFile = new File([updateBlob], 'update.zip');
            
            // Chrome'un kendi güncelleme sistemini kullan
            chrome.runtime.requestUpdateCheck((status) => {
                if (status === 'update_available') {
                    chrome.runtime.reload();
                }
            });
        }
    } catch (error) {
        console.error('Güncelleme kontrolü hatası:', error);
    }
}

// Sürüm numaralarını karşılaştır (1.0.0 vs 1.1.0)
function compareVersions(v1, v2) {
    const v1Parts = v1.split('.').map(Number);
    const v2Parts = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;
        
        if (v1Part > v2Part) return 1;
        if (v1Part < v2Part) return -1;
    }
    
    return 0;
}

// Bildirim tıklama olayını dinle
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'update-available') {
        // Güncelleme sayfasını aç
        chrome.tabs.create({
            url: `https://github.com/${GITHUB_REPO}/releases/latest`
        });
    }
    if (notificationId === 'cert-warning') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('pages/cert_guide.html')
        });
    }
});

// Eklenti yüklendiğinde veya güncellendiğinde çalışacak
chrome.runtime.onInstalled.addListener(async () => {
    chrome.proxy.settings.set({
        value: { mode: "direct" },
        scope: "regular"
    });
    isEnabled = false;
    isSubscriptionExpired = false;
    isAuthenticated = false;
    
    // İlk sürüm kontrolünü yap
    await checkForUpdates();

    // Her 6 saatte bir güncelleme kontrolü yap
    chrome.alarms.create('updateCheck', {
        periodInMinutes: 360 // 6 saat
    });
});

// Periyodik güncelleme kontrolü
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateCheck') {
        checkForUpdates();
    }
});

// Sistem hataları için listener
chrome.proxy.onProxyError.addListener(function(details) {
    console.error("Sistem hatası:", details);
}); 