<?php
// Kime gideceği (alan kişi) – site sahibinin veya destek mailinin adresi olabilir
define('_to_name', 'REMOKRAT');
define('_to_email', 'info@remokrat.com');

// Kimden gönderileceği (gönderici)
define('_from_name', 'ILTERISG'); // C# SmtpConfig'tan gelen FromName
define('_from_email', 'support@ilterisg.com'); // C# SmtpConfig'tan gelen FromEmail

// SMTP ayarları (C# SmtpConfig'tan gelen bilgilerle güncellendi)
define('_smtp_host', 'mail.kurumsaleposta.com'); // C# SmtpConfig.Host
define('_smtp_username', 'support@ilterisg.com'); // C# SmtpConfig.Username
define('_smtp_password', 'FZr..q1w2e3r4'); // C# SmtpConfig.Password
define('_smtp_port', '587'); // C# SmtpConfig.Port
// Güvenlik (C# SmtpConfig.EnableSsl = false olduğu için "none" olarak bırakıldı)
define('_smtp_secure', 'none'); // C# SmtpConfig.EnableSsl = false

// E-postanın konu satırı
define('_subject_email', 'FinPeak: Contact from WWW');

// Form validation ve geribildirim mesajları
define('_msg_invalid_data_name', 'Lütfen geçerli bir isim girin.');
define('_msg_invalid_data_email', 'Lütfen geçerli bir e-posta adresi girin.');
define('_msg_invalid_data_phone', 'Lütfen geçerli bir telefon numarası girin.'); // "e-posta adresi" yerine "telefon numarası" yaptım, mantıksal hata düzeltildi
define('_msg_invalid_data_subject', 'Lütfen konu seçin.');
define('_msg_invalid_data_message', 'Lütfen mesajı yazın.');

define('_msg_send_ok', 'Bizimle iletişime geçtiğiniz için teşekkürler. En kısa sürede iletişime geçeceğiz');
define('_msg_send_error', 'Sorry, we can\'t send this message.');
?>