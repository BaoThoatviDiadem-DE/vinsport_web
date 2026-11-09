require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const {
  SNSClient,
  CreateTopicCommand,
  SubscribeCommand,
  PublishCommand,
  ListSubscriptionsByTopicCommand,
} = require("@aws-sdk/client-sns");

const region = (process.env.AWS_REGION || "ap-southeast-1").trim();

const snsClient = new SNSClient({
  region,
});

async function main() {
  console.log("==================================================");
  console.log("       CẤU HÌNH & KIỂM TRA AMAZON SNS VINSPORT    ");
  console.log("==================================================");
  console.log(`- Khu vực AWS: ${region}`);

  // 1. Tạo hoặc lấy Topic
  console.log("\n1. Đang khởi tạo SNS Topic: vinsport-order-notifications...");
  let topicArn = "";
  try {
    const createTopicRes = await snsClient.send(
      new CreateTopicCommand({
        Name: "vinsport-order-notifications",
        Attributes: {
          DisplayName: "VinSport Notifications",
        },
      })
    );
    topicArn = createTopicRes.TopicArn;
    console.log(`✅ [THÀNH CÔNG] Topic ARN: ${topicArn}`);
  } catch (err) {
    console.error(`❌ [LỖI TẠO TOPIC]: ${err.message}`);
    if (err.message.includes("is not authorized")) {
      console.log("\n👉 HƯỚNG DẪN KHẮC PHỤC QUYỀN IAM:");
      console.log("1. Đăng nhập vào AWS Console -> Dịch vụ IAM (Identity and Access Management).");
      console.log("2. Vào mục Users -> Chọn User của bạn (vd: python-etl-bot).");
      console.log("3. Bấm 'Add permissions' -> 'Attach policies directly'.");
      console.log("4. Tìm và tích chọn: 'AmazonSNSFullAccess' -> Bấm 'Save changes'.");
      console.log("5. Sau đó chạy lại script này: node backend/scripts/setup_sns.js\n");
    }
    process.exit(1);
  }

  // 2. Đăng ký Email nếu có tham số
  const args = process.argv.slice(2);
  const emailIndex = args.indexOf("--email");
  const targetEmail = emailIndex !== -1 && args[emailIndex + 1] ? args[emailIndex + 1] : process.env.AWS_SNS_ADMIN_EMAIL;

  if (targetEmail) {
    console.log(`\n2. Đang đăng ký nhận thông báo cho email: ${targetEmail}...`);
    try {
      const subRes = await snsClient.send(
        new SubscribeCommand({
          TopicArn: topicArn,
          Protocol: "email",
          Endpoint: targetEmail,
        })
      );
      console.log(`✅ [THÀNH CÔNG] Đã gửi yêu cầu đăng ký tới: ${targetEmail}`);
      console.log("📬 LƯU Ý QUAN TRỌNG: AWS đã gửi 1 email có tiêu đề 'AWS Notification - Subscription Confirmation'.");
      console.log("   Vui lòng mở hộp thư email và bấm vào liên kết 'Confirm subscription' để bắt đầu nhận tin!");
    } catch (err) {
      console.error(`❌ [LỖI ĐĂNG KÝ EMAIL]: ${err.message}`);
    }
  } else {
    console.log("\n2. (Bỏ qua đăng ký email vì không truyền tham số --email <dia_chi_email>)");
  }

  // 3. Gửi thông báo test
  console.log("\n3. Đang gửi thử một thông báo kiểm tra (Test Notification)...");
  try {
    const pubRes = await snsClient.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: "[VinSport Test] Kiểm tra tích hợp Amazon SNS thành công",
        Message: `Xin chào Quản trị viên VinSport,

Hệ thống thông báo tự động qua Amazon SNS đã được kết nối thành công với website VinSport!

- Mã định danh Topic: ${topicArn}
- Thời gian kiểm tra: ${new Date().toLocaleString("vi-VN")}
- Trạng thái: Sẵn sàng gửi email khi có Đơn hàng mới, Hủy đơn hoặc Cập nhật trạng thái đơn hàng.

Trân trọng,
VinSport E-commerce Platform.`,
      })
    );
    console.log(`🎉 [THÀNH CÔNG] Đã phát thông báo thử nghiệm! Message ID: ${pubRes.MessageId}`);
  } catch (err) {
    console.error(`❌ [LỖI GỬI THÔNG BÁO]: ${err.message}`);
  }

  console.log("\n==================================================");
  console.log("HOÀN TẤT THIẾT LẬP AMAZON SNS CHO VINSPORT!");
  console.log("==================================================");
}

main().catch(console.error);

