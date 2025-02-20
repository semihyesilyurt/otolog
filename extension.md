**PRD (Ürün Gereksinim Belgesi) - OTOLOG Chrome Eklentisi**  
**Sürüm:** 1.0  
**Hazırlayan:** [İsim]  
**Tarih:** [Tarih]  

---

### **1. Giriş**  
**Amaç:**  
OTOLOG Chrome eklentisi, kullanıcıların belirli domainlere (ör. partslink24.com) proxy üzerinden güvenli ve kimlik doğrulamalı erişim sağlamasını, abonelik durumunu yönetmesini ve otomatik güncellemeleri takip etmesini amaçlar.  

**Kapsam:**  
- Proxy tabanlı trafik yönlendirme.  
- Kullanıcı kimlik doğrulaması ve oturum yönetimi.  
- Abonelik süresi kontrolü ve uyarı sistemi.  
- Otomatik güncelleme bildirimleri.  
- Aktivite loglaması ve raporlama.  

---

### **2. Kullanıcı Hikayeleri**  
- **Kullanıcı (Teknisyen):**  
  - "Proxy üzerinden partslink24.com'a otomatik kimlik bilgilerimle erişmek istiyorum."  
  - "Aboneliğimin ne zaman sona ereceğini görmek istiyorum."  
- **Yönetici:**  
  - "Kullanıcıların aktivitelerini loglamak ve raporlamak istiyorum."  
  - "Abonelik süresi dolan kullanıcıların erişimini engellemek istiyorum."  
- **Geliştirici:**  
  - "Eklentinin yeni sürümlerini otomatik olarak kontrol etmek istiyorum."  

---

### **3. Fonksiyonel Gereksinimler**  
#### **3.1 Proxy Yönetimi**  
- **Domain Listesi:**  
  - partslink24.com, usercentrics.eu, go-mpulse.net, doubleclick.net, googletagmanager.com.  
- **Özellikler:**  
  - Proxy aktif/pasif durumu kullanıcı tarafından kontrol edilebilir.  
  - partslink24.com isteklerine otomatik kullanıcı emaili eklenir.  

#### **3.2 Kimlik Doğrulama ve Oturum Yönetimi**  
- **Giriş:**  
  - Şirket kodu, email ve şifre ile Supabase üzerinden kimlik doğrulama.  
  - "Beni Hatırla" seçeneği ile bilgilerin saklanması.  
- **Çıkış:**  
  - Oturum sonlandırıldığında proxy devre dışı bırakılır ve cookies temizlenir.  

#### **3.3 Abonelik Kontrolü**  
- **Zaman Tabanlı Kontrol:**  
  - Abonelik bitiş tarihi geçmişse proxy otomatik devre dışı kalır.  
  - Dashboard’da kalan gün ve paket bilgisi gösterilir.  

#### **3.4 Otomatik Güncelleme**  
- **XML Tabanlı Sürüm Kontrolü:**  
  - 6 saatte bir https://parcakatalog.com/updates/updates.xml kontrol edilir.  
  - Yeni sürüm varsa bildirim gösterilir ve tıklamayla güncelleme sayfasına yönlendirilir.  

#### **3.5 Loglama ve Raporlama**  
- **Log Türleri:**  
  - Proxy durumu değişiklikleri, oturum açma/kapama, hatalar.  
- **Veri Saklama:**  
  - Loglar Supabase tablosuna (user_logs) kaydedilir.  

---

### **4. Teknik Gereksinimler**  
#### **4.1 Teknolojiler**  
- **Frontend:** HTML, CSS, JavaScript (Chrome API).  
- **Backend:** Supabase (Auth, Database).  
- **Proxy:** Sabit IP (77.92.154.204:8887).  

#### **4.2 Entegrasyonlar**  
- **Supabase Tabloları:**  
  - `subscriptions`: Abonelik bilgileri.  
  - `user_logs`: Kullanıcı aktivite logları.  
  - `companies`: Şirket kodları.  
- **Harici API:**  
  - IP adresi alımı için api.ipify.org.  

#### **4.3 Güvenlik**  
- Tüm veri iletişimi HTTPS üzerinden şifrelenir.  
- Kullanıcı şifreleri Supabase Auth ile hash’lenir.  

---

### **5. Teknik Olmayan Gereksinimler**  
#### **5.1 Kullanıcı Arayüzü**  
- **Dashboard:**  
  - Abonelik bilgileri, aktif mod toggle, çıkış butonu.  
- **Login Sayfası:**  
  - Şirket kodu, email ve şifre alanları.  

#### **5.2 Performans**  
- Proxy geçişi 2 saniyeden uzun sürmemeli.  
- Güncelleme kontrolü arka planda çalışmalı.  

---

### **6. Zaman Çizelgesi ve Teslimatlar**  
| Aşama             | Süre (Hafta) | Durum       |  
|--------------------|--------------|-------------|  
| Proxy Yönetimi     | 2            | Tamamlandı  |  
| Kimlik Doğrulama   | 1            | Tamamlandı  |  
| Abonelik Kontrolü  | 1            | Tamamlandı  |  
| Loglama Sistemi    | 1            | Geliştirmede|  
| Test ve Optimizasyon| 2            | Planlanan   |  

---

### **7. Riskler ve Bağımlılıklar**  
- **Riskler:**  
  - Proxy sunucusunun kesintisi.  
  - Supabase tablolarında veri kaybı.  
- **Bağımlılıklar:**  
  - Supabase servislerinin sürekliliği.  
  - Harici API’lerin erişilebilirliği (api.ipify.org).  

---

**Onay:**  
[İsim/Tarih] (Ürün Yöneticisi)  
[İsim/Tarih] (Teknik Lider)