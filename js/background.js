const PROXY_HOST = "77.92.154.204";
const PROXY_PORT = 8887;


const proxyDomains = [
  "partslink24.com",
  "usercentrics.eu",
  "go-mpulse.net",
  "doubleclick.net",
  "googletagmanager.com",
];

let userEmail = null; // Kullanıcı email'ini saklamak için yeni değişken

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

// Eklenti aktif/pasif durumu kontrolü
let isEnabled = false;
let isSubscriptionExpired = false;
let isAuthenticated = false;

// Supabase yapılandırması
const SUPABASE_URL = 'https://vjdbbbgfnebdptyfmnkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZGJiYmdmbmViZHB0eWZtbmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1MzE4MzQsImV4cCI6MjA1MjEwNzgzNH0.67HlAfvqrg_Yua7jKbjt7YrT7PeLA9BjNKa6MIR0fWY';

// Log kaydetme fonksiyonu
function logUserActivity(eventType, description, requestDetails = null) {
    const logData = {
        user_id: null, // Dashboard'dan gönderilecek
        ip_address: null, // Dashboard'dan alınacak
        request: requestDetails,
        proxy: {
            address: `${PROXY_HOST}:${PROXY_PORT}`,
            status: isEnabled ? "connected" : "disconnected"
        },
        event: {
            type: eventType,
            description: description,
            timestamp: new Date().toISOString()
        },
        device: {
            browser: navigator.userAgent,
            device_type: "desktop"
        }
    };

    // Log verilerini dashboard'a gönder
    chrome.runtime.sendMessage({
        action: "saveLog",
        logData: logData
    });
}

// Test için güncelleme kontrolünü manuel tetikle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getProxyStatus") {
        sendResponse({ isEnabled });
    } else if (message.action === "setAuthStatus") {
        isAuthenticated = message.isAuthenticated;
        userEmail = message.userEmail; // Kullanıcı email'ini sakla
        if (!isAuthenticated) {
            isEnabled = false;
            userEmail = null; // Oturum kapandığında email'i temizle
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
        
        // Proxy durumu değişikliğini logla
        logUserActivity(
            "proxy_status_changed",
            `Proxy durumu ${message.enable ? 'aktif' : 'pasif'} olarak değiştirildi.`
        );
        
        sendResponse({ isEnabled });
    } else if (message.action === "testUpdate") {  // Yeni test fonksiyonu
        checkForUpdates();
        sendResponse({ success: true });
    }
    return true;
});

// Güncelleme kontrolünü test etmek için debug logları ekleyelim
async function checkForUpdates() {
    try {
        console.log('[UPDATE] Güncelleme kontrolü başlatıldı');
        const manifest = chrome.runtime.getManifest();
        const currentVersion = manifest.version;
        console.log('[UPDATE] Mevcut versiyon:', currentVersion);
        
        const response = await fetch('https://parcakatalog.com/updates/updates.xml', {
            method: 'GET',
            headers: {
                'Accept': 'application/xml'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const xmlText = await response.text();
        console.log('[UPDATE] XML içeriği:', xmlText);
        
        // XML'i regex ile parse et
        const versionMatch = xmlText.match(/version="([0-9]+\.[0-9]+\.[0-9]+)"/);
        const codebaseMatch = xmlText.match(/codebase="([^"]+)"/);
        
        if (!versionMatch || !codebaseMatch) {
            console.log('[UPDATE] Sürüm bilgisi bulunamadı');
            return;
        }
        
        const newVersion = versionMatch[1];
        const codebase = codebaseMatch[1];
        
        console.log('[UPDATE] Yeni versiyon:', newVersion);
        console.log('[UPDATE] Codebase:', codebase);
        
        // Sürümleri karşılaştır
        const updateAvailable = compareVersions(newVersion, currentVersion) > 0;
        console.log('[UPDATE] Güncelleme mevcut:', updateAvailable);

        if (updateAvailable) {
            // Yeni sürüm mevcut, bildirim göster
            chrome.notifications.create('update-available', {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('images/icon128.png'),
                title: 'OTOLOG Güncelleme',
                message: `Yeni sürüm (${newVersion}) mevcut. Güncellemek için tıklayın.`,
                requireInteraction: true
            });
        }
    } catch (error) {
        console.error('[UPDATE] Güncelleme kontrolü hatası:', error);
    }
}

// Sürüm karşılaştırma yardımcı fonksiyonu - daha sağlam hale getirildi
function compareVersions(v1, v2) {
    try {
        const v1Parts = v1.split('.').map(Number);
        const v2Parts = v2.split('.').map(Number);
        
        // Geçersiz sürüm numarası kontrolü
        if (v1Parts.some(isNaN) || v2Parts.some(isNaN)) {
            console.error('[UPDATE] Geçersiz sürüm numarası:', { v1, v2 });
            return 0;
        }
        
        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1Part = v1Parts[i] || 0;
            const v2Part = v2Parts[i] || 0;
            
            if (v1Part > v2Part) return 1;
            if (v1Part < v2Part) return -1;
        }
        return 0;
    } catch (error) {
        console.error('[UPDATE] Sürüm karşılaştırma hatası:', error);
        return 0;
    }
}

// Bildirim tıklama olayını dinle
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'update-available') {
        // Güncelleme sayfasını aç
        chrome.tabs.create({
            url: 'https://parcakatalog.com/updates/latest.html'
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

    // İlk güncelleme kontrolü
    await checkForUpdates();

    // Her 6 saatte bir güncelleme kontrolü
    setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
});

// Sistem hataları için listener
chrome.proxy.onProxyError.addListener(function(details) {
    console.error("Sistem hatası:", details);
});

// URL'leri değiştirmek için web request listener'ı ekle
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (isEnabled && userEmail && details.url.includes('partslink24.com')) {
            let url = new URL(details.url);
            url.searchParams.set('user_email', userEmail);
            return { redirectUrl: url.toString() };
        }
    },
    {
        urls: ["*://*.partslink24.com/*"]
    },
    ["blocking"]
); 