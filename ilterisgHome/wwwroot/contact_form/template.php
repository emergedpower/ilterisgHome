<?php
ob_start();
?>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
            }
            .container {
                max-width: 650px;
                margin: 20px auto;
                padding: 25px;
                background-color: #ffffff;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }
            .header {
                font-size: 26px;
                color: #2c3e50;
                margin-bottom: 20px;
                text-align: center;
                border-bottom: 2px solid #3498db;
                padding-bottom: 10px;
            }
            .details {
                margin-bottom: 20px;
            }
            .details div {
                margin: 10px 0;
                font-size: 16px;
            }
            .details b {
                color: #2c3e50;
                display: inline-block;
                min-width: 100px;
            }
            .message-box {
                background-color: #f9f9f9;
                padding: 15px;
                border-left: 4px solid #3498db;
                border-radius: 5px;
                margin-top: 15px;
            }
            .footer {
                font-size: 12px;
                color: #777;
                text-align: center;
                margin-top: 25px;
                border-top: 1px solid #e0e0e0;
                padding-top: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><?php echo _subject_email; ?></div>
            <div class="details">
                <div><b>Ýsim:</b> <?php echo htmlspecialchars($values["name"]); ?></div>
                <div><b>E-posta:</b> <?php echo htmlspecialchars($values["email"]); ?></div>
                <?php if (!empty($values["phone"])): ?>
                    <div><b>Telefon:</b> <?php echo htmlspecialchars($values["phone"]); ?></div>
                <?php endif; ?>
                <?php if (!empty($values["message"])): ?>
                    <div class="message-box"><b>Mesaj:</b><br><?php echo nl2br(htmlspecialchars($values["message"])); ?></div>
                <?php endif; ?>
                <?php if (!empty($values["message_calculator"])): ?>
                    <div class="message-box"><b>Hesaplayýcý Mesajý:</b><br><?php echo nl2br(htmlspecialchars($values["message_calculator"])); ?></div>
                <?php endif; ?>
                <?php if (!empty($form_data)): ?>
                    <div><b>Form Verileri:</b><br><?php echo nl2br(htmlspecialchars($form_data)); ?></div>
                <?php endif; ?>
            </div>
            <div class="footer">
                <p>Bu e-posta otomatik olarak oluþturulmuþtur. Lütfen doðrudan yanýtlamayýnýz.</p>
                <p>Ýletiþim için: <a href="mailto:<?php echo _from_email; ?>"><?php echo _from_email; ?></a></p>
            </div>
        </div>
    </body>
</html>
<?php
$content = ob_get_contents();
ob_end_clean();
return $content;
?>