const {
  LambdaClient,
  InvokeCommand,
  ListFunctionsCommand,
} = require("@aws-sdk/client-lambda");
const { getVoucherByCode } = require("./dynamoService");

// Tên hàm Lambda mặc định
const LAMBDA_FUNCTION_NAME =
  process.env.AWS_LAMBDA_FUNCTION_NAME || "vinsport-serverless-engine";
const AWS_REGION = process.env.AWS_REGION || "ap-southeast-1";

// Khởi tạo client Lambda
let lambdaClient = null;

function getLambdaClient() {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({
      region: AWS_REGION,
    });
  }
  return lambdaClient;
}

// Local Serverless Fallback Handler (đảm bảo dự án luôn chạy 100% không bao giờ gián đoạn)
let localHandlerCache = null;
function getLocalHandler() {
  if (!localHandlerCache) {
    try {
      const lambdaModule = require("../../lambda/index.js");
      localHandlerCache = lambdaModule.handler;
    } catch (e) {
      console.warn("[Lambda Local Fallback] Không thể nạp lambda/index.js:", e.message);
    }
  }
  return localHandlerCache;
}

/**
 * Gọi hàm Serverless Engine (Ưu tiên AWS Lambda Cloud -> Dự phòng Local Serverless Engine)
 */
async function invokeServerlessEngine(action, payload = {}) {
  const client = getLambdaClient();
  const eventPayload = {
    action,
    ...payload,
    invokedFrom: "VinSport-Backend-Express",
    timestamp: new Date().toISOString(),
  };

  // 1. Thử gọi trực tiếp lên AWS Lambda Cloud nếu có cấu hình
  if (client) {
    try {
      const command = new InvokeCommand({
        FunctionName: LAMBDA_FUNCTION_NAME,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(JSON.stringify(eventPayload)),
      });

      const startTime = Date.now();
      const response = await client.send(command);
      const executionTime = Date.now() - startTime;

      if (response.Payload) {
        const rawString = Buffer.from(response.Payload).toString("utf-8");
        const parsed = JSON.parse(rawString);

        // Chuẩn hóa payload trả về từ Lambda (xử lý cả dạng API Gateway response hoặc raw JSON)
        let responseData = parsed;
        if (parsed.body) {
          try {
            responseData = typeof parsed.body === "string" ? JSON.parse(parsed.body) : parsed.body;
          } catch (_) {}
        }

        console.log(
          `[AWS LAMBDA CLOUD] Đã gọi thành công "${LAMBDA_FUNCTION_NAME}" (Action: ${action}) trong ${executionTime}ms`
        );

        return {
          ...responseData,
          cloudProvider: "Amazon Web Services (AWS Lambda)",
          functionName: LAMBDA_FUNCTION_NAME,
          region: AWS_REGION,
          statusCode: response.StatusCode || 200,
          isCloud: true,
        };
      }
    } catch (awsError) {
      console.warn(
        `[AWS LAMBDA CLOUD INFO] Chưa thể gọi trực tiếp lên AWS (${awsError.name}: ${awsError.message}). Tự động kích hoạt Local Serverless Engine fallback.`
      );
    }
  }

  // 2. Dự phòng: Chạy qua Local Serverless Handler với logic hoàn toàn giống hệt
  const localHandler = getLocalHandler();
  if (localHandler) {
    try {
      const localResponse = await localHandler(eventPayload, {});
      let responseData = localResponse;
      if (localResponse.body) {
        try {
          responseData = typeof localResponse.body === "string" ? JSON.parse(localResponse.body) : localResponse.body;
        } catch (_) {}
      }

      return {
        ...responseData,
        cloudProvider: "VinSport Serverless Engine (Local Simulation)",
        functionName: `${LAMBDA_FUNCTION_NAME} (Local)`,
        region: AWS_REGION,
        statusCode: localResponse.statusCode || 200,
        isCloud: false,
      };
    } catch (localErr) {
      console.error("[Local Serverless Handler Error]:", localErr);
      throw localErr;
    }
  }

  throw new Error("Không thể thực thi hàm Serverless");
}

/**
 * 1. Tính toán khuyến mãi, voucher và miễn phí vận chuyển qua Serverless
 */
async function calculatePromotion({ voucherCode, subtotal, items = [], userId }) {
  let dynamicVoucher = null;
  if (voucherCode) {
    try {
      dynamicVoucher = await getVoucherByCode(voucherCode);
    } catch (_) {}
  }

  return await invokeServerlessEngine("CALCULATE_PROMOTION", {
    voucherCode,
    subtotal: Number(subtotal) || 0,
    items,
    userId,
    dynamicVoucher,
  });
}

/**
 * 2. Xác thực và kiểm tra chống gian lận đơn hàng qua Serverless
 */
async function processOrderServerless(orderData) {
  return await invokeServerlessEngine("PROCESS_ORDER", {
    orderData,
  });
}

/**
 * 3. Đề xuất phụ kiện & sản phẩm liên quan thông minh qua Serverless
 */
async function getSmartRecommendations({ category, brand, currentProductId }) {
  return await invokeServerlessEngine("SMART_RECOMMENDATIONS", {
    category,
    brand,
    currentProductId,
  });
}

/**
 * 4. Kiểm tra sức khỏe kết nối AWS Lambda
 */
async function checkLambdaHealth() {
  const client = getLambdaClient();
  let cloudFunctions = [];
  let isAwsConnected = false;

  try {
    const listRes = await client.send(
      new ListFunctionsCommand({ MaxItems: 10 })
    );

    isAwsConnected = true;
    cloudFunctions = (listRes.Functions || []).map((f) => ({
      functionName: f.FunctionName,
      runtime: f.Runtime,
      handler: f.Handler,
      lastModified: f.LastModified,
      codeSize: f.CodeSize,
    }));
  } catch (e) {
    console.warn("[AWS Lambda ListFunctions check]:", e.message);
  }

  const pingResult = await invokeServerlessEngine("SYSTEM_PING");

  return {
    isAwsConnected,
    targetFunctionName: LAMBDA_FUNCTION_NAME,
    region: AWS_REGION,
    cloudFunctions,
    pingResult,
  };
}
module.exports = {
  calculatePromotion,
  processOrderServerless,
  getSmartRecommendations,
  checkLambdaHealth,
  LAMBDA_FUNCTION_NAME,
};

