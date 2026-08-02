const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "giabaotranle04112011";
const REPO_NAME = "getkey";
const FILE_PATH = "keys.json";

exports.handler = async (event, context) => {
    try {
        if (!GITHUB_TOKEN) {
            return {
                statusCode: 500,
                body: JSON.stringify({ success: false, error: "Chưa nhận được GITHUB_TOKEN trên Netlify!" })
            };
        }

        // 1. Tính toán mốc thời gian hết hạn (sau 24h = 86,400 giây)
        const now = Math.floor(Date.now() / 1000);
        const EXPIRE_IN_SECONDS = 24 * 60 * 60; // 86400s
        const expiresAt = now + EXPIRE_IN_SECONDS;

        // 2. Tạo Key ngẫu nhiên (dạng TLGB-XXXX-XXXX)
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const genChunk = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const newKey = `TLGB-${genChunk()}-${genChunk()}`;

        // 3. Tải file keys.json từ GitHub
        const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const getRes = await fetch(getUrl, {
            headers: {
                "Authorization": `token ${GITHUB_TOKEN}`,
                "User-Agent": "Netlify-Key-Generator",
                "Accept": "application/vnd.github.v3+json",
                "Cache-Control": "no-cache"
            }
        });

        if (!getRes.ok) {
            const errJson = await getRes.json().catch(() => ({}));
            throw new Error(`Lỗi đọc keys.json (${getRes.status}): ${errJson.message || 'Không kết nối được GitHub'}`);
        }

        const fileData = await getRes.json();
        const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        
        let keyMap = {};
        try {
            const parsed = JSON.parse(currentContent);
            
            // Tự động chuyển đổi dữ liệu cũ nếu file trên GitHub đang là Mảng []
            if (Array.isArray(parsed)) {
                parsed.forEach(k => {
                    if (typeof k === 'string') keyMap[k] = expiresAt;
                });
            } else if (typeof parsed === 'object' && parsed !== null) {
                keyMap = parsed;
            }
        } catch (e) {
            keyMap = {};
        }

        // 4. LỌC XÓA TỰ ĐỘNG: Xóa các Key đã quá hạn 24h khỏi CSDL
        Object.keys(keyMap).forEach(key => {
            if (typeof keyMap[key] === 'number' && keyMap[key] <= now) {
                delete keyMap[key];
            }
        });

        // 5. Thêm Key mới vào Object (Lưu mốc timestamp hết hạn 24h)
        keyMap[newKey] = expiresAt;

        // 6. Commit ghi đè file keys.json mới lên GitHub
        const updatedContentB64 = Buffer.from(JSON.stringify(keyMap, null, 2)).toString('base64');
        const putRes = await fetch(getUrl, {
            method: "PUT",
            headers: {
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Content-Type": "application/json",
                "User-Agent": "Netlify-Key-Generator",
                "Accept": "application/vnd.github.v3+json"
            },
            body: JSON.stringify({
                message: `🤖 Auto add key: ${newKey} (Expires in 24h)`,
                content: updatedContentB64,
                sha: fileData.sha
            })
        });

        if (putRes.ok) {
            // Định dạng ngày giờ chuẩn Việt Nam (UTC+7)
            const createdDateStr = new Date(now * 1000).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
            const expireDateStr = new Date(expiresAt * 1000).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: true, 
                    key: newKey,
                    createdAt: now,
                    expiresAt: expiresAt,
                    createdDate: createdDateStr,
                    expireDate: expireDateStr
                })
            };
        } else {
            const errText = await putRes.text();
            throw new Error("Lỗi ghi file GitHub: " + errText);
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
