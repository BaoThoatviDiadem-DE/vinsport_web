const {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand,
} = require("@aws-sdk/client-sqs");

const { uploadOrderToS3 } = require("./s3Service");
const { sendOrderEmail } = require("./emailService");
const { sendTechnicalAlert } = require("./snsService");

// Cấu hình SQS Client sử dụng thông tin AWS IAM từ file .env
const sqsClient = new SQSClient({
  region: (process.env.AWS_REGION || "ap-southeast-1").trim(),
});

const QUEUE_NAME = (process.env.AWS_SQS_QUEUE_NAME || "vinsport-order-queue").trim();

let cachedQueueUrl = null;
let isWorkerRunning = false;
let shouldStopWorker = false;
let sqsAccessDeniedNotified = false;

/**
 * Lấy hoặc tự động tạo SQS Queue vinsport-order-queue
 */
async function getOrCreateQueueUrl() {
  if (cachedQueueUrl) return cachedQueueUrl;

  const res = await sqsClient.send(
    new GetQueueUrlCommand({
      QueueName: QUEUE_NAME,
    })
  );

  cachedQueueUrl = res.QueueUrl;
  console.log(`[AWS SQS] Connected to existing Queue: ${cachedQueueUrl}`);

  return cachedQueueUrl;
}
/**
 * Xử lý tác vụ đơn hàng (Gửi email khách hàng + Đồng bộ S3 Data Lakehouse)
 */
async function executeOrderJob({ orderId, actionType }) {
  console.log(`[Worker Pipeline] Bắt đầu xử lý đơn hàng #${orderId} (${actionType})...`);
  
  // 1. Đồng bộ sang Amazon S3
  try {
    await uploadOrderToS3(orderId);
  } catch (s3Err) {
    console.error(`[Worker Pipeline] Lỗi sao lưu S3 cho đơn #${orderId}:`, s3Err.message);
  }

  // 2. Gửi email xác nhận HTML qua Gmail SMTP
  try {
    await sendOrderEmail(orderId, actionType);
  } catch (emailErr) {
    console.error(`[Worker Pipeline] Lỗi gửi email cho đơn #${orderId}:`, emailErr.message);
  }
}

/**
 * Đẩy một sự kiện đơn hàng vào hàng đợi AWS SQS (Producer)
 * @param {number|string} orderId - Mã đơn hàng
 * @param {"NEW_ORDER"|"STATUS_UPDATED"|"CANCELLED"} actionType - Loại sự kiện
 */
async function sendOrderToQueue(orderId, actionType = "NEW_ORDER") {
  const numericOrderId = Number(orderId);
  if (!numericOrderId) return;

  const payload = {
    orderId: numericOrderId,
    actionType,
    timestamp: new Date().toISOString(),
  };

  try {
    const queueUrl = await getOrCreateQueueUrl();
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(payload),
      MessageAttributes: {
        ActionType: {
          DataType: "String",
          StringValue: actionType,
        },
        OrderId: {
          DataType: "Number",
          StringValue: String(numericOrderId),
        },
      },
    });

    const res = await sqsClient.send(command);
    console.log(
      `[AWS SQS Producer] Đã đưa đơn #${numericOrderId} (${actionType}) vào Queue thành công. (MessageId: ${res.MessageId})`
    );
    return res.MessageId;
  } catch (err) {
    console.warn(`[AWS SQS Producer] Không thể đưa vào SQS: ${err.message}`);

    // Cơ chế Fallback dự phòng: Nếu IAM user chưa được cấp quyền SQS,
    // xử lý ngầm (Local Background Fallback) ngay lập tức để hệ thống KHÔNG BAO GIỜ bị gián đoạn đơn hàng!
    console.log(`[AWS SQS Fallback] Chuyển đơn #${numericOrderId} sang xử lý ngầm trực tiếp.`);
    setImmediate(async () => {
      try {
        await executeOrderJob(payload);
      } catch (fallbackErr) {
        console.error(`[AWS SQS Fallback Error]`, fallbackErr);
      }
    });

    if (err.name === "AccessDenied" && !sqsAccessDeniedNotified) {
      sqsAccessDeniedNotified = true;
      console.warn(
        "==> [LƯU Ý QUAN TRỌNG]: IAM User 'python-etl-bot' chưa được gán quyền 'AmazonSQSFullAccess'. Vui lòng gán policy này trên AWS IAM Console để SQS hoạt động 100%!"
      );
    }
  }
}

/**
 * Lắng nghe và tiêu thụ message từ hàng đợi AWS SQS (Consumer / Background Worker)
 * Sử dụng kỹ thuật Long Polling (WaitTimeSeconds: 20) để tối ưu chi phí (hoàn toàn miễn phí)
 */
async function startOrderWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  shouldStopWorker = false;

  console.log(`[AWS SQS Worker] Đang khởi động worker lắng nghe hàng đợi '${QUEUE_NAME}'...`);

  // Vòng lặp lắng nghe liên tục trong background
  (async () => {
    while (!shouldStopWorker) {
      try {
        const queueUrl = await getOrCreateQueueUrl();

        const receiveCmd = new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 20, // Long polling 20s (chuẩn AWS, giảm số lượng request xuống mức tối thiểu)
          VisibilityTimeout: 60,
        });

        const res = await sqsClient.send(receiveCmd);

        if (res.Messages && res.Messages.length > 0) {
          console.log(`[AWS SQS Worker] Nhận được ${res.Messages.length} message từ queue.`);

          for (const msg of res.Messages) {
            try {
              const body = JSON.parse(msg.Body || "{}");
              const { orderId, actionType } = body;

              if (orderId) {
                // Xử lý gửi mail và backup S3
                await executeOrderJob({ orderId, actionType: actionType || "NEW_ORDER" });
              }

              // Xử lý thành công -> Xóa message khỏi hàng đợi
              await sqsClient.send(
                new DeleteMessageCommand({
                  QueueUrl: queueUrl,
                  ReceiptHandle: msg.ReceiptHandle,
                })
              );
              console.log(`[AWS SQS Worker] Đã hoàn tất và xóa Message ${msg.MessageId} khỏi queue.`);
            } catch (msgErr) {
              console.error(`[AWS SQS Worker] Lỗi xử lý message ${msg.MessageId}:`, msgErr.message);
              // Không xóa message để SQS tự động retry khi hết VisibilityTimeout
              sendTechnicalAlert({
                level: "HIGH",
                title: `Lỗi xử lý SQS Message (${msg.MessageId})`,
                message: `Worker gặp sự cố khi xử lý message từ SQS: ${msgErr.message}`,
                error: msgErr,
              });
            }
          }
        }
      } catch (err) {
        if (err.name === "AccessDenied") {
          if (!sqsAccessDeniedNotified) {
            sqsAccessDeniedNotified = true;
            console.warn(
              "[AWS SQS Worker] Chưa có quyền truy cập SQS (AccessDenied). Đang tạm dừng 30 giây trước khi thử lại..."
            );
          }
          // Chờ 30 giây để tránh spam log liên tục khi chưa cấp quyền IAM
          await new Promise((resolve) => setTimeout(resolve, 30000));
        } else {
          console.warn(`[AWS SQS Worker Polling Error] ${err.message}. Thử lại sau 10s...`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      }
    }
    isWorkerRunning = false;
    console.log("[AWS SQS Worker] Worker đã dừng.");
  })();
}

function stopOrderWorker() {
  shouldStopWorker = true;
}

module.exports = {
  sqsClient,
  QUEUE_NAME,
  sendOrderToQueue,
  startOrderWorker,
  stopOrderWorker,
  getOrCreateQueueUrl,
};

