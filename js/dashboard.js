const SUPABASE_URL = 'https://vjdbbbgfnebdptyfmnkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZGJiYmdmbmViZHB0eWZtbmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1MzE4MzQsImV4cCI6MjA1MjEwNzgzNH0.67HlAfvqrg_Yua7jKbjt7YrT7PeLA9BjNKa6MIR0fWY';

let supabaseClient;
let currentUser;
let subscriptionData;

// Mesaj kutusu için yardımcı fonksiyon
function showMessage(message, type = 'info') {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`;
}

// Abonelik durumunu kontrol et
async function checkSubscription() {
    try {
        const { data, error } = await supabaseClient
            .from('subscriptions')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (error) throw error;

        subscriptionData = data;
        updateDashboard();

        // Abonelik kontrolü ve proxy yönetimi
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
    document.getElementById('userName').textContent = currentUser.user_metadata.full_name || currentUser.email;
    document.getElementById('packageName').textContent = subscriptionData.package_name;
    
    const startDate = new Date(subscriptionData.start_date);
    const endDate = new Date(subscriptionData.end_date);
    const today = new Date();
    const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    document.getElementById('startDate').textContent = `Başlangıç: ${startDate.toLocaleDateString('tr-TR')}`;
    document.getElementById('daysLeft').textContent = `Kalan: ${daysLeft} gün`;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Oturum kontrolü
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) {
            window.location.href = 'popup.html';
            return;
        }

        currentUser = session.user;
        await checkSubscription();

        // Event Listeners
        document.getElementById('activeMode').addEventListener('change', async (e) => {
            const isChecked = e.target.checked;
            
            // Abonelik durumunu kontrol et
            const today = new Date();
            const endDate = new Date(subscriptionData.end_date);
            const isSubscriptionActive = today <= endDate;

            if (!isSubscriptionActive) {
                e.target.checked = false; // Checkbox'ı işaretsiz tut
                showMessage('Aboneliğiniz sona erdiği için sistem aktif moda alınamaz', 'error');
                return;
            }

            await chrome.runtime.sendMessage({ 
                action: "toggleProxy",
                enable: isChecked
            });
            showMessage(isChecked ? 'Aktif mod açık' : 'Aktif mod kapalı');
        });

        document.getElementById('renewButton').addEventListener('click', () => {
            window.open('https://odecem.com', '_blank');
        });

        document.getElementById('logoutButton').addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            await chrome.runtime.sendMessage({ 
                action: "setAuthStatus", 
                isAuthenticated: false 
            });
            await chrome.runtime.sendMessage({ action: "toggleProxy", enable: false });
            window.location.href = 'popup.html';
        });

    } catch (error) {
        console.error('Dashboard yükleme hatası:', error);
        showMessage('Bir hata oluştu', 'error');
    }
}); 