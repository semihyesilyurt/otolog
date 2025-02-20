let currentUser;
let subscriptionData;

// Mesaj kutusu için yardımcı fonksiyon
function showMessage(message, type = 'info') {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`;
}

// Abonelik kontrol fonksiyonu güncellendi: Supabase sorgusu yerine local veriye bakılıyor.
async function checkSubscription() {
    try {
        updateDashboard();
        const today = new Date();
        const endDate = new Date(subscriptionData.end_date);
        const isSubscriptionActive = today <= endDate;
        
        if (!isSubscriptionActive) {
            document.getElementById('subscriptionAlert').classList.remove('hidden');
            // Sistemi devre dışı bırak
            await chrome.runtime.sendMessage({ 
                action: "toggleProxy", 
                enable: false,
                forceDisable: true // Zorla devre dışı bırak
            });
            showMessage('Aboneliğiniz sona ermiştir!', 'error');
            
            // Aktif mod checkbox'ını işaretsiz yap ve devre dışı bırak
            const activeModeCheckbox = document.getElementById('activeMode');
            if (activeModeCheckbox) {
                activeModeCheckbox.checked = false;
                activeModeCheckbox.disabled = true;
            }
        } else {
            // Sistemi etkinleştir
            await chrome.runtime.sendMessage({ 
                action: "toggleProxy", 
                enable: true 
            });
            showMessage('Sistem aktif edildi', 'success');
        }
    } catch (error) {
        console.error('Abonelik kontrolü hatası:', error);
        showMessage('Abonelik bilgileri alınamadı', 'error');
    }
}

// Dashboard bilgilerini güncelle
function updateDashboard() {
    document.getElementById('userName').textContent = currentUser.user_metadata?.full_name || currentUser.email;
    document.getElementById('packageName').textContent = subscriptionData.package_name;
    
    const startDate = new Date(subscriptionData.start_date);
    const endDate = new Date(subscriptionData.end_date);
    const today = new Date();
    const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    document.getElementById('startDate').textContent = `Başlangıç: ${startDate.toLocaleDateString('tr-TR')}`;
    document.getElementById('daysLeft').textContent = `Kalan: ${daysLeft} gün`;
}

document.addEventListener('DOMContentLoaded', async () => {
    // chrome.storage'dan oturum bilgilerini al
    const stored = await chrome.storage.local.get(['sessionData']);
    if (!stored.sessionData) {
        window.location.href = 'popup.html';
        return;
    }
    
    currentUser = stored.sessionData.user;
    subscriptionData = stored.sessionData.subscription;
    
    // Background script'e oturum bilgilerini bildir
    await chrome.runtime.sendMessage({ 
        action: "setAuthStatus", 
        isAuthenticated: true,
        userEmail: currentUser.email
    });

    await checkSubscription();

    // Aktif mod durumunu kontrol et ve ayarla
    const activeModeCheckbox = document.getElementById('activeMode');
    const savedModeState = await chrome.storage.local.get(['activeModeState']);
    
    if (savedModeState.activeModeState !== undefined) {
        activeModeCheckbox.checked = savedModeState.activeModeState;
        // Sistem durumunu kayıtlı duruma göre ayarla
        await chrome.runtime.sendMessage({ 
            action: "toggleProxy",
            enable: savedModeState.activeModeState
        });
    }

    // Event Listeners
    activeModeCheckbox.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        
        const today = new Date();
        const endDate = new Date(subscriptionData.end_date);
        const isSubscriptionActive = today <= endDate;

        if (!isSubscriptionActive) {
            e.target.checked = false;
            showMessage('Aboneliğiniz sona erdiği için sistem aktif moda alınamaz', 'error');
            return;
        }

        // Yeni durumu kaydet
        await chrome.storage.local.set({ activeModeState: isChecked });

        await chrome.runtime.sendMessage({ 
            action: "toggleProxy",
            enable: isChecked
        });
        showMessage(isChecked ? 'Aktif mod açık' : 'Aktif mod kapalı');
    });

    document.getElementById('renewButton').addEventListener('click', () => {
        window.open('https://parcakatalog.com', '_blank');
    });

    document.getElementById('logoutButton').addEventListener('click', async () => {
        try {
            // Çıkış yapma olayını logla
            chrome.runtime.sendMessage({
                action: "logActivity",
                eventType: "user_logout",
                description: "Kullanıcı çıkış yaptı"
            });
            
            // Önce partslink24.com session ve cookie'lerini temizle
            const cookieRemovalPromises = [
                chrome.cookies.remove({
                    url: 'https://www.partslink24.com',
                    name: 'JSESSIONID'
                }),
                chrome.cookies.remove({
                    url: 'https://www.partslink24.com',
                    name: 'BIGipServerpartslink24_prod_pool'
                })
            ];
            
            await Promise.all(cookieRemovalPromises);

            // Oturum bilgilerini chrome storage'dan kaldır
            await chrome.storage.local.remove(['sessionData', 'activeModeState']);

            await chrome.runtime.sendMessage({ 
                action: "setAuthStatus", 
                isAuthenticated: false,
                userEmail: null
            });
            await chrome.runtime.sendMessage({ 
                action: "toggleProxy", 
                enable: false 
            });

            // "Beni Hatırla" durumu kontrolü
            const { rememberMe } = await chrome.storage.local.get(['rememberMe']);
            if (!rememberMe) {
                await chrome.storage.local.remove(['credentials']);
            }

            window.location.href = 'popup.html';
        } catch (error) {
            console.error('Çıkış yapılırken hata:', error);
            showMessage('Çıkış yapılırken bir hata oluştu', 'error');
        }
    });
}); 