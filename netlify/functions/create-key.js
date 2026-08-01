const fetch = require('node-fetch');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "giabaotranle04112011"; // Đã điền sẵn Username của Bảo
const REPO_NAME = "getkey";              // Đã điền sẵn Repo Name
const FILE_PATH = "keys.json";

exports.handler = async (event, context) => {
    try {
        // 1. Tạo Key ngẫu nhiên
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const genChunk = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const newKey = `TLGB-${genChunk()}-${genChunk()}`;

        // 2. Lấy file keys.json từ GitHub
        const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const getRes = await fetch(getUrl, {
            headers: {
                "Authorization": `token ${GITHUB_TOKEN}`,
                "User-Agent": "Netlify-Key-Generator"
            }
        });

        if (!getRes.ok) {
            throw new Error("Không thể đọc file keys.json. Hãy chắc chắn đã tạo file keys.json trên GitHub!");
        }

        const fileData = await getRes.json();
        const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        let keyList = JSON.parse(currentContent);

        // 3. Thêm Key mới vào danh sách
        if (!keyList.includes(newKey)) {
            keyList.push(newKey);
        }

        // 4. Commit ghi đè file keys.json lên GitHub
        const updatedContentB64 = Buffer.from(JSON.stringify(keyList, null, 2)).toString('base64');
        const putRes = await fetch(getUrl, {
            method: "PUT",
            headers: {
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Content-Type": "application/json",
                "User-Agent": "Netlify-Key-Generator"
            },
            body: JSON.stringify({
                message: `🤖 Auto add key: ${newKey}`,
                content: updatedContentB64,
                sha: fileData.sha
            })
        });

        if (putRes.ok) {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, key: newKey })
            };
        } else {
            const errText = await putRes.text();
            throw new Error("Lỗi GitHub API: " + errText);
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
