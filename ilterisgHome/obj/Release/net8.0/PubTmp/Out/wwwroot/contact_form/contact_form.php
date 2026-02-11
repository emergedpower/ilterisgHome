<?php
error_reporting(E_ALL & ~E_NOTICE);
require_once("config.php");
function map_deep($value, $callback)
{
    if(is_array($value))
	{
        foreach($value as $index => $item)
		{
            $value[$index] = map_deep($item, $callback);
        }
    }
	elseif(is_object($value))
	{
        $object_vars = get_object_vars($value);
        foreach($object_vars as $property_name => $property_value)
		{
            $value->$property_name = map_deep($property_value, $callback);
        }
    }
	else
	{
        $value = call_user_func($callback, $value);
    }
    return $value;
}
function stripslashes_deep($value)
{
    return map_deep($value, 'stripslashes_from_strings_only');
}
function stripslashes_from_strings_only($value)
{
    return is_string($value) ? stripslashes($value) : $value;
}
function fp_stripslashes_deep($value)
{
	$value = is_array($value) ?
				array_map('stripslashes_deep', $value) :
				stripslashes($value);

	return $value;
}
if(isset($_POST["action"]) && $_POST["action"]=="contact_form")
{
	ob_start();
	//contact form
	require_once("../phpMailer/src/Exception.php");
	require_once("../phpMailer/src/PHPMailer.php");
	require_once("../phpMailer/src/SMTP.php");		   
	$result = array();
	$result["isOk"] = true;
	if(((isset($_POST["name_required"]) && (int)$_POST["name_required"] && $_POST["name"]!="") || (!isset($_POST["name_required"]) || !(int)$_POST["name_required"])) && ((isset($_POST["email_required"]) && (int)$_POST["email_required"] && $_POST["email"]!="" && preg_match("#^[_a-zA-Z0-9-]+(\.[_a-zA-Z0-9-]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(\.[a-zA-Z]{2,12})$#", $_POST["email"])) || (!isset($_POST["email_required"]) || !(int)$_POST["email_required"])) && ((isset($_POST["phone_required"]) && (int)$_POST["phone_required"] && $_POST["phone"]!="") || (!isset($_POST["phone_required"]) || !(int)$_POST["phone_required"])) && ((isset($_POST["message_required"]) && (int)$_POST["message_required"] && $_POST["message"]!="") || (!isset($_POST["message_required"]) || !(int)$_POST["message_required"])))
	{
		$values = array(
			"name" => isset($_POST["name"]) ? $_POST["name"] : "",
			"email" => isset($_POST["email"]) ? $_POST["email"] : "",
			"phone" => isset($_POST["phone"]) ? $_POST["phone"] : "",
			"subject" => isset($_POST["subject"]) ? $_POST["subject"] : "",
			"message" => isset($_POST["message"]) ? $_POST["message"] : "",
			"message_calculator" => isset($_POST["message_calculator"]) ? $_POST["message_calculator"] : ""
		);
		$values = fp_stripslashes_deep($values);
		$values = array_map("htmlspecialchars", $values);
		
		$form_data = "";
		foreach($_POST as $key=>$value)
		{
			if(array_key_exists($key . "-label", $_POST))
			{
				if(array_key_exists($key . "-name", $_POST))
				{
					if($value!="")
						$form_data .= "<br>" . $_POST[$key . "-label"] . " " . $_POST[$key . "-name"] . " (" . $value . ")";
				}
				else
				{
					if($value!="")
						$form_data .= "<br>" . $_POST[$key . "-label"] . " " . $value;
				}
			}
		}
		foreach($_POST as $key=>$value)
		{
			if(array_key_exists($key . "-summarylabel", $_POST) && !empty($_POST[$key . "-summarylabel"]))
			{
				$form_data .= "<b>" . $_POST[$key . "-summarylabel"] . "</b><b>" . $value . "</b>";
			}
		}
		if(!empty($_POST["final-service-cost-hidden"]))
			$form_data .= "<br>Total cost: " . $_POST["final-service-cost-hidden"];

		$mail=new PHPMailer\PHPMailer\PHPMailer();

		$mail->CharSet='UTF-8';

		$mail->SetFrom((!empty(_from_email)? _from_email : _to_email), (!empty(_from_name)? _from_name : _to_name));
		$mail->AddAddress(_to_email, _to_name);
		$mail->AddReplyTo($values["email"], $values["name"]);

		$smtp=_smtp_host;
		if(!empty($smtp))
		{
			$mail->IsSMTP();
			$mail->SMTPAuth = true; 
			//$mail->SMTPDebug  = 2;
			$mail->Host = _smtp_host;
			$mail->Username = _smtp_username;
			$mail->Password = _smtp_password;
			if((int)_smtp_port>0)
				$mail->Port = (int)_smtp_port;
			$mail->SMTPSecure = _smtp_secure;
		}

		$mail->Subject = (isset($values["subject"]) && $values["subject"]!="" && $values["subject"]!=_subject_email ? $values["subject"] : _subject_email);
		$mail->MsgHTML(include("../contact_form/template.php"));
		//print_r($mail->Body);
		if($mail->Send())
			$result["submit_message"] = _msg_send_ok;
		else
		{
			$result["isOk"] = false;
			$result["submit_message"] = _msg_send_error . (isset($mail->ErrorInfo) ? " " . $mail->ErrorInfo : "");
		}
	}
	else
	{
		$result["isOk"] = false;
		if(isset($_POST["name_required"]) && (int)$_POST["name_required"] && $_POST["name"]=="")
			$result["error_name"] = _msg_invalid_data_name;
		if(isset($_POST["email_required"]) && (int)$_POST["email_required"] && ($_POST["email"]=="" || !preg_match("#^[_a-zA-Z0-9-]+(\.[_a-zA-Z0-9-]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(\.[a-zA-Z]{2,12})$#", $_POST["email"])))
			$result["error_email"] = _msg_invalid_data_email;
		if(isset($_POST["phone_required"]) && (int)$_POST["phone_required"] && $_POST["phone"]=="")
			$result["error_phone"] = _msg_invalid_data_phone;
		if(isset($_POST["subject_required"]) && (int)$_POST["subject_required"] && $_POST["subject"]=="")
			$result["error_subject"] = _msg_invalid_data_subject;
		if(isset($_POST["message_required"]) && (int)$_POST["message_required"] && $_POST["message"]=="")
			$result["error_message"] = _msg_invalid_data_message;
	}
	$system_message = ob_get_clean();
	$result["system_message"] = $system_message;
	echo @json_encode($result);
	exit();
}
?>