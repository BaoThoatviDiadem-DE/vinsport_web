const AWS_REGION = process.env.AWS_REGION || "ap-southeast-1";
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const COGNITO_ENDPOINT = `https://cognito-idp.${AWS_REGION}.amazonaws.com/`;

/**
 * Gọi Amazon Cognito Identity Provider REST API
 */
async function callCognitoAPI(target, payload) {
  const response = await fetch(COGNITO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorType = (data.__type || "").split("#").pop();
    const errorMessage = data.message || data.Message || "Lỗi Cognito không xác định";

    // Dịch các lỗi phổ biến sang tiếng Việt dễ hiểu
    let friendlyMessage = errorMessage;
    if (errorType === "UsernameExistsException") {
      friendlyMessage = "Email này đã được đăng ký trên hệ thống.";
    } else if (errorType === "InvalidPasswordException") {
      friendlyMessage = "Mật khẩu không đạt yêu cầu bảo mật của Cognito (tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt).";
    } else if (errorType === "CodeMismatchException") {
      friendlyMessage = "Mã xác thực không chính xác, vui lòng kiểm tra lại.";
    } else if (errorType === "ExpiredCodeException") {
      friendlyMessage = "Mã xác thực đã hết hạn, vui lòng nhấn Gửi lại mã.";
    } else if (errorType === "UserNotConfirmedException") {
      friendlyMessage = "Tài khoản chưa được xác minh mã email.";
    } else if (errorType === "NotAuthorizedException") {
      friendlyMessage = "Email hoặc mật khẩu không chính xác.";
    } else if (errorType === "UserNotFoundException") {
      friendlyMessage = "Không tìm thấy tài khoản với email này.";
    } else if (errorType === "LimitExceededException" || errorType === "TooManyRequestsException") {
      friendlyMessage = "Bạn đã thử quá nhiều lần, vui lòng đợi một lát rồi thử lại.";
    } else if (errorType === "InvalidParameterException") {
      if (errorMessage.includes("User email should be empty or same as username")) {
        friendlyMessage = "Định dạng email không hợp lệ hoặc không đồng nhất ký tự hoa/thường.";
      } else if (errorMessage.includes("phone number")) {
        friendlyMessage = "Số điện thoại không đúng định dạng quốc tế (ví dụ: +84901234567).";
      }
    }

    const err = new Error(friendlyMessage);
    err.code = errorType;
    err.originalMessage = errorMessage;
    throw err;
  }

  return data;
}

/**
 * 1. Đăng ký tài khoản trực tiếp qua Cognito
 * Cognito sẽ tự động gửi mã OTP xác thực 6 số về Email
 */
async function cognitoSignUp({ email, password, name, phone }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const userAttributes = [
    // Giá trị email bắt buộc phải hoàn toàn trùng khớp với Username (cùng chữ thường)
    { Name: "email", Value: normalizedEmail },
  ];

  if (name && String(name).trim()) {
    userAttributes.push({ Name: "name", Value: String(name).trim() });
  }

  // Định dạng số điện thoại chuẩn E.164 (+84...) nếu có nhập
  if (phone && String(phone).trim()) {
    let cleanPhone = String(phone).trim().replace(/[\s.-]/g, "");
    if (cleanPhone) {
      if (!cleanPhone.startsWith("+")) {
        cleanPhone = cleanPhone.startsWith("0")
          ? "+84" + cleanPhone.slice(1)
          : "+84" + cleanPhone;
      }
      userAttributes.push({ Name: "phone_number", Value: cleanPhone });
    }
  }

  return await callCognitoAPI("SignUp", {
    ClientId: COGNITO_CLIENT_ID,
    Username: normalizedEmail,
    Password: password,
    UserAttributes: userAttributes,
  });
}

/**
 * 2. Xác nhận mã OTP do Cognito gửi về Email
 */
async function cognitoConfirmSignUp({ email, code }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return await callCognitoAPI("ConfirmSignUp", {
    ClientId: COGNITO_CLIENT_ID,
    Username: normalizedEmail,
    ConfirmationCode: String(code).trim(),
  });
}

/**
 * 3. Gửi lại mã xác nhận OTP
 */
async function cognitoResendCode({ email }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return await callCognitoAPI("ResendConfirmationCode", {
    ClientId: COGNITO_CLIENT_ID,
    Username: normalizedEmail,
  });
}

/**
 * 4. Đăng nhập trực tiếp bằng Email & Mật khẩu (USER_PASSWORD_AUTH)
 */
async function cognitoLoginDirect({ email, password }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return await callCognitoAPI("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: normalizedEmail,
      PASSWORD: password,
    },
  });
}

module.exports = {
  cognitoSignUp,
  cognitoConfirmSignUp,
  cognitoResendCode,
  cognitoLoginDirect,
};
