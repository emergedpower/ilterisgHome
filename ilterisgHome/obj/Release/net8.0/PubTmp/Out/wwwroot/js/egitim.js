$(document).ready(function () {
    // SweetAlert ile bildirimleri göster
    const successMessage = $('#success-message').val();
    const errorMessage = $('#error-message').val();

    if (successMessage) {
        Swal.fire({
            icon: 'success',
            title: 'Başarılı!',
            text: successMessage,
            confirmButtonText: 'Tamam'
        });
    }

    if (errorMessage) {
        Swal.fire({
            icon: 'error',
            title: 'Hata!',
            text: errorMessage,
            confirmButtonText: 'Tamam'
        });
    }
});